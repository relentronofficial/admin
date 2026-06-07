'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Plus, Send, Loader2, X, ChevronLeft, Archive } from 'lucide-react';
import { useSiteConfig } from '@/lib/context/SiteConfigContext';
import {
  useConversations,
  useConversationMessages,
  useStartConversation,
  useSendChatMessage,
  useArchiveConversation,
} from '@/lib/hooks/useDashboard';
import { useMe } from '@/lib/hooks/useUser';
import { getSocket } from '@/lib/socket/client';
import { useQueryClient } from '@tanstack/react-query';
import { timeAgo } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  avatarUrl,
  name,
  size = 28,
  style,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  style?: React.CSSProperties;
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? ''}
        width={size}
        height={size}
        className="rounded-full flex-shrink-0 object-cover"
        style={{ width: size, height: size, ...style }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
          (e.currentTarget.nextSibling as HTMLElement | null)?.style?.removeProperty('display');
        }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
      style={{ width: size, height: size, ...style }}
    >
      {initial}
    </div>
  );
}

// ── Date separator helpers ────────────────────────────────────────────────────

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const sameYear = now.getFullYear() === d.getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) });
}

function groupMessagesByDay(msgs: any[]): { label: string; messages: any[] }[] {
  const groups: { label: string; messages: any[] }[] = [];
  for (const m of msgs) {
    const label = getDateLabel(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(m);
    else groups.push({ label, messages: [m] });
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────

const TYPING_DEBOUNCE_MS = 2000;

export default function MessagesPage() {
  const { uiStrings } = useSiteConfig();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [activeId, setActiveId]       = useState<string | null>(null);
  const [input, setInput]             = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject]   = useState('');
  const [newBody, setNewBody]         = useState('');
  const [mobileView, setMobileView]   = useState<'list' | 'chat'>('list');

  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef      = useRef<Socket | null>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  const { data: convoData }  = useConversations();
  const { data: msgData }    = useConversationMessages(activeId);
  const startConversation    = useStartConversation();
  const sendMessage          = useSendChatMessage();
  const archiveConversation  = useArchiveConversation();

  const conversations  = (convoData as any)?.data ?? [];
  const messages       = (msgData as any)?.data ?? [];
  const activeMeta     = (msgData as any)?.meta ?? null;
  const messageGroups  = groupMessagesByDay(messages);

  // Auto-select first conversation on initial load
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // Scroll to bottom instantly on conversation switch, smoothly on new messages
  useEffect(() => {
    if (!activeId) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Socket: join conversation room
  useEffect(() => {
    if (!activeId) return;
    let mounted = true;

    const handleMessage = ({ conversationId }: any) => {
      if (conversationId !== activeId) return;
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
    };

    const handleTyping = ({ senderType, isTyping: t }: any) => {
      if (senderType === 'admin') setIsTyping(t);
    };

    const handleClosed = ({ conversationId: cid }: any) => {
      if (cid !== activeId) return;
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
    };

    const handleReopened = ({ conversationId: cid }: any) => {
      if (cid !== activeId) return;
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
    };

    getSocket().then((s) => {
      if (!mounted) return;
      socketRef.current = s;
      s.emit('chat:join', { conversationId: activeId });
      s.on('chat:message', handleMessage);
      s.on('chat:typing', handleTyping);
      s.on('chat:conversation_closed', handleClosed);
      s.on('chat:conversation_reopened', handleReopened);
    });

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { conversationId: activeId });
        socketRef.current.off('chat:message', handleMessage);
        socketRef.current.off('chat:typing', handleTyping);
        socketRef.current.off('chat:conversation_closed', handleClosed);
        socketRef.current.off('chat:conversation_reopened', handleReopened);
      }
      socketRef.current = null;
    };
  }, [activeId, queryClient]);

  // Auto-grow textarea (max ~4 rows / 96px)
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  }

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    autoResize();
    if (!activeId || !socketRef.current) return;
    socketRef.current.emit('chat:typing', { conversationId: activeId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { conversationId: activeId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [activeId]);

  function selectConversation(id: string) {
    setActiveId(id);
    setMobileView('chat');
    setIsTyping(false);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  const handleSend = async () => {
    if (!activeId || !input.trim()) return;
    const body = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const optimisticId = `opt-${Date.now()}`;
    queryClient.setQueryData(
      ['user', 'conversations', activeId, 'messages'],
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: [...(old.data ?? []), {
            id: optimisticId,
            body,
            senderType: 'member',
            senderName: me?.firstName ?? 'You',
            senderAvatarUrl: (me as any)?.avatarUrl ?? null,
            createdAt: new Date().toISOString(),
          }],
        };
      }
    );

    try {
      await sendMessage.mutateAsync({ conversationId: activeId, body });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
    } catch {
      queryClient.setQueryData(
        ['user', 'conversations', activeId, 'messages'],
        (old: any) => {
          if (!old) return old;
          return { ...old, data: (old.data ?? []).filter((m: any) => m.id !== optimisticId) };
        }
      );
      toast.error('Failed to send message');
    }
  };

  const handleStart = async () => {
    if (!newSubject.trim() || !newBody.trim()) return toast.error('Subject and message are required');
    try {
      const res: any = await startConversation.mutateAsync({ subject: newSubject.trim(), body: newBody.trim() });
      setNewSubject('');
      setNewBody('');
      setShowNewForm(false);
      const newId = res?.data?.id ?? null;
      if (newId) selectConversation(newId);
    } catch {
      toast.error('Failed to start conversation');
    }
  };

  const isClosed = activeMeta?.status === 'closed';

  return (
    <div
      className="flex h-[calc(100vh-140px)] rounded-xl border overflow-hidden"
      style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)' }}
    >
      {/* ── Left pane: conversation list ───────────────────────────────────── */}
      <div
        className={cn(
          'w-full lg:w-72 lg:flex-shrink-0 border-r flex flex-col',
          mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
        )}
        style={{
          borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
          background: 'var(--color-bg-surface)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
        >
          <h2 className="font-bold text-sm text-foreground">{uiStrings?.chatPageTitle}</h2>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded"
            style={{ color: 'var(--color-accent)' }}
          >
            <Plus size={12} /> {uiStrings?.chatNewLabel}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs text-muted-foreground">{uiStrings?.chatEmptyTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{uiStrings?.chatEmptyDesc}</p>
            </div>
          ) : (
            conversations.map((c: any) => (
              <div
                key={c.id}
                className={cn(
                  'group relative w-full text-left px-4 py-3 border-b transition-colors cursor-pointer',
                  activeId === c.id ? 'bg-accent/10' : 'hover:bg-white/[0.03]'
                )}
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                  background: activeId === c.id
                    ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
                    : undefined,
                }}
                onClick={() => selectConversation(c.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate flex-1">{c.subject}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.memberUnreadCount > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        {c.memberUnreadCount}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveConversation.mutate({ id: c.id, hidden: true });
                        if (activeId === c.id) { setActiveId(null); setMobileView('list'); }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
                      title="Archive"
                    >
                      <Archive size={12} />
                    </button>
                  </div>
                </div>
                {c.lastMessage && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.lastMessage.senderType === 'member' ? 'You: ' : ''}
                    {c.lastMessage.body}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  {c.status === 'closed' && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Closed •</span>
                  )}
                  <p className="text-[10px] text-muted-foreground">{timeAgo(c.lastMessageAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right pane: chat thread ─────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-1 flex flex-col',
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        )}
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {activeId && activeMeta ? (
          <>
            {/* Thread header */}
            <div
              className="px-4 py-3 border-b flex items-center gap-3"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                background: 'var(--color-bg-surface)',
              }}
            >
              <button
                onClick={() => setMobileView('list')}
                className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{activeMeta.subject}</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: isClosed ? '#6b7280' : 'var(--color-success, #22c55e)' }}
                  >
                    {activeMeta.status}
                  </span>
                  {isClosed && (
                    <span className="text-[10px] text-muted-foreground">— reply to reopen</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messageGroups.map(({ label, messages: dayMsgs }) => (
                <div key={label} className="space-y-3">
                  {/* Date separator */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">
                      {label}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>

                  {dayMsgs.map((m: any) => {
                    const isMe = m.senderType === 'member';
                    return (
                      <div key={m.id} className={cn('flex gap-2.5', isMe && 'flex-row-reverse')}>
                        <Avatar
                          avatarUrl={isMe ? (me as any)?.avatarUrl : m.senderAvatarUrl}
                          name={isMe ? me?.firstName : m.senderName}
                          size={28}
                          style={{ background: isMe ? 'var(--color-accent)' : '#444' }}
                        />
                        <div
                          className={cn(
                            'max-w-[65%] rounded-2xl px-3.5 py-2',
                            isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'
                          )}
                          style={{
                            background: isMe
                              ? 'color-mix(in srgb, var(--color-accent) 20%, transparent)'
                              : 'var(--color-bg-surface)',
                          }}
                        >
                          <p className="text-sm text-foreground leading-relaxed">{m.body}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">
                            {timeAgo(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {isTyping && (
                <p className="text-xs text-muted-foreground pl-10 italic animate-pulse">
                  TBT Team {uiStrings?.chatTypingText}
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area — always visible; closed conversations reopen on reply */}
            <div
              className="px-4 py-3 border-t flex items-end gap-2"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                background: 'var(--color-bg-surface)',
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={
                  isClosed
                    ? 'Reply to reopen this conversation…'
                    : 'Write a message… (Enter to send, Shift+Enter for new line)'
                }
                className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground leading-relaxed"
                style={{ maxHeight: 96, overflowY: 'auto' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
                style={{ background: 'var(--color-accent)' }}
              >
                {sendMessage.isPending ? (
                  <Loader2 size={13} className="animate-spin text-white" />
                ) : (
                  <Send size={13} className="text-white" />
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageSquare size={36} className="mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">{uiStrings?.chatSelectPrompt}</p>
          </div>
        )}
      </div>

      {/* ── New conversation modal ──────────────────────────────────────────── */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--color-bg-surface)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">{uiStrings?.chatNewLabel}</h3>
              <button onClick={() => setShowNewForm(false)}>
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                {uiStrings?.chatSubjectLabel}
              </label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg px-3 h-10 text-sm outline-none border text-foreground"
                style={{
                  background: 'var(--color-bg-primary)',
                  borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Message</label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border text-foreground resize-none"
                style={{
                  background: 'var(--color-bg-primary)',
                  borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
                }}
              />
            </div>
            <button
              onClick={handleStart}
              disabled={startConversation.isPending}
              className="w-full h-10 rounded-lg font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-accent)' }}
            >
              {startConversation.isPending && <Loader2 size={13} className="animate-spin" />}
              Start Conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
