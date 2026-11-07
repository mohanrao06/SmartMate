import os
import tempfile
import streamlit as st
from datetime import datetime
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
    
    /* Header & Branding */
    .app-header {
        font-size: 2.3rem;
        font-weight: 800;
        margin-bottom: 0.1rem;
        background: linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .status-badge {
        display: inline-block;
        padding: 0.4rem 0.9rem;
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
        padding: 1.25rem;
        height: 100%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .feature-card h4 {
        margin-top: 0;
        color: #1E293B;
    }
    .feature-card p {
        color: #64748B;
        font-size: 0.92rem;
    }

    /* Pill Buttons */
    div[data-testid="stHorizontalBlock"] button {
        border-radius: 20px;
        font-size: 0.85rem;
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

if "source_docs" not in st.session_state:
    st.session_state.source_docs = []

if "auto_prompt" not in st.session_state:
    st.session_state.auto_prompt = None

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
        
        progress_slot = st.empty()
        status_slot = st.empty()
        
        try:
            progress_slot.progress(20)
            status_slot.caption("📄 Parsing input source and extracting clean text...")
            
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
                        if tmp_path and os.path.exists(tmp_path):
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
                progress_slot.progress(50)
                status_slot.caption("🛡️ Purging previous database & splitting into 1000-char chunks...")
                
                progress_slot.progress(75)
                status_slot.caption("🧮 Generating local embeddings (BAAI/bge-small-en-v1.5 - zero rate limits)...")
                
                vector_store, chunk_count = build_vector_store(docs)
                
                progress_slot.progress(100)
                status_slot.caption("✨ Knowledge base ready!")
                
                st.session_state.vector_store = vector_store
                st.session_state.current_source = source_label
                st.session_state.chunk_count = chunk_count
                st.session_state.source_docs = docs[:3]  # Keep first few for inspector preview
                
                # Reset chat history for fresh topic
                st.session_state.messages = []
                st.success(f"Loaded '{source_label}' ({chunk_count} chunks). Old embeddings purged!")
                st.rerun()

        except Exception as e:
            progress_slot.empty()
            status_slot.empty()
            st.error(f"Error processing input: {str(e)}")

    st.markdown("---")
    
    # Model Configuration
    st.subheader("⚙️ Settings")
    st.caption("🔒 **Embeddings**: Local BAAI/bge-small-en-v1.5 (Zero Quotas & Zero Limits)")
    model_choice = st.selectbox(
        "Chat LLM (Groq):",
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
        clear_vector_store()
        st.session_state.vector_store = None
        st.session_state.current_source = None
        st.session_state.chunk_count = 0
        st.session_state.source_docs = []
        st.session_state.messages = []
        st.info("Knowledge base deleted and chat history cleared.")
        st.rerun()

    # Chat Export Button
    if st.session_state.messages:
        chat_text = f"# SmartMate Chat Export\n**Source**: {st.session_state.current_source}\n**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n---\n\n"
        for m in st.session_state.messages:
            role = "🧑 User" if m["role"] == "user" else "🤖 Assistant"
            chat_text += f"### {role}\n{m['content']}\n\n"
        st.download_button(
            label="📥 Export Chat (Markdown)",
            data=chat_text,
            file_name=f"smartmate_chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
            mime="text/markdown",
            use_container_width=True
        )


# ----------------- MAIN INTERFACE (TABS) -----------------

st.markdown("<div class='app-header'>SmartMate 💖</div>", unsafe_allow_html=True)
st.caption("Ask questions and chat with your files, websites, or raw notes with strict grounding.")

tab_chat, tab_inspector = st.tabs(["💬 Conversational Chat", "📄 Document & Chunks Inspector"])

with tab_chat:
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
        
        # Starter Prompt Pills
        st.markdown("**💡 Quick Question Pills:**")
        p_col1, p_col2, p_col3 = st.columns(3)
        with p_col1:
            if st.button("📌 Summarize Key Points", use_container_width=True):
                st.session_state.auto_prompt = "Provide a concise summary highlighting the 3 most important takeaways from this document."
        with p_col2:
            if st.button("🔍 Main Problems & Solutions", use_container_width=True):
                st.session_state.auto_prompt = "What are the core problems, challenges, or questions addressed in this content?"
        with p_col3:
            if st.button("❓ Create 3 Quiz Questions", use_container_width=True):
                st.session_state.auto_prompt = "Generate 3 thoughtful questions to test my understanding of this material, with answers."

    # Display Past Messages
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if "context_docs" in msg and msg["context_docs"]:
                with st.expander("📚 View Retrieved MMR Context"):
                    for idx, doc in enumerate(msg["context_docs"]):
                        st.markdown(f"**Chunk {idx+1}** (Source: `{doc.metadata.get('source', 'Unknown')}`):")
                        st.text(doc.page_content)

    # Chat Input & Prompt Handling
    user_input = st.chat_input("Ask a question about the loaded content...")
    active_query = user_input or st.session_state.auto_prompt

    if active_query:
        # Reset auto_prompt immediately so it doesn't loop
        st.session_state.auto_prompt = None
        
        if st.session_state.vector_store is None:
            st.warning("Please ingest a document, website, or text first using the sidebar.")
        else:
            # Display user question
            st.session_state.messages.append({"role": "user", "content": active_query})
            with st.chat_message("user"):
                st.markdown(active_query)

            # Generate Assistant Response with live streaming
            with st.chat_message("assistant"):
                try:
                    stream_gen, retrieved_docs = stream_query_rag(
                        query=active_query,
                        vector_store=st.session_state.vector_store,
                        model_name=model_choice,
                        chat_history=st.session_state.messages[:-1]
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

with tab_inspector:
    st.subheader("📄 Document & Chunks Inspector")
    if st.session_state.vector_store is not None:
        m_col1, m_col2 = st.columns(2)
        with m_col1:
            st.metric("Active Source", str(st.session_state.current_source))
        with m_col2:
            st.metric("Total Indexed Chunks", st.session_state.chunk_count)
            
        st.markdown("---")
        st.markdown("### 🔍 Sample Extracted Content (First Pages / Chunks)")
        if st.session_state.source_docs:
            for idx, doc in enumerate(st.session_state.source_docs):
                with st.expander(f"Section {idx+1} Preview (Source: {doc.metadata.get('source', 'Unknown')})", expanded=(idx==0)):
                    st.text(doc.page_content[:1500])
        else:
            st.caption("No preview chunks cached.")
    else:
        st.info("No document loaded yet. Use the sidebar to ingest a source.")
