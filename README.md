<div align="center">

# SmartMate
### *Multi-Source Conversational RAG Platform*

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend_SSE-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18_TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-Modern_UI-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LangChain](https://img.shields.io/badge/LangChain-RAG_Pipeline-1C3C3C?style=for-the-badge&logo=chainlink&logoColor=white)](https://www.langchain.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-E25A1C?style=for-the-badge)](https://www.trychroma.com/)
[![Groq](https://img.shields.io/badge/Groq-Ultra_Fast_LLM-F55036?style=for-the-badge)](https://groq.com/)
[![HuggingFace](https://img.shields.io/badge/Embeddings-BAAI%2Fbge--small--en-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/BAAI/bge-small-en-v1.5)

<br/>

> **"Upload PDFs, live website URLs, or notes — and hold strictly grounded, citation-verified conversations powered by local embeddings and ultra-fast streaming inference."**

---

</div>

## Table of Contents

- [What is SmartMate?](#what-is-smartmate)
- [Key Capabilities](#key-capabilities)
- [The RAG Architecture](#the-rag-architecture)
- [Storage-Safe Auto-Purge Engine](#storage-safe-auto-purge-engine)
- [Tech Stack](#tech-stack)
- [How to Run](#how-to-run)
- [Environment Configuration](#environment-configuration)
- [Project Structure](#project-structure)

---

## What is SmartMate?

**SmartMate** is a full-stack Retrieval-Augmented Generation (RAG) web application engineered with a **FastAPI + SSE backend** and an **industry-grade React + TypeScript + Tailwind CSS interface**.

Whether analyzing a dense multi-hundred-page textbook PDF, a technical web article, or pasted meeting notes, SmartMate parses, chunks, embeds locally with zero API rate limits, indexes into ChromaDB, generates an executive summary, and streams citation-linked Markdown answers in real time.

---

## Key Capabilities

| Feature | Description |
| :--- | :--- |
| **Multi-Source Drag & Drop** | Upload `.pdf`, `.txt`, or `.md` files via drag-and-drop, fetch live website URLs (`WebBaseLoader` + `BeautifulSoup`), or paste direct notes. |
| **Granular SSE Progress** | Real-time multi-stage ingestion pipeline tracking extraction, prior index purge, chunking, batched local embedding progress, and summary generation. |
| **Storage-Safe Auto-Purge** | Loading a new source automatically deletes prior ChromaDB collections and disk files to eliminate topic bleed and save storage. |
| **100% Local Zero-Quota Embeddings** | Runs `BAAI/bge-small-en-v1.5` locally on your machine — handles large books and PDFs with zero 429 rate-limit errors or embedding costs. |
| **Interactive Inline Citations** | Answers include clickable `[Chunk N]` pills that open the right **Retrieved Context Drawer** directly to the supporting passage and page number. |
| **Full Vector Chunk Inspector** | Dedicated Inspector tab with source telemetry, live keyword search across all indexed chunks, pagination, and one-click copy. |
| **Light & Dark Workspace** | Minimalist modern UI with persistent Light/Dark mode, stoppable SSE token streaming, configurable MMR depth (`k=2..8`), and Markdown chat export. |

---

## The RAG Architecture

<div align="center">

<img src="assets/rag_workflow.svg" alt="SmartMate RAG Workflow" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); margin-bottom: 20px;" />

*SmartMate End-to-End Pipeline: Multi-Source Ingestion, Auto-Purge, Local BGE Indexing, MMR Retrieval & Groq SSE Streaming*

</div>

---

## Storage-Safe Auto-Purge Engine

SmartMate enforces **Automatic Source Isolation**:
1. Before indexing a new upload, URL, or note, `clear_vector_store()` releases active handles, removes the existing Chroma collection, and cleans up `chroma-db/` on disk.
2. Conversation history resets cleanly per unique `source_id`, preventing answers from leaking context across unrelated files.
3. You can also manually purge the active vector index from the sidebar at any time.

---

## Tech Stack

```text
Frontend SPA      ───► React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React-Markdown
Backend Server    ───► FastAPI, Uvicorn (REST + Server-Sent Events Streaming)
RAG Orchestration ───► LangChain Core, Community & Text Splitters
Embedding Engine  ───► BAAI/bge-small-en-v1.5 (100% Local HuggingFace Embeddings)
Vector Store      ───► ChromaDB (Persistent Local Vector Index)
LLM Inference     ───► Groq Cloud (GPT-OSS 120B, Llama 3.3 70B, Llama 3.1 8B Instant)
Document Parsers  ───► PyPDF, WebBaseLoader, BeautifulSoup4
```

---

## How to Run

### 1. Prerequisites
* **Python 3.11+** (configured in `.venv`)
* *(Optional for modifying UI source)* **Node.js 18+ / npm** (production frontend bundle is already pre-built inside `frontend/dist`)

### 2. Configure `.env`
Ensure `SmartMate/.env` contains your Groq API key:

```env
GROQ_API_KEY="your_groq_api_key_here"
```

### 3. Start the Application (Single Command)
From inside `C:\Users\gedal\Desktop\AI\RAG\SmartMate`:

```powershell
.venv\Scripts\python.exe server.py
```

Open your browser to:
**`http://127.0.0.1:8000`**

### 4. Frontend Development Mode (Optional)
If you want hot-reloading while editing files in `frontend/src/`:

Terminal 1 (Backend API):
```powershell
.venv\Scripts\python.exe server.py
```

Terminal 2 (Vite Dev Server on port 5173):
```powershell
cd frontend
npm run dev
```

When done editing, run `npm run build` inside `frontend/` to update the production bundle served by `server.py`.

---

## Environment Configuration

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GROQ_API_KEY` | **Yes** | Your API key from [Groq Console](https://console.groq.com/) for fast chat inference and summaries. |
| `TRANSFORMERS_OFFLINE` | Auto | Enabled by `rag_engine.py` for instant local cached embedding startup. |
| `HF_HUB_OFFLINE` | Auto | Enabled by `rag_engine.py` to avoid HuggingFace Hub lookup delays. |

---

## Project Structure

```text
SmartMate/
├── server.py               # FastAPI server (REST + SSE streams + serves React SPA)
├── rag_engine.py           # Core RAG engine (loaders, auto-purge, local BGE, MMR, Groq)
├── frontend/               # React + TypeScript + Vite + Tailwind CSS v2 UI
│   ├── index.html
│   ├── package.json
│   ├── src/                # Modular UI components, API client & types
│   └── dist/               # Production static SPA served by FastAPI
├── requirements.txt        # Python backend & RAG dependencies
├── .env.example            # API key environment template
├── .gitignore              # Protects .env, .venv, node_modules & chroma-db
├── README.md               # Documentation
└── assets/
    └── rag_workflow.svg    # Architecture diagram
```
