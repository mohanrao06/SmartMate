import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import type {
  ChatMessage,
  IngestProgress,
  KnowledgeStatus,
  RetrievedSource,
} from "../types/rag";
import { MessageBubble } from "./MessageBubble";
import { WelcomeScreen } from "./WelcomeScreen";

interface ChatAreaProps {
  knowledge: KnowledgeStatus;
  messages: ChatMessage[];
  isStreaming: boolean;
  isIngesting: boolean;
  ingestProgress: IngestProgress | null;
  ingestError: string | null;
  selectedModelName: string;
  retrievalK: number;
  onSendMessage: (query: string) => void;
  onStopStreaming: () => void;
  onSelectCitation: (sources: RetrievedSource[], highlightCitation?: number) => void;
  onIngestFile: (file: File) => void;
  onIngestUrl: (url: string) => void;
}

const STARTER_PROMPTS = [
  {
    icon: Sparkles,
    label: "Executive Takeaways",
    prompt:
      "Provide a structured breakdown of the 3 to 5 most important concepts and takeaways in this source.",
  },
  {
    icon: ListChecks,
    label: "Problems & Solutions",
    prompt:
      "What core challenges, problems, or trade-offs are identified in this material, and how are they solved?",
  },
  {
    icon: HelpCircle,
    label: "Quiz Me (3 Questions)",
    prompt:
      "Create 3 insightful comprehension questions based strictly on this content, and include concise model answers.",
  },
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  knowledge,
  messages,
  isStreaming,
  isIngesting,
  ingestProgress,
  ingestError,
  selectedModelName,
  retrievalK,
  onSendMessage,
  onStopStreaming,
  onSelectCitation,
  onIngestFile,
  onIngestUrl,
}) => {
  const [input, setInput] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    // Expand summary automatically whenever a fresh document is indexed
    setSummaryOpen(true);
  }, [knowledge.source_id]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !knowledge.active) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  if (!knowledge.active) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50/40 dark:bg-[#0B0F17]">
        <WelcomeScreen
          onIngestFile={onIngestFile}
          onIngestUrl={onIngestUrl}
          isIngesting={isIngesting}
          ingestProgress={ingestProgress}
          ingestError={ingestError}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/40 dark:bg-[#0B0F17]">
      {/* Scrollable Conversation Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* AI Executive Summary Card */}
          {knowledge.summary && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111726]">
              <button
                type="button"
                onClick={() => setSummaryOpen(!summaryOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Executive Brief · {knowledge.source_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {knowledge.chunk_count} chunks ·{" "}
                    {knowledge.ingest_duration_s ? `${knowledge.ingest_duration_s}s` : ""}
                  </span>
                  {summaryOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {summaryOpen && (
                <div className="border-t border-slate-100 px-4 py-3.5 text-sm text-slate-700 dark:border-slate-800/80 dark:text-slate-300">
                  <div className="smartmate-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {knowledge.summary}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Starter Prompt Pills (shown when conversation hasn't started yet) */}
          {messages.length === 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Suggested Questions
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {STARTER_PROMPTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => onSendMessage(item.prompt)}
                      className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#111726] dark:hover:border-indigo-700"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                        <Icon className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{item.label}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="space-y-5">
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && isLast && msg.role === "assistant"}
                  onSelectCitation={onSelectCitation}
                />
              );
            })}
          </div>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Floating Input Composer */}
      <div className="border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0B0F17]/95 sm:px-6 shrink-0">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/15 dark:border-slate-800 dark:bg-[#111726]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Ask a question about ${knowledge.source_name || "your document"}...`}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                title="Stop generating"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white transition hover:bg-rose-700"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                title="Send message (Enter)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              Strictly grounded · MMR Top-{retrievalK}
            </span>
            <span className="hidden sm:inline font-mono text-[10px]">
              {selectedModelName} · Enter to send, Shift+Enter for newline
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

