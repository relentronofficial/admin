/**
 * Pure course visibility gate for admin-assigned business-category filtering.
 *
 * CV-01/CV-02 added two new columns:
 *   members.business_categories JSONB  — admin-assigned multi-value audience
 *   courses.batch_visibility_ids JSONB — batch-level visibility overrides
 *
 * Combined with the existing courses.applicable_business_types TEXT[] these
 * signals decide whether a catalog entry is visible to a given member:
 *
 *   1. General Content — course has no applicable_business_types → visible to all.
 *   2. Uncategorised member — business_categories is empty → visible to all
 *      (backward compat; admin has not yet assigned categories to this member).
 *   3. Batch override — member's batchId is in course.batch_visibility_ids
 *      → visible regardless of category.
 *   4. Category intersection — at least one of the member's business_categories
 *      matches a course applicable_business_type → visible.
 *   5. Otherwise → hidden.
 *
 * This check is orthogonal to isCourseInMemberModules (mentorship module ceiling)
 * and to courses.module (which only drives the /courses tab UI).
 */

export interface CourseVisFields {
  applicableBusinessTypes: string[] | null;
  batchVisibilityIds: string[] | null;
}

export interface MemberVisFields {
  businessCategories: string[] | null;
  batchId: string | null;
}

export function isCourseVisible(course: CourseVisFields, member: MemberVisFields): boolean {
  // General Content: no audience restriction
  const types = course.applicableBusinessTypes ?? [];
  if (types.length === 0) return true;

  // Uncategorised member: backward-compat, sees everything until admin categorises
  const cats = member.businessCategories ?? [];
  if (cats.length === 0) return true;

  // Batch-level visibility override
  const batchIds = course.batchVisibilityIds ?? [];
  if (member.batchId && batchIds.includes(member.batchId)) return true;

  // Category intersection
  return types.some(t => cats.includes(t));
}

export function filterVisibleCourses<T extends CourseVisFields>(
  courses: T[],
  member: MemberVisFields,
): T[] {
  return courses.filter(c => isCourseVisible(c, member));
}
