import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOICE_MAX_BYTES, cleanTranscript, transcribeVoiceNote, validVoiceNote } from './transcribe.js';

function wav(bytes = 3_200, rate = 16_000, channels = 1) {
  const b = Buffer.alloc(44 + bytes);
  b.write('RIFF', 0); b.write('WAVEfmt ', 8); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt16LE(16, 34);
  return b.toString('base64');
}

describe('validVoiceNote', () => {
  it('accepts a 16 kHz mono WAV only', () => {
    expect(validVoiceNote(wav())).toBe(wav());
    expect(validVoiceNote(wav(3_200, 48_000))).toBeNull();
    expect(validVoiceNote(wav(3_200, 16_000, 2))).toBeNull();
    expect(validVoiceNote(wav(0))).toBeNull();
    expect(validVoiceNote(wav(VOICE_MAX_BYTES))).toBeNull();
    expect(validVoiceNote(Buffer.from('x'.repeat(200)).toString('base64'))).toBeNull();
    expect(validVoiceNote('not base64!')).toBeNull();
    expect(validVoiceNote(null)).toBeNull();
  });
});

describe('cleanTranscript', () => {
  it('tidies text and spots silence', () => {
    expect(cleanTranscript('  "Indha maasam\n revenue evlo?" ', 100)).toBe('Indha maasam revenue evlo?');
    expect(cleanTranscript('NO_SPEECH.', 100)).toBe('');
    expect(cleanTranscript(null, 100)).toBe('');
    expect(cleanTranscript('abcdef', 3)).toBe('abc');
  });
});

describe('transcribeVoiceNote', () => {
  afterEach(() => vi.restoreAllMocks());
  const go = (log = vi.fn()) => transcribeVoiceNote({ apiKey: 'k', wavBase64: wav(), max: 2_000, log });
  const reply = (body: unknown, status = 200) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('sends the audio and returns the words', async () => {
    const spy = reply({ choices: [{ finish_reason: 'stop', message: { content: 'Batch 55 eppadi pogudhu?' } }] });
    expect(await go()).toBe('Batch 55 eppadi pogudhu?');
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body.messages[0].content[1].input_audio).toEqual({ data: wav(), format: 'wav' });
    expect(body.provider.data_collection).toBe('deny');
  });
  it('refuses a cut-off transcript', async () => {
    reply({ choices: [{ finish_reason: 'length', message: { content: 'half' } }] });
    await expect(go()).rejects.toThrow(/shorter/);
  });
  it('explains failures without leaking them', async () => {
    reply({ error: { message: 'secret' } }, 402);
    await expect(go()).rejects.toThrow(/out of credit/);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Bearer SECRET'));
    const log = vi.fn();
    await expect(go(log)).rejects.toThrow(/try again/);
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
  });
});
