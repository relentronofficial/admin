/**
 * Result export rows + CSV, ported from the standalone utils/exportHelper.js.
 * Category / dimension columns are derived from what appears in the export
 * (they are admin-configurable). Pure; the PDF is drawn in the handler.
 */

export interface ExportResult {
  userId?: { name?: string; email?: string; sharedCode?: string } | null;
  totalMarks: number;
  maxScore: number;
  percentage: number;
  level: string;
  categoryScores?: Record<string, number> | null;
  highestCategory?: string[] | null;
  businessReadinessPercent?: number | null;
  aptitudeScore?: number | null;
  personalityScore?: number | null;
  businessMindsetScore?: number | null;
  financialAwarenessScore?: number | null;
  dimensionPercentages?: Record<string, number> | null;
  strongDimensions?: string[] | null;
  weakDimensions?: string[] | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  skippedCount?: number | null;
  recommendedBusiness?: string[] | null;
  recommendations?: { business: string; explanation: string }[] | null;
  createdAt?: Date | string | null;
}

const v = (x: unknown) => (x === null || x === undefined ? '' : x);

export function buildCsv(results: ExportResult[]): string {
  const categoryNames = [...new Set(results.flatMap((r) => Object.keys(r.categoryScores ?? {})))].sort();
  const dimensionNames = [...new Set(results.flatMap((r) => Object.keys(r.dimensionPercentages ?? {})))].sort();
  const fields: [string, (r: ExportResult) => unknown][] = [
    ['Name', (r) => r.userId?.name ?? ''],
    ['Email', (r) => r.userId?.email ?? ''],
    ['Shared Code', (r) => r.userId?.sharedCode ?? ''],
    ['Total Marks', (r) => r.totalMarks],
    ['Max Score', (r) => r.maxScore],
    ['Percentage', (r) => r.percentage],
    ['Level', (r) => r.level],
    ...categoryNames.map((n) => [`${n} Score`, (r: ExportResult) => v(r.categoryScores?.[n])] as [string, (r: ExportResult) => unknown]),
    ['Top Category', (r) => (r.highestCategory ?? []).join('; ')],
    ['Business Readiness %', (r) => v(r.businessReadinessPercent)],
    ['Aptitude Score', (r) => v(r.aptitudeScore)],
    ['Personality Score', (r) => v(r.personalityScore)],
    ['Business Mindset Score', (r) => v(r.businessMindsetScore)],
    ['Financial Awareness Score', (r) => v(r.financialAwarenessScore)],
    ...dimensionNames.map((n) => [`${n} %`, (r: ExportResult) => v(r.dimensionPercentages?.[n])] as [string, (r: ExportResult) => unknown]),
    ['Strong Dimensions', (r) => (r.strongDimensions ?? []).join('; ')],
    ['Weak Dimensions', (r) => (r.weakDimensions ?? []).join('; ')],
    ['Correct', (r) => v(r.correctCount)],
    ['Wrong', (r) => v(r.wrongCount)],
    ['Skipped', (r) => v(r.skippedCount)],
    ['Recommended Business', (r) => (r.recommendedBusiness ?? []).join('; ')],
    ['Recommendations (business: explanation)', (r) => (r.recommendations ?? []).map((x) => `${x.business}: ${x.explanation}`).join(' | ')],
    ['Assessment Date', (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : '')],
  ];
  // json2csv quoting: every value quoted, inner quotes doubled.
  const cell = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const lines = [fields.map(([label]) => cell(label)).join(','), ...results.map((r) => fields.map(([, get]) => cell(get(r))).join(','))];
  return '﻿' + lines.join('\n'); // UTF-8 BOM for Excel
}

/** Summary statistics + charts for the dashboard (percentages, last 30 days, business counts). */
export function dashboardFigures(results: { percentage: number; createdAt: Date | string; recommendedBusiness?: string[] | null }[], today: Date = new Date()) {
  const scores = results.map((r) => r.percentage);
  const averageScore = scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const byDay: Record<string, number> = {};
  for (const r of results) {
    const day = new Date(r.createdAt).toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const businessCount: Record<string, number> = {};
  for (const r of results) for (const b of r.recommendedBusiness ?? []) businessCount[b] = (businessCount[b] || 0) + 1;
  return {
    averageScore,
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
    barChart: { labels: days, data: days.map((d) => byDay[d] || 0) },
    pieChart: { labels: Object.keys(businessCount), data: Object.values(businessCount) },
  };
}
