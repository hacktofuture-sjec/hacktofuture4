/**
 * Chat session list + active session view.
 *
 * Talks to the Django chat endpoints:
 *   GET  /chat/sessions/
 *   POST /chat/sessions/
 *   GET  /chat/sessions/{id}/messages/
 *   POST /chat/sessions/{id}/send/     — SSE-capable
 *
 * We attempt the SSE stream first; if the backend returns plain JSON we fall
 * back to a one-shot message.
 */
import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import { chatApi, extractError, unwrap } from '../api';
import type { ChatMessage, ChatSession } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  SectionHeader,
  Spinner,
  formatDate,
} from '../components/ui';

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const res = await chatApi.listSessions();
      const list = unwrap(res);
      setSessions(list);
      if (!activeId && list.length) setActiveId(list[0].id);
    } catch (err) {
      setSessionsError(extractError(err));
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadMessages = async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await chatApi.messages(id);
      setMessages(unwrap(res));
    } catch (err) {
      setSendError(extractError(err));
    } finally {
      setLoadingMessages(false);
    }
  };

  // Both effects are intentionally mount-only / activeId-only: the loader
  // closures are defined inside the component but only read setters and the
  // captured `activeId` param, so re-running when their identity changes
  // would just cause redundant re-fetches.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const createSession = async () => {
    try {
      const s = await chatApi.createSession({ title: 'New conversation' });
      setSessions((prev) => [s, ...prev]);
      setActiveId(s.id);
    } catch (err) {
      setSessionsError(extractError(err));
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await chatApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (err) {
      setSessionsError(extractError(err));
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setStreaming('');
    setSendError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        session_id: activeId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft('');

    try {
      let buffer = '';
      await chatApi.sendStream(
        activeId,
        { message: text },
        (chunk) => {
          // SSE events carry JSON frames (reasoning_step / final_answer) or
          // plain text tokens. We try JSON first, fall back to raw text.
          try {
            const evt = JSON.parse(chunk) as {
              event?: string;
              content?: string;
              delta?: string;
            };
            const piece = evt.content ?? evt.delta ?? '';
            if (piece) {
              buffer += piece;
              setStreaming(buffer);
            }
          } catch {
            buffer += chunk;
            setStreaming(buffer);
          }
        }
      );
      // Finalize the assistant message.
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          session_id: activeId,
          role: 'assistant',
          content: buffer,
          created_at: new Date().toISOString(),
        },
      ]);
      setStreaming('');
    } catch (streamErr) {
      // Fall back to JSON endpoint.
      try {
        const res = await chatApi.send(activeId, { message: text });
        setMessages((prev) => [...prev, res]);
      } catch (err) {
        setSendError(extractError(err) || extractError(streamErr));
      }
    } finally {
      setSending(false);
    }
  };

  const active = sessions.find((s) => s.id === activeId);

  return (
    <>
      <SectionHeader
        title="Chat"
        subtitle="Conversational analytics over your normalized product data."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 min-h-[70vh]">
        {/* Session list */}
        <Card className="p-3 flex flex-col">
          <Button
            variant="subtle"
            onClick={createSession}
            className="w-full flex items-center justify-center gap-1.5 mb-3"
          >
            <Plus className="w-3.5 h-3.5" />
            New conversation
          </Button>

          {loadingSessions ? (
            <Spinner />
          ) : sessionsError ? (
            <ErrorBanner message={sessionsError} />
          ) : sessions.length === 0 ? (
            <EmptyState icon={<MessageSquare className="w-5 h-5" />} title="No sessions" />
          ) : (
            <ul className="flex-1 overflow-y-auto space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveId(s.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] transition-all flex items-center gap-2 ${
                      activeId === s.id
                        ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/25'
                        : 'text-gray-400 border border-transparent hover:bg-white/[0.04]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 truncate">{s.title || 'Untitled'}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      className="text-gray-600 hover:text-red-400 p-1 rounded cursor-pointer"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Thread */}
        <Card className="flex flex-col">
          {!active ? (
            <EmptyState
              title="Select a conversation"
              hint="Or start a new one from the left."
            />
          ) : (
            <>
              <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{active.title || 'Untitled'}</p>
                  <p className="text-[11px] text-gray-500">
                    Created {formatDate(active.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {loadingMessages ? (
                  <Spinner />
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="Start the conversation"
                    hint="Ask about tickets, insights, or your integrations."
                  />
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-2.5 ${
                        m.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {m.role !== 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-300" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          m.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : 'bg-white/[0.04] border border-white/[0.06] text-gray-300 rounded-bl-md'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  ))
                )}

                {streaming && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
                    </div>
                    <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm bg-white/[0.04] border border-white/[0.06] text-gray-300 rounded-bl-md whitespace-pre-wrap">
                      {streaming}
                    </div>
                  </div>
                )}

                {sendError && <ErrorBanner message={sendError} />}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="border-t border-white/[0.05] p-3 flex items-center gap-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message…"
                  className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="flex items-center gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
