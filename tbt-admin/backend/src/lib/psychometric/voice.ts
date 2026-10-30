import { createHash } from 'node:crypto';

/**
 * Psychometric voice helpers, ported from the standalone platform
 * (utils/tanglish.js, utils/edgeTts.js, utils/ttsSettings.js). The Tamil letter
 * tables, word lists and voice catalogue are copied verbatim. Pure — the actual
 * neural synthesis lives in the admin voice handler.
 */

// ── Tanglish (romanized Tamil) → Tamil script ──────────────────────────────
const VOWELS: [string, string, string][] = [['au', 'ஔ', 'ௌ'], ['ai', 'ஐ', 'ை'], ['aa', 'ஆ', 'ா'], ['ee', 'ஏ', 'ே'], ['ii', 'ஈ', 'ீ'], ['oo', 'ஓ', 'ோ'], ['uu', 'ஊ', 'ூ'], ['a', 'அ', ''], ['i', 'இ', 'ி'], ['u', 'உ', 'ு'], ['e', 'எ', 'ெ'], ['o', 'ஒ', 'ொ']];
const CONS: [string, string][] = [['ng', 'ங'], ['nj', 'ஞ'], ['ch', 'ச'], ['sh', 'ஷ'], ['zh', 'ழ'], ['th', 'த'], ['dh', 'த'], ['kh', 'க'], ['gh', 'க'], ['ph', 'ப'], ['bh', 'ப'], ['k', 'க'], ['g', 'க'], ['c', 'ச'], ['j', 'ஜ'], ['t', 'ட'], ['d', 'ட'], ['n', 'ந'], ['p', 'ப'], ['b', 'ப'], ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['l', 'ல'], ['v', 'வ'], ['w', 'வ'], ['s', 'ஸ'], ['h', 'ஹ'], ['f', 'ஃப'], ['x', 'க்ஸ'], ['q', 'க']];
const PULLI = '்';

export function tanglishToTamil(input: string): string {
  const src = String(input || '');
  const s = src.toLowerCase();
  const isTa = (ch: string) => ch >= '஀' && ch <= '௿';
  const matchAt = <T extends string[]>(arr: T[], pos: number) => { for (const e of arr) if (s.startsWith(e[0], pos)) return e; return null; };
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (isTa(src[i])) { out += src[i]; i++; continue; }
    const c = matchAt(CONS, i);
    if (c) {
      i += c[0].length;
      const v = matchAt(VOWELS, i);
      if (v) { out += c[1] + v[2]; i += v[0].length; } else out += c[1] + PULLI;
      continue;
    }
    const v = matchAt(VOWELS, i);
    if (v) { out += v[1]; i += v[0].length; continue; }
    out += src[i];
    i++;
  }
  return out;
}

const TANGLISH_LEX = new Set('unga ungal ungala ungaluku ungalukku ungaloda naan nee neenga ninga avan ava avanga avaru naanga naama namma namba idhu adhu ithu athu indha intha andha enna yaar yaaru eppadi epdi ippadi appadi panna pannu pannunga pannanum pandrom seyya seyyanum sollu sollavum solli sonna kelvi bathil pathil badhil romba konjam illa illai irukku iruku unda aana aanaal aanalum venum vendum theriyum puriyum padi padikka padichu padikkanum kooda mattum ellam ella ellaam oru rendu moonu naalu nalla seri sari vanakkam nandri anbu kashtam kashtamana moolam moolama mudiyum mudiyathu aagum aachu vaanga ponga irunga kudunga kaatunga ninaivu yosanai yosichu therinjukonga therinjukanum'.split(/\s+/));
const TANGLISH_SUFFIX = ['nga', 'kku', 'ku', 'nu', 'la', 'um', 'dhu', 'dham', 'aana', 'aachu', 'anum', 'avum', 'itten', 'ittu', 'kanum', 'kuthu'];
const ENGLISH_STOP = new Set('the a an is am are was were be been being to of in on at for and or but with you your yours i we they he she it this that these those how what why when where which who will would can could should shall may might must do does did done read each option pick closest handle customer complaint question checks check respond answer choose select following apply all best most from about into over under please note here there than then them their our have has had not no yes if else while because so such very more less first second third only also just like get got make made take give given use used word meaning sentence passage correct below'.split(/\s+/));

/** Romanized text: Tanglish or English? Heuristic, approximate by nature. */
export function detectTanglish(text: string): boolean {
  const s = String(text || '').toLowerCase();
  if (!s.trim() || /[஀-௿]/.test(s)) return false;
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 1);
  if (words.length < 2) return false;
  let ta = 0;
  let en = 0;
  for (const w of words) {
    if (ENGLISH_STOP.has(w)) { en += 1; continue; }
    if (TANGLISH_LEX.has(w)) { ta += 2; continue; }
    if (TANGLISH_SUFFIX.some((suf) => w.length > suf.length + 1 && w.endsWith(suf))) { ta += 1; continue; }
    if (/zh|kk|tt|pp|nn|dh|ng|aa|oo/.test(w)) ta += 0.5;
  }
  return ta > en && ta >= words.length * 0.35;
}

