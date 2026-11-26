import apiClient from "../client";
import { apiBase } from "../base";

export type HelpBotActionStatus = "pending" | "working" | "done" | "dismissed";

/** Something the assistant prepared; nothing happens until the member confirms. */
export type HelpBotAction = { status: HelpBotActionStatus } & (
  | { type: "ticket"; subject: string; message: string; categoryId: string | null; categoryName: string | null; priority: "low" | "medium" | "high" }
  | { type: "book_call"; sessionId: string; title: string; category: string; startsAt: string; minutes: number; host: string | null }
  | { type: "cancel_call"; bookingId: string; title: string; startsAt: string }
  | { type: "habit"; habitId: string; question: string; done: boolean }
);

export interface HelpBotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: HelpBotAction[] | null;
  rating?: 1 | -1 | null;
  /** AI credits this answer used (null/absent = not charged). */
  credits?: number | null;
}

export type HelpBotEvent =
  | { t: "start"; conversationId: string }
  | { t: "tool"; name: string }
  | { t: "answer"; text: string; messageId: string | null; conversationId: string; actions: HelpBotAction[]; credits?: number }
  /** code AI_CREDITS_NEEDED: the member has too few AI credits to ask. */
  | { t: "error"; message: string; code?: string };

const BASE = "/api/help-bot";
type Res<T> = { data: T };

export async function getHelpBotStatus(): Promise<{ enabled: boolean; comingSoon: boolean }> {
  const res = (await apiClient.get(`${BASE}/status`)) as Res<{ enabled?: boolean; comingSoon?: boolean } | null>;
  return { enabled: !!res?.data?.enabled, comingSoon: !!res?.data?.comingSoon };
}

export const helpBotService = {
  conversations: async () =>
    ((await apiClient.get(`${BASE}/conversations`)) as Res<Array<{ id: string; title: string; updatedAt: string }>>).data,
  conversation: async (id: string) =>
    ((await apiClient.get(`${BASE}/conversations/${id}`)) as Res<{ messages: HelpBotMessage[] }>).data.messages,
  remove: (id: string) => apiClient.delete(`${BASE}/conversations/${id}`),
  rate: (id: string, rating: 1 | -1 | null) => apiClient.post(`${BASE}/messages/${id}/rating`, { rating }),
  moveAction: (id: string, index: number, status: HelpBotActionStatus) =>
    apiClient.post(`${BASE}/messages/${id}/actions/${index}`, { status }),
  habits: async () => ((await apiClient.get(`${BASE}/habits`)) as Res<Array<{ habitId: string; done: boolean }>>).data,
  saveHabit: (habitId: string, done: boolean) => apiClient.put(`${BASE}/habits`, { habitId, done }),
};

/** fetch, because axios can't stream. A 401 refreshes the session once, like the axios interceptor does. */
async function post(path: string, body: unknown, signal: AbortSignal): Promise<Response> {
  const send = () =>
    fetch(`${apiBase()}${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  const res = await send();
  if (res.status !== 401) return res;
  await fetch(`${apiBase()}/api/user-auth/refresh`, { method: "POST", credentials: "include" }).catch(() => undefined);
  return send();
}

async function errorBody(res: Response): Promise<{ message: string; code?: string }> {
  const j = await res.json().catch(() => null);
  return { message: typeof j?.error === "string" ? j.error : "", code: typeof j?.data?.code === "string" ? j.data.code : undefined };
}

async function errorOf(res: Response): Promise<string> {
  return (await errorBody(res)).message;
}

/** The spoken answer as PCM. Made only by this call. */
export async function fetchHelpBotSpeech(messageId: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const res = await post(`/messages/${messageId}/speech`, {}, signal);
  if (!res.ok || !res.body) throw new Error(await errorOf(res));
  return res.body;
}

export async function streamHelpBotChat(
  body: { message: string; conversationId: string | null; page: string },
  onEvent: (ev: HelpBotEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await post("/chat", body, signal);
  if (!res.ok || !res.body) return onEvent({ t: "error", ...(await errorBody(res)) });

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
        let ev: HelpBotEvent;
        try {
          ev = JSON.parse(line.slice(5).trim()) as HelpBotEvent;
        } catch {
          continue;
        }
        onEvent(ev);
      }
    }
  }
}
