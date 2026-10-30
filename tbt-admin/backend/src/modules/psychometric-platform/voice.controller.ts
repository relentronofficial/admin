import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  TTS_DEFAULTS,
  VOICES,
  buildProsody,
  explanationSpeechText,
  patchTtsConfig,
  textHash,
  voiceForExplanation,
  voiceForLang,
  type TtsConfig,
} from '../../lib/psychometric/voice.js';
import { fail, rows, type Db } from './db.js';

// Psychometric "Voice / Audio" admin: neural-voice settings, per-question audio
// status, generate / preview / delete for question and spoken-explanation audio.
// Ported from the standalone adminTtsController. Audio is cached in
// psy_question_audio (kind 'question' | 'explanation').

type Req = FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>;
type Kind = 'question' | 'explanation';
const db = (req: FastifyRequest): Db => req.server.prisma as unknown as Db;
const TTS_KEY = 'tts_config';

async function getConfig(d: Db): Promise<TtsConfig> {
  const [r] = await rows(d, `SELECT value FROM psy_settings WHERE key = $1`, TTS_KEY);
  return { ...TTS_DEFAULTS, ...(r && r.value && typeof r.value === 'object' ? r.value : {}) };
}

/**
 * Microsoft Edge read-aloud neural voices via `msedge-tts` (free, unofficial
 * endpoint), loaded only when an admin generates audio. If the package isn't
 * installed, generation answers 502 and everything else keeps working.
 */
async function synthesize(text: string, voice: string, prosody: { rate: string; pitch: string }): Promise<Buffer> {
  const pkg = 'msedge-tts';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { MsEdgeTTS, OUTPUT_FORMAT } = (await import(pkg)) as any;
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, prosody);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (c: Buffer) => chunks.push(c));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
    setTimeout(() => reject(new Error('edge-tts timeout')), 20_000);
  });
  return Buffer.concat(chunks);
}

export async function getVoiceSettings(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [config, [stats]] = await Promise.all([
    getConfig(d),
    rows(d, `SELECT (SELECT COUNT(*)::int FROM psy_questions WHERE is_active) AS total,
                    (SELECT COUNT(*)::int FROM psy_question_audio WHERE kind = 'question') AS with_audio`),
  ]);
  return reply.send({ success: true, config, voices: VOICES, stats: { total: stats.total, withAudio: stats.with_audio } });
}

