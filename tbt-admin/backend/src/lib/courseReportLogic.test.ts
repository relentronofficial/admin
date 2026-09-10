import { describe, expect, it } from 'vitest';

import {
  buildCourseReportMessage,
  buildFeedbackMessage,
  computeCourseStats,
  computeWeekNumberForDate,
  isEligibleEnrollment,
} from './courseReportLogic.js';

describe('computeWeekNumberForDate', () => {
  it('is week 1 on the enrollment date itself', () => {
    const enrolledAt = new Date('2026-08-10T00:00:00Z');
    expect(computeWeekNumberForDate(enrolledAt, enrolledAt)).toBe(1);
  });

  it('is still week 1 for any day within the first 7 days', () => {
    const enrolledAt = new Date('2026-08-10T00:00:00Z');
    expect(computeWeekNumberForDate(new Date('2026-08-16T23:00:00Z'), enrolledAt)).toBe(1);
  });

  it('rolls over to week 2 exactly 7 days after enrollment', () => {
    const enrolledAt = new Date('2026-08-10T00:00:00Z');
    expect(computeWeekNumberForDate(new Date('2026-08-17T00:00:00Z'), enrolledAt)).toBe(2);
  });

  it('computes week 5 twenty-nine days after enrollment', () => {
    const enrolledAt = new Date('2026-01-01T00:00:00Z');
    expect(computeWeekNumberForDate(new Date('2026-01-30T00:00:00Z'), enrolledAt)).toBe(5);
  });
});

describe('computeCourseStats', () => {
  it('computes progress percentage and pending count from completed/total', () => {
    const stats = computeCourseStats({ totalLessons: 10, completedLessons: 4 });
    expect(stats).toEqual({
      totalLessons: 10,
      completedLessons: 4,
      pendingLessons: 6,
      progressPercentage: 40,
    });
  });

  it('returns 0% progress when there are no lessons yet', () => {
    const stats = computeCourseStats({ totalLessons: 0, completedLessons: 0 });
    expect(stats.progressPercentage).toBe(0);
    expect(stats.pendingLessons).toBe(0);
  });

  it('never returns a negative pendingLessons count', () => {
    // Defensive: completedLessons should never exceed totalLessons, but guard anyway.
    const stats = computeCourseStats({ totalLessons: 5, completedLessons: 6 });
    expect(stats.pendingLessons).toBe(0);
  });
});

describe('isEligibleEnrollment', () => {
  it('is eligible for an active member with a phone and no completion date', () => {
    expect(
      isEligibleEnrollment({ status: 'active', phone: '9999999999' }, { completedAt: null }),
    ).toBe(true);
  });

  it('is not eligible once the course is completed', () => {
    expect(
      isEligibleEnrollment({ status: 'active', phone: '9999999999' }, { completedAt: new Date() }),
    ).toBe(false);
  });

  it('is not eligible without a phone number', () => {
    expect(
      isEligibleEnrollment({ status: 'active', phone: null }, { completedAt: null }),
    ).toBe(false);
  });

  it('is not eligible for an inactive member', () => {
    expect(
      isEligibleEnrollment({ status: 'paused', phone: '9999999999' }, { completedAt: null }),
    ).toBe(false);
  });
});

describe('buildCourseReportMessage', () => {
  it('renders the exact requested WhatsApp report format', () => {
    const message = buildCourseReportMessage({
      userName: 'Kavya',
      courseName: 'React Fundamentals',
      weekNumber: 3,
      stats: { totalLessons: 10, completedLessons: 6, pendingLessons: 4, progressPercentage: 60 },
      completedTitles: ['Intro to JSX', 'Props & State'],
      pendingTitles: ['Hooks Deep Dive', 'Context API'],
      remarks: 'Great pace this week!',
    });

    expect(message).toBe(
      [
        'Weekly Course Report',
        '',
        'User: Kavya',
        'Course: React Fundamentals',
        'Week: 3',
        '',
        'Progress: 60%',
        '',
        'Completed:',
        '• Intro to JSX',
        '• Props & State',
        '',
        'Pending:',
        '• Hooks Deep Dive',
        '• Context API',
        '',
        'Admin Remarks:',
        'Great pace this week!',
      ].join('\n'),
    );
  });

  it('falls back to "None yet"/"None" for empty lists and missing remarks', () => {
    const message = buildCourseReportMessage({
      userName: 'Arun',
      courseName: 'Node Basics',
      weekNumber: 1,
      stats: { totalLessons: 5, completedLessons: 0, pendingLessons: 5, progressPercentage: 0 },
      completedTitles: [],
      pendingTitles: ['Lesson 1'],
      remarks: null,
    });
    expect(message).toContain('Completed:\nNone yet');
    expect(message).toContain('Admin Remarks:\nNone');
  });
});

describe('buildFeedbackMessage', () => {
  it('renders the exact requested WhatsApp feedback format', () => {
    const message = buildFeedbackMessage({
      userName: 'Kavya',
      courseName: 'React Fundamentals',
      weekNumber: 3,
      feedback: 'Loving the pace so far.',
      remarks: 'Could use more quizzes.',
    });

    expect(message).toBe(
      [
        'Weekly User Feedback',
        '',
        'User: Kavya',
        'Course: React Fundamentals',
        'Week: 3',
        '',
        'Feedback:',
        'Loving the pace so far.',
        '',
        'Additional Remarks:',
        'Could use more quizzes.',
      ].join('\n'),
    );
  });

  it('falls back to "None" for missing remarks', () => {
    const message = buildFeedbackMessage({
      userName: 'Arun',
      courseName: 'Node Basics',
      weekNumber: 1,
      feedback: 'All good.',
      remarks: undefined,
    });
    expect(message).toContain('Additional Remarks:\nNone');
  });
});
