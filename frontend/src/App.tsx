import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ChatArea } from "./components/ChatArea";
import { CitationDrawer } from "./components/CitationDrawer";
import { DocumentInspector } from "./components/DocumentInspector";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import {
  deleteKnowledge,
  fetchHealth,
  ingestFile,
  ingestText,
  ingestUrl,
  streamChat,
} from "./services/api";
import type {
  ActiveTab,
  ChatMessage,
  IngestProgress,
  KnowledgeStatus,
  ModelInfo,
  RetrievedSource,
} from "./types/rag";

const DEFAULT_KNOWLEDGE: KnowledgeStatus = {
  active: false,
  source_id: null,
  source_name: null,
  source_type: null,
  chunk_count: 0,
  total_chars: 0,
  page_count: null,
  summary: "",
  ingested_at: null,
  ingest_duration_s: null,
  embedding_model: "BAAI/bge-small-en-v1.5",
};

const DEFAULT_MODELS: ModelInfo[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    provider: "Groq",
    badge: "Balanced",
    description: "High-reasoning flagship model",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    provider: "Groq",
    badge: "Versatile",
    description: "Strong analytical accuracy",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B",
    provider: "Groq",
    badge: "Ultra-Fast",
    description: "Sub-second latency",
  },
];

const CHAT_STORAGE_KEY = "smartmate_chat_session_v2";
const THEME_STORAGE_KEY = "smartmate_theme_v2";

