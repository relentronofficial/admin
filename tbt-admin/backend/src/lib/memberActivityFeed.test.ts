import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_GROUPS, ACTIVITY_KINDS, feedSql, isActionKind, unreadSql } from './memberActivityFeed.js';

const all = feedSql(null);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('member activity feed', () => {
  it('limits every source to members assigned to the admin', () => {
    for (const sql of [all, unreadSql(), ...ACTIVITY_GROUPS.map(feedSql)]) {
      expect(sql).toContain('account_manager_id = $1::uuid');
      const sources = sql.split('UNION ALL').length;
      expect(count(sql, /IN \(SELECT id FROM mine\)/g)).toBe(sources);
    }
  });

  it('a group returns only its own sources', () => {
    expect(feedSql('tasks')).toContain("'task_submitted'");
    expect(feedSql('tasks')).not.toContain("'ticket_raised'");
  });

  it('messages: only those the member sent', () => {
    const sql = feedSql('messages');
    expect(sql).toContain("d.sender_type = 'member'");
    expect(sql).toContain('m.sender_member_id IN (SELECT id FROM mine)');
  });

  it('includes every kind, and counts everything but sent notifications as new', () => {
    for (const k of ACTIVITY_KINDS) expect(all).toContain(`'${k}'`);
    expect(isActionKind('task_submitted')).toBe(true);
    expect(isActionKind('direct_message') && isActionKind('group_message')).toBe(true);
    expect(isActionKind('notification_sent')).toBe(false);
    expect(unreadSql()).not.toContain('FROM notifications');
  });

  it('reads only tables that exist', () => {
    const ddl = readFileSync(new URL('../plugins/prisma.ts', import.meta.url), 'utf8')
      + readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
    const tables = new Set([...all.matchAll(/(?:FROM|JOIN) ([a-z_]{4,})\b/g)].map((m) => m[1]).filter((t) => t !== 'mine'));
    expect(tables.size).toBeGreaterThan(15);
    for (const t of tables) expect(ddl.includes(`@@map("${t}")`) || ddl.includes(`EXISTS ${t} `), t).toBe(true);
  });
});
