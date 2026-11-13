import { describe, expect, it } from 'vitest';
import { buildProfileExtrasUpsert, buildSkillRatingsQuery, mergeSkillRatings, PROFILE_EXTRA_COLUMNS, profileExtrasSelect, SKILL_RATING_FIELDS } from './memberProfileExtras.js';

describe('member profile extras (side table, members is at the column limit)', () => {
  it('nothing provided → no write', () => {
    expect(buildProfileExtrasUpsert('m1', {})).toBeNull();
    expect(buildProfileExtrasUpsert('m1', { teamSize: '5' })).toBeNull(); // team_size stays on members
  });

  it('upserts only the given fields, typed, and never touches the others on conflict', () => {
    const q = buildProfileExtrasUpsert('m1', { hasWebsite: true, skillContent: 4, websiteUrl: null })!;
    expect(q.values).toEqual(['m1', true, 4, null]);
    expect(q.sql).toContain('INSERT INTO member_profile_extras (member_id, has_website, skill_content, website_url, updated_at)');
    expect(q.sql).toContain('VALUES ($1::uuid, $2::boolean, $3::int, $4::text, NOW())');
    expect(q.sql).toContain('ON CONFLICT (member_id) DO UPDATE SET has_website = EXCLUDED.has_website, skill_content = EXCLUDED.skill_content, website_url = EXCLUDED.website_url, updated_at = NOW()');
    expect(q.sql).not.toContain('skill_ads');
    expect(q.sql).not.toMatch(/\bmembers\b/);
  });

  it('stores watched video steps as JSON', () => {
    const q = buildProfileExtrasUpsert('m1', { watchedVideoSteps: ['intro', 'kyc'] })!;
    expect(q.values).toEqual(['m1', '["intro","kyc"]']);
    expect(q.sql).toContain('$2::jsonb');
  });

  it('never references a members column that production cannot hold', () => {
    const cols = Object.values(PROFILE_EXTRA_COLUMNS).map((c) => c.col);
    expect(cols).toEqual(expect.arrayContaining(['has_website', 'watched_video_steps', 'revenue_goal_after_tbt']));
    expect(profileExtrasSelect('x').split(', ').every((part) => part.startsWith('x.'))).toBe(true);
  });

  it('members list reads all six skill ratings from the side table, for the page of ids', () => {
    expect(SKILL_RATING_FIELDS).toEqual(['skillBusinessFoundation', 'skillContent', 'skillFunnels', 'skillAds', 'skillSales', 'skillOverallMarketing']);
    const sql = buildSkillRatingsQuery();
    expect(sql).toContain('FROM member_profile_extras x WHERE x.member_id = ANY($1::uuid[])');
    for (const f of SKILL_RATING_FIELDS) expect(sql).toContain(`x.${PROFILE_EXTRA_COLUMNS[f].col} AS "${f}"`);
  });

  it('merges saved ratings onto each member row; unrated members get null, not 1', () => {
    const members: any[] = [{ id: 'a' }, { id: 'b' }];
    mergeSkillRatings(members, [{ id: 'a', skillBusinessFoundation: 7, skillContent: 3, skillFunnels: null, skillAds: 10, skillSales: 5, skillOverallMarketing: 8 }]);
    expect(members[0]).toEqual({ id: 'a', skillBusinessFoundation: 7, skillContent: 3, skillFunnels: null, skillAds: 10, skillSales: 5, skillOverallMarketing: 8 });
    expect(members[1]).toEqual({ id: 'b', skillBusinessFoundation: null, skillContent: null, skillFunnels: null, skillAds: null, skillSales: null, skillOverallMarketing: null });
  });
});
