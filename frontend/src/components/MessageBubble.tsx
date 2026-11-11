import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Check, Copy, Cpu, Sparkles, User } from "lucide-react";
import type { ChatMessage, RetrievedSource } from "../types/rag";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onSelectCitation: (sources: RetrievedSource[], highlightCitation?: number) => void;
}

function linkifyCitations(text: string): string {
  // Transform [Chunk 1] or [Chunk 1, 2] outside fenced code blocks into clickable citation links
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment, idx) => {
      if (idx % 2 === 1) return segment; // inside code block
      return segment.replace(
        /\[Chunk\s+(\d+(?:\s*,\s*(?:Chunk\s*)?\d+)*)\]/gi,
        (_match, group: string) => {
          const nums = group
            .split(",")
            .map((part) => part.replace(/[^\d]/g, "").trim())
            .filter(Boolean);
          return nums.map((n) => `[Chunk ${n}](#citation-${n})`).join(" ");
        }
      );
    })
    .join("");
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  onSelectCitation,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] items-start gap-2.5 sm:max-w-[75%]">
          <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <User className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    );
  }

  const sources = message.sources || [];
  const processedContent = linkifyCitations(message.content);

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-400 dark:ring-indigo-500/30">
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Assistant Answer Card */}
        <div
          className={`rounded-2xl rounded-tl-sm border px-4 py-3.5 shadow-sm ${
            message.isError
              ? "border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
              : "border-slate-200/90 bg-white text-slate-800 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-100"
          }`}
        >
          <div className="smartmate-prose">
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, ...props }) => {
                    if (href && href.startsWith("#citation-")) {
                      const num = Number(href.replace("#citation-", ""));
                      return (
                        <button
                          type="button"
                          onClick={() => onSelectCitation(sources, num)}
                          className="mx-0.5 inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-200 transition hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-indigo-500/40 dark:hover:bg-indigo-500/30"
                        >
                          {children}
                        </button>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 dark:text-indigo-400"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {processedContent}
              </ReactMarkdown>
            ) : (
              <span className="text-xs text-slate-400">Thinking...</span>
            )}
            {isStreaming && <span className="streaming-cursor" />}
          </div>

          {/* Sources Bar & Metadata */}
          {!isStreaming && message.content && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                {sources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectCitation(sources, 1)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300"
                  >
                    <BookOpen className="h-3 w-3" />
                    <span>{sources.length} Grounded Chunks</span>
                  </button>
                )}

                {sources.map((src) => (
                  <button
                    key={src.citation}
                    type="button"
                    onClick={() => onSelectCitation(sources, src.citation)}
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
                  >
                    #{src.citation}
                    {src.page ? ` p.${src.page}` : ""}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                {message.latency_ms && (
                  <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px]">
                    <Cpu className="h-3 w-3" />
                    {(message.latency_ms / 1000).toFixed(2)}s
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

