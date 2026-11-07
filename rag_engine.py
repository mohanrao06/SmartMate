import os
import shutil
import requests
from typing import List, Tuple, Generator
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Set offline mode for local cached huggingface embeddings to prevent network lookup timeouts
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["USER_AGENT"] = "SmartMate/1.0"

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

DEFAULT_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma-db")

# Singleton cached embedding model
_EMBEDDING_MODEL = None

def get_embedding_model():
    """
    Returns Google Gemini embedding model (gemini-embedding-001) for blazing-fast ~1s indexing.
    Falls back to HuggingFace if GOOGLE_API_KEY is missing.
    """
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        google_key = os.getenv("GOOGLE_API_KEY")
        if google_key:
            _EMBEDDING_MODEL = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=google_key
            )
        else:
            from langchain_huggingface import HuggingFaceEmbeddings
            _EMBEDDING_MODEL = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    return _EMBEDDING_MODEL

def clear_vector_store(persist_directory: str = DEFAULT_DB_DIR):
    """
    Completely deletes and cleans up the existing vector store collection
    and files to save storage and ensure old embeddings are purged.
    """
    if os.path.exists(persist_directory):
        try:
            emb = get_embedding_model()
            temp_db = Chroma(persist_directory=persist_directory, embedding_function=emb)
            temp_db.delete_collection()
        except Exception:
            pass
        
        try:
            shutil.rmtree(persist_directory, ignore_errors=True)
        except Exception as e:
            print(f"Directory cleanup warning: {e}")

def load_documents_from_file(file_path: str, original_filename: str = "") -> List[Document]:
    """Loads documents from a PDF or plain text file."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
        docs = loader.load()
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        docs = [Document(page_content=content, metadata={"source": original_filename or os.path.basename(file_path)})]
    return docs

def load_documents_from_url(url: str) -> List[Document]:
    """Loads and extracts readable content from a given website URL with fallback."""
    try:
        loader = WebBaseLoader(url)
        docs = loader.load()
        if docs and docs[0].page_content.strip():
            return docs
    except Exception:
        pass

    # Robust fallback using requests + BeautifulSoup
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    
    soup = BeautifulSoup(resp.text, "html.parser")
    for script_or_style in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        script_or_style.decompose()
        
    text = soup.get_text(separator="\n", strip=True)
    title = soup.title.string.strip() if soup.title and soup.title.string else url
    return [Document(page_content=text, metadata={"source": title or url})]

def load_documents_from_text(text: str, source_label: str = "Direct Text Input") -> List[Document]:
    """Wraps raw user-entered text into a Document."""
    return [Document(page_content=text, metadata={"source": source_label})]

def build_vector_store(docs: List[Document], persist_directory: str = DEFAULT_DB_DIR) -> Tuple[Chroma, int]:
    """
    Deletes any existing vector database, chunks the new documents,
    creates fresh embeddings, and saves into Chroma.
    """
    # 1. Purge previous database
    clear_vector_store(persist_directory)

    # 2. Split into chunks using project configuration
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = splitter.split_documents(docs)
    chunks = [c for c in chunks if c.page_content.strip()]
    if not chunks:
        raise ValueError("No readable text could be extracted from the provided source.")

    # 3. Create fresh embeddings and store in Chroma
    emb = get_embedding_model()
    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=emb,
        persist_directory=persist_directory
    )
    
    return vector_store, len(chunks)

def get_retriever(vector_store: Chroma):
    """Returns the MMR retriever configured identically to main.py."""
    return vector_store.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 4,
            "fetch_k": 10,
            "lambda_mult": 0.5
        }
    )

def generate_document_summary(docs: List[Document], model_name: str = "openai/gpt-oss-120b") -> str:
    """Generates a concise 3-bullet executive summary of the newly ingested documents."""
    try:
        sample_text = "\n\n".join([d.page_content for d in docs[:4]])[:3500]
        prompt = f"""You are an intelligent document analyst.
Provide a clear, 3-bullet summary highlighting the core themes, objectives, and key takeaways from the following material:

Document Excerpt:
{sample_text}

Executive Summary:"""
        llm = ChatGroq(model=model_name, temperature=0.2)
        resp = llm.invoke(prompt)
        return resp.content
    except Exception as e:
        return f"Summary unavailable: {str(e)}"

def _build_prompt_and_context(query: str, vector_store: Chroma, chat_history: List[dict] = None) -> Tuple[object, List[Document]]:
    """Helper to retrieve MMR docs and construct the final prompt with conversational memory support."""
    retriever = get_retriever(vector_store)
    docs = retriever.invoke(query)
    
    context = "\n\n".join([doc.page_content for doc in docs])
    
    messages = [
        ("system",
            """You are a helpful AI assistant.
Use ONLY the provided context to answer the question.
If the answer is not present in the context,
say: "I could not find the answer in the document."
"""
        )
    ]
    
    # Add recent conversation turns for smooth follow-up questions
    if chat_history:
        for msg in chat_history[-4:]:
            role = "human" if msg["role"] == "user" else "ai"
            messages.append((role, msg["content"][:600]))

    messages.append(
        ("human",
            """Context:
{context}

Question:
{question}
"""
        )
    )
    
    prompt = ChatPromptTemplate.from_messages(messages)
    final_prompt = prompt.invoke({
        "context": context,
        "question": query
    })
    return final_prompt, docs

def query_rag(query: str, vector_store: Chroma, model_name: str = "openai/gpt-oss-120b", chat_history: List[dict] = None) -> Tuple[str, List[Document]]:
    """Retrieves context using MMR and generates a complete answer using ChatGroq."""
    final_prompt, docs = _build_prompt_and_context(query, vector_store, chat_history=chat_history)
    llm = ChatGroq(model=model_name, temperature=0)
    response = llm.invoke(final_prompt)
    return response.content, docs

def stream_query_rag(query: str, vector_store: Chroma, model_name: str = "openai/gpt-oss-120b", chat_history: List[dict] = None) -> Tuple[Generator[str, None, None], List[Document]]:
    """Retrieves context using MMR and yields tokens for live streaming in the UI with conversational memory."""
    final_prompt, docs = _build_prompt_and_context(query, vector_store, chat_history=chat_history)
    llm = ChatGroq(model=model_name, temperature=0)
    
    def token_generator():
        for chunk in llm.stream(final_prompt):
            if chunk.content:
                yield chunk.content

    return token_generator(), docs
