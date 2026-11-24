import apiClient from "../client";
import { apiBase } from "../base";

export interface HelpBotTurn {
  role: "user" | "assistant";
  content: string;
}

export type HelpBotEvent =
  | { t: "delta"; text: string }
  | { t: "reset" }
  | { t: "done" }
  | { t: "error"; message: string };

export async function getHelpBotStatus(): Promise<{ enabled: boolean }> {
  const res = (await apiClient.get("/api/help-bot/status")) as { data?: { enabled?: boolean } };
  return { enabled: !!res?.data?.enabled };
}

async function postChat(body: string, signal: AbortSignal): Promise<Response> {
  return fetch(`${apiBase()}/api/help-bot/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body,
    signal,
  });
}

/**
 * Streams the assistant's answer. Calls `onEvent` for each server event.
 * Uses fetch (not axios) so the answer renders token by token. A 401 refreshes
 * the session once and retries, like the axios interceptor does.
 */
export async function streamHelpBotChat(
  messages: HelpBotTurn[],
  page: string,
  onEvent: (ev: HelpBotEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const body = JSON.stringify({ messages, page });
  let res = await postChat(body, signal);
  if (res.status === 401) {
    await fetch(`${apiBase()}/api/user-auth/refresh`, { method: "POST", credentials: "include" }).catch(() => undefined);
    res = await postChat(body, signal);
  }
  if (!res.ok || !res.body) {
    let message = "";
    try {
      const j = await res.json();
      message = typeof j?.error === "string" ? j.error : "";
    } catch { /* not JSON */ }
    onEvent({ t: "error", message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          onEvent(JSON.parse(line.slice(5).trim()) as HelpBotEvent);
        } catch { /* ignore a malformed line */ }
      }
    }
  }
}
