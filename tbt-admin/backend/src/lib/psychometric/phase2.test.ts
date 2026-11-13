import { describe, expect, it } from 'vitest';
import { buildCsv, dashboardFigures } from './resultExport.js';
import { buildProsody, detectTanglish, explanationSpeechText, patchTtsConfig, tanglishToTamil, voiceForExplanation, voiceForLang } from './voice.js';

describe('buildCsv', () => {
  const r = {
    userId: { name: 'Ravi "R" Kumar', email: 'r@x.com', sharedCode: 'TBT1' },
    totalMarks: 40, maxScore: 50, percentage: 80, level: 'Good',
    categoryScores: { Leadership: 20, Communication: 20 },
    dimensionPercentages: { Leadership: 90 },
    highestCategory: ['Leadership'], recommendedBusiness: ['Consulting', 'Agency'],
    recommendations: [{ business: 'Consulting', explanation: 'fit' }],
    correctCount: 3, wrongCount: 1, skippedCount: 0,
    createdAt: '2026-10-01T10:00:00.000Z',
  };

  it('starts with a BOM, quotes every value and escapes quotes', () => {
    const csv = buildCsv([r]);
    expect(csv.startsWith('﻿"Name","Email","Shared Code"')).toBe(true);
    expect(csv).toContain('"Ravi ""R"" Kumar"');
  });

  it('derives sorted category and dimension columns from the data', () => {
    const header = buildCsv([r]).split('\n')[0];
    expect(header).toContain('"Communication Score","Leadership Score","Top Category"');
    expect(header).toContain('"Leadership %","Strong Dimensions"');
  });

  it('joins lists the same way as the old export', () => {
    const row = buildCsv([r]).split('\n')[1];
    expect(row).toContain('"Consulting; Agency"');
    expect(row).toContain('"Consulting: fit"');
    expect(row).toContain('"2026-10-01T10:00:00.000Z"');
  });
});

describe('dashboardFigures', () => {
  it('averages percentages, finds extremes, buckets the last 30 days and counts businesses', () => {
    const today = new Date('2026-10-30T12:00:00Z');
    const f = dashboardFigures([
      { percentage: 80, createdAt: '2026-10-30T09:00:00Z', recommendedBusiness: ['A', 'B'] },
      { percentage: 61, createdAt: '2026-10-29T09:00:00Z', recommendedBusiness: ['A'] },
      { percentage: 70, createdAt: '2026-01-01T09:00:00Z', recommendedBusiness: [] },
    ], today);
    expect(f.averageScore).toBe(70.3);
    expect([f.highestScore, f.lowestScore]).toEqual([80, 61]);
    expect(f.barChart.labels).toHaveLength(30);
    expect(f.barChart.labels.at(-1)).toBe('2026-10-30');
    expect(f.barChart.data.at(-1)).toBe(1);
    expect(f.barChart.data.at(-2)).toBe(1);
    expect(f.pieChart).toEqual({ labels: ['A', 'B'], data: [2, 1] });
  });

  it('is all zero with no results', () => {
    const f = dashboardFigures([]);
    expect([f.averageScore, f.highestScore, f.lowestScore]).toEqual([0, 0, 0]);
  });
});

describe('voice helpers', () => {
  it('transliterates Tanglish to Tamil script', () => {
    expect(tanglishToTamil('vanakkam')).toBe('வநக்கம்');
    expect(tanglishToTamil('தமிழ்')).toBe('தமிழ்');
  });

  it('detects Tanglish vs English', () => {
    expect(detectTanglish('neenga romba nalla pannunga')).toBe(true);
    expect(detectTanglish('please choose the best answer')).toBe(false);
  });

  it('explanation speech text: Tamil script as-is, Tanglish transliterated, English untouched', () => {
    expect(explanationSpeechText({ explanationAudioText: 'தமிழ் விளக்கம்' })).toBe('தமிழ் விளக்கம்');
    expect(explanationSpeechText({ explanationAudioText: 'vanakkam', explanationIsTanglish: true })).toBe('வநக்கம்');
    expect(explanationSpeechText({ explanationAudioText: 'Read each option carefully' })).toBe('Read each option carefully');
    expect(explanationSpeechText({ explanationAudioText: '  ' })).toBe('');
  });

  it('settings patch keeps only valid fields and clamps numbers', () => {
    expect(patchTtsConfig({ ratePct: 99, pitchHz: '-80', enabled: 0, voiceEn: '', bogus: 1 })).toEqual({ ratePct: 50, pitchHz: -50, enabled: false });
  });

  it('prosody strings and voice choice', () => {
    expect(buildProsody({ ratePct: -6, pitchHz: 0 })).toEqual({ rate: '-6%', pitch: '+0Hz' });
    expect(voiceForLang('ta', {})).toBe('ta-IN-PallaviNeural');
    expect(voiceForLang('en', { voiceEn: 'en-GB-RyanNeural' })).toBe('en-GB-RyanNeural');
    expect(voiceForExplanation('தமிழ்', { voiceExplanation: 'ta-IN-ValluvarNeural' })).toBe('ta-IN-ValluvarNeural');
  });
});
