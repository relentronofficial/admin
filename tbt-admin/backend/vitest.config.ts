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
    include: ['src/modules/ads/**/*.test.ts', 'src/lib/batchReportLogic.test.ts'],
    environment: 'node',
    // These tests touch no database, no network and no Fastify instance. If one
    // ever needs to, it belongs in a different file with a different config —
    // the value here is that `npm test` stays fast enough to run on every save.
    testTimeout: 5_000,
  },
});
