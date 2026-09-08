import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();

const member = await prisma.member.findFirst({
  where: { verificationStatus: 'awaiting_kyc', status: 'pending' },
  select: { id: true, firstName: true, lastName: true, verificationStatus: true },
});

if (!member) { console.error('No awaiting_kyc member found'); process.exit(1); }
console.log('Testing with member:', member.firstName, member.lastName, `(${member.id})`);

const secret = process.env.JWT_ACCESS_SECRET;
const token = jwt.sign({ memberId: member.id }, secret, { expiresIn: '2h' });

const pdfBuf = Buffer.from('%PDF-1.4 1 obj<</Type /Catalog>> endobj');
const params = new URLSearchParams({ documentType: 'id_proof', filename: 'test-id.pdf' });

// Test against local backend first (JWT secret matches), then remotes
const targets = [
  { label: 'local', url: 'http://localhost:8000' },
  { label: 'staging', url: 'https://tbt-backend-staging-464464507912.asia-south1.run.app' },
  { label: 'production', url: 'https://tbt-backend-464464507912.asia-south1.run.app' },
];

for (const { label, url } of targets) {
  const endpoint = `${url}/api/onboarding/documents/upload?${params}`;
  console.log(`\n[${label}] POST ${endpoint}`);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', Cookie: `tbt_access=${token}` },
      body: pdfBuf,
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response:`, JSON.stringify(body, null, 2));
    if (res.status === 201) {
      console.log(`\n✓ [${label}] Upload endpoint working! Doc ID: ${body.data?.id}`);
      // Clean up: delete the test document
      const delRes = await fetch(`${url}/api/onboarding/documents/${body.data?.id}`, {
        method: 'DELETE',
        headers: { Cookie: `tbt_access=${token}` },
      });
      console.log(`  Cleanup DELETE: ${delRes.status}`);
    }
  } catch (e) {
    if (e.name === 'TimeoutError' || e.code === 'ECONNREFUSED') {
      console.log(`  Not available (${e.code ?? e.name})`);
    } else {
      console.error(`  Error: ${e.message}`);
    }
  }
}

await prisma.$disconnect();
