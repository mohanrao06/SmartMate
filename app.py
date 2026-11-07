import os
import tempfile
import streamlit as st
from dotenv import load_dotenv

from rag_engine import (
    load_documents_from_file,
    load_documents_from_url,
    load_documents_from_text,
    build_vector_store,
    clear_vector_store,
    stream_query_rag,
    get_embedding_model
)

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

# Page Configuration
st.set_page_config(
    page_title="SmartMate - Conversational RAG",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom UI/UX Styling
st.markdown("""
<style>
    /* Global Container Adjustments */
    .block-container {
        padding-top: 1.5rem;
        padding-bottom: 2rem;
    }
    
    /* Header & Badges */
    .app-header {
        font-size: 2.2rem;
        font-weight: 800;
        margin-bottom: 0.2rem;
        background: linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .status-badge {
        display: inline-block;
        padding: 0.35rem 0.85rem;
        border-radius: 9999px;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }
    .status-active {
        background-color: #DEF7EC;
        color: #03543F;
        border: 1px solid #BCF0DA;
    }
    .status-inactive {
        background-color: #FDE8E8;
        color: #9B1C1C;
        border: 1px solid #FBD5D5;
    }

    /* Cards */
    .feature-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 0.75rem;
        padding: 1.2rem;
        height: 100%;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Session State
if "messages" not in st.session_state:
    st.session_state.messages = []

if "vector_store" not in st.session_state:
    st.session_state.vector_store = None

if "current_source" not in st.session_state:
    st.session_state.current_source = None

if "chunk_count" not in st.session_state:
    st.session_state.chunk_count = 0

# ----------------- SIDEBAR -----------------
with st.sidebar:
    st.markdown("## 🤖 SmartMate 💖")
    st.markdown("*Your intelligent multi-source RAG companion.*")
    st.markdown("---")
    
    # Active Knowledge Base Status Indicator
    if st.session_state.vector_store is not None and st.session_state.current_source:
        st.markdown(
            f"""<div class='status-badge status-active'>
                🟢 Active: {st.session_state.current_source} ({st.session_state.chunk_count} chunks)
            </div>""",
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            """<div class='status-badge status-inactive'>
                ⚪ No Knowledge Base Loaded
            </div>""",
            unsafe_allow_html=True
        )
        
    st.subheader("📥 Ingest Knowledge")
    input_type = st.radio(
        "Select Source Type:",
        ["📄 File (PDF / TXT)", "🌐 Website URL", "✍️ Raw Text"],
        help="Upload or paste content. Uploading a new source automatically deletes previous embeddings to save storage."
    )
    
    uploaded_file = None
    web_url = None
    raw_text = None
    
    if input_type == "📄 File (PDF / TXT)":
        uploaded_file = st.file_uploader("Upload Document", type=["pdf", "txt"])
    elif input_type == "🌐 Website URL":
        web_url = st.text_input("Enter Web URL", placeholder="https://example.com/article")
    elif input_type == "✍️ Raw Text":
        raw_text = st.text_area("Enter / Paste Text", height=150, placeholder="Paste your text or notes here...")
        
    # Process / Ingest Button
    if st.button("🚀 Process & Ingest Knowledge", use_container_width=True, type="primary"):
        docs = []
        source_label = ""
        
        try:
            with st.spinner("Processing source & purging old embeddings..."):
                if input_type == "📄 File (PDF / TXT)":
                    if not uploaded_file:
                        st.warning("Please upload a file first.")
                    else:
                        ext = os.path.splitext(uploaded_file.name)[1].lower()
                        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
                            tmp_file.write(uploaded_file.read())
                            tmp_path = tmp_file.name
                        
                        try:
                            docs = load_documents_from_file(tmp_path, original_filename=uploaded_file.name)
                            source_label = uploaded_file.name
                        finally:
                            if os.path.exists(tmp_path):
                                os.remove(tmp_path)
                                
                elif input_type == "🌐 Website URL":
                    if not web_url or not web_url.strip():
                        st.warning("Please enter a valid URL.")
                    else:
                        docs = load_documents_from_url(web_url.strip())
                        source_label = web_url.strip()
                        
                elif input_type == "✍️ Raw Text":
                    if not raw_text or not raw_text.strip():
                        st.warning("Please enter some text.")
                    else:
                        docs = load_documents_from_text(raw_text.strip(), source_label="Direct Text")
                        source_label = "Pasted Text"

                # If documents successfully extracted, rebuild vector store and purge old embeddings
                if docs:
                    vector_store, chunk_count = build_vector_store(docs, persist_directory="chroma-db")
                    st.session_state.vector_store = vector_store
                    st.session_state.current_source = source_label
                    st.session_state.chunk_count = chunk_count
                    # Reset chat history for fresh topic
                    st.session_state.messages = []
                    st.success(f"Loaded '{source_label}' ({chunk_count} chunks). Old embeddings purged!")
                    st.rerun()

        except Exception as e:
            st.error(f"Error processing input: {str(e)}")

    st.markdown("---")
    
    # Model Configuration
    st.subheader("⚙️ Settings")
    model_choice = st.selectbox(
        "Groq Model:",
        [
            "openai/gpt-oss-120b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768"
        ],
        index=0
    )
    
    # Manual Clear Button
    if st.button("🗑️ Delete Current Knowledge Base", use_container_width=True):
        clear_vector_store("chroma-db")
        st.session_state.vector_store = None
        st.session_state.current_source = None
        st.session_state.chunk_count = 0
        st.session_state.messages = []
        st.info("Knowledge base deleted and chat history cleared.")
        st.rerun()


# ----------------- MAIN CHAT INTERFACE -----------------

st.markdown("<div class='app-header'>SmartMate 💖</div>", unsafe_allow_html=True)
st.caption("Ask questions and chat with your files, websites, or raw notes with strict grounding.")

# Display Info Banner if No Knowledge Base is Loaded
if st.session_state.vector_store is None:
    st.info("👈 **Get Started**: Upload a PDF/TXT file, enter a Website URL, or paste text in the sidebar and click **Process & Ingest Knowledge**.")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("""
        <div class='feature-card'>
            <h4>📄 File Uploads</h4>
            <p>Upload PDF or text documents. Automatically parsed and chunked for rapid questions & answers.</p>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("""
        <div class='feature-card'>
            <h4>🌐 Web Scraping</h4>
            <p>Paste any web article or documentation link to ingest fresh online content directly into your knowledge base.</p>
        </div>
        """, unsafe_allow_html=True)
    with col3:
        st.markdown("""
        <div class='feature-card'>
            <h4>🛡️ Storage-Safe Purge</h4>
            <p>Previous Chroma embeddings are purged automatically on every new upload to protect storage and eliminate topic bleed.</p>
        </div>
        """, unsafe_allow_html=True)
else:
    st.write(f"💬 Currently chatting about: **{st.session_state.current_source}**")

# Display Past Messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if "context_docs" in msg and msg["context_docs"]:
            with st.expander("📚 View Retrieved MMR Context"):
                for idx, doc in enumerate(msg["context_docs"]):
                    st.markdown(f"**Chunk {idx+1}** (Source: `{doc.metadata.get('source', 'Unknown')}`):")
                    st.text(doc.page_content)

# Chat Input & Response Generation
if user_prompt := st.chat_input("Ask a question about the loaded content..."):
    if st.session_state.vector_store is None:
        st.warning("Please ingest a document, website, or text first using the sidebar.")
    else:
        # Display user question
        st.session_state.messages.append({"role": "user", "content": user_prompt})
        with st.chat_message("user"):
            st.markdown(user_prompt)

        # Generate Assistant Response with live streaming
        with st.chat_message("assistant"):
            try:
                stream_gen, retrieved_docs = stream_query_rag(
                    query=user_prompt,
                    vector_store=st.session_state.vector_store,
                    model_name=model_choice
                )
                answer = st.write_stream(stream_gen)
                
                if retrieved_docs:
                    with st.expander("📚 View Retrieved MMR Context"):
                        for idx, doc in enumerate(retrieved_docs):
                            st.markdown(f"**Chunk {idx+1}** (Source: `{doc.metadata.get('source', 'Unknown')}`):")
                            st.text(doc.page_content)
                
                # Save assistant response to state
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer,
                    "context_docs": retrieved_docs
                })
            except Exception as e:
                error_msg = f"Error during response generation: {str(e)}"
                st.error(error_msg)
                st.session_state.messages.append({"role": "assistant", "content": error_msg})
