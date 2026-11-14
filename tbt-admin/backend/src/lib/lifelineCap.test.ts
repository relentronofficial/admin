import { describe, it, expect } from 'vitest';
import { MAX_LIFELINES_HELD, lifelineRoomLeft, clampLifelineCount, LifelineCapError } from './lifelineCap.js';

describe('lifeline cap', () => {
  it('caps holdings at 5', () => {
    expect(MAX_LIFELINES_HELD).toBe(5);
  });
  it('room left refills only up to the cap', () => {
    expect(lifelineRoomLeft(0)).toBe(5);
    expect(lifelineRoomLeft(4)).toBe(1);
    expect(lifelineRoomLeft(5)).toBe(0);
    expect(lifelineRoomLeft(8)).toBe(0);
    expect(lifelineRoomLeft(-2)).toBe(5);
    expect(lifelineRoomLeft(NaN)).toBe(5);
  });
  it('clamps configured counts', () => {
    expect(clampLifelineCount(3)).toBe(3);
    expect(clampLifelineCount(20)).toBe(5);
    expect(clampLifelineCount(-1)).toBe(0);
  });
  it('error message reflects room left', () => {
    expect(new LifelineCapError(0).message).toMatch(/maximum of 5/);
    expect(new LifelineCapError(2).message).toMatch(/buy 2 more/);
    expect(new LifelineCapError(0).code).toBe('LIFELINE_CAP_REACHED');
  });
});
