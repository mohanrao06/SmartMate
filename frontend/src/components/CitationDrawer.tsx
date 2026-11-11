import React, { useEffect, useState } from "react";
import { BookOpen, Check, Copy, FileText, X } from "lucide-react";
import type { RetrievedSource } from "../types/rag";

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: RetrievedSource[];
  highlightedCitation: number | null;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  isOpen,
  onClose,
  sources,
  highlightedCitation,
}) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && highlightedCitation !== null) {
      const el = document.getElementById(`drawer-citation-${highlightedCitation}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isOpen, highlightedCitation]);

  if (!isOpen) return null;

  const handleCopy = async (citation: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(citation);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-[340px] flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800/80 dark:bg-[#0F141F] xl:static xl:shadow-none shrink-0">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Retrieved Context (MMR)
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {sources.length > 0
                ? `${sources.length} diverse passages verified`
                : "Select a response to inspect sources"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close sources drawer"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {sources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              No citations selected yet
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              Ask a question or click any <span className="font-mono">[Chunk #]</span> pill in an answer to trace the exact retrieved source excerpts.
            </p>
          </div>
        ) : (
          sources.map((src) => {
            const isHighlighted = highlightedCitation === src.citation;
            return (
              <div
                key={src.citation}
                id={`drawer-citation-${src.citation}`}
                className={`rounded-xl border p-3 transition ${
                  isHighlighted
                    ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/30"
                    : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                      Chunk {src.citation}
                    </span>
                    {src.page && (
                      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                        Page {src.page}
                      </span>
                    )}
                    {src.chunk_index && (
                      <span className="text-[10px] text-slate-400">
                        #{src.chunk_index}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(src.citation, src.content)}
                    title="Copy excerpt"
                    className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    {copiedId === src.citation ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>

                <p className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {src.source}
                </p>

                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200/70 bg-white p-2.5 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-300">
                  <p className="whitespace-pre-wrap">{src.content}</p>
                </div>

                <div className="mt-1.5 text-right font-mono text-[10px] text-slate-400">
                  {src.char_count} chars
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

