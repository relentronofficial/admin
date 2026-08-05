"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  HelpCircle,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  Play,
  Star,
  TicketCheck,
  Users,
  X,
} from "lucide-react";

import {
  useFaqById,
  useFaqs,
  useHelpdeskSettings,
  useMyTickets,
  useSupportCategories,
  ticketDisplayId,
} from "@/lib/hooks/useSupport";
import type { Faq, HelpdeskSettings, SupportTicket, SupportTicketStatus } from "@/types";
import { cn } from "@/lib/utils/cn";

// ── Status pill ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<SupportTicketStatus, { color: string; label: string }> = {
  new: { color: "#60a5fa", label: "New" },
  in_progress: { color: "#facc15", label: "In Progress" },
  resolved: { color: "#4ade80", label: "Resolved" },
  closed: { color: "#a0a0a0", label: "Closed" },
};

function StatusPill({ status }: { status: SupportTicketStatus }) {
  const { color, label } = STATUS_MAP[status] ?? STATUS_MAP.new;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// ── Category icon mapping ───────────────────────────────────────────────────

function faqIcon(name: string | null | undefined) {
  const n = (name || "").toLowerCase();
  if (n.includes("payment") || n.includes("bill") || n.includes("subscription")) return Users;
  if (n.includes("tech") || n.includes("login") || n.includes("video") || n.includes("record")) return Play;
  if (n.includes("comm") || n.includes("group") || n.includes("spam")) return Users;
  return HelpCircle;
}

// ── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-bold tracking-widest"
      style={{ color: "#FFD4AF" }}
    >
      {children}
    </div>
  );
}

// ── Modal shell ─────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            {title && <h3 className="text-base font-bold text-foreground">{title}</h3>}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-overlay)]"
            aria-label="Close"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

// ── Call Us modal ───────────────────────────────────────────────────────────

