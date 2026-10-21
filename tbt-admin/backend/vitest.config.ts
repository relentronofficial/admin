import { defineConfig } from 'vitest/config';

/**
 * Vitest — TBT_ADS_SPECKIT.md §15.
 *
 * Deliberately narrow. This repo has no backend test suite, and this config is
 * not the start of retrofitting one: it exists so pure, DB-free modules
 * carrying their feature's highest correctness risk — the ad eligibility
 * engine and validation schemas, and the batch-report period/stats/message
 * math — can be verified instead of eyeballed. `include` lists specific
 * files/dirs on purpose, so a stray `*.test.ts` elsewhere cannot quietly
 * turn `npm test` into a slow, half-maintained suite.
 */
export default defineConfig({
  test: {
    include: ['src/modules/ads/**/*.test.ts', 'src/lib/batchReportLogic.test.ts', 'src/lib/onboardingLogic.test.ts', 'src/lib/onboardingMeetingLogic.test.ts', 'src/lib/weekChecklistLogic.test.ts', 'src/lib/chatMessageActionRules.test.ts', 'src/lib/helpdeskTicketRules.test.ts', 'src/lib/courseReportLogic.test.ts', 'src/lib/lessonProgression.test.ts', 'src/lib/streakPointsLogic.test.ts', 'src/lib/cache.test.ts', 'src/lib/supportQuota.test.ts', 'src/lib/supportCallLogic.test.ts', 'src/lib/coursePriceValidation.test.ts', 'src/lib/sessionRevocation.test.ts', 'src/lib/tbtStats.test.ts', 'src/lib/streakSummaryLogic.test.ts', 'src/lib/schemaGuardLogic.test.ts', 'src/lib/activityDays.test.ts', 'src/lib/memberActivityLogic.test.ts', 'src/lib/mentorshipModules.test.ts', 'src/lib/memberModuleAccess.test.ts', 'src/lib/weeklyGraphLogic.test.ts', 'src/lib/mentorshipDemo.test.ts', 'src/modules/user/mentorshipDemo.handlers.test.ts', 'src/lib/weeklyGraphConfig.test.ts', 'src/modules/weekly-graph/weeklyGraph.handlers.test.ts', 'src/lib/programVideoProgress.test.ts', 'src/lib/programVideoProgress.pg.test.ts', 'src/lib/lifelinePurchaseLogic.test.ts', 'src/modules/user/lifelinePurchase.handlers.test.ts', 'src/lib/lifelineCredit.pg.test.ts', 'src/lib/moduleFaqLogic.test.ts', 'src/modules/module-faqs/moduleFaqs.handlers.test.ts', 'src/modules/user/supportCallCoins.handlers.test.ts', 'src/modules/user-batch/spendCoins.handlers.test.ts', 'src/modules/user/episodeLifelineCoins.handlers.test.ts', 'src/modules/user/mentorshipModules.handlers.test.ts', 'src/modules/user/coinBalance.handlers.test.ts', 'src/lib/courseVisibility.test.ts'],
    environment: 'node',
    // These tests touch no database, no network and no Fastify instance. If one
    // ever needs to, it belongs in a different file with a different config —
    // the value here is that `npm test` stays fast enough to run on every save.
    testTimeout: 5_000,
  },
});
