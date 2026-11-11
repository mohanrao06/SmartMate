import json
import os
import queue
import tempfile
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rag_engine import (
    AVAILABLE_MODELS,
    build_vector_store_detailed,
    clear_vector_store,
    generate_document_summary,
    load_documents_from_file,
    load_documents_from_text,
    load_documents_from_url,
    stream_query_rag,
    warm_embedding_model,
)

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)


class KnowledgeState:
    """Thread-safe container holding the active single-source RAG session."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.vector_store: Any = None
        self.source_id: Optional[str] = None
        self.source_name: Optional[str] = None
        self.source_type: Optional[str] = None
        self.chunk_count: int = 0
        self.total_chars: int = 0
        self.page_count: Optional[int] = None
        self.summary: str = ""
        self.chunks: List[Dict[str, Any]] = []
        self.ingested_at: Optional[str] = None
        self.ingest_duration_s: Optional[float] = None

    def set_active(
        self,
        vector_store: Any,
        source_name: str,
        source_type: str,
        raw_docs: List[Any],
        chunks: List[Any],
        summary: str,
        duration_s: float,
    ) -> Dict[str, Any]:
        with self.lock:
            self.vector_store = vector_store
            self.source_id = str(uuid.uuid4())
            self.source_name = source_name
            self.source_type = source_type
            self.chunk_count = len(chunks)
            self.total_chars = sum(len(c.page_content) for c in chunks)
            pages = {
                doc.metadata.get("page")
                for doc in raw_docs
                if isinstance(doc.metadata.get("page"), int)
            }
            self.page_count = len(pages) if pages else None
            self.summary = summary
            self.ingested_at = datetime.now(timezone.utc).isoformat()
            self.ingest_duration_s = round(duration_s, 2)
            self.chunks = [
                {
                    "index": idx + 1,
                    "content": c.page_content,
                    "char_count": len(c.page_content),
                    "metadata": {
                        "source": str(c.metadata.get("source", source_name)),
                        "page": (
                            c.metadata.get("page") + 1
                            if isinstance(c.metadata.get("page"), int)
                            else None
                        ),
                    },
                }
                for idx, c in enumerate(chunks)
            ]
            return self.status_dict()

    def clear(self) -> None:
        with self.lock:
            self.vector_store = None
            self.source_id = None
            self.source_name = None
            self.source_type = None
            self.chunk_count = 0
            self.total_chars = 0
            self.page_count = None
            self.summary = ""
            self.chunks = []
            self.ingested_at = None
            self.ingest_duration_s = None
        clear_vector_store()

    def status_dict(self) -> Dict[str, Any]:
        return {
            "active": self.vector_store is not None,
            "source_id": self.source_id,
            "source_name": self.source_name,
            "source_type": self.source_type,
            "chunk_count": self.chunk_count,
            "total_chars": self.total_chars,
            "page_count": self.page_count,
            "summary": self.summary,
            "ingested_at": self.ingested_at,
            "ingest_duration_s": self.ingest_duration_s,
            "embedding_model": "BAAI/bge-small-en-v1.5",
        }


state = KnowledgeState()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Pre-warm local embedding model shortly after HTTP listener binds
    timer = threading.Timer(1.5, warm_embedding_model)
    timer.daemon = True
    timer.start()
    yield
    timer.cancel()


app = FastAPI(
    title="SmartMate RAG API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UrlIngestRequest(BaseModel):
    url: str = Field(..., min_length=4)
    model: str = Field(default="openai/gpt-oss-120b")


class TextIngestRequest(BaseModel):
    text: str = Field(..., min_length=1)
    label: str = Field(default="Direct Notes")
    model: str = Field(default="openai/gpt-oss-120b")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatStreamRequest(BaseModel):
    query: str = Field(..., min_length=1)
    model: str = Field(default="openai/gpt-oss-120b")
    k: int = Field(default=4, ge=1, le=8)
    chat_history: List[ChatMessage] = Field(default_factory=list)


def _sse_event(event_type: str, payload: Dict[str, Any]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _run_ingestion_stream(loader_fn, source_name: str, source_type: str, summary_model: str):
    """Runs document loading, DB purge, chunking, embedding, and summary in a worker thread with SSE progress."""
    event_q: "queue.Queue[Optional[Tuple[str, Dict[str, Any]]]]" = queue.Queue()

    def push_progress(stage: str, message: str, percent: int) -> None:
        event_q.put(("progress", {"stage": stage, "message": message, "percent": percent}))

    def worker() -> None:
        start_time = time.perf_counter()
        try:
            push_progress("extract", f"Extracting clean text from {source_name}...", 8)
            raw_docs = loader_fn()
            if not raw_docs or not any(d.page_content.strip() for d in raw_docs):
                raise ValueError("No readable text content found in the source.")

            # Release old in-memory handle before clear_vector_store touches SQLite files on Windows
            with state.lock:
                state.vector_store = None

            vector_store, chunks = build_vector_store_detailed(
                raw_docs,
                progress_callback=push_progress,
            )

            push_progress("summary", "Generating executive summary with Groq...", 93)
            summary = generate_document_summary(raw_docs, model_name=summary_model)

            elapsed = time.perf_counter() - start_time
            status = state.set_active(
                vector_store=vector_store,
                source_name=source_name,
                source_type=source_type,
                raw_docs=raw_docs,
                chunks=chunks,
                summary=summary,
                duration_s=elapsed,
            )

            push_progress("done", "Knowledge base ready!", 100)
            event_q.put(("complete", status))
        except Exception as exc:
            event_q.put(("error", {"message": str(exc)}))
        finally:
            event_q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    while True:
        item = event_q.get()
        if item is None:
            break
        ev_name, data = item
        yield _sse_event(ev_name, data)


@app.get("/api/health")
def get_health():
    return {
        "status": "ok",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "embedding_model": "BAAI/bge-small-en-v1.5",
        "models": AVAILABLE_MODELS,
        "knowledge": state.status_dict(),
    }


@app.get("/api/knowledge")
def get_knowledge():
    return state.status_dict()


@app.get("/api/knowledge/chunks")
def get_knowledge_chunks(
    q: str = Query(default=""),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=40, ge=1, le=200),
):
    with state.lock:
        if state.vector_store is None:
            return {"total": 0, "filtered": 0, "chunks": []}

        all_chunks = state.chunks
        query_lower = q.strip().lower()
        if query_lower:
            matched = [c for c in all_chunks if query_lower in c["content"].lower()]
        else:
            matched = all_chunks

        sliced = matched[offset : offset + limit]
        return {
            "total": len(all_chunks),
            "filtered": len(matched),
            "chunks": sliced,
        }


@app.delete("/api/knowledge")
def delete_knowledge():
    state.clear()
    return {"cleared": True, "knowledge": state.status_dict()}


@app.post("/api/ingest/file")
async def ingest_file(
    file: UploadFile = File(...),
    model: str = Form(default="openai/gpt-oss-120b"),
):
    filename = file.filename or "uploaded_document"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".pdf", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail="Only PDF, TXT, and Markdown (.md) files are supported.")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    def loader():
        try:
            return load_documents_from_file(tmp_path, original_filename=filename)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    source_type = ext.lstrip(".")
    return StreamingResponse(
        _run_ingestion_stream(loader, filename, source_type, model),
        media_type="text/event-stream",
    )


@app.post("/api/ingest/url")
def ingest_url(req: UrlIngestRequest):
    url = req.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    return StreamingResponse(
        _run_ingestion_stream(
            lambda: load_documents_from_url(url),
            source_name=url,
            source_type="url",
            summary_model=req.model,
        ),
        media_type="text/event-stream",
    )


@app.post("/api/ingest/text")
def ingest_text(req: TextIngestRequest):
    text = req.text.strip()
    label = req.label.strip() or "Direct Notes"
    if not text:
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")

    return StreamingResponse(
        _run_ingestion_stream(
            lambda: load_documents_from_text(text, source_label=label),
            source_name=label,
            source_type="text",
            summary_model=req.model,
        ),
        media_type="text/event-stream",
    )


@app.post("/api/chat/stream")
def chat_stream(req: ChatStreamRequest):
    with state.lock:
        vs = state.vector_store
    if vs is None:
        raise HTTPException(status_code=400, detail="No active knowledge base loaded. Please ingest a source first.")

    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is missing in SmartMate/.env.")

    history_dicts = [{"role": m.role, "content": m.content} for m in req.chat_history]

    def generate():
        start = time.perf_counter()
        try:
            token_gen, retrieved_docs = stream_query_rag(
                query=req.query.strip(),
                vector_store=vs,
                model_name=req.model,
                chat_history=history_dicts,
                k=req.k,
            )

            sources_payload = [
                {
                    "citation": idx + 1,
                    "content": doc.page_content,
                    "char_count": len(doc.page_content),
                    "source": str(doc.metadata.get("source", state.source_name or "Document")),
                    "page": (
                        doc.metadata.get("page") + 1
                        if isinstance(doc.metadata.get("page"), int)
                        else None
                    ),
                    "chunk_index": doc.metadata.get("chunk_index"),
                }
                for idx, doc in enumerate(retrieved_docs)
            ]
            yield _sse_event("sources", {"sources": sources_payload})

            for token in token_gen:
                yield _sse_event("token", {"content": token})

            elapsed_ms = int((time.perf_counter() - start) * 1000)
            yield _sse_event("done", {"latency_ms": elapsed_ms, "model": req.model})
        except Exception as exc:
            yield _sse_event("error", {"message": str(exc)})

    return StreamingResponse(generate(), media_type="text/event-stream")


# Serve prebuilt React SPA when frontend/dist exists
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
FRONTEND_ASSETS = os.path.join(FRONTEND_DIST, "assets")

if os.path.isdir(FRONTEND_ASSETS):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return JSONResponse(
        {
            "message": "SmartMate API is running. Build frontend with `cd frontend && npm run build` or run Vite dev server."
        },
        status_code=200,
    )


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 60)
    print("  SmartMate RAG Platform v2.0")
    print("  Open in browser: http://127.0.0.1:8000")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)