function CallUsModal({
  open,
  onClose,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  settings: HelpdeskSettings | null | undefined;
}) {
  const rows: Array<{ icon: React.ReactNode; label: string; sub: string; href: string; color: string }> = [];
  if (settings?.phoneNumber) {
    rows.push({
      icon: <Phone size={18} />,
      label: "Call Helpline",
      sub: settings.phoneNumber,
      href: `tel:${settings.phoneNumber}`,
      color: "#27AE60",
    });
  }
  if (settings?.whatsappNumber) {
    const digits = settings.whatsappNumber.replace(/[^\d]/g, "");
    rows.push({
      icon: <MessageCircle size={18} />,
      label: "Chat on WhatsApp",
      sub: settings.whatsappNumber,
      href: `https://wa.me/${digits}`,
      color: "#25D366",
    });
  }
  if (settings?.email) {
    rows.push({
      icon: <Mail size={18} />,
      label: "Email us",
      sub: settings.email,
      href: `mailto:${settings.email}`,
      color: "var(--color-accent)",
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Contact Support"
      subtitle={settings?.supportTiming || undefined}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No contact channels configured yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <a
              key={r.href}
              href={r.href}
              target={r.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-[var(--color-surface-overlay)]"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  color: r.color,
                  background: `color-mix(in srgb, ${r.color} 12%, transparent)`,
                }}
              >
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{r.label}</div>
                <div className="text-xs text-muted-foreground truncate">{r.sub}</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </a>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── FAQ answer modal ────────────────────────────────────────────────────────

function FaqModal({ open, onClose, faq }: { open: boolean; onClose: () => void; faq: Faq | null }) {
  return (
    <Modal open={open} onClose={onClose}>
      {faq && (
        <div>
          <h3 className="text-base font-bold text-foreground">{faq.question}</h3>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed whitespace-pre-line">
            {faq.answer}
          </p>
        </div>
      )}
    </Modal>
  );
}

// ── Hero banner ─────────────────────────────────────────────────────────────

function HeroBanner({ settings }: { settings: HelpdeskSettings | null | undefined }) {
  const subtitle = settings?.subtitle && settings.subtitle.trim().length > 0
    ? settings.subtitle
    : "How can we help you?";
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "var(--color-accent)" }} />
      <div className="p-5 sm:p-6 flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug whitespace-pre-line">
            {subtitle}
          </h2>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
          style={{
            color: "#27AE60",
            background: "rgba(39,174,96,0.08)",
            border: "1px solid rgba(39,174,96,0.35)",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 bg-[#27AE60]" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#27AE60]" />
          </span>
          <span className="text-[9px] font-bold tracking-wider leading-tight">
            SUPPORT<br />ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Quick action tile ───────────────────────────────────────────────────────

function QuickTile({
  icon,
  label,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <div
      className="p-4 sm:p-5 rounded-2xl flex flex-col items-start gap-4 h-full transition-colors hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{
          color: "var(--color-accent)",
          background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
        }}
      >
        {icon}
      </div>
      <div className="text-sm font-bold text-foreground">{label}</div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button onClick={onClick} className="text-left w-full">
      {inner}
    </button>
  );
}

// ── Support page inner (needs Suspense because of useSearchParams) ──────────

function SupportPageInner() {
  const params = useSearchParams();
  const focusFaqId = params.get("faqId");

  const { data: settings } = useHelpdeskSettings();
  const { data: categories = [] } = useSupportCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const { data: faqs = [], isLoading: faqsLoading } = useFaqs({ categoryId: selectedCategoryId });
  const { data: tickets = [] } = useMyTickets();
  const { data: focusedFaq } = useFaqById(focusFaqId);

  const [callOpen, setCallOpen] = useState(false);
  const [faqModal, setFaqModal] = useState<Faq | null>(null);
  const focusedRef = useRef<HTMLButtonElement>(null);

  // Merge deep-linked FAQ into the visible list if the current filter hides it.
  const displayFaqs: Faq[] = useMemo(() => {
    if (!focusFaqId || !focusedFaq) return faqs;
    if (faqs.some((f) => f.id === focusFaqId)) return faqs;
    return [focusedFaq, ...faqs];
  }, [faqs, focusFaqId, focusedFaq]);

  // Auto-scroll to the focused FAQ + open its sheet once the data lands.
  const openedRef = useRef(false);
  useEffect(() => {
    if (!focusFaqId || !focusedFaq || openedRef.current) return;
    openedRef.current = true;
    // Give the DOM a tick to render the row before scrolling.
    setTimeout(() => {
      focusedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFaqModal(focusedFaq);
    }, 200);
  }, [focusFaqId, focusedFaq]);

  const recentTickets = tickets.slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {settings?.title || "Support Center"}
        </h1>
      </div>

      <HeroBanner settings={settings} />

      {/* Quick actions */}
      <div className="space-y-3">
        <SectionLabel>QUICK ACTIONS</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <QuickTile icon={<TicketCheck size={22} />} label="Raise Ticket" href="/support/new" />
          <QuickTile icon={<PhoneCall size={22} />} label="Call Us" onClick={() => setCallOpen(true)} />
          <QuickTile icon={<Star size={22} />} label="Feedback" href="/support/feedback" />
        </div>
      </div>

      {/* Category chips */}
      <div className="space-y-3">
        <SectionLabel>BROWSE HELP TOPICS</SectionLabel>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <CategoryChip
              label="All"
              selected={!selectedCategoryId}
              onClick={() => setSelectedCategoryId(undefined)}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                selected={selectedCategoryId === c.id}
                onClick={() => setSelectedCategoryId(c.id)}
              />
            ))}
          </div>
        )}

        {/* FAQ list */}
        {faqsLoading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Loading FAQs…</div>
        ) : displayFaqs.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No FAQs available in this topic yet.
          </div>
        ) : (
          <div className="space-y-2">
            {displayFaqs.map((f) => {
              const Icon = faqIcon(f.category?.name);
              const highlight = f.id === focusFaqId;
              return (
                <button
                  key={f.id}
                  ref={highlight ? focusedRef : undefined}
                  onClick={() => setFaqModal(f)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-colors hover:bg-[var(--color-surface-overlay)]",
                  )}
                  style={{
                    background: "var(--color-bg-surface)",
                    border: highlight
                      ? "1.5px solid var(--color-accent)"
                      : "1px solid var(--color-border-subtle)",
                    boxShadow: highlight
                      ? "0 8px 24px color-mix(in srgb, var(--color-accent) 18%, transparent)"
                      : undefined,
                  }}
                >
                  <Icon size={18} style={{ color: "var(--color-accent)" }} />
                  <span className="flex-1 text-sm font-semibold text-foreground">{f.question}</span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent tickets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>MY RECENT TICKETS</SectionLabel>
          <Link
            href="/support/tickets"
            className="text-[11px] font-bold tracking-wider flex items-center gap-1"
            style={{ color: "var(--color-accent)" }}
          >
            VIEW ALL <ArrowRight size={12} />
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div
            className="p-5 rounded-2xl text-center text-sm text-muted-foreground"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            No tickets yet — raise one when you need help.
          </div>
        ) : (
          <div className="space-y-2">
            {recentTickets.map((t) => (
              <TicketPreviewCard key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </div>

      <CallUsModal open={callOpen} onClose={() => setCallOpen(false)} settings={settings} />
      <FaqModal open={!!faqModal} onClose={() => setFaqModal(null)} faq={faqModal} />
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors",
        selected ? "font-bold text-foreground" : "font-medium text-muted-foreground",
      )}
      style={{
        background: "var(--color-bg-surface)",
        border: selected
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-border-subtle)",
      }}
    >
      {label}
    </button>
  );
}

function TicketPreviewCard({ ticket }: { ticket: SupportTicket }) {
  return (
    <Link
      href={`/support/tickets/${ticket.id}`}
      className="block p-3.5 rounded-2xl transition-colors hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-surface-overlay)" }}
        >
          <MessageSquare size={18} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{ticket.subject}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {ticketDisplayId(ticket)} · {new Date(ticket.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
        <StatusPill status={ticket.status} />
      </div>
    </Link>
  );
}

// ── Page (Suspense wrapper for useSearchParams) ─────────────────────────────

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto py-10 text-muted-foreground text-sm">Loading…</div>}>
      <SupportPageInner />
    </Suspense>
  );
}
