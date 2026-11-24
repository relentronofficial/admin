import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanScript, sayNumbers, scriptProblem, speechParts, spokenScript, speechStream, startSpeech, tamilNumber } from './speak.js';

afterEach(() => vi.unstubAllGlobals());

describe('tamilNumber', () => {
  it.each([
    [0, 'பூஜ்யம்'], [1, 'ஒன்னு'], [19, 'பத்தொம்போது'], [20, 'இருபது'], [49, 'நாப்பத்தி ஒம்போது'], [100, 'நூறு'], [105, 'நூத்தி அஞ்சு'],
    [999, 'தொள்ளாயிரத்தி தொண்ணூத்தி ஒம்போது'], [1000, 'ஆயிரம்'], [1007, 'ஆயிரத்தி ஏழு'], [7499, 'ஏழாயிரத்தி நானூத்தி தொண்ணூத்தி ஒம்போது'],
    [17000, 'பதினேழாயிரம்'], [90000, 'தொண்ணூறாயிரம்'], [100000, 'ஒரு லட்சம்'],
    [817599, 'எட்டு லட்சத்தி பதினேழாயிரத்தி ஐநூத்தி தொண்ணூத்தி ஒம்போது'], [10000000, 'ஒரு கோடி'], [25000000, 'ரெண்டு கோடியே அம்பது லட்சம்'],
    [2026, 'ரெண்டாயிரத்தி இருபத்தி ஆறு'],
  ])('%i', (n, words) => expect(tamilNumber(n)).toBe(words));
  it('never leaves a gap', () => {
    for (let n = 0; n < 200_000; n += 37) expect(tamilNumber(n), String(n)).toMatch(/^[஀-௿]+(?: [஀-௿]+)*$/);
  });
});

it('sayNumbers handles amounts, decimals, times and "1 thing"', () => {
  expect(sayNumbers('8,17,599 ரூபா')).toBe('எட்டு லட்சத்தி பதினேழாயிரத்தி ஐநூத்தி தொண்ணூத்தி ஒம்போது ரூபா');
  expect(sayNumbers('1 payment, 10, 12')).toBe('ஒரு payment, பத்து, பன்னெண்டு');
  expect(sayNumbers('6.70 percent')).toBe('ஆறு புள்ளி ஏழு percent');
  expect(sayNumbers('November 20, 2:04 PM-க்கு 3 பேர்')).toBe('November 20, 2:04 PM-க்கு மூணு பேர்');
  expect(sayNumbers('pending-ல 5.')).toBe('pending-ல அஞ்சு.');
});

describe('scriptProblem', () => {
  it('accepts figures from the answer, refuses others', () => {
    expect(scriptProblem('revenue 817599 ரூபா', 'Total ₹8,17,599')).toBeNull();
    expect(scriptProblem('revenue 8,17,500 ரூபா', 'Total ₹8,17,599')).toContain('817500');
    expect(scriptProblem('8 லட்சம்', '₹8,00,000 and 8')).toContain('digits');
    expect(scriptProblem('8 lakhs', '8')).toContain('digits');
    expect(scriptProblem('', 'x')).toBeTruthy();
    expect(scriptProblem('a'.repeat(1300), 'x')).toContain('longer');
  });
  it('cleans markup', () => expect(cleanScript('**ஆமா** ₹ 5 <laugh>\n| x |')).toBe('ஆமா 5 laugh x'));
});

it('speechParts keeps every word, in order, in three parts or fewer', () => {
  const s = 'இந்த மாசம் revenue நல்லா இருக்கு. ஆமா. Course payments பதினொன்னு இருக்கு. பத்து payments pending-ல இருக்கு. மீதி screen-ல இருக்கு.';
  expect(speechParts(s).join(' ')).toBe(s);
  expect(speechParts(s).length).toBeLessThanOrEqual(3);
  expect(speechParts(s)[0]).toBe('இந்த மாசம் revenue நல்லா இருக்கு.');
  expect(speechParts('ஆமா')).toEqual(['ஆமா']);
});

describe('calls', () => {
  it('startSpeech plays parts in order even when a later one is ready first', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      const text = JSON.parse(init.body).input as string;
      if (text.startsWith('A')) await new Promise((r) => setTimeout(r, 30));
      return new Response(text[0], { headers: { 'content-type': 'audio/pcm' } });
    }));
    let out = '';
    for await (const c of await startSpeech(`A${'a'.repeat(30)}. B${'b'.repeat(30)}. C${'c'.repeat(30)}.`, o())) out += new TextDecoder().decode(c);
    expect(out).toBe('ABC');
  });
  const o = () => ({ apiKey: 'sk-or-secret', log: vi.fn() });
  const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }));
  it('retries a script that changes a figure, then says it', async () => {
    const f = vi.fn().mockResolvedValueOnce(reply('50 பேர்')).mockResolvedValueOnce(reply('49 பேர்'));
    vi.stubGlobal('fetch', f);
    expect(await spokenScript('49 members', o())).toBe('நாப்பத்தி ஒம்போது பேர்');
    expect(f.mock.calls[1][1].body).toContain('refused');
  });
  it('gives up rather than say a wrong figure, and logs no figures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply('50 பேர்')));
    const x = o();
    await expect(spokenScript('49 members', x)).rejects.toThrow(/could not be put/);
    expect(JSON.stringify(x.log.mock.calls)).not.toMatch(/50|secret/);
  });
  it('keeps digits in an English answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply('There are 49 members')));
    expect(await spokenScript('49 members', o())).toBe('There are 49 members');
  });
  it('streams audio and refuses anything else', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('abc', { headers: { 'content-type': 'audio/pcm' } })));
    expect(await new Response(await speechStream('x', o())).text()).toBe('abc');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })));
    await expect(speechStream('x', o())).rejects.toThrow(/could not be made/);
  });
});
