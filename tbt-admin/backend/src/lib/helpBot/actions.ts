/**
 * Things the assistant prepares for a member. It never does them: the app shows
 * a card, and only the member's own Confirm runs the normal API for it.
 */
export type HelpBotAction =
  | { type: 'ticket'; subject: string; message: string; categoryId: string | null; categoryName: string | null; priority: 'low' | 'medium' | 'high' }
  | { type: 'book_call'; sessionId: string; title: string; category: string; startsAt: string; minutes: number; host: string | null }
  | { type: 'cancel_call'; bookingId: string; title: string; startsAt: string }
  | { type: 'habit'; habitId: string; question: string; done: boolean };

/** pending → working → done, or → dismissed. A failed try goes back to pending. */
export type ActionStatus = 'pending' | 'working' | 'done' | 'dismissed';

const NEXT: Record<ActionStatus, ActionStatus[]> = {
  pending: ['working', 'dismissed'],
  working: ['done', 'pending'],
  done: [],
  dismissed: [],
};

/** The statuses an action may be in for it to become `to`; empty = never. */
export function allowedFrom(to: unknown): ActionStatus[] {
  return (Object.keys(NEXT) as ActionStatus[]).filter((from) => NEXT[from].includes(to as ActionStatus));
}

export const MAX_ACTIONS = 3;
