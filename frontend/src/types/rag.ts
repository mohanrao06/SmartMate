export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  badge: string;
  description: string;
}

export interface KnowledgeStatus {
  active: boolean;
  source_id: string | null;
  source_name: string | null;
  source_type: string | null;
  chunk_count: number;
  total_chars: number;
  page_count: number | null;
  summary: string;
  ingested_at: string | null;
  ingest_duration_s: number | null;
  embedding_model: string;
}

export interface HealthResponse {
  status: string;
  groq_configured: boolean;
  embedding_model: string;
  models: ModelInfo[];
  knowledge: KnowledgeStatus;
}

export interface RetrievedSource {
  citation: number;
  content: string;
  char_count: number;
  source: string;
  page: number | null;
  chunk_index?: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedSource[];
  model?: string;
  latency_ms?: number;
  timestamp: string;
  isError?: boolean;
}

export interface ChunkItem {
  index: number;
  content: string;
  char_count: number;
  metadata: {
    source: string;
    page: number | null;
  };
}

export interface ChunksResponse {
  total: number;
  filtered: number;
  chunks: ChunkItem[];
}

export interface IngestProgress {
  stage: "extract" | "purge" | "chunk" | "embed" | "summary" | "done";
  message: string;
  percent: number;
}

export type ActiveTab = "chat" | "inspector";

