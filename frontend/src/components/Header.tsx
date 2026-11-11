import React from "react";
import {
  Database,
  Download,
  MessageSquare,
  Moon,
  PanelLeftOpen,
  PanelRightOpen,
  RotateCcw,
  Sun,
} from "lucide-react";
import type { ActiveTab, KnowledgeStatus } from "../types/rag";

interface HeaderProps {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  knowledge: KnowledgeStatus;
  hasMessages: boolean;
  onExportChat: () => void;
  onClearChat: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  onOpenSidebar,
  drawerOpen,
  onToggleDrawer,
  activeTab,
  onTabChange,
  knowledge,
  hasMessages,
  onExportChat,
  onClearChat,
  darkMode,
  onToggleTheme,
}) => {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0B0F17]/90 shrink-0">
      {/* Left: Sidebar toggle + Context Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {!sidebarOpen && (
          <button
            onClick={onOpenSidebar}
            title="Open sidebar"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Workspace
          </span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          {knowledge.active ? (
            <span
              className="truncate max-w-[220px] md:max-w-[320px] text-xs font-semibold text-slate-800 dark:text-slate-100"
              title={knowledge.source_name || ""}
            >
              {knowledge.source_name}
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Ready to ingest
            </span>
          )}
        </div>
      </div>

      {/* Center: View Switcher */}
      <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
            activeTab === "chat"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Chat</span>
        </button>
        <button
          onClick={() => onTabChange("inspector")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
            activeTab === "inspector"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Inspector</span>
          {knowledge.active && (
            <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-mono font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {knowledge.chunk_count}
            </span>
          )}
        </button>
      </div>

      {/* Right: Utility Buttons */}
      <div className="flex items-center gap-1.5">
        {hasMessages && (
          <>
            <button
              onClick={onExportChat}
              title="Export chat as Markdown"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
            </button>
            <button
              onClick={onClearChat}
              title="Reset conversation"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        <button
          onClick={onToggleTheme}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={onToggleDrawer}
          title="Toggle citations drawer"
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            drawerOpen
              ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Sources</span>
        </button>
      </div>
    </header>
  );
};

