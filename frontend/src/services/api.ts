import type {
  ChunksResponse,
  HealthResponse,
  IngestProgress,
  KnowledgeStatus,
  RetrievedSource,
} from "../types/rag";

async function parseSSEStream(
  response: Response,
  handlers: {
    onEvent: (eventName: string, data: unknown) => void;
  }
): Promise<void> {
  if (!response.ok) {
    let errText = `HTTP ${response.status}`;
    try {
      const json = await response.json();
      if (json?.detail) errText = json.detail;
    } catch {
      const txt = await response.text();
      if (txt) errText = txt;
    }
    throw new Error(errText);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported by browser.");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Normalize CRLF -> LF just in case
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundaryIdx = buffer.indexOf("\n\n");
    while (boundaryIdx !== -1) {
      const rawFrame = buffer.slice(0, boundaryIdx);
      buffer = buffer.slice(boundaryIdx + 2);

      if (rawFrame.trim()) {
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of rawFrame.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length > 0) {
          const joined = dataLines.join("\n");
          try {
            const parsed = JSON.parse(joined);
            handlers.onEvent(eventName, parsed);
          } catch {
            handlers.onEvent(eventName, joined);
          }
        }
      }

      boundaryIdx = buffer.indexOf("\n\n");
    }
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Failed to reach API (${res.status})`);
  return res.json();
}

export async function fetchKnowledge(): Promise<KnowledgeStatus> {
  const res = await fetch("/api/knowledge");
  if (!res.ok) throw new Error("Failed to load knowledge status");
  return res.json();
}

export async function fetchChunks(
  query: string = "",
  offset: number = 0,
  limit: number = 40
): Promise<ChunksResponse> {
  const params = new URLSearchParams({
    q: query,
    offset: String(offset),
    limit: String(limit),
  });
  const res = await fetch(`/api/knowledge/chunks?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load document chunks");
  return res.json();
}

export async function deleteKnowledge(): Promise<KnowledgeStatus> {
  const res = await fetch("/api/knowledge", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete knowledge base");
  const json = await res.json();
  return json.knowledge;
}

interface IngestCallbacks {
  onProgress: (progress: IngestProgress) => void;
  onComplete: (status: KnowledgeStatus) => void;
}

export async function ingestFile(
  file: File,
  model: string,
  callbacks: IngestCallbacks
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("model", model);

  const res = await fetch("/api/ingest/file", {
    method: "POST",
    body: form,
  });

  let streamError: string | null = null;
  await parseSSEStream(res, {
    onEvent: (eventName, data) => {
      if (eventName === "progress") {
        callbacks.onProgress(data as IngestProgress);
      } else if (eventName === "complete") {
        callbacks.onComplete(data as KnowledgeStatus);
      } else if (eventName === "error") {
        const err = data as { message?: string };
        streamError = err?.message || "Unknown ingestion error";
      }
    },
  });

  if (streamError) throw new Error(streamError);
}

export async function ingestUrl(
  url: string,
  model: string,
  callbacks: IngestCallbacks
): Promise<void> {
  const res = await fetch("/api/ingest/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, model }),
  });

  let streamError: string | null = null;
  await parseSSEStream(res, {
    onEvent: (eventName, data) => {
      if (eventName === "progress") {
        callbacks.onProgress(data as IngestProgress);
      } else if (eventName === "complete") {
        callbacks.onComplete(data as KnowledgeStatus);
      } else if (eventName === "error") {
        const err = data as { message?: string };
        streamError = err?.message || "Failed to fetch URL";
      }
    },
  });

  if (streamError) throw new Error(streamError);
}

export async function ingestText(
  text: string,
  label: string,
  model: string,
  callbacks: IngestCallbacks
): Promise<void> {
  const res = await fetch("/api/ingest/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, label, model }),
  });

  let streamError: string | null = null;
  await parseSSEStream(res, {
    onEvent: (eventName, data) => {
      if (eventName === "progress") {
        callbacks.onProgress(data as IngestProgress);
      } else if (eventName === "complete") {
        callbacks.onComplete(data as KnowledgeStatus);
      } else if (eventName === "error") {
        const err = data as { message?: string };
        streamError = err?.message || "Failed to process text";
      }
    },
  });

  if (streamError) throw new Error(streamError);
}

export async function streamChat(
  params: {
    query: string;
    model: string;
    k: number;
    chatHistory: Array<{ role: string; content: string }>;
    signal?: AbortSignal;
  },
  callbacks: {
    onSources: (sources: RetrievedSource[]) => void;
    onToken: (token: string) => void;
    onDone: (meta: { latency_ms: number; model: string }) => void;
  }
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: params.signal,
    body: JSON.stringify({
      query: params.query,
      model: params.model,
      k: params.k,
      chat_history: params.chatHistory,
    }),
  });

  let streamError: string | null = null;
  await parseSSEStream(res, {
    onEvent: (eventName, data) => {
      if (eventName === "sources") {
        const payload = data as { sources: RetrievedSource[] };
        callbacks.onSources(payload.sources || []);
      } else if (eventName === "token") {
        const payload = data as { content?: string };
        if (payload?.content) callbacks.onToken(payload.content);
      } else if (eventName === "done") {
        callbacks.onDone(data as { latency_ms: number; model: string });
      } else if (eventName === "error") {
        const payload = data as { message?: string };
        streamError = payload?.message || "Streaming generation failed";
      }
    },
  });

  if (streamError) throw new Error(streamError);
}