export function App(): React.ReactElement {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");

  const [groqConfigured, setGroqConfigured] = useState<boolean>(true);
  const [models, setModels] = useState<ModelInfo[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-oss-120b");
  const [retrievalK, setRetrievalK] = useState<number>(4);

  const [knowledge, setKnowledge] = useState<KnowledgeStatus>(DEFAULT_KNOWLEDGE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeSources, setActiveSources] = useState<RetrievedSource[]>([]);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(THEME_STORAGE_KEY, "light");
    }
  }, [darkMode]);

  // Collapse sidebar on small viewports initially
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Bootstrap API state
  useEffect(() => {
    fetchHealth()
      .then((res) => {
        setGroqConfigured(res.groq_configured);
        if (res.models?.length) setModels(res.models);
        setKnowledge(res.knowledge);

        // Restore cached chat only if it belongs to the same active source_id
        if (res.knowledge.active && res.knowledge.source_id) {
          try {
            const raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (raw) {
              const saved = JSON.parse(raw);
              if (saved.source_id === res.knowledge.source_id && Array.isArray(saved.messages)) {
                setMessages(saved.messages);
              }
            }
          } catch {
            // ignore corrupted storage
          }
        }
      })
      .catch(() => {
        // Ignore startup network transient error
      });
  }, []);

  // Persist chat history for current source_id
  useEffect(() => {
    if (knowledge.active && knowledge.source_id) {
      try {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({ source_id: knowledge.source_id, messages })
        );
      } catch {
        // ignore quota limits
      }
    }
  }, [knowledge.active, knowledge.source_id, messages]);

  const handleIngestComplete = (status: KnowledgeStatus) => {
    setKnowledge(status);
    setMessages([]);
    setActiveSources([]);
    setHighlightedCitation(null);
    setActiveTab("chat");
    setDrawerOpen(false);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const runIngestion = async (
    task: (
      onProgress: (p: IngestProgress) => void,
      onComplete: (s: KnowledgeStatus) => void
    ) => Promise<void>
  ) => {
    setIsIngesting(true);
    setIngestError(null);
    setIngestProgress({ stage: "extract", message: "Starting pipeline...", percent: 4 });
    // Ensure sidebar is visible on desktop or feedback is tracked cleanly
    try {
      await task(
        (p) => setIngestProgress(p),
        (status) => handleIngestComplete(status)
      );
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Failed to ingest source.");
    } finally {
      setIsIngesting(false);
      setIngestProgress(null);
    }
  };

  const handleIngestFile = (file: File) =>
    runIngestion((onProgress, onComplete) =>
      ingestFile(file, selectedModel, { onProgress, onComplete })
    );

  const handleIngestUrl = (url: string) =>
    runIngestion((onProgress, onComplete) =>
      ingestUrl(url, selectedModel, { onProgress, onComplete })
    );

  const handleIngestText = (text: string, label: string) =>
    runIngestion((onProgress, onComplete) =>
      ingestText(text, label, selectedModel, { onProgress, onComplete })
    );

  const handleDeleteKnowledge = async () => {
    try {
      const updated = await deleteKnowledge();
      setKnowledge(updated);
      setMessages([]);
      setActiveSources([]);
      setDrawerOpen(false);
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const handleSendMessage = async (query: string) => {
    if (!knowledge.active || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };

    const assistantId = `${Date.now()}-assistant`;
    const placeholderAssistant: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      model: selectedModel,
      timestamp: new Date().toISOString(),
    };

    const historyForApi = messages
      .filter((m) => !m.isError && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, placeholderAssistant]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChat(
        {
          query,
          model: selectedModel,
          k: retrievalK,
          chatHistory: historyForApi,
          signal: controller.signal,
        },
        {
          onSources: (sources) => {
            setActiveSources(sources);
            setHighlightedCitation(null);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
            );
          },
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m
              )
            );
          },
          onDone: (meta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, latency_ms: meta.latency_ms, model: meta.model }
                  : m
              )
            );
          },
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = err instanceof Error ? err.message : "Failed to generate answer.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content || `Error: ${msg}`,
                  isError: true,
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const handleSelectCitation = (sources: RetrievedSource[], highlight?: number) => {
    setActiveSources(sources);
    setHighlightedCitation(highlight ?? 1);
    setDrawerOpen(true);
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    const header = [
      `# SmartMate Conversation Export`,
      `- **Source:** ${knowledge.source_name || "Unknown"}`,
      `- **Model:** ${selectedModel}`,
      `- **Exported:** ${new Date().toLocaleString()}`,
      `\n---\n`,
    ].join("\n");

    const body = messages
      .map((m) => `### ${m.role === "user" ? "User" : "SmartMate Assistant"}\n\n${m.content}`)
      .join("\n\n---\n\n");

    const blob = new Blob([header + body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartmate_export_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearChat = () => {
    setMessages([]);
    setActiveSources([]);
    setHighlightedCitation(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const activeModelObj = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Left Ingestion & Knowledge Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        knowledge={knowledge}
        models={models}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        retrievalK={retrievalK}
        onRetrievalKChange={setRetrievalK}
        isIngesting={isIngesting}
        ingestProgress={ingestProgress}
        ingestError={ingestError}
        onIngestFile={handleIngestFile}
        onIngestUrl={handleIngestUrl}
        onIngestText={handleIngestText}
        onDeleteKnowledge={handleDeleteKnowledge}
        onOpenInspector={() => setActiveTab("inspector")}
      />

      {/* Main Content Shell */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          knowledge={knowledge}
          hasMessages={messages.length > 0}
          onExportChat={handleExportChat}
          onClearChat={handleClearChat}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(!darkMode)}
        />

        {!groqConfigured && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>GROQ_API_KEY</strong> is not configured in <code>SmartMate/.env</code>. Vector indexing works locally, but chat generation requires a Groq API key.
            </span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {activeTab === "chat" ? (
            <ChatArea
              knowledge={knowledge}
              messages={messages}
              isStreaming={isStreaming}
              isIngesting={isIngesting}
              ingestProgress={ingestProgress}
              ingestError={ingestError}
              selectedModelName={activeModelObj?.name || selectedModel}
              retrievalK={retrievalK}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              onSelectCitation={handleSelectCitation}
              onIngestFile={handleIngestFile}
              onIngestUrl={handleIngestUrl}
            />
          ) : (
            <DocumentInspector knowledge={knowledge} />
          )}

          <CitationDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sources={activeSources}
            highlightedCitation={highlightedCitation}
          />
        </div>
      </div>
    </div>
  );
}

export default App;

