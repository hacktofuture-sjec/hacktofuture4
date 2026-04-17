/**
 * chat.urls — AI-assisted chat sessions, history, SSE sends.
 */
import { API_BASE, apiDelete, apiGet, apiPost, tokenStore } from './client';
import type { ChatMessage, ChatSession, Paginated } from './types';

export const chatApi = {
  listSessions: () =>
    apiGet<Paginated<ChatSession> | ChatSession[]>('/chat/sessions/'),

  createSession: (body?: { title?: string }) =>
    apiPost<ChatSession>('/chat/sessions/', body ?? {}),

  getSession: (id: string) => apiGet<ChatSession>(`/chat/sessions/${id}/`),

  deleteSession: (id: string) =>
    apiDelete<{ detail?: string }>(`/chat/sessions/${id}/`),

  messages: (id: string) =>
    apiGet<Paginated<ChatMessage> | ChatMessage[]>(
      `/chat/sessions/${id}/messages/`
    ),

  /**
   * Send a message; Django stores user + assistant rows after calling the agent.
   * Body must use `content` (alias `message` also accepted server-side).
   */
  send: (id: string, body: { content: string }) =>
    apiPost<{
      user_message: ChatMessage;
      assistant_message: ChatMessage;
    }>(`/chat/sessions/${id}/send/`, body),

  /**
   * Server-Sent Events streaming sender. The backend is documented to return
   * an SSE stream from this endpoint, so we use `fetch` (not axios) because
   * axios in the browser cannot expose a streaming body.
   *
   * Emits each incoming event chunk via `onEvent`. Resolves when the stream
   * closes cleanly; rejects on network/HTTP error.
   */
  async sendStream(
    id: string,
    body: { message: string },
    onEvent: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const token = tokenStore.getAccess();
    const res = await fetch(`${API_BASE}/chat/sessions/${id}/send/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`SSE request failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // SSE frames are separated by \n\n.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        // Emit the `data:` payload lines only (concat multi-line data).
        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length) onEvent(dataLines.join('\n'));
      }
    }
  },
};
