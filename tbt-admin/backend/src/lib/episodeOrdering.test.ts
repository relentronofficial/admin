import { describe, expect, it } from 'vitest';
import { parseEpisodePosition, planEpisodeOrder, sectionPositions, type OrderEpisode, type OrderSection } from './episodeOrdering.js';

const S1 = 'sec-1', S2 = 'sec-2';
const sections: OrderSection[] = [
  { id: S2, sortOrder: 1 },
  { id: S1, sortOrder: 0 },
];
const ep = (id: string, sectionId: string | null, order: number | null, createdAt = '2026-01-01T00:00:00Z'): OrderEpisode => ({ id, sectionId, order, createdAt });
const ids = (plan: Array<{ id: string; order: number }>) => plan.map((p) => p.id);
const posOf = (eps: OrderEpisode[], secs = sections) => Object.fromEntries(sectionPositions(eps, secs));

describe('planEpisodeOrder', () => {
  it('sorts numerically (2 before 10) and renumbers 0..n-1', () => {
    const eps = [ep('d', null, 10), ep('a', null, 1), ep('c', null, 3), ep('b', null, 2)];
    expect(planEpisodeOrder(eps, [])).toEqual([
      { id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }, { id: 'd', order: 3 },
    ]);
  });

  it('follows the sections: section order, then unsectioned ("General") last', () => {
    // The production symptom: section 1 holds course positions 18, 19, 57, 58
    const eps = [ep('s2a', S2, 20), ep('s1c', S1, 57), ep('gen', null, 0), ep('s1a', S1, 18), ep('s1d', S1, 58), ep('s1b', S1, 19)];
    expect(ids(planEpisodeOrder(eps, sections))).toEqual(['s1a', 's1b', 's1c', 's1d', 's2a', 'gen']);
    expect(posOf(eps)).toEqual({ s1a: 1, s1b: 2, s1c: 3, s1d: 4, s2a: 1, gen: 1 });
  });

  it('moves an episode from position 4 to 2 inside its section, shifting the others down', () => {
    const eps = [ep('a', S1, 0), ep('b', S1, 1), ep('c', S1, 2), ep('d', S1, 3), ep('x', S2, 4)];
    const plan = planEpisodeOrder(eps, sections, { move: { episodeId: 'd', position: 2 } });
    expect(ids(plan)).toEqual(['a', 'd', 'b', 'c', 'x']);
    expect(plan.map((p) => p.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('a position already taken shifts the rest (no duplicates, no swap with unrelated episodes)', () => {
    const eps = [ep('a', S1, 0), ep('b', S1, 1), ep('c', S1, 2)];
    const plan = planEpisodeOrder(eps, sections, { move: { episodeId: 'c', position: 1 } });
    expect(ids(plan)).toEqual(['c', 'a', 'b']);
    expect(new Set(plan.map((p) => p.order)).size).toBe(3);
  });

  it('never moves an episode into another section; a too-large position means "last in its section"', () => {
    const eps = [ep('a', S1, 0), ep('b', S1, 1), ep('x', S2, 2), ep('y', S2, 3)];
    const plan = planEpisodeOrder(eps, sections, { move: { episodeId: 'a', position: 99 } });
    expect(ids(plan)).toEqual(['b', 'a', 'x', 'y']);
  });

  it('legacy data: missing (null) and duplicate orders get a stable unique sequence', () => {
    const eps = [
      ep('late', null, null, '2026-03-01T00:00:00Z'),
      ep('dup2', null, 5, '2026-02-01T00:00:00Z'),
      ep('dup1', null, 5, '2026-01-01T00:00:00Z'),
      ep('first', null, 0),
    ];
    const plan = planEpisodeOrder(eps, []);
    expect(ids(plan)).toEqual(['first', 'dup1', 'dup2', 'late']);
    expect(planEpisodeOrder(eps, [])).toEqual(plan); // deterministic
  });

  it('drag-and-drop sequence reorders within each section and keeps sections intact', () => {
    const eps = [ep('a', S1, 0), ep('b', S1, 1), ep('x', S2, 2), ep('y', S2, 3)];
    // the admin dragged b above a and y above x
    const plan = planEpisodeOrder(eps, sections, { sequence: ['b', 'a', 'y', 'x'] });
    expect(ids(plan)).toEqual(['b', 'a', 'y', 'x']);
    // a sequence that interleaves sections can't pull episodes across sections
    expect(ids(planEpisodeOrder(eps, sections, { sequence: ['x', 'a', 'y', 'b'] }))).toEqual(['a', 'b', 'x', 'y']);
  });

  it('an episode that just changed section goes to the end of that section', () => {
    const eps = [ep('a', S1, 0), ep('moved', S1, 1), ep('b', S1, 2), ep('x', S2, 3)];
    expect(ids(planEpisodeOrder(eps, sections, { toSectionEnd: 'moved' }))).toEqual(['a', 'b', 'moved', 'x']);
  });

  it('episodes in a deleted / unknown section fall back to General', () => {
    const eps = [ep('orphan', 'gone', 0), ep('a', S1, 1)];
    expect(ids(planEpisodeOrder(eps, sections))).toEqual(['a', 'orphan']);
    expect(posOf(eps)).toEqual({ a: 1, orphan: 1 });
  });
});

describe('parseEpisodePosition', () => {
  it('accepts positive whole numbers only', () => {
    expect(parseEpisodePosition(1)).toEqual({ ok: true, value: 1 });
    expect(parseEpisodePosition('10')).toEqual({ ok: true, value: 10 });
    for (const bad of [0, -1, 1.5, '2.5', '', 'abc', null, undefined, NaN]) expect(parseEpisodePosition(bad).ok).toBe(false);
  });
});
