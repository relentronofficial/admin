/**
 * Browser-speech helpers for the Psychometric assessment, ported from the
 * former standalone candidate page. The Tamil tables and word lists match the
 * backend copy (tbt-admin/backend/src/lib/psychometric/voice.ts) — edit both
 * together.
 */

const TL_VOWELS: [string, string, string][] = [["au", "ஔ", "ௌ"], ["ai", "ஐ", "ை"], ["aa", "ஆ", "ா"], ["ee", "ஏ", "ே"], ["ii", "ஈ", "ீ"], ["oo", "ஓ", "ோ"], ["uu", "ஊ", "ூ"], ["a", "அ", ""], ["i", "இ", "ி"], ["u", "உ", "ு"], ["e", "எ", "ெ"], ["o", "ஒ", "ொ"]];
const TL_CONS: [string, string][] = [["ng", "ங"], ["nj", "ஞ"], ["ch", "ச"], ["sh", "ஷ"], ["zh", "ழ"], ["th", "த"], ["dh", "த"], ["kh", "க"], ["gh", "க"], ["ph", "ப"], ["bh", "ப"], ["k", "க"], ["g", "க"], ["c", "ச"], ["j", "ஜ"], ["t", "ட"], ["d", "ட"], ["n", "ந"], ["p", "ப"], ["b", "ப"], ["m", "ம"], ["y", "ய"], ["r", "ர"], ["l", "ல"], ["v", "வ"], ["w", "வ"], ["s", "ஸ"], ["h", "ஹ"], ["f", "ஃப"], ["x", "க்ஸ"], ["q", "க"]];

/** Tanglish (Tamil in English letters) → Tamil script. Approximate by design. */
export function tanglishToTamil(input: string): string {
  const src = String(input || "");
  const s = src.toLowerCase();
  const isTa = (ch: string) => ch >= "஀" && ch <= "௿";
  const matchAt = <T extends string[]>(arr: T[], pos: number) => { for (const e of arr) if (s.startsWith(e[0], pos)) return e; return null; };
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (isTa(src[i])) { out += src[i]; i++; continue; }
    const c = matchAt(TL_CONS, i);
    if (c) {
      i += c[0].length;
      const v = matchAt(TL_VOWELS, i);
      if (v) { out += c[1] + v[2]; i += v[0].length; } else out += c[1] + "்";
      continue;
    }
    const v = matchAt(TL_VOWELS, i);
    if (v) { out += v[1]; i += v[0].length; continue; }
    out += src[i];
    i++;
  }
  return out;
}

const TL_LEX = new Set("unga ungal ungala ungaluku ungalukku ungaloda naan nee neenga ninga avan ava avanga avaru naanga naama namma namba idhu adhu ithu athu indha intha andha enna yaar yaaru eppadi epdi ippadi appadi panna pannu pannunga pannanum pandrom seyya seyyanum sollu sollavum solli sonna kelvi bathil pathil badhil romba konjam illa illai irukku iruku unda aana aanaal aanalum venum vendum theriyum puriyum padi padikka padichu padikkanum kooda mattum ellam ella ellaam oru rendu moonu naalu nalla seri sari vanakkam nandri anbu kashtam kashtamana moolam moolama mudiyum mudiyathu aagum aachu vaanga ponga irunga kudunga kaatunga ninaivu yosanai yosichu therinjukonga therinjukanum".split(/\s+/));
const TL_SUF = ["nga", "kku", "ku", "nu", "la", "um", "dhu", "dham", "aana", "aachu", "anum", "avum", "itten", "ittu", "kanum", "kuthu"];
const EN_STOP = new Set("the a an is am are was were be been being to of in on at for and or but with you your yours i we they he she it this that these those how what why when where which who will would can could should shall may might must do does did done read each option pick closest handle customer complaint question checks check respond answer choose select following apply all best most from about into over under please note here there than then them their our have has had not no yes if else while because so such very more less first second third only also just like get got make made take give given use used word meaning sentence passage correct below".split(/\s+/));

/** Romanized text: Tanglish or English? */
export function detectTanglish(text: string): boolean {
  const s = String(text || "").toLowerCase();
  if (!s.trim() || /[஀-௿]/.test(s)) return false;
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 1);
  if (words.length < 2) return false;
  let ta = 0;
  let en = 0;
  for (const w of words) {
    if (EN_STOP.has(w)) { en += 1; continue; }
    if (TL_LEX.has(w)) { ta += 2; continue; }
    if (TL_SUF.some((suf) => w.length > suf.length + 1 && w.endsWith(suf))) { ta += 1; continue; }
    if (/zh|kk|tt|pp|nn|dh|ng|aa|oo/.test(w)) ta += 0.5;
  }
  return ta > en && ta >= words.length * 0.35;
}

type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang" | "default">;

/** Most natural-sounding first: neural/natural, then online/enhanced/Google, then known pleasant voices. */
export function scoreVoice(v: VoiceLike | null | undefined): number {
  const n = (v?.name || "").toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 6;
  if (/online|enhanced|premium/.test(n)) s += 3;
  if (/google/.test(n)) s += 3;
  if (/zira|aria|jenny|sonia|libby|emma|ava|samantha|nova|serena|karen|heera/.test(n)) s += 2;
  if (v?.default) s += 1;
  return s;
}

export const bestVoice = <V extends VoiceLike>(list: V[]): V | null =>
  list.length ? list.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] : null;

/**
 * Voice + lang for `text`. `forceLang` (the question's saved language) wins
 * over detecting Tamil script. Without a voice for the wanted language, falls
 * back to the best English (then any) voice and matches `lang` to it — a
 * lang/voice mismatch silences some engines.
 */
export function pickSpeech<V extends VoiceLike>(text: string, voices: V[], forceLang?: "en" | "ta") {
  const tamil = forceLang ? forceLang === "ta" : /[஀-௿]/.test(text || "");
  const want = tamil ? "ta" : "en";
  let lang = tamil ? "ta-IN" : "en-US";
  let voice = bestVoice(voices.filter((v) => (v.lang || "").toLowerCase().startsWith(want)));
  if (!voice) {
    voice = bestVoice(voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en"))) || bestVoice(voices) || null;
    if (voice?.lang) lang = voice.lang;
  }
  return { lang, voice };
}

export const hasTamilVoice = (voices: VoiceLike[]) => voices.some((v) => (v.lang || "").toLowerCase().startsWith("ta"));
