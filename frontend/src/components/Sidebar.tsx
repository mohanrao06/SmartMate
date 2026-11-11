import React, { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Globe,
  Layers,
  Loader2,
  PanelLeftClose,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { IngestProgress, KnowledgeStatus, ModelInfo } from "../types/rag";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  knowledge: KnowledgeStatus;
  models: ModelInfo[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  retrievalK: number;
  onRetrievalKChange: (k: number) => void;
  isIngesting: boolean;
  ingestProgress: IngestProgress | null;
  ingestError: string | null;
  onIngestFile: (file: File) => void;
  onIngestUrl: (url: string) => void;
  onIngestText: (text: string, label: string) => void;
  onDeleteKnowledge: () => void;
  onOpenInspector: () => void;
}

type SourceMode = "file" | "url" | "text";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  knowledge,
  models,
  selectedModel,
  onModelChange,
  retrievalK,
  onRetrievalKChange,
  isIngesting,
  ingestProgress,
  ingestError,
  onIngestFile,
  onIngestUrl,
  onIngestText,
  onDeleteKnowledge,
  onOpenInspector,
}) => {
  const [mode, setMode] = useState<SourceMode>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [textLabel, setTextLabel] = useState("");
  const [textInput, setTextInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleProcess = () => {
    if (isIngesting) return;
    if (mode === "file" && selectedFile) {
      onIngestFile(selectedFile);
    } else if (mode === "url" && urlInput.trim()) {
      onIngestUrl(urlInput.trim());
    } else if (mode === "text" && textInput.trim()) {
      onIngestText(textInput.trim(), textLabel.trim() || "Direct Notes");
    }
  };

  const canProcess =
    !isIngesting &&
    ((mode === "file" && selectedFile !== null) ||
      (mode === "url" && urlInput.trim().length > 4) ||
      (mode === "text" && textInput.trim().length > 0));

  const stages = [
    { key: "extract", label: "Extract text" },
    { key: "purge", label: "Purge prior index" },
    { key: "chunk", label: "Chunk text" },
    { key: "embed", label: "Local BGE embed" },
    { key: "summary", label: "Generate brief" },
  ];

  const currentStageIndex = ingestProgress
    ? stages.findIndex((s) => s.key === ingestProgress.stage)
    : -1;

  return (
    <aside
      className={`${
        isOpen ? "translate-x-0 w-[310px]" : "-translate-x-full w-0 lg:w-0 overflow-hidden"
      } fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800/80 dark:bg-[#0F141F] lg:static shrink-0`}
    >
      {/* Top Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                SmartMate
              </span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                RAG 2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Document Intelligence
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Collapse sidebar"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Sidebar Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Active Knowledge Base Card */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Knowledge Base
            </span>
            {knowledge.active && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Indexed
              </span>
            )}
          </div>

          {knowledge.active ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100"
                    title={knowledge.source_name || ""}
                  >
                    {knowledge.source_name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      {knowledge.source_type}
                    </span>
                    <span>{knowledge.chunk_count} chunks</span>
                    {knowledge.page_count && <span>· {knowledge.page_count} pages</span>}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <button
                  onClick={onOpenInspector}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/70"
                >
                  <Database className="h-3.5 w-3.5" />
                  Inspect
                </button>

                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    title="Purge index"
                    className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setConfirmDelete(false);
                        onDeleteKnowledge();
                      }}
                      className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700"
                    >
                      Purge
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-center dark:border-slate-800 dark:bg-slate-900/30">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                No active document loaded
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                Upload a file, URL, or note below
              </p>
            </div>
          )}
        </section>

        {/* Source Ingestion Section */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ingest Source
            </span>
            <span
              title="Loading a new source automatically deletes prior ChromaDB embeddings to keep storage clean and eliminate topic bleed."
              className="text-[10px] text-slate-400 dark:text-slate-500"
            >
              Auto-purge enabled
            </span>
          </div>

          {/* Segmented Control */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            {[
              { id: "file" as SourceMode, label: "File", icon: FileText },
              { id: "url" as SourceMode, label: "URL", icon: Globe },
              { id: "text" as SourceMode, label: "Notes", icon: StickyNote },
            ].map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Source Input Area */}
          <div className="mt-3">
            {mode === "file" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700"
                  }`}
                >
                  <UploadCloud className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
                  <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    Drop PDF, TXT, or MD here
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    or click to browse files
                  </p>
                </div>

                {selectedFile && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatBytes(selectedFile.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === "url" && (
              <div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://docs.example.com/article"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  Extracts clean body copy via WebBaseLoader + BeautifulSoup.
                </p>
              </div>
            )}

            {mode === "text" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={textLabel}
                  onChange={(e) => setTextLabel(e.target.value)}
                  placeholder="Source title (optional)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={5}
                  placeholder="Paste meeting notes, documentation, or excerpts..."
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="flex justify-end text-[11px] text-slate-400">
                  {textInput.length.toLocaleString()} chars
                </div>
              </div>
            )}

            {/* Process CTA */}
            <button
              type="button"
              disabled={!canProcess}
              onClick={handleProcess}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isIngesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Indexing Source...
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Process & Index
                </>
              )}
            </button>

            {/* Live Progress Stepper */}
            {isIngesting && ingestProgress && (
              <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                  <span>Pipeline Progress</span>
                  <span className="font-mono">{ingestProgress.percent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${ingestProgress.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                  {ingestProgress.message}
                </p>
                <div className="mt-2.5 space-y-1">
                  {stages.map((st, idx) => {
                    const isDone =
                      ingestProgress.stage === "done" || idx < currentStageIndex;
                    const isCurrent =
                      ingestProgress.stage !== "done" && idx === currentStageIndex;
                    return (
                      <div key={st.key} className="flex items-center gap-1.5 text-[11px]">
                        {isDone ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : isCurrent ? (
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                        ) : (
                          <span className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                        )}
                        <span
                          className={
                            isDone || isCurrent
                              ? "font-medium text-slate-700 dark:text-slate-200"
                              : "text-slate-400 dark:text-slate-500"
                          }
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ingestion Error */}
            {ingestError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{ingestError}</span>
              </div>
            )}
          </div>
        </section>

        {/* Model & Retrieval Configuration */}
        <section className="border-t border-slate-200/80 pt-4 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Engine Settings
            </span>
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <div className="mt-2.5 space-y-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Inference Model (Groq)
              </label>
              <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </select>
            </div>

            {showAdvanced && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    MMR Context Chunks (k)
                  </span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {retrievalK}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={retrievalK}
                  onChange={(e) => onRetrievalKChange(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Focused (2)</span>
                  <span>Balanced (4)</span>
                  <span>Deep (8)</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer Local Embeddings Badge */}
      <div className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Cpu className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-700 dark:text-slate-300">
              BAAI/bge-small-en-v1.5
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Local CPU embeddings · Zero rate limits
            </p>
          </div>
          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        </div>
      </div>
    </aside>
  );
};

