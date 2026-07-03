/**
 * Batch Sample Data Seed
 * Run: npx tsx prisma/seed-batches.ts  (from backend/)
 *   or: npm run seed:batches            (from tbt-admin/)
 *
 * Targets the first active batch ("Batch 2026 — Cohort A") and adds:
 *   - MemberDayProgress records for all batch members (Days 1–5)
 *   - MemberAttendance records for all members (Days 1–7)
 *   - 2 BatchBreakRequest examples
 *   - Category labels on batch days 1–10
 *
 * Idempotent — skips creation if the record already exists.
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ── Day categories for Days 1–10 ─────────────────────────────────────────────

const DAY_CATEGORIES: Record<number, string> = {
  1:  'Foundation',
  2:  'Market Research',
  3:  'Market Research',
  4:  'Branding',
  5:  'Finance',
  6:  'Product',
  7:  'Weekly Review',
  8:  'Marketing',
  9:  'Content',
  10: 'Lead Generation',
};

// ── Member progress definitions ───────────────────────────────────────────────
// Each entry: memberId → array of { dayNumber, status, journalEntry?, reviewNote?, submittedAt? }
// We look up member IDs from the DB at runtime so this is keyed by first/last name.

type ProgressEntry = {
  dayNumber: number;
  status: string;
  journalEntry?: string;
  reviewNote?: string;
  submittedAt?: Date;
};

type MemberProgress = {
  firstName: string;
  lastName: string;
  progress: ProgressEntry[];
};

const MEMBER_PROGRESS: MemberProgress[] = [
  {
    firstName: 'Ravi',
    lastName: 'Murugan',
    progress: [
      {
        dayNumber: 1,
        status: 'approved',
        journalEntry: "Wrote my vision statement — Tamil Nadu's top digital marketing agency by end of 2027. Committed.",
        submittedAt: new Date('2026-06-02T09:30:00Z'),
      },
      {
        dayNumber: 2,
        status: 'approved',
        journalEntry: 'Interviewed 3 potential customers. Biggest pain point: no idea how to market online without burning cash.',
        submittedAt: new Date('2026-06-03T10:15:00Z'),
      },
      {
        dayNumber: 3,
        status: 'approved',
        journalEntry: 'Mapped 5 competitors. Found a gap: nobody is doing affordable video marketing for Tamil SMEs.',
        submittedAt: new Date('2026-06-04T11:00:00Z'),
      },
      {
        dayNumber: 4,
        status: 'pending_approval',
        journalEntry: 'Drafted my USP: "High-quality Tamil business videos at ₹5,000 — not ₹50,000." Simple and powerful.',
        submittedAt: new Date('2026-06-05T14:00:00Z'),
      },
    ],
  },
  {
    firstName: 'Deepika',
    lastName: 'Natarajan',
    progress: [
      {
        dayNumber: 1,
        status: 'approved',
        journalEntry: 'Vision: Own a handmade jewelry brand that sells pan-India, ₹10L revenue by December 2026.',
        submittedAt: new Date('2026-06-02T08:00:00Z'),
      },
      {
        dayNumber: 2,
        status: 'approved',
        journalEntry: 'Researched 50 potential customers on Instagram. Women 25-40, working professionals, love handmade aesthetic.',
        submittedAt: new Date('2026-06-03T09:00:00Z'),
      },
      {
        dayNumber: 3,
        status: 'in_progress',
        journalEntry: 'Competitive analysis in progress — cataloguing what Pipa Bella and Tribe do vs. what small sellers do differently.',
      },
    ],
  },
  {
    firstName: 'Sakthivel',
    lastName: 'Paneerselvam',
    progress: [
      {
        dayNumber: 1,
        status: 'approved',
        journalEntry: 'Vision set. Goal: catering business serving 500+ events per year across Coimbatore. Starting now.',
        submittedAt: new Date('2026-06-02T07:00:00Z'),
      },
      {
        dayNumber: 2,
        status: 'pending_approval',
        journalEntry: 'Customer interviews done — married couples planning events want one vendor who handles everything, not 5 separate ones.',
        submittedAt: new Date('2026-06-03T16:30:00Z'),
      },
    ],
  },
  {
    firstName: 'Merlin',
    lastName: 'D',
    progress: [
      {
        dayNumber: 1,
        status: 'in_progress',
        journalEntry: 'Started watching the orientation video. Taking notes on the program structure.',
      },
    ],
  },
  {
    firstName: 'Karthik',
    lastName: 'Selvam',
    progress: [
      {
        dayNumber: 1,
        status: 'rejected',
        journalEntry: 'Submitted my vision but it was too vague.',
        reviewNote: 'Please be more specific. Include revenue targets, number of customers, and timeline. Re-submit with 2-3 concrete metrics.',
        submittedAt: new Date('2026-06-02T18:00:00Z'),
      },
    ],
  },
];

// ── Attendance seed data ──────────────────────────────────────────────────────
// Per-day attendance for days 1–7 across all active members.
// present = showed up to live session / on-track. absent = missed.

type AttendanceRecord = {
  firstName: string;
  lastName: string;
  days: Record<number, { status: string; notes?: string }>;
};

const ATTENDANCE_DATA: AttendanceRecord[] = [
  {
    firstName: 'Arjun',
    lastName: 'Subramaniam',
    days: {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'present' },
      4: { status: 'present' },
      5: { status: 'present' },
      6: { status: 'present' },
      7: { status: 'absent', notes: 'Family event — informed in advance' },
    },
  },
  {
    firstName: 'Priya',
    lastName: 'Krishnan',
    days: {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'present' },
      4: { status: 'present' },
      5: { status: 'present' },
      6: { status: 'absent', notes: 'Out of town' },
      7: { status: 'present' },
    },
  },
  {
    firstName: 'Ravi',
    lastName: 'Murugan',
    days: {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'present' },
      4: { status: 'present' },
      5: { status: 'absent', notes: 'Power cut, joined partial session via mobile' },
      6: { status: 'present' },
      7: { status: 'present' },
    },
  },
  {
    firstName: 'Deepika',
    lastName: 'Natarajan',
    days: {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'present' },
      4: { status: 'absent' },
      5: { status: 'present' },
      6: { status: 'present' },
      7: { status: 'present' },
    },
  },
  {
    firstName: 'Sakthivel',
    lastName: 'Paneerselvam',
    days: {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'absent', notes: 'Emergency at business — joined recording' },
      4: { status: 'present' },
      5: { status: 'present' },
      6: { status: 'present' },
      7: { status: 'present' },
    },
  },
  {
    firstName: 'Merlin',
    lastName: 'D',
    days: {
      1: { status: 'present' },
      2: { status: 'absent', notes: 'Late joiner — joined batch on Day 2' },
      3: { status: 'present' },
      4: { status: 'present' },
      5: { status: 'present' },
      6: { status: 'absent' },
      7: { status: 'present' },
    },
  },
  {
    firstName: 'Karthik',
    lastName: 'Selvam',
    days: {
      1: { status: 'present' },
      2: { status: 'break', notes: 'On approved break — health reasons' },
      3: { status: 'break', notes: 'On approved break' },
      4: { status: 'break', notes: 'On approved break' },
      5: { status: 'absent' },
      6: { status: 'absent' },
      7: { status: 'absent' },
    },
  },
  {
    firstName: 'Manoj',
    lastName: 'G',
    days: {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'present' },
      4: { status: 'present' },
      5: { status: 'present' },
      6: { status: 'present' },
      7: { status: 'present' },
    },
  },
];

// ── Break requests ────────────────────────────────────────────────────────────

type BreakRequest = {
  firstName: string;
  lastName: string;
  startDay: number;
  endDay: number;
  reason: string;
  status: string;
  adminNote?: string;
};

const BREAK_REQUESTS: BreakRequest[] = [
  {
    firstName: 'Karthik',
    lastName: 'Selvam',
    startDay: 2,
    endDay: 4,
    reason: 'Hospitalized for 3 days — medical certificate attached to the group.',
    status: 'approved',
    adminNote: 'Approved. Get well soon, Karthik. Resume from Day 5.',
  },
  {
    firstName: 'Deepika',
    lastName: 'Natarajan',
    startDay: 11,
    endDay: 13,
    reason: 'Travelling to Chennai for a trade fair — will catch up on recordings.',
    status: 'pending',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Batch sample data…\n');

  // ── Resolve batch ──────────────────────────────────────────────────────────
  const batch = await prisma.batch.findFirst({
    where: { isActive: true },
    orderBy: { startsAt: 'asc' },
  });

  if (!batch) {
    console.log('❌  No active batch found. Create a batch first.');
    return;
  }
  console.log(`📦 Batch: "${batch.name}" (id: ${batch.id})\n`);

  // ── Resolve all batch members ──────────────────────────────────────────────
  const allMembers = await prisma.member.findMany({
    where: { batchId: batch.id },
    select: { id: true, firstName: true, lastName: true },
  });

  function findMember(firstName: string, lastName: string) {
    return allMembers.find(
      m =>
        m.firstName?.toLowerCase() === firstName.toLowerCase() &&
        m.lastName?.toLowerCase() === lastName.toLowerCase(),
    );
  }

  console.log(`👥 Members in batch: ${allMembers.length}\n`);

  // ── 1. Update batch day categories ────────────────────────────────────────
  let catUpdated = 0;
  for (const [dayStr, category] of Object.entries(DAY_CATEGORIES)) {
    const dayNumber = parseInt(dayStr, 10);
    const day = await prisma.batchDay.findFirst({
      where: { batchId: batch.id, dayNumber },
    });
    if (!day) continue;
    await prisma.batchDay.update({
      where: { id: day.id },
      data: { category } as any,
    });
    catUpdated++;
  }
  console.log(`✅ Updated ${catUpdated} batch day categories (Days 1–10)\n`);

  // ── 2. MemberDayProgress ─────────────────────────────────────────────────
  let progCreated = 0;
  let progSkipped = 0;

  for (const mp of MEMBER_PROGRESS) {
    const member = findMember(mp.firstName, mp.lastName);
    if (!member) {
      console.log(`  ⚠️  Member not found: ${mp.firstName} ${mp.lastName} — skipping`);
      continue;
    }

    for (const p of mp.progress) {
      const exists = await prisma.memberDayProgress.findFirst({
        where: { batchId: batch.id, memberId: member.id, dayNumber: p.dayNumber },
      });
      if (exists) { progSkipped++; continue; }

      await prisma.memberDayProgress.create({
        data: {
          batchId:      batch.id,
          memberId:     member.id,
          dayNumber:    p.dayNumber,
          status:       p.status,
          journalEntry: p.journalEntry ?? null,
          reviewNote:   p.reviewNote ?? null,
          submittedAt:  p.submittedAt ?? null,
          completedTaskIds: [],
        } as any,
      });
      progCreated++;
    }
  }

  console.log(`✅ MemberDayProgress: ${progCreated} created, ${progSkipped} skipped\n`);

  // ── 3. MemberAttendance ───────────────────────────────────────────────────
  let attCreated = 0;
  let attSkipped = 0;

  for (const ar of ATTENDANCE_DATA) {
    const member = findMember(ar.firstName, ar.lastName);
    if (!member) {
      console.log(`  ⚠️  Member not found: ${ar.firstName} ${ar.lastName} — skipping attendance`);
      continue;
    }

    for (const [dayStr, att] of Object.entries(ar.days)) {
      const dayNumber = parseInt(dayStr, 10);
      const exists = await prisma.memberAttendance.findFirst({
        where: { batchId: batch.id, memberId: member.id, dayNumber },
      });
      if (exists) { attSkipped++; continue; }

      await prisma.memberAttendance.create({
        data: {
          batchId:   batch.id,
          memberId:  member.id,
          dayNumber,
          status:    att.status,
          notes:     att.notes ?? null,
          markedAt:  new Date(),
        } as any,
      });
      attCreated++;
    }
  }

  console.log(`✅ MemberAttendance: ${attCreated} created, ${attSkipped} skipped\n`);

  // ── 4. BatchBreakRequests ─────────────────────────────────────────────────
  let brCreated = 0;
  let brSkipped = 0;

  for (const br of BREAK_REQUESTS) {
    const member = findMember(br.firstName, br.lastName);
    if (!member) {
      console.log(`  ⚠️  Member not found: ${br.firstName} ${br.lastName} — skipping break request`);
      continue;
    }

    const exists = await prisma.batchBreakRequest.findFirst({
      where: { batchId: batch.id, memberId: member.id, startDay: br.startDay },
    });
    if (exists) { brSkipped++; continue; }

    await prisma.batchBreakRequest.create({
      data: {
        batchId:    batch.id,
        memberId:   member.id,
        startDay:   br.startDay,
        endDay:     br.endDay,
        reason:     br.reason,
        status:     br.status,
        adminNote:  br.adminNote ?? null,
        reviewedAt: br.status !== 'pending' ? new Date() : null,
      } as any,
    });
    brCreated++;
  }

  console.log(`✅ BatchBreakRequests: ${brCreated} created, ${brSkipped} skipped\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalProgress = await prisma.memberDayProgress.count({ where: { batchId: batch.id } });
  const totalAttendance = await prisma.memberAttendance.count({ where: { batchId: batch.id } });
  const totalBreaks = await prisma.batchBreakRequest.count({ where: { batchId: batch.id } });

  console.log('📊 Summary');
  console.log(`   Batch       : ${batch.name}`);
  console.log(`   Day Progress: ${totalProgress} total records`);
  console.log(`   Attendance  : ${totalAttendance} total records`);
  console.log(`   Break Reqs  : ${totalBreaks} total`);
  console.log('\n✨ Done!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
