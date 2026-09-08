// One-off script: find a member by phone and send them a test batch report.
// Run with: node --env-file=.env scripts/send-test-report.mjs <phone> [weekly|monthly]
//
// Example: node --env-file=.env scripts/send-test-report.mjs 7010834661 weekly

import { PrismaClient } from '@prisma/client';

const [, , phone, reportType = 'weekly'] = process.argv;

if (!phone) {
  console.error('Usage: node --env-file=.env scripts/send-test-report.mjs <phone> [weekly|monthly]');
  process.exit(1);
}
if (reportType !== 'weekly' && reportType !== 'monthly') {
  console.error('reportType must be "weekly" or "monthly"');
  process.exit(1);
}

const prisma = new PrismaClient();

// Dynamic import so env is already loaded by --env-file before the module runs.
const { deliverMemberReport, generateMemberReport } = await import('../src/lib/batchReports.js');

async function main() {
  const normalised = phone.replace(/\D/g, '');
  const member = await prisma.member.findFirst({
    where: { phone: { in: [normalised, `+91${normalised}`, `91${normalised}`] } },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true, batchId: true },
  });

  if (!member) {
    console.error(`No member found with phone: ${phone}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Found member: ${member.firstName} ${member.lastName ?? ''} (${member.phone}) — status: ${member.status}, batchId: ${member.batchId}`);

  // Preview first
  const preview = await generateMemberReport(prisma, member.id, reportType);
  if (!preview.eligible) {
    console.error(`Member not eligible: ${preview.reason}`);
    console.log('You can still force-send by passing force=true in the API, but skipping here.');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n─── Preview ───────────────────────────────');
  console.log(preview.message);
  console.log('───────────────────────────────────────────\n');

  // Send (force=true to bypass duplicate-period guard during testing)
  const result = await deliverMemberReport(prisma, member.id, reportType, { force: true });
  console.log(`Delivery result: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