type ExplanationSource = { explanationAudioText?: string | null; explanationIsTanglish?: boolean | null };

/** The exact text a question's spoken explanation is synthesized from ('' = none). */
export function explanationSpeechText(q: ExplanationSource): string {
  const raw = (q?.explanationAudioText ? String(q.explanationAudioText) : '').trim();
  if (!raw) return '';
  if (/[஀-௿]/.test(raw)) return raw;
  return q.explanationIsTanglish || detectTanglish(raw) ? tanglishToTamil(raw) : raw;
}

// ── Neural voice settings ──────────────────────────────────────────────────
export const isTamil = (text: string) => /[஀-௿]/.test(text || '');
export const textHash = (text: string) => createHash('sha256').update(String(text || '')).digest('hex');

export const EN_VOICE = 'en-US-AriaNeural';
export const TA_VOICE = 'ta-IN-PallaviNeural';

export const VOICES = {
  en: [
    { id: 'en-US-AriaNeural', label: 'Aria — US female, warm' },
    { id: 'en-US-JennyNeural', label: 'Jenny — US female, friendly' },
    { id: 'en-US-AnaNeural', label: 'Ana — US female, soft' },
    { id: 'en-US-GuyNeural', label: 'Guy — US male' },
    { id: 'en-GB-SoniaNeural', label: 'Sonia — UK female' },
    { id: 'en-GB-RyanNeural', label: 'Ryan — UK male' },
    { id: 'en-IN-NeerjaNeural', label: 'Neerja — India female' },
    { id: 'en-IN-PrabhatNeural', label: 'Prabhat — India male' },
  ],
  ta: [
    { id: 'ta-IN-PallaviNeural', label: 'Pallavi — Tamil female' },
    { id: 'ta-IN-ValluvarNeural', label: 'Valluvar — Tamil male' },
    { id: 'ta-LK-SaranyaNeural', label: 'Saranya — Tamil (LK) female' },
    { id: 'ta-LK-KumarNeural', label: 'Kumar — Tamil (LK) male' },
  ],
};

export interface TtsConfig {
  enabled: boolean;
  voiceEn: string;
  voiceTa: string;
  ratePct: number;
  pitchHz: number;
  voiceExplanation: string;
  explanationRatePct: number;
}

export const TTS_DEFAULTS: TtsConfig = {
  enabled: true,
  voiceEn: 'en-US-AriaNeural',
  voiceTa: 'ta-IN-PallaviNeural',
  ratePct: -6,
  pitchHz: 0,
  voiceExplanation: 'ta-IN-PallaviNeural',
  explanationRatePct: -6,
};

/** Only provided, valid fields change (same clamps as the standalone handler). */
export function patchTtsConfig(body: Record<string, unknown>): Partial<TtsConfig> {
  const clamp = (n: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(n)));
  const ok = (v: unknown) => v !== undefined && !Number.isNaN(Number(v));
  const p: Partial<TtsConfig> = {};
  if (body.enabled !== undefined) p.enabled = !!body.enabled;
  if (body.voiceEn) p.voiceEn = String(body.voiceEn);
  if (body.voiceTa) p.voiceTa = String(body.voiceTa);
  if (body.voiceExplanation) p.voiceExplanation = String(body.voiceExplanation);
  if (ok(body.ratePct)) p.ratePct = clamp(body.ratePct, -50, 50);
  if (ok(body.explanationRatePct)) p.explanationRatePct = clamp(body.explanationRatePct, -50, 50);
  if (ok(body.pitchHz)) p.pitchHz = clamp(body.pitchHz, -50, 50);
  return p;
}

export function buildProsody({ ratePct = -6, pitchHz = 0 }: { ratePct?: number; pitchHz?: number } = {}) {
  const sign = (n: number) => (Number(n) >= 0 ? `+${Number(n)}` : String(Number(n)));
  return { rate: `${sign(ratePct)}%`, pitch: `${sign(pitchHz)}Hz` };
}

export const voiceForLang = (lang: string, c: Partial<TtsConfig> = {}) => (lang === 'ta' ? c.voiceTa || TA_VOICE : c.voiceEn || EN_VOICE);
export const voiceForExplanation = (text: string, c: Partial<TtsConfig> = {}) =>
  isTamil(text) ? c.voiceExplanation || c.voiceTa || TA_VOICE : c.voiceEn || EN_VOICE;
