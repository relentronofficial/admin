// Raise a helpdesk ticket on behalf of a member (same row shape as a
// member-submitted ticket from /support).
//
// Usage (from tbt-admin/backend/, needs backend/.env):
//   node scripts/raise-ticket-for-member.mjs --phone 9xxxxxxxxx \
//     --subject "Short summary" --message "Full description" [--priority medium]
//   Add --dry-run to preview without writing.
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
    return acc;
  }, []),
);
const { phone, subject, message } = args;
const priority = args.priority ?? 'medium';
if (!phone || !subject || !message) {
  console.error('Required: --phone, --subject, --message');
  process.exit(1);
}
if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
  console.error('--priority must be low | medium | high | urgent');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  const member = await prisma.member.findFirst({
    where: { phone: { endsWith: digits } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  if (!member) throw new Error(`No member found with phone ending ${digits}`);
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
  console.log('Member:', { id: member.id, name, phone: member.phone, email: member.email });

  if (args['dry-run']) {
    console.log('Dry run — would create ticket:', { subject, message, priority });
  } else {
    const t = await prisma.helpdeskTicket.create({
      data: {
        memberId: member.id,
        name,
        email: member.email,
        phone: member.phone,
        subject,
        message,
        priority,
        status: 'new',
      },
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO admin_notifications (title, body, type, metadata) VALUES ($1, $2, $3, $4::jsonb)`,
      'New Support Ticket', `${name}: ${subject}`, 'helpdesk_ticket', JSON.stringify({ ticketId: t.id }),
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO helpdesk_ticket_activity_log (ticket_id, actor_type, actor_id, action) VALUES ($1::uuid, 'system', NULL, 'created')`,
      t.id,
    );
    console.log(`Created ticket #${t.displayNumber ?? '?'} (${t.id})`);
  }
} finally {
  await prisma.$disconnect();
}
