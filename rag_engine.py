import gc
import os
import shutil
import requests
from typing import Callable, Dict, Generator, List, Optional, Tuple
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Set offline mode for local cached HuggingFace embeddings to prevent network lookup timeouts
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["USER_AGENT"] = "SmartMate/2.0"

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

DEFAULT_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma-db")

AVAILABLE_MODELS = [
    {
        "id": "openai/gpt-oss-120b",
        "name": "GPT-OSS 120B",
        "provider": "Groq",
        "badge": "Balanced",
        "description": "High-reasoning flagship model for deep document synthesis",
    },
    {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B",
        "provider": "Groq",
        "badge": "Versatile",
        "description": "Strong analytical accuracy across complex multi-page texts",
    },
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B",
        "provider": "Groq",
        "badge": "Ultra-Fast",
        "description": "Sub-second latency for rapid Q&A and extraction",
    },
]

# Singleton cached embedding model
_EMBEDDING_MODEL: Optional[HuggingFaceEmbeddings] = None


def get_embedding_model() -> HuggingFaceEmbeddings:
    """
    Returns the reliable local HuggingFace embedding model (BAAI/bge-small-en-v1.5).
    Runs 100% locally on CPU/GPU with zero rate limits, zero quota errors, and zero API costs.
    """
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        _EMBEDDING_MODEL = HuggingFaceEmbeddings(
            model_name="BAAI/bge-small-en-v1.5",
            encode_kwargs={"batch_size": 64},
        )
    return _EMBEDDING_MODEL


def warm_embedding_model() -> bool:
    """Pre-loads the local embedding model into memory so initial uploads are faster."""
    get_embedding_model()
    return True


def clear_vector_store(persist_directory: Optional[str] = DEFAULT_DB_DIR) -> None:
    """
    Completely deletes and cleans up the existing vector store collection
    and files to conserve storage and prevent topic bleed across uploads.
    """
    if not persist_directory:
        persist_directory = DEFAULT_DB_DIR

    if persist_directory and os.path.exists(persist_directory):
        try:
            emb = get_embedding_model()
            temp_db = Chroma(persist_directory=persist_directory, embedding_function=emb)
            temp_db.delete_collection()
            del temp_db
        except Exception:
            pass

        gc.collect()
        try:
            shutil.rmtree(persist_directory, ignore_errors=True)
        except Exception as e:
            print(f"Directory cleanup warning: {e}")


def load_documents_from_file(file_path: str, original_filename: str = "") -> List[Document]:
    """Loads documents from PDF, plain text, or Markdown files with clean source metadata."""
    ext = os.path.splitext(file_path)[1].lower()
    display_name = original_filename or os.path.basename(file_path)

    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        for doc in docs:
            doc.metadata["source"] = display_name
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        docs = [Document(page_content=content, metadata={"source": display_name})]
    return docs


def load_documents_from_url(url: str) -> List[Document]:
    """Loads and extracts readable content from a given website URL with BeautifulSoup fallback."""
    try:
        loader = WebBaseLoader(url)
        docs = loader.load()
        if docs and docs[0].page_content.strip():
            for doc in docs:
                doc.metadata.setdefault("source", url)
            return docs
    except Exception:
        pass

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    title = soup.title.string.strip() if soup.title and soup.title.string else url
    return [Document(page_content=text, metadata={"source": title or url, "url": url})]


def load_documents_from_text(text: str, source_label: str = "Direct Notes") -> List[Document]:
    """Wraps raw user-entered text into a Document."""
    return [Document(page_content=text, metadata={"source": source_label})]


