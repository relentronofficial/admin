'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Archive,
  ChevronLeft,
  Copy,
  Edit3,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Reply,
  Send,
  Smile,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useSiteConfig } from '@/lib/context/SiteConfigContext';
import {
  useConversations,
  useConversationMessages,
  useStartConversation,
  useSendChatMessage,
  useArchiveConversation,
} from '@/lib/hooks/useDashboard';
import { useMyChatGroups } from '@/lib/hooks/useChatGroups';
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

// A single row in the interleaved sidebar list. WhatsApp mixes DMs and
// groups together sorted by lastMessageAt; the row payload keeps the
// original object under `data` for the click handler.
type InterleavedRow =
  | { type: 'group'; id: string; lastAt: string; data: any }
  | { type: 'dm'; id: string; lastAt: string; data: any };

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
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{
    file: File;
    previewUrl: string;
    uploading: boolean;
    uploadedUrl: string | null;
    mediaType: 'image' | 'video' | 'document' | 'audio';
  } | null>(null);

  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef      = useRef<Socket | null>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const { data: convoData }  = useConversations();
  const { data: msgData }    = useConversationMessages(activeId);
  const { data: groups = [] } = useMyChatGroups();
  const startConversation    = useStartConversation();
  const sendMessage          = useSendChatMessage();
  const archiveConversation  = useArchiveConversation();

  const conversations  = (convoData as any)?.data ?? [];
  const messages       = (msgData as any)?.data ?? [];
  const activeMeta     = (msgData as any)?.meta ?? null;
  const messageGroups  = groupMessagesByDay(messages);

  // Interleaved list: mix groups + DMs by lastMessageAt descending. Any
  // side with no timestamp bubbles to the bottom.
  const rows: InterleavedRow[] = useMemo(() => {
    const merged: InterleavedRow[] = [];
    for (const g of groups) {
      merged.push({
        type: 'group',
        id: g.id,
        lastAt: g.lastMessageAt || g.updatedAt || g.createdAt || '',
        data: g,
      });
    }
    for (const c of conversations) {
      merged.push({
        type: 'dm',
        id: c.id,
        lastAt: c.lastMessageAt || c.updatedAt || c.createdAt || '',
        data: c,
      });
    }
    merged.sort((a, b) => {
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return bt - at;
    });
    return merged;
  }, [conversations, groups]);

  // Auto-select first DM on initial load
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
    setReplyingTo(null);
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large (max 20 MB)');
      return;
    }
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const mediaType: 'image' | 'video' | 'document' | 'audio' = isImage
      ? 'image'
      : isVideo
        ? 'video'
        : isAudio
          ? 'audio'
          : 'document';
    setPendingMedia({ file, previewUrl, uploading: true, uploadedUrl: null, mediaType });
    const { uploadChatMedia } = await import('@/lib/api/services/chatGroups.service');
    const uploaded = await uploadChatMedia(file);
    setPendingMedia((prev) => {
      if (!prev || prev.file !== file) return prev;
      return {
        ...prev,
        uploading: false,
        uploadedUrl: uploaded?.publicUrl ?? null,
        mediaType: uploaded?.mediaType ?? prev.mediaType,
      };
    });
  }

  const handleSend = async () => {
    if (!activeId) return;
    const body = input.trim();
    const hasReadyMedia = pendingMedia?.uploadedUrl && !pendingMedia.uploading;
    if (!body && !hasReadyMedia) return;
    if (pendingMedia?.uploading) return;

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
            mediaUrl: pendingMedia?.uploadedUrl ?? null,
            mediaType: hasReadyMedia ? pendingMedia?.mediaType : null,
            replyToId: replyingTo?.id ?? null,
            senderType: 'member',
            senderId: (me as any)?.id ?? null,
            senderName: me?.firstName ?? 'You',
            senderAvatarUrl: (me as any)?.avatarUrl ?? null,
            createdAt: new Date().toISOString(),
          }],
        };
      }
    );

    try {
      // Extended payload: DM send now accepts mediaUrl + mediaType +
      // replyToId (matches group-chat semantics). See useSendChatMessage.
      await sendMessage.mutateAsync({
        conversationId: activeId,
        body: body || '',
        mediaUrl: hasReadyMedia && pendingMedia?.uploadedUrl ? pendingMedia.uploadedUrl : undefined,
        mediaType: hasReadyMedia ? pendingMedia?.mediaType : undefined,
        replyToId: replyingTo?.id,
      });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
      setReplyingTo(null);
      if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
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
      {/* ── Left pane: unified list (groups + DMs interleaved) ───────────── */}
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
          className="relative flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
        >
          <h2 className="font-bold text-sm text-foreground">{uiStrings?.chatPageTitle}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded"
              style={{ color: 'var(--color-accent)' }}
            >
              <Plus size={12} /> {uiStrings?.chatNewLabel}
            </button>
            <button
              onClick={() => setTopMenuOpen((v) => !v)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
              aria-label="More options"
            >
              <MoreVertical size={14} />
            </button>
          </div>
          {topMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setTopMenuOpen(false)} />
              <div
                className="absolute right-2 top-full mt-1 z-40 w-44 rounded-xl overflow-hidden py-1"
                style={{
                  background: 'var(--color-modal-bg)',
                  border: '1px solid var(--color-border-medium)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
                }}
              >
                <Link
                  href="/messages/starred"
                  onClick={() => setTopMenuOpen(false)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                >
                  <Star size={13} /> Starred messages
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs text-muted-foreground">{uiStrings?.chatEmptyTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{uiStrings?.chatEmptyDesc}</p>
            </div>
          ) : (
            rows.map((row) =>
              row.type === 'group' ? (
                <GroupRow key={`g-${row.id}`} group={row.data} />
              ) : (
                <DmRow
                  key={`d-${row.id}`}
                  convo={row.data}
                  meId={(me as any)?.id ?? null}
                  activeId={activeId}
                  onSelect={() => selectConversation(row.id)}
                  onArchive={() => {
                    archiveConversation.mutate({ id: row.id, hidden: true });
                    if (activeId === row.id) { setActiveId(null); setMobileView('list'); }
                  }}
                />
              )
            )
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
                    <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">
                      {label}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
                  </div>

                  {dayMsgs.map((m: any) => {
                    const isMe = m.senderType === 'member';
                    return (
                      <DmBubble
                        key={m.id}
                        message={m}
                        isMe={isMe}
                        me={me}
                        onReply={() => setReplyingTo(m)}
                      />
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

            {/* Composer */}
            <div
              className="border-t"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                background: 'var(--color-bg-surface)',
              }}
            >
              {replyingTo && (
                <div
                  className="mx-4 mt-3 px-3 py-2 rounded-lg text-[11px] flex items-center justify-between gap-2"
                  style={{
                    background: 'var(--color-bg-primary)',
                    borderLeft: '3px solid var(--color-accent)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold" style={{ color: 'var(--color-accent)' }}>
                      Replying to {replyingTo.senderType === 'member' ? 'yourself' : (replyingTo.senderName ?? 'Team')}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {replyingTo.body
                        ? replyingTo.body.slice(0, 100)
                        : replyingTo.mediaType
                          ? `📎 ${replyingTo.mediaType}`
                          : '…'}
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {pendingMedia && (
                <div
                  className="mx-4 mt-3 px-3 py-2 rounded-lg flex items-center gap-3"
                  style={{
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'var(--color-surface-overlay)' }}
                  >
                    {pendingMedia.mediaType === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pendingMedia.previewUrl} alt="" className="w-full h-full object-cover" />
                    ) : pendingMedia.mediaType === 'video' ? (
                      <video src={pendingMedia.previewUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <FileText size={18} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {pendingMedia.file.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {pendingMedia.uploading ? 'Uploading…' : pendingMedia.uploadedUrl ? 'Ready to send' : 'Upload failed'}
                    </div>
                  </div>
                  {pendingMedia.uploading ? (
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  ) : (
                    <button
                      onClick={() => {
                        if (pendingMedia.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
                        setPendingMedia(null);
                      }}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              <div className="px-4 py-3 flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={onPickFile}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendMessage.isPending || !!pendingMedia}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] disabled:opacity-40 flex-shrink-0"
                  aria-label="Attach file"
                  title="Attach file"
                >
                  <Paperclip size={15} />
                </button>
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
                  disabled={
                    (input.trim().length === 0 && !pendingMedia?.uploadedUrl) ||
                    sendMessage.isPending ||
                    pendingMedia?.uploading
                  }
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

// ── DM bubble with hover menu ────────────────────────────────────────────────

function DmBubble({
  message,
  isMe,
  me,
  onReply,
}: {
  message: any;
  isMe: boolean;
  me: any;
  onReply: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function comingSoon(label: string) {
    toast(`${label}: coming soon`, { icon: '⏳' });
    setMenuOpen(false);
  }

  function handleCopy() {
    const text = message.body ?? '';
    if (!text) {
      toast.error('Nothing to copy');
      setMenuOpen(false);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast.success('Copied'),
        () => toast.error('Copy failed'),
      );
    }
    setMenuOpen(false);
  }

  return (
    <div className={cn('flex gap-2.5 relative group', isMe && 'flex-row-reverse')}>
      <Avatar
        avatarUrl={isMe ? (me as any)?.avatarUrl : message.senderAvatarUrl}
        name={isMe ? me?.firstName : message.senderName}
        size={28}
        style={{ background: isMe ? 'var(--color-accent)' : 'hsl(var(--muted-foreground))' }}
      />
      <div className={cn('max-w-[65%] flex flex-col', isMe && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            isMe ? 'rounded-tr-sm' : 'rounded-tl-sm',
          )}
          style={{
            background: isMe
              ? 'color-mix(in srgb, var(--color-accent) 20%, transparent)'
              : 'var(--color-bg-surface)',
          }}
        >
          {/* Reply quote */}
          {message.replyTo && (
            <div
              className="mx-1.5 mt-1.5 px-2.5 py-1.5 rounded-md text-[11px]"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                borderLeft: '3px solid var(--color-accent)',
              }}
            >
              <div className="font-bold" style={{ color: 'var(--color-accent)' }}>
                {message.replyTo.senderName ?? 'Member'}
              </div>
              <div className="text-muted-foreground truncate">
                {message.replyTo.body || (message.replyTo.mediaType ? `📎 ${message.replyTo.mediaType}` : '…')}
              </div>
            </div>
          )}

          {/* Media */}
          {message.mediaUrl && message.mediaType && (
            <DmMediaBlock
              url={message.mediaUrl}
              type={message.mediaType}
              onImageClick={() => setLightboxOpen(true)}
            />
          )}

          {message.body && (
            <p className="text-sm text-foreground leading-relaxed px-3.5 py-2 whitespace-pre-wrap break-words">
              {message.body}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0 px-3.5 pb-1.5 text-right">
            {timeAgo(message.createdAt)}
          </p>
        </div>
      </div>

      {/* Hover / persistent action button. Sits on the bubble edge; opens a
          small menu with Reply, Copy, Edit, Delete, React, Forward. Except
          Reply and Copy, the actions currently show a "coming soon" toast
          until the DM edit/delete/react backend ships. */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          'absolute top-1 w-6 h-6 rounded-full flex items-center justify-center transition-opacity',
          isMe ? 'left-8 lg:opacity-0 lg:group-hover:opacity-100' : 'right-8 lg:opacity-0 lg:group-hover:opacity-100',
        )}
        style={{
          background: 'var(--color-modal-bg)',
          border: '1px solid var(--color-border-medium)',
          color: 'var(--color-text-secondary)',
        }}
        aria-label="Message options"
      >
        <MoreVertical size={12} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className={cn(
              'absolute top-8 z-50 w-40 rounded-xl overflow-hidden py-1',
              isMe ? 'left-8' : 'right-8',
            )}
            style={{
              background: 'var(--color-modal-bg)',
              border: '1px solid var(--color-border-medium)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                onReply();
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            >
              <Reply size={13} /> Reply
            </button>
            <button
              onClick={handleCopy}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            >
              <Copy size={13} /> Copy
            </button>
            <button
              onClick={() => comingSoon('React')}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            >
              <Smile size={13} /> React
            </button>
            <button
              onClick={() => comingSoon('Forward')}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            >
              <Reply size={13} className="scale-x-[-1]" /> Forward
            </button>
            {isMe && (
              <button
                onClick={() => comingSoon('Edit')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
              >
                <Edit3 size={13} /> Edit
              </button>
            )}
            <button
              onClick={() => comingSoon('Delete for me')}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            >
              <Trash2 size={13} /> Delete for me
            </button>
            {isMe && (
              <button
                onClick={() => comingSoon('Delete for everyone')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-[var(--color-surface-overlay)]"
              >
                <Trash2 size={13} /> Delete for everyone
              </button>
            )}
          </div>
        </>
      )}

      {lightboxOpen && message.mediaUrl && message.mediaType === 'image' && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt=""
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// DM-specific media renderer. Mirrors the group chat version but uses
// slightly narrower widths appropriate to the DM pane.
function DmMediaBlock({
  url,
  type,
  onImageClick,
}: {
  url: string;
  type: string;
  onImageClick: () => void;
}) {
  const filename = (() => {
    try {
      return decodeURIComponent(url.split('/').pop() ?? 'file');
    } catch {
      return 'file';
    }
  })();

  if (type === 'image') {
    return (
      <button
        onClick={onImageClick}
        className="block w-full max-w-[300px]"
        style={{ background: '#000' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-full h-auto max-h-[300px] object-cover" loading="lazy" />
      </button>
    );
  }
  if (type === 'video') {
    return (
      <video src={url} controls preload="metadata" className="w-full max-w-[300px] max-h-[300px]" style={{ background: '#000' }} />
    );
  }
  if (type === 'audio') {
    return <audio src={url} controls preload="metadata" className="w-full max-w-[300px]" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 m-1.5 p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-surface-overlay)' }}
      >
        <FileText size={18} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{filename}</div>
        <div className="text-[10px] text-muted-foreground">Download</div>
      </div>
    </a>
  );
}

// ── Sidebar row: DM ───────────────────────────────────────────────────────

function DmRow({
  convo,
  meId,
  activeId,
  onSelect,
  onArchive,
}: {
  convo: any;
  meId: string | null;
  activeId: string | null;
  onSelect: () => void;
  onArchive: () => void;
}) {
  const isActive = activeId === convo.id;
  // "You:" prefix when the last message was sent by the current member.
  // We check senderId (present on new API responses) first, and fall
  // back to senderType === 'member' for older payloads.
  const lastMsg = convo.lastMessage;
  const lastMineByType = lastMsg?.senderType === 'member';
  const lastMineById = lastMsg && meId && lastMsg.senderId ? lastMsg.senderId === meId : false;
  const lastMine = lastMineById || lastMineByType;

  return (
    <div
      className={cn(
        'group relative w-full text-left px-4 py-3 border-b transition-colors cursor-pointer',
        isActive ? 'bg-accent/10' : 'hover:bg-[var(--color-surface-overlay)]',
      )}
      style={{
        borderColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
        background: isActive ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : undefined,
      }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground truncate flex-1">{convo.subject}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {convo.memberUnreadCount > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: 'var(--color-accent)' }}
            >
              {convo.memberUnreadCount}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
            title="Archive"
          >
            <Archive size={12} />
          </button>
        </div>
      </div>
      {lastMsg && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {lastMine ? 'You: ' : ''}
          {lastMsg.body ?? (lastMsg.mediaType ? `📎 ${lastMsg.mediaType}` : '')}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        {convo.status === 'closed' && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Closed •</span>
        )}
        <p className="text-[10px] text-muted-foreground">{timeAgo(convo.lastMessageAt)}</p>
      </div>
    </div>
  );
}

// ── Sidebar row: Group ─────────────────────────────────────────────────────

function GroupRow({ group }: { group: any }) {
  // Mute state is a client-only mirror; the sidebar shows the muted
  // indicator without a fetch by reading the localStorage helper. The
  // hook file exports isLocallyMuted but we import it lazily to keep
  // this component tree-shakeable in tests.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    (async () => {
      const { isLocallyMuted } = await import('@/lib/hooks/useChatGroups');
      setMuted(isLocallyMuted(group.id));
    })();
  }, [group.id]);

  return (
    <Link
      href={`/messages/group/${group.id}`}
      className="flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[var(--color-surface-overlay)]"
      style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
    >
      <div
        className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center relative"
        style={{ background: 'var(--color-surface-overlay)' }}
      >
        {group.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Users size={16} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground truncate">{group.name}</span>
          {muted && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-surface-overlay)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Muted
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {group.lastMessage
            ? `${group.lastMessage.senderName ? `${group.lastMessage.senderName}: ` : ''}${group.lastMessage.body}`
            : 'No messages yet'}
        </div>
      </div>
      {group.unreadCount > 0 && (
        <span
          className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
          style={{ background: 'var(--color-accent)' }}
        >
          {group.unreadCount > 99 ? '99+' : group.unreadCount}
        </span>
      )}
    </Link>
  );
}
