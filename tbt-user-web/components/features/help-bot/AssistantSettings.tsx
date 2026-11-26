"use client";

/**
 * TBT Assistant settings, the member's own: what it remembers about them
 * (edit or delete), how answers are read aloud, and a daily credit cap.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { helpBotService, type HelpBotPrefs } from "@/lib/api/services/helpBot.service";
import type { T } from "./ActionCard";

const MEMORY_MAX = 800;

export function AssistantSettings({ t, charging, onDone }: { t: T; charging: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["help-bot", "prefs"], queryFn: helpBotService.prefs });
  const [form, setForm] = useState<HelpBotPrefs | null>(null);
  const [cap, setCap] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm(data);
    setCap(data.dailyCreditCap == null ? "" : String(data.dailyCreditCap));
  }, [data]);

  async function save(next: HelpBotPrefs) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await helpBotService.savePrefs(next);
      qc.setQueryData(["help-bot", "prefs"], next);
      setSaved(true);
    } catch (e) {
      setError((e as Error)?.message || t("helpBotSettingsFailed", "Couldn't save. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const muted = { color: "var(--color-text-secondary)" };
  const field = { background: "var(--color-surface-overlay-xs, rgba(127,127,127,0.08))", border: "1px solid var(--color-border-medium)", color: "var(--color-text-normal)" };
  const label = "block text-xs font-semibold mb-1";

  if (isLoading || !form) {
    return <p className="flex-1 p-4 text-center text-sm" style={muted}>{isError ? t("helpBotSettingsLoadFailed", "Couldn't load your settings.") : t("helpBotLoading", "Loading…")}</p>;
  }

  const capValue = cap.trim() === "" ? null : Number(cap);
  const capBad = capValue != null && (!Number.isInteger(capValue) || capValue < 1 || capValue > 100000);
  const set = (patch: Partial<HelpBotPrefs>) => { setSaved(false); setForm({ ...form, ...patch }); };

  return (
    <form
      className="flex-1 overflow-y-auto p-4 space-y-5 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!capBad) void save({ ...form, memory: form.memory?.trim() || null, dailyCreditCap: capValue });
      }}
    >
      <section>
        <label htmlFor="hb-memory" className={label}>{t("helpBotMemoryLabel", "What the assistant remembers about you")}</label>
        <p className="text-xs mb-2" style={muted}>{t("helpBotMemoryHelp", "Your business, products and goals — used in every answer. Never add passwords, OTPs or bank details.")}</p>
        <textarea
          id="hb-memory"
          value={form.memory ?? ""}
          onChange={(e) => set({ memory: e.target.value.slice(0, MEMORY_MAX) })}
          rows={5}
          placeholder={t("helpBotMemoryPlaceholder", "e.g. I sell handmade soaps on Instagram. Goal: ₹1 lakh a month by March.")}
          className="w-full resize-y rounded-xl px-3 py-2 text-base sm:text-sm outline-none"
          style={field}
        />
        <div className="mt-1 flex items-center justify-between text-xs" style={muted}>
          <span className="tabular-nums">{(form.memory ?? "").length}/{MEMORY_MAX}</span>
          {!!form.memory && (
            <button type="button" onClick={() => void save({ ...form, memory: null, dailyCreditCap: capBad ? data!.dailyCreditCap : capValue })} className="inline-flex items-center gap-1 h-8 px-2 rounded-lg hover:opacity-70">
              <Trash2 size={13} /> {t("helpBotMemoryDelete", "Delete all")}
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold">{t("helpBotVoiceSettings", "Voice")}</p>
        <div>
          <label htmlFor="hb-lang" className={label}>{t("helpBotVoiceLang", "Language")}</label>
          <select id="hb-lang" value={form.voiceLang} onChange={(e) => set({ voiceLang: e.target.value as HelpBotPrefs["voiceLang"] })} className="w-full h-11 rounded-xl px-3" style={field}>
            <option value="tanglish">{t("helpBotVoiceTanglish", "Tanglish (Tamil + English)")}</option>
            <option value="tamil">{t("helpBotVoiceTamil", "More Tamil")}</option>
            <option value="english">{t("helpBotVoiceEnglish", "English")}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hb-voice" className={label}>{t("helpBotVoiceName", "Voice")}</label>
            <select id="hb-voice" value={form.voiceName} onChange={(e) => set({ voiceName: e.target.value as HelpBotPrefs["voiceName"] })} className="w-full h-11 rounded-xl px-3" style={field}>
              <option value="Zephyr">{t("helpBotVoiceF1", "Female 1")}</option>
              <option value="Kore">{t("helpBotVoiceF2", "Female 2")}</option>
              <option value="Puck">{t("helpBotVoiceM1", "Male 1")}</option>
              <option value="Charon">{t("helpBotVoiceM2", "Male 2")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="hb-pace" className={label}>{t("helpBotVoicePace", "Speed")}</label>
            <select id="hb-pace" value={form.voicePace} onChange={(e) => set({ voicePace: e.target.value as HelpBotPrefs["voicePace"] })} className="w-full h-11 rounded-xl px-3" style={field}>
              <option value="slow">{t("helpBotVoiceSlow", "Slow")}</option>
              <option value="normal">{t("helpBotVoiceNormal", "Normal")}</option>
              <option value="fast">{t("helpBotVoiceFast", "Fast")}</option>
            </select>
          </div>
        </div>
        <p className="text-xs" style={muted}>{t("helpBotVoiceHelp", "Used the next time you press Request voice.")}</p>
      </section>

      {charging && (
        <section>
          <label htmlFor="hb-cap" className={label}>{t("helpBotCapLabel", "Daily credit limit (optional)")}</label>
          <input
            id="hb-cap"
            inputMode="numeric"
            value={cap}
            onChange={(e) => { setSaved(false); setCap(e.target.value.replace(/[^\d]/g, "").slice(0, 6)); }}
            placeholder={t("helpBotCapPlaceholder", "No limit")}
            className="w-full h-11 rounded-xl px-3 text-base sm:text-sm outline-none"
            style={field}
            aria-invalid={capBad}
          />
          <p className="mt-1 text-xs" style={capBad ? { color: "var(--color-alert)" } : muted}>
            {capBad ? t("helpBotCapBad", "Enter a number from 1 to 100000, or leave it empty.") : t("helpBotCapHelp", "The assistant stops answering for the day once your answers have used this many credits.")}
          </p>
        </section>
      )}

      {error && <p role="alert" className="text-xs" style={{ color: "var(--color-alert)" }}>{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving || capBad} className="h-10 flex-1 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: "var(--color-accent)", color: "#fff" }}>
          {saving && <Loader2 size={14} className="animate-spin" />} {saved ? t("helpBotSettingsSaved", "Saved") : t("helpBotSettingsSave", "Save")}
        </button>
        <button type="button" onClick={onDone} className="h-10 px-3 rounded-lg text-sm" style={{ border: "1px solid var(--color-border-medium)" }}>
          {t("helpBotBack", "Back to chat")}
        </button>
      </div>
    </form>
  );
}
