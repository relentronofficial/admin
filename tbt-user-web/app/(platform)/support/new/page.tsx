"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";

import { useMe } from "@/lib/hooks/useUser";
import {
  useSubmitTicket,
  useSupportCategories,
  ticketDisplayId,
} from "@/lib/hooks/useSupport";
import { uploadTicketAttachment } from "@/lib/api/services/support.service";
import type {
  SupportPreferredContact,
  SupportTicket,
  SupportTicketPriority,
} from "@/types";
import { cn } from "@/lib/utils/cn";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;

interface AttachmentSlot {
  id: string;
  file: File;
  uploading: boolean;
  uploadedUrl: string | null;
}

const PRIORITY_OPTIONS: Array<{ value: SupportTicketPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const REPLY_VIA_OPTIONS: Array<{ value: SupportPreferredContact; label: string }> = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone" },
];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RaiseTicketPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: categories = [] } = useSupportCategories();
  const submit = useSubmitTicket();

  const meName = useMemo(() => {
    if (!me) return "";
    const first = me.firstName ?? "";
    const last = (me as unknown as { lastName?: string | null }).lastName ?? "";
    return `${first} ${last}`.trim() || (me as unknown as { name?: string }).name || "";
  }, [me]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preferredContact, setPreferredContact] = useState<SupportPreferredContact | null>(null);
  const [slots, setSlots] = useState<AttachmentSlot[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<SupportTicket | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);

  // Prefill name/email/phone from the logged-in member (once).
  if (!hydratedRef.current && me) {
    hydratedRef.current = true;
    if (meName && !name) setName(meName);
    if (me.email && !email) setEmail(me.email);
    const phoneVal = (me as unknown as { phone?: string }).phone;
    if (phoneVal && !phone) setPhone(phoneVal);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Required";
    if (!email.trim()) next.email = "Required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = "Invalid email";
    if (!subject.trim()) next.subject = "Required";
    if (!message.trim()) next.message = "Required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (picked.length === 0) return;

    const remaining = MAX_ATTACHMENT_COUNT - slots.length;
    if (remaining <= 0) {
      setBanner(`Attachment limit reached (${MAX_ATTACHMENT_COUNT}).`);
      return;
    }
    const accepted: File[] = [];
    for (const f of picked) {
      if (accepted.length >= remaining) break;
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setBanner(`Skipped "${f.name}" — over 10 MB.`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;

    const newSlots: AttachmentSlot[] = accepted.map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      uploading: true,
      uploadedUrl: null,
    }));
    setSlots((prev) => [...prev, ...newSlots]);

    // Upload each in parallel and patch its slot when done.
    await Promise.all(
      newSlots.map(async (slot) => {
        const url = await uploadTicketAttachment(slot.file);
        setSlots((prev) =>
          prev.map((s) => (s.id === slot.id ? { ...s, uploading: false, uploadedUrl: url } : s)),
        );
      }),
    );
  }

  function removeSlot(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!validate()) return;

    const anyUploading = slots.some((s) => s.uploading);
    if (anyUploading) {
      setBanner("Wait for attachments to finish uploading.");
      return;
    }
    const anyFailed = slots.some((s) => !s.uploading && !s.uploadedUrl);
    if (anyFailed) {
      setBanner("Some attachments failed. Remove them or try again.");
      return;
    }

    setBusy(true);
    try {
      const urls = slots.map((s) => s.uploadedUrl).filter((u): u is string => !!u);
      const res = await submit.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        categoryId: categoryId || null,
        priority,
        preferredContact: preferredContact ?? null,
        attachmentUrls: urls,
      });
      if (res.data) setSubmitted(res.data);
      else setBanner("Ticket submit returned no data.");
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not submit ticket. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Success view ──────────────────────────────────────────────────────

  if (submitted) {
    const replyBlurb = submitted.preferredContact
      ? `Our support team has been notified. You'll get updates on this Ticket and via ${submitted.preferredContact.toUpperCase()}.`
      : "Our support team has been notified. You'll get updates on this Ticket.";
    return (
      <div className="max-w-md mx-auto py-8 space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(39,174,96,0.10)",
            border: "1px solid rgba(39,174,96,0.35)",
          }}
        >
          <CheckCircle2 size={30} style={{ color: "#27AE60" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Ticket {ticketDisplayId(submitted)} submitted
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{replyBlurb}</p>
        </div>
        <div
          className="text-left p-4 rounded-2xl"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="text-sm font-bold text-foreground">{submitted.subject}</div>
          <div className="text-[11px] text-muted-foreground tracking-wider mt-1">
            PRIORITY: {submitted.priority.toUpperCase()}
            {submitted.category ? ` · ${submitted.category.name}` : ""}
          </div>
        </div>
        <div className="space-y-2">
          <Link
            href={`/support/tickets/${submitted.id}`}
            className="block w-full py-3 rounded-xl font-bold text-white text-sm tracking-wider"
            style={{ background: "var(--color-accent)" }}
          >
            VIEW TICKET
          </Link>
          <button
            onClick={() => router.push("/support")}
            className="w-full py-3 rounded-xl font-semibold text-sm text-foreground"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          >
            Back to Support
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/support"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Raise a Ticket</h1>
      </div>

      {banner && (
        <div
          className="mb-4 p-3 rounded-xl flex items-start gap-2 text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#ef4444",
          }}
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <FieldLabel>YOUR NAME</FieldLabel>
        <TextInput value={name} onChange={setName} placeholder="Enter your name" error={errors.name} />

        <FieldLabel>EMAIL</FieldLabel>
        <TextInput
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          type="email"
          error={errors.email}
        />

        <FieldLabel>PHONE (OPTIONAL)</FieldLabel>
        <TextInput value={phone} onChange={setPhone} placeholder="e.g. +91 90000 00000" type="tel" />

        {categories.length > 0 && (
          <>
            <FieldLabel>CATEGORY</FieldLabel>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-foreground bg-transparent outline-none"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}

        <FieldLabel>PRIORITY</FieldLabel>
        <ChipGroup
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(v) => setPriority(v as SupportTicketPriority)}
        />

        <FieldLabel>SUBJECT</FieldLabel>
        <TextInput
          value={subject}
          onChange={setSubject}
          placeholder="Short summary of the issue"
          error={errors.subject}
        />

        <FieldLabel>DESCRIPTION</FieldLabel>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Describe the issue in detail"
          className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none resize-y"
          style={{
            background: "var(--color-bg-surface)",
            border: `1px solid ${errors.message ? "#ef4444" : "var(--color-border-subtle)"}`,
          }}
        />
        {errors.message && (
          <div className="text-xs text-red-500 -mt-3">{errors.message}</div>
        )}

        <FieldLabel>REPLY VIA (OPTIONAL)</FieldLabel>
        <ChipGroup
          options={REPLY_VIA_OPTIONS}
          value={preferredContact ?? ""}
          allowClear
          onChange={(v) =>
            setPreferredContact((prev) => (prev === v ? null : (v as SupportPreferredContact)))
          }
        />

        {/* Attachments */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <FieldLabel>
              ATTACHMENTS ({slots.length}/{MAX_ATTACHMENT_COUNT})
            </FieldLabel>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={slots.length >= MAX_ATTACHMENT_COUNT}
              className="text-xs font-bold flex items-center gap-1 disabled:opacity-50"
              style={{ color: "var(--color-accent)" }}
            >
              <Paperclip size={13} /> Add file
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPickFiles}
          />
          {slots.length === 0 ? (
            <div
              className="p-3 rounded-xl text-xs text-muted-foreground"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              Up to {MAX_ATTACHMENT_COUNT} files, 10 MB each. Optional.
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((s) => (
                <AttachmentRow key={s.id} slot={s} onRemove={() => removeSlot(s.id)} />
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full mt-6 py-3.5 rounded-xl font-bold text-white text-sm tracking-wider flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: "var(--color-accent)" }}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> SUBMITTING…
            </>
          ) : (
            "SUBMIT TICKET"
          )}
        </button>
      </form>
    </div>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-bold tracking-wider mb-1.5"
      style={{ color: "#FFD4AF" }}
    >
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none"
        style={{
          background: "var(--color-bg-surface)",
          border: `1px solid ${error ? "#ef4444" : "var(--color-border-subtle)"}`,
        }}
      />
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
  allowClear = false,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-4 py-2 rounded-full text-xs transition-colors",
              selected ? "font-bold" : "font-semibold text-muted-foreground",
            )}
            style={{
              color: selected ? "var(--color-accent)" : undefined,
              background: selected
                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                : "var(--color-bg-surface)",
              border: `${selected ? 1.5 : 1}px solid ${
                selected ? "var(--color-accent)" : "var(--color-border-subtle)"
              }`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
      {allowClear && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="px-3 py-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function AttachmentRow({
  slot,
  onRemove,
}: {
  slot: AttachmentSlot;
  onRemove: () => void;
}) {
  const okColor = "#4ADE80";
  const errColor = "#ef4444";
  const iconColor = slot.uploadedUrl
    ? okColor
    : slot.uploading
      ? "var(--color-accent)"
      : errColor;

  return (
    <div
      className="p-3 rounded-xl flex items-center gap-3"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div style={{ color: iconColor }}>
        {slot.uploadedUrl ? (
          <CheckCircle2 size={18} />
        ) : slot.uploading ? (
          <CloudUpload size={18} />
        ) : (
          <AlertCircle size={18} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{slot.file.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {slot.uploading
            ? `Uploading… ${humanSize(slot.file.size)}`
            : slot.uploadedUrl
              ? `Ready · ${humanSize(slot.file.size)}`
              : "Failed · remove to retry"}
        </div>
      </div>
      {slot.uploading ? (
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-md hover:bg-[var(--color-surface-overlay)]"
          aria-label="Remove"
        >
          <X size={14} className="text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