export async function updateVoiceSettings(req: Req, reply: FastifyReply) {
  const d = db(req);
  const next = { ...(await getConfig(d)), ...patchTtsConfig(req.body ?? {}) };
  await d.$executeRawUnsafe(
    `INSERT INTO psy_settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, TTS_KEY, JSON.stringify(next));
  return reply.send({ success: true, config: next });
}

/** Per question: none | ready (matches current text) | stale (text changed since generation). */
export async function voiceStatus(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [questions, audio] = await Promise.all([
    rows(d, `SELECT id, text, sort_order, explanation_audio_text, explanation_is_tanglish FROM psy_questions WHERE is_active ORDER BY sort_order`),
    rows(d, `SELECT question_id, kind, text_hash, voice FROM psy_question_audio`),
  ]);
  const key = (id: string, kind: Kind) => `${kind}:${id}`;
  const byKey = new Map(audio.map((a) => [key(a.question_id, a.kind), a]));
  const data = questions.map((q) => {
    const a = byKey.get(key(q.id, 'question'));
    const speech = explanationSpeechText({ explanationAudioText: q.explanation_audio_text, explanationIsTanglish: q.explanation_is_tanglish });
    const e = byKey.get(key(q.id, 'explanation'));
    return {
      _id: q.id,
      order: q.sort_order,
      text: q.text,
      status: !a ? 'none' : a.text_hash === textHash(q.text) ? 'ready' : 'stale',
      voice: a ? a.voice : null,
      hasExplanation: !!speech,
      explanationIsTanglish: !!q.explanation_is_tanglish,
      explanationStatus: !speech ? null : !e ? 'none' : e.text_hash === textHash(speech) ? 'ready' : 'stale',
      explanationVoice: e ? e.voice : null,
    };
  });
  return reply.send({ success: true, data });
}

async function saveAudio(d: Db, questionId: string, kind: Kind, hash: string, voice: string, audio: Buffer) {
  await d.$executeRawUnsafe(
    `INSERT INTO psy_question_audio (question_id, kind, text_hash, voice, lang, content_type, audio)
     VALUES ($1, $2, $3, $4, $5, 'audio/mpeg', $6)
     ON CONFLICT (question_id, kind) DO UPDATE SET text_hash = EXCLUDED.text_hash, voice = EXCLUDED.voice,
       lang = EXCLUDED.lang, audio = EXCLUDED.audio, updated_at = NOW()`,
    questionId, kind, hash, voice, voice.slice(0, 5), audio);
}

const generationFailed = (reply: FastifyReply, err: unknown) =>
  fail(reply, 502, `Voice generation failed: ${(err as Error)?.message ?? err}`);

export async function generateQuestionAudio(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [q] = await rows(d, `SELECT id, text, language FROM psy_questions WHERE id = $1`, req.params.id);
  if (!q) return fail(reply, 404, 'Question not found.');
  try {
    const config = await getConfig(d);
    const voice = voiceForLang(q.language === 'ta' ? 'ta' : 'en', config);
    const audio = await synthesize(q.text, voice, buildProsody(config));
    await saveAudio(d, q.id, 'question', textHash(q.text), voice, audio);
    return reply.send({ success: true, voice, bytes: audio.length });
  } catch (err) {
    return generationFailed(reply, err);
  }
}

export async function generateExplanationAudio(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [q] = await rows(d, `SELECT id, explanation_audio_text, explanation_is_tanglish FROM psy_questions WHERE id = $1`, req.params.id);
  if (!q) return fail(reply, 404, 'Question not found.');
  const speech = explanationSpeechText({ explanationAudioText: q.explanation_audio_text, explanationIsTanglish: q.explanation_is_tanglish });
  if (!speech) return fail(reply, 400, 'This question has no spoken explanation to generate.');
  try {
    const config = await getConfig(d);
    const voice = voiceForExplanation(speech, config);
    const audio = await synthesize(speech, voice, buildProsody({ ratePct: config.explanationRatePct ?? config.ratePct, pitchHz: config.pitchHz }));
    await saveAudio(d, q.id, 'explanation', textHash(speech), voice, audio);
    return reply.send({ success: true, voice, bytes: audio.length });
  } catch (err) {
    return generationFailed(reply, err);
  }
}

/** The cached mp3 for a question's question/explanation audio (also used by the member assessment). */
export async function sendCachedAudio(d: Db, reply: FastifyReply, questionId: string, kind: Kind, notFound: string) {
  const [a] = await rows(d, `SELECT audio, content_type FROM psy_question_audio WHERE question_id = $1 AND kind = $2`, questionId, kind);
  if (!a || !a.audio) return fail(reply, 404, notFound);
  return reply.header('Content-Type', a.content_type || 'audio/mpeg').header('Cache-Control', 'no-store').send(Buffer.from(a.audio));
}

export const previewQuestionAudio = (req: Req, reply: FastifyReply) => sendCachedAudio(db(req), reply, req.params.id, 'question', 'No audio generated yet.');
export const previewExplanationAudio = (req: Req, reply: FastifyReply) =>
  sendCachedAudio(db(req), reply, req.params.id, 'explanation', 'No explanation audio generated yet.');

export async function deleteQuestionAudio(req: Req, reply: FastifyReply) {
  await db(req).$executeRawUnsafe(`DELETE FROM psy_question_audio WHERE question_id = $1 AND kind = 'question'`, req.params.id);
  return reply.send({ success: true });
}

export async function deleteExplanationAudio(req: Req, reply: FastifyReply) {
  await db(req).$executeRawUnsafe(`DELETE FROM psy_question_audio WHERE question_id = $1 AND kind = 'explanation'`, req.params.id);
  return reply.send({ success: true });
}
