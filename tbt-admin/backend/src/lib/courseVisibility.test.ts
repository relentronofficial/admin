import { describe, it, expect } from 'vitest';
import { isCourseVisible, filterVisibleCourses } from './courseVisibility.js';

const course = (types: string[] | null, batchIds: string[] = []) => ({
  applicableBusinessTypes: types,
  batchVisibilityIds: batchIds,
});

const member = (cats: string[], batchId: string | null = null) => ({
  businessCategories: cats,
  batchId,
});

describe('isCourseVisible', () => {
  describe('General Content (no audience restriction)', () => {
    it('null applicable_business_types → visible to any member', () => {
      expect(isCourseVisible(course(null), member(['Service']))).toBe(true);
    });

    it('empty applicable_business_types → visible to any member', () => {
      expect(isCourseVisible(course([]), member(['Product']))).toBe(true);
    });

    it('General Content visible to uncategorised member too', () => {
      expect(isCourseVisible(course([]), member([]))).toBe(true);
    });
  });

  describe('Uncategorised member (backward compat)', () => {
    it('empty business_categories → sees all courses', () => {
      expect(isCourseVisible(course(['Product']), member([]))).toBe(true);
    });

    it('null business_categories → sees all courses', () => {
      expect(isCourseVisible(course(['Service']), member(null as any))).toBe(true);
    });
  });

  describe('Category matching', () => {
    it('exact match → visible', () => {
      expect(isCourseVisible(course(['Product']), member(['Product']))).toBe(true);
    });

    it('no match → hidden', () => {
      expect(isCourseVisible(course(['Product']), member(['Service']))).toBe(false);
    });

    it('multi-category member with one match → visible', () => {
      expect(isCourseVisible(course(['Product']), member(['Service', 'Product']))).toBe(true);
    });

    it('multi-category member with no match → hidden', () => {
      expect(isCourseVisible(course(['Coaching']), member(['Service', 'Product']))).toBe(false);
    });

    it('multi-category course with one member match → visible', () => {
      expect(isCourseVisible(course(['Product', 'Service']), member(['Service']))).toBe(true);
    });

    it('multi-category course with no member match → hidden', () => {
      expect(isCourseVisible(course(['Product', 'Service']), member(['Coaching']))).toBe(false);
    });
  });

  describe('Batch visibility override', () => {
    it('member batchId in batchVisibilityIds → visible despite category mismatch', () => {
      expect(isCourseVisible(
        course(['Product'], ['batch-1']),
        member(['Service'], 'batch-1'),
      )).toBe(true);
    });

    it('member batchId NOT in batchVisibilityIds → no override', () => {
      expect(isCourseVisible(
        course(['Product'], ['batch-2']),
        member(['Service'], 'batch-1'),
      )).toBe(false);
    });

    it('null member batchId → batch override never applies', () => {
      expect(isCourseVisible(
        course(['Product'], ['batch-1']),
        member(['Service'], null),
      )).toBe(false);
    });

    it('null batchVisibilityIds on course → treated as empty, no override', () => {
      const c = { applicableBusinessTypes: ['Product'], batchVisibilityIds: null };
      expect(isCourseVisible(c, member(['Service'], 'batch-1'))).toBe(false);
    });

    it('batch override also works for category-match member', () => {
      expect(isCourseVisible(
        course(['Product'], ['batch-1']),
        member(['Product'], 'batch-1'),
      )).toBe(true);
    });
  });
});

describe('filterVisibleCourses', () => {
  it('filters hidden courses and keeps visible ones', () => {
    const courses = [
      { id: '1', applicableBusinessTypes: ['Product'], batchVisibilityIds: [] },
      { id: '2', applicableBusinessTypes: [],           batchVisibilityIds: [] },
      { id: '3', applicableBusinessTypes: ['Service'],  batchVisibilityIds: [] },
    ];
    const result = filterVisibleCourses(courses, member(['Product']));
    expect(result.map(c => c.id)).toEqual(['1', '2']);
  });

  it('returns all courses for uncategorised member', () => {
    const courses = [
      { id: '1', applicableBusinessTypes: ['Product'], batchVisibilityIds: [] },
      { id: '2', applicableBusinessTypes: ['Service'],  batchVisibilityIds: [] },
    ];
    expect(filterVisibleCourses(courses, member([]))).toHaveLength(2);
  });

  it('batch override rescues a course that would otherwise be filtered', () => {
    const courses = [
      { id: '1', applicableBusinessTypes: ['Product'], batchVisibilityIds: ['batch-A'] },
      { id: '2', applicableBusinessTypes: ['Product'], batchVisibilityIds: [] },
    ];
    const result = filterVisibleCourses(courses, member(['Service'], 'batch-A'));
    expect(result.map(c => c.id)).toEqual(['1']);
  });

  it('empty input returns empty output', () => {
    expect(filterVisibleCourses([], member(['Product']))).toEqual([]);
  });
});
