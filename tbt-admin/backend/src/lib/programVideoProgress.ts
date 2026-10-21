// Program video completion — drives the Extra Lifeline "+" on the Mentorship header.
//
// "Required videos" = every VISIBLE episode (course_episodes.is_visible) of every
// PUBLISHED course (is_published AND is_active AND not deleted) whose module is
// one of the member's program modules:
//   • only modules the member can actually open — the same verdict the catalog
//     and playback guards use (mentorshipModules.ts resolveModuleAccess /
//     isCourseModuleAllowed): the member's admin override (members.allowed_modules)
//     when set, else programs.allowed_modules of their batch's program
//     ([] = all), narrowed by the member's own module selection / business-type
//     default (`effective`); an unrestricted member counts every active module;
//   • courses the member never enrolled in or opened still count;
//   • courses with no module (general content) are not part of any program
//     module and are not counted.
// "Completed" = course_episode_progress.completed = true for this member on those
// episodes (the authoritative per-lesson record) — never member_episode_progress
// (workshop episodes) and never the dashboard's Modules tile numbers.
//
// Fail closed: no batch, no eligible modules, or any error → null (the website
// keeps the "+" hidden); zero eligible videos is reported as total 0, which the
// website also treats as "not complete".
import { loadMemberModuleAccess } from './memberModuleAccess.js';
import type { ModuleAccess } from './mentorshipModules.js';

export interface ProgramVideoProgress {
  total: number;
  completed: number;
}

/** Modules whose courses are required: the modules the member can open (never one they can't). */
export function programVideoModules(access: ModuleAccess): string[] {
  // effective can still hold a module an admin has since deactivated (no selection yet);
  // only currently active modules (selectable) are required.
  return access.restricted ? access.effective.filter((m) => access.selectable.includes(m)) : access.selectable;
}

export async function loadProgramVideoProgress(
  prisma: any,
  redis: any,
  memberId: string,
  batchId: string | null,
): Promise<ProgramVideoProgress | null> {
  if (!batchId) return null;
  try {
    const modules = programVideoModules(await loadMemberModuleAccess(prisma, redis, memberId));
    if (modules.length === 0) return { total: 0, completed: 0 };
    const rows: Array<{ total: number; completed: number }> = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE cep.completed = true)::int AS completed
       FROM course_episodes ce
       JOIN courses c ON c.id = ce.course_id
       LEFT JOIN course_episode_progress cep ON cep.episode_id = ce.id AND cep.member_id = $1::uuid
       WHERE ce.is_visible = true
         AND c.is_published = true AND c.is_active = true AND c.deleted_at IS NULL
         AND c.module = ANY($2::text[])`,
      memberId, modules,
    );
    const total = Number(rows[0]?.total ?? 0);
    const completed = Number(rows[0]?.completed ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(completed)) return null;
    return { total, completed: Math.min(completed, total) };
  } catch {
    return null;
  }
}
