import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Database,
  FileText,
  Layers,
  Loader2,
  Search,
  Timer,
} from "lucide-react";
import { fetchChunks } from "../services/api";
import type { ChunkItem, KnowledgeStatus } from "../types/rag";

interface DocumentInspectorProps {
  knowledge: KnowledgeStatus;
}

const PAGE_SIZE = 20;

export const DocumentInspector: React.FC<DocumentInspectorProps> = ({ knowledge }) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!knowledge.active) {
      setChunks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchChunks(debouncedQuery, offset, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setChunks(res.chunks);
        setTotal(res.total);
        setFiltered(res.filtered);
      })
      .catch(() => {
        if (!cancelled) setChunks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [knowledge.active, knowledge.source_id, debouncedQuery, offset]);

  const handleCopy = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // ignore
    }
  };

  if (!knowledge.active) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50/40 px-6 text-center dark:bg-[#0B0F17]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Database className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
          No Vector Index Active
        </h3>
        <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Ingest a document, webpage, or text source to inspect its split chunks, vector metadata, and keyword matches here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/40 px-4 py-6 dark:bg-[#0B0F17] sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Metrics Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
              <span>Active Source</span>
            </div>
            <p
              className="mt-1.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
              title={knowledge.source_name || ""}
            >
              {knowledge.source_name}
            </p>
            <p className="mt-0.5 text-[11px] uppercase font-mono text-slate-400">
              {knowledge.source_type}
              {knowledge.page_count ? ` · ${knowledge.page_count} pages` : ""}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Layers className="h-3.5 w-3.5 text-emerald-500" />
              <span>Indexed Chunks</span>
            </div>
            <p className="mt-1.5 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {knowledge.chunk_count.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              1,000 chars / 200 overlap
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-amber-500" />
              <span>Total Volume</span>
            </div>
            <p className="mt-1.5 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {knowledge.total_chars.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">chars</span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {knowledge.embedding_model}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111726]">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Timer className="h-3.5 w-3.5 text-sky-500" />
              <span>Index Time</span>
            </div>
            <p className="mt-1.5 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {knowledge.ingest_duration_s ? `${knowledge.ingest_duration_s}s` : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Local ChromaDB persistent
            </p>
          </div>
        </div>

        {/* Search & Pagination Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter indexed chunks by keyword..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {filtered === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, filtered)}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-800 dark:text-slate-200">{filtered}</strong>
              {filtered !== total && ` (total ${total})`}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= filtered}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-300"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chunks Grid / List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-500" />
            Loading vector store chunks...
          </div>
        ) : chunks.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-400">
            No chunks match "{debouncedQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {chunks.map((chunk) => (
              <div
                key={chunk.index}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111726]"
              >
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                      Chunk #{chunk.index}
                    </span>
                    {chunk.metadata.page && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Page {chunk.metadata.page}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">
                      {chunk.char_count} chars
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(chunk.index, chunk.content)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      {copiedIdx === chunk.index ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 max-h-48 overflow-y-auto text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <p className="whitespace-pre-wrap">{chunk.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

