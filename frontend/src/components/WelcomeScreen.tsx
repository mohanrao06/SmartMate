import React, { useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Globe,
  Loader2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UploadCloud,
  Zap,
} from "lucide-react";
import type { IngestProgress } from "../types/rag";

interface WelcomeScreenProps {
  onIngestFile: (file: File) => void;
  onIngestUrl: (url: string) => void;
  isIngesting: boolean;
  ingestProgress: IngestProgress | null;
  ingestError: string | null;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onIngestFile,
  onIngestUrl,
  isIngesting,
  ingestProgress,
  ingestError,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [quickUrl, setQuickUrl] = useState("");

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !isIngesting) onIngestFile(f);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        {/* Minimalist Title */}
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/70 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Grounded Multi-Source RAG Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Ask anything across your knowledge
          </h1>
          <p className="mt-2.5 text-sm text-slate-500 dark:text-slate-400">
            Upload a book, research PDF, live webpage, or notes. SmartMate indexes locally with zero quotas and grounds every answer with verifiable citations.
          </p>
        </div>

        {/* Interactive Center Dropzone */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111726]">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onIngestFile(f);
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isIngesting && fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
              dragging
                ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700"
            }`}
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Drop a PDF, TXT, or Markdown file to begin
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Click to select from disk · Instant local BGE vector indexing
            </p>
          </div>

          {/* Quick URL bar */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickUrl.trim() && !isIngesting) {
                    onIngestUrl(quickUrl.trim());
                  }
                }}
                placeholder="Or paste any article / docs URL (https://...)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              disabled={isIngesting || quickUrl.trim().length < 5}
              onClick={() => quickUrl.trim() && onIngestUrl(quickUrl.trim())}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              Fetch URL
            </button>
          </div>

          {isIngesting && ingestProgress && (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-700 dark:text-indigo-300">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {ingestProgress.message}
                </span>
                <span className="font-mono">{ingestProgress.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${ingestProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {ingestError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ingestError}</span>
            </div>
          )}
        </div>

        {/* 3 Clean Feature Pillars */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800/80 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <FileText className="h-4 w-4 text-indigo-500" />
              <span>Multi-Source</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Seamlessly handles multi-hundred-page PDFs, web pages, and direct scratchpad notes.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800/80 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Zero Topic Bleed</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Auto-purges prior Chroma collections on every upload so answers stay strictly scoped.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800/80 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>MMR + Citations</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Maximal Marginal Relevance picks diverse chunks and links every claim to its exact source.
            </p>
          </div>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <StickyNote className="h-3 w-3" />
          <span>Tip: Use the left sidebar to switch to raw notes input anytime.</span>
        </p>
      </div>
    </div>
  );
};