def split_documents(
    docs: List[Document],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[Document]:
    """Splits documents into clean, indexed chunks with enriched metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(docs)
    clean_chunks = [c for c in chunks if c.page_content and c.page_content.strip()]

    for idx, chunk in enumerate(clean_chunks):
        chunk.metadata["chunk_index"] = idx + 1
        chunk.metadata["char_count"] = len(chunk.page_content)

    return clean_chunks


def build_vector_store_detailed(
    docs: List[Document],
    persist_directory: Optional[str] = DEFAULT_DB_DIR,
    progress_callback: Optional[Callable[[str, str, int], None]] = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> Tuple[Chroma, List[Document]]:
    """
    Purges existing vector database, splits new documents into chunks,
    generates local embeddings in batches with real-time progress callbacks,
    and returns both the Chroma vector store and indexed chunks.
    """
    if not persist_directory:
        persist_directory = DEFAULT_DB_DIR

    def report(stage: str, message: str, percent: int) -> None:
        if progress_callback:
            progress_callback(stage, message, percent)

    report("purge", "Purging previous vector index to guarantee zero topic bleed...", 15)
    clear_vector_store(persist_directory)

    report("chunk", f"Splitting document into {chunk_size}-char overlapping chunks...", 30)
    chunks = split_documents(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    if not chunks:
        raise ValueError("No readable text could be extracted from the provided source.")

    report("embed", f"Initializing local embedding engine (BAAI/bge-small-en-v1.5) for {len(chunks)} chunks...", 40)
    emb = get_embedding_model()

    # Batch ingestion so large books/PDFs report live granular embedding progress
    batch_size = 64
    total_chunks = len(chunks)
    vector_store = Chroma(
        persist_directory=persist_directory,
        embedding_function=emb,
    )

    for start in range(0, total_chunks, batch_size):
        end = min(start + batch_size, total_chunks)
        batch = chunks[start:end]
        vector_store.add_documents(batch)

        pct = 40 + int((end / total_chunks) * 48)  # maps 40% -> 88%
        report("embed", f"Embedded {end} of {total_chunks} chunks locally...", pct)

    return vector_store, chunks


def build_vector_store(
    docs: List[Document],
    persist_directory: Optional[str] = DEFAULT_DB_DIR,
) -> Tuple[Chroma, int]:
    """
    Backward-compatible wrapper returning (vector_store, chunk_count).
    """
    vector_store, chunks = build_vector_store_detailed(docs, persist_directory=persist_directory)
    return vector_store, len(chunks)


def get_retriever(vector_store: Chroma, k: int = 4, fetch_k: int = 12, lambda_mult: float = 0.5):
    """Returns the Maximal Marginal Relevance (MMR) retriever for diverse, non-redundant context."""
    effective_fetch_k = max(fetch_k, k * 2)
    return vector_store.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": k,
            "fetch_k": effective_fetch_k,
            "lambda_mult": lambda_mult,
        },
    )


def generate_document_summary(docs: List[Document], model_name: str = "openai/gpt-oss-120b") -> str:
    """Generates a concise structured executive brief and key takeaways for the ingested content."""
    try:
        sample_text = "\n\n".join([d.page_content for d in docs[:5]])[:4000]
        prompt = (
            "You are an expert technical analyst.\n"
            "Write a concise 1-sentence executive overview followed by exactly 3 sharp bullet-point takeaways "
            "capturing the core themes, insights, or structure of the material below.\n"
            "Keep formatting clean Markdown. Do not add filler.\n\n"
            f"Material:\n{sample_text}\n\n"
            "Executive Brief:"
        )
        if not os.getenv("GROQ_API_KEY"):
            return "Document indexed and ready for Q&A."
        llm = ChatGroq(model=model_name, temperature=0.2, timeout=12, max_retries=1)
        resp = llm.invoke(prompt)
        return resp.content.strip()
    except Exception as e:
        return f"Document indexed and ready for Q&A. (Summary preview skipped: {str(e)})"


def _format_context_with_citations(docs: List[Document]) -> str:
    """Formats retrieved documents with explicit chunk citation markers for inline references."""
    parts = []
    for idx, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "Document")
        page = doc.metadata.get("page")
        chunk_idx = doc.metadata.get("chunk_index")
        loc_parts = [str(source)]
        if isinstance(page, int):
            loc_parts.append(f"Page {page + 1}")
        if chunk_idx:
            loc_parts.append(f"Index #{chunk_idx}")
        header = f"[Chunk {idx}] ({' · '.join(loc_parts)})"
        parts.append(f"{header}\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def _build_prompt_and_context(
    query: str,
    vector_store: Chroma,
    chat_history: Optional[List[Dict[str, str]]] = None,
    k: int = 4,
) -> Tuple[object, List[Document]]:
    """Retrieves diverse MMR chunks and builds a strictly grounded chat prompt with memory."""
    retriever = get_retriever(vector_store, k=k)
    docs = retriever.invoke(query)
    context = _format_context_with_citations(docs)

    messages = [
        (
            "system",
            """You are SmartMate, a precision document intelligence assistant.
Rules:
1. Answer strictly using ONLY the provided context chunks below.
2. Do NOT fabricate facts, numbers, or external assumptions outside the context.
3. Reference the supporting chunks naturally inline using bracket citations like [Chunk 1] or [Chunk 2] whenever stating facts from them.
4. Structure answers cleanly using clear Markdown (headings, bullet lists, tables, or fenced code blocks where appropriate).
5. If the answer cannot be determined from the provided context, respond clearly with:
"I could not find the answer in the loaded knowledge base." """,
        )
    ]

    if chat_history:
        for msg in chat_history[-6:]:
            role = "human" if msg.get("role") == "user" else "ai"
            content = (msg.get("content") or "")[:800]
            if content:
                messages.append((role, content))

    messages.append(
        (
            "human",
            """Context Chunks:
{context}

User Question:
{question}""",
        )
    )

    prompt = ChatPromptTemplate.from_messages(messages)
    final_prompt = prompt.invoke({"context": context, "question": query})
    return final_prompt, docs


def query_rag(
    query: str,
    vector_store: Chroma,
    model_name: str = "openai/gpt-oss-120b",
    chat_history: Optional[List[Dict[str, str]]] = None,
    k: int = 4,
) -> Tuple[str, List[Document]]:
    """Retrieves context using MMR and generates a complete answer using ChatGroq."""
    final_prompt, docs = _build_prompt_and_context(query, vector_store, chat_history=chat_history, k=k)
    llm = ChatGroq(model=model_name, temperature=0)
    response = llm.invoke(final_prompt)
    return response.content, docs


def stream_query_rag(
    query: str,
    vector_store: Chroma,
    model_name: str = "openai/gpt-oss-120b",
    chat_history: Optional[List[Dict[str, str]]] = None,
    k: int = 4,
) -> Tuple[Generator[str, None, None], List[Document]]:
    """Retrieves context using MMR and yields tokens for real-time streaming."""
    final_prompt, docs = _build_prompt_and_context(query, vector_store, chat_history=chat_history, k=k)
    llm = ChatGroq(model=model_name, temperature=0)

    def token_generator() -> Generator[str, None, None]:
        for chunk in llm.stream(final_prompt):
            if chunk.content:
                yield chunk.content

    return token_generator(), docs
