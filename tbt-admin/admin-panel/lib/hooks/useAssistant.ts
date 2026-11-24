import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[] | null;
  voice?: boolean;
}

export type AssistantEvent =
  | { t: "start"; conversationId: string }
  | { t: "tool"; name: string }
  | { t: "answer"; text: string; messageId?: string | null; conversationId: string; title: string; tools: string[] }
  | { t: "error"; message: string };

const KEY = ["admin-assistant"];

export function useAssistantStatus() {
  return useQuery({
    queryKey: [...KEY, "status"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/admin-assistant/status");
      return res.data as { enabled: boolean; keyInvalid?: boolean; tools: string[]; canTest?: boolean };
    },
  });
}

export function useAssistantConversations() {
  return useQuery({
    queryKey: [...KEY, "conversations"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/admin-assistant/conversations");
      return (res.data ?? []) as Array<{ id: string; title: string; updatedAt: string }>;
    },
  });
}

export async function fetchAssistantConversation(id: string): Promise<AssistantMessage[]> {
  const res: any = await apiClient.get(`/api/admin-assistant/conversations/${id}`);
  return res.data?.messages ?? [];
}

export function useDeleteAssistantConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/admin-assistant/conversations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "conversations"] }),
  });
}

export interface AccuracyResult {
  pass: boolean;
  expected: string[];
  missing: string[];
  answer: string;
  tools: string[];
  costUsd: number;
  hard: boolean;
  ms: number;
}

export function useAccuracyCases(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "eval"],
    enabled,
    queryFn: async () => {
      const res: any = await apiClient.get("/api/admin-assistant/eval");
      return (res.data ?? []) as Array<{ id: string; question: string }>;
    },
  });
}

export async function runAccuracyCase(id: string): Promise<AccuracyResult> {
  const res: any = await apiClient.post(`/api/admin-assistant/eval/${id}`, {}, { timeout: 240_000 });
  return res.data as AccuracyResult;
}

/** Datasets that no longer match the database. */
export async function runAssistantSelfTest(): Promise<{ datasets: number; failed: string[] }> {
  const res: any = await apiClient.get("/api/admin-assistant/selftest", { timeout: 120_000 });
  return res.data;
}

/** Turns a voice note (base64 WAV) into text. Throws with a message to show. */
export async function transcribeVoice(token: string | null, audio: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${apiClient.defaults.baseURL}/api/admin-assistant/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ audio }),
    signal,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.data?.text) {
    throw new Error(typeof j?.error === "string" ? j.error : "The voice note could not be processed. Please try again.");
  }
  return j.data.text as string;
}

/** The spoken form of a saved answer, as it is made (16-bit mono PCM). Throws with a message to show. */
export async function fetchAnswerSpeech(token: string | null, messageId: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${apiClient.defaults.baseURL}/api/admin-assistant/messages/${messageId}/speech`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => null);
    throw new Error(typeof j?.error === "string" ? j.error : "The voice could not be played. Please try again.");
  }
  return res.body;
}

/** Sends a question and reports each server event. fetch, because axios can't stream in the browser. */
export async function streamAssistantChat(
  token: string | null,
  body: { message: string; conversationId: string | null; voice?: boolean },
  onEvent: (ev: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${apiClient.defaults.baseURL}/api/admin-assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => null);
    const e = j?.error;
    onEvent({ t: "error", message: (typeof e === "string" ? e : e?.message) || "Could not reach the assistant." });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim()) as AssistantEvent;
        if (ev.t === "answer" || ev.t === "error") finished = true;
        onEvent(ev);
      } catch {
        /* ignore a malformed line */
      }
    }
  }
  if (!finished) onEvent({ t: "error", message: "The connection was lost before the answer arrived. Please try again." });
}
