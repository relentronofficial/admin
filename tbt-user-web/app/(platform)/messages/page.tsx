'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Plus, Send, Loader2, X } from 'lucide-react';
import { useSiteConfig } from '@/lib/context/SiteConfigContext';
import {
  useConversations,
  useConversationMessages,
  useStartConversation,
  useSendChatMessage,
} from '@/lib/hooks/useDashboard';
import { useMe } from '@/lib/hooks/useUser';
import { getSocket } from '@/lib/socket/client';
import { useQueryClient } from '@tanstack/react-query';
import { timeAgo } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';

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
  const typingTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef                = useRef<HTMLDivElement>(null);
  // Cached socket reference — avoids async getSocket() on every keystroke
  const socketRef                     = useRef<Socket | null>(null);

  const { data: convoData }  = useConversations();
  const { data: msgData }    = useConversationMessages(activeId);
  const startConversation    = useStartConversation();
  const sendMessage          = useSendChatMessage();

  const conversations = (convoData as any)?.data ?? [];
  const messages      = (msgData as any)?.data ?? [];
  const activeMeta    = (msgData as any)?.meta ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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

    getSocket().then((s) => {
      if (!mounted) return;
      socketRef.current = s;
      s.emit('chat:join', { conversationId: activeId });
      s.on('chat:message', handleMessage);
      s.on('chat:typing', handleTyping);
      s.on('chat:conversation_closed', handleClosed);
    });

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { conversationId: activeId });
        socketRef.current.off('chat:message', handleMessage);
        socketRef.current.off('chat:typing', handleTyping);
        socketRef.current.off('chat:conversation_closed', handleClosed);
      }
      socketRef.current = null;
    };
  }, [activeId, queryClient]);

  // Synchronous — uses cached socketRef instead of async getSocket()
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (!activeId || !socketRef.current) return;
    socketRef.current.emit('chat:typing', { conversationId: activeId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { conversationId: activeId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [activeId]);

  const handleSend = async () => {
    if (!activeId || !input.trim()) return;
    const body = input.trim();
    setInput('');

    // Optimistic update — message appears instantly without waiting for refetch
    const optimisticId = `opt-${Date.now()}`;
    queryClient.setQueryData(
      ['user', 'conversations', activeId, 'messages'],
      (old: any) => {
        if (!old) return old;
        const optimistic = {
          id: optimisticId,
          body,
          senderType: 'member',
          senderName: me?.firstName ?? 'You',
          senderAvatarUrl: me?.avatarUrl ?? null,
          createdAt: new Date().toISOString(),
        };
        return { ...old, data: [...(old.data ?? []), optimistic] };
      }
    );

    try {
      await sendMessage.mutateAsync({ conversationId: activeId, body });
      // Replace optimistic entry with the real one from the server
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
    } catch {
      // Roll back the optimistic entry
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
    if (!newSubject.trim() || !newBody.trim()) {
      return toast.error('Subject and message are required');
    }
    try {
      const res: any = await startConversation.mutateAsync({
        subject: newSubject.trim(),
        body: newBody.trim(),
      });
      setNewSubject('');
      setNewBody('');
      setShowNewForm(false);
      setActiveId(res?.data?.id ?? null);
    } catch {
      toast.error('Failed to start conversation');
    }
  };

  return (
    <div
      className="flex h-[calc(100vh-140px)] rounded-xl border overflow-hidden"
      style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)' }}
    >
      {/* ── Left pane: conversation list ───────────────────────────────────── */}
      <div
        className="w-72 flex-shrink-0 border-r flex flex-col"
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
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b transition-colors',
                  activeId === c.id && 'bg-accent/10'
                )}
                style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{c.subject}</p>
                  {c.memberUnreadCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ background: 'var(--color-accent)' }}
                    >
                      {c.memberUnreadCount}
                    </span>
                  )}
                </div>
                {c.lastMessage && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.lastMessage.senderType === 'member' ? 'You: ' : ''}
                    {c.lastMessage.body}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(c.lastMessageAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right pane: chat thread ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
        {activeId && activeMeta ? (
          <>
            <div
              className="px-5 py-3 border-b flex items-center justify-between"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                background: 'var(--color-bg-surface)',
              }}
            >
              <div>
                <p className="font-semibold text-sm text-foreground">{activeMeta.subject}</p>
                <p className="text-xs text-muted-foreground capitalize">{activeMeta.status}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((m: any) => {
                const isMe = m.senderType === 'member';
                return (
                  <div key={m.id} className={cn('flex gap-2.5', isMe && 'flex-row-reverse')}>
                    <Avatar
                      avatarUrl={isMe ? me?.avatarUrl : m.senderAvatarUrl}
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

              {isTyping && (
                <p className="text-xs text-muted-foreground pl-10 italic animate-pulse">
                  TBT Team {uiStrings?.chatTypingText}
                </p>
              )}

              {activeMeta.status === 'closed' && (
                <p className="text-center text-xs text-muted-foreground py-2 italic">
                  {uiStrings?.chatClosedLabel}
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {activeMeta.status === 'open' && (
              <div
                className="px-4 py-3 border-t flex items-end gap-2"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                  background: 'var(--color-bg-surface)',
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Write a message..."
                  className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground leading-relaxed"
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
            )}
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
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Message
              </label>
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
