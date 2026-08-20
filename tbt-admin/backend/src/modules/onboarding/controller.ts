import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPresignedUrlHandler } from '../upload/controller.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import { canEditOnboarding, canSubmitOnboarding, checkOnboardingReadyToSubmit } from '../../lib/onboardingLogic.js';
import { onboardingContentSchema, onboardingUpdateSchema, presignDocumentSchema, registerDocumentSchema } from './schema.js';

const PROFILE_SELECT = {
  firstName: true, lastName: true, dob: true, gender: true, profilePhotoUrl: true,
  city: true, state: true, pincode: true, businessName: true, businessType: true,
  businessEstablishedOn: true, productServiceType: true, instagramLink: true,
  annualTurnover: true, goalAfter90Days: true, preferredSessionMode: true, gstNumber: true,
  marketingChannels: true, marketingChannelName: true, hasMarketingTeam: true,
  marketingTeamDetails: true, hasVideoEditing: true, videoEditingDetails: true,
  domainHostingDetails: true, businessAddress: true, sector: true, industry: true,
  subIndustry: true, businessStage: true, currentChallenges: true,
} as const;

// GET /api/onboarding — current wizard state (member-facing)
export async function getOnboardingHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const [member, documents] = await Promise.all([
    req.server.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        status: true, verificationStatus: true, onboardingCompleted: true,
        onboardingSubmittedAt: true, onboardingReviewNote: true,
        ...PROFILE_SELECT,
      } as any,
    }),
    req.server.prisma.kycDocument.findMany({
      where: { memberId },
      select: { id: true, documentType: true, documentUrl: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

  const { status, verificationStatus, onboardingCompleted, onboardingSubmittedAt, onboardingReviewNote, ...profile } = member as any;
  return reply.send({
    success: true,
    data: { status, verificationStatus, onboardingCompleted, onboardingSubmittedAt, onboardingReviewNote, profile, documents },
    error: null,
  });
}

// PATCH /api/onboarding — save progress (member-facing)
export async function updateOnboardingHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const parsed = onboardingUpdateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { verificationStatus: true } as any });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  if (!canEditOnboarding((member as any).verificationStatus)) {
    return reply.status(403).send({ success: false, data: null, error: 'Onboarding cannot be edited in its current state' });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.dob) data.dob = new Date(data.dob as string);
  if (data.businessEstablishedOn) data.businessEstablishedOn = new Date(data.businessEstablishedOn as string);

  const updated = await req.server.prisma.member.update({
    where: { id: memberId },
    data: data as any,
    select: PROFILE_SELECT as any,
  });
  return reply.send({ success: true, data: updated, error: null });
}

const CONTENT_COLS = `id, step_key AS "stepKey", title, text_body AS "textBody", video_url AS "videoUrl", audio_url AS "audioUrl", image_url AS "imageUrl", lottie_url AS "lottieUrl", quiz_data AS "quizData", sort_order AS "sortOrder", is_active AS "isActive"`;

// GET /api/onboarding/content — active step content (member-facing)
export async function getOnboardingContentHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ${CONTENT_COLS} FROM onboarding_content WHERE is_active = true ORDER BY sort_order ASC`,
  );
  return reply.send({ success: true, data: rows, error: null });
}

// POST /api/onboarding/photo/presign — member-facing, presign for profile photo upload
export async function presignProfilePhotoHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const parsed = presignDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { verificationStatus: true } as any });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  if (!canEditOnboarding((member as any).verificationStatus)) {
    return reply.status(403).send({ success: false, data: null, error: 'Profile photo cannot be changed in the current state' });
  }

  (req.body as any).bucket = 'profile-photos';
  (req.body as any).pathPrefix = `members/${memberId}`;
  return getPresignedUrlHandler(req, reply);
}

// POST /api/onboarding/documents/presign — member-facing, thin wrapper over
// the existing presigned-upload handler with a server-fixed bucket/prefix.
// The client-supplied bucket/pathPrefix on the generic upload endpoint is
// never used here — see SELF_ONBOARDING_SPECKIT.md §5.3.
export async function presignOnboardingDocumentHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const parsed = presignDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { verificationStatus: true } as any });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  if (!canEditOnboarding((member as any).verificationStatus)) {
    return reply.status(403).send({ success: false, data: null, error: 'Documents cannot be uploaded in the current state' });
  }

  (req.body as any).bucket = 'kyc-documents';
  (req.body as any).pathPrefix = `members/${memberId}`;
  return getPresignedUrlHandler(req, reply);
}

// POST /api/onboarding/documents — member-facing, register an uploaded document
export async function registerOnboardingDocumentHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const parsed = registerDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
  }

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { verificationStatus: true } as any });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  if (!canEditOnboarding((member as any).verificationStatus)) {
    return reply.status(403).send({ success: false, data: null, error: 'Documents cannot be uploaded in the current state' });
  }

  const doc = await req.server.prisma.kycDocument.create({
    data: { memberId, documentType: parsed.data.documentType, documentUrl: parsed.data.documentUrl, status: 'pending' },
    select: { id: true, documentType: true, documentUrl: true, status: true },
  });
  return reply.status(201).send({ success: true, data: doc, error: null });
}

// DELETE /api/onboarding/documents/:id — member-facing, remove a wrongly-uploaded document
export async function deleteOnboardingDocumentHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const memberId = req.memberId!;
  const doc = await req.server.prisma.kycDocument.findUnique({ where: { id: req.params.id } });
  // 404 rather than 403 for a document that isn't this member's — never
  // confirm existence of another member's document.
  if (!doc || doc.memberId !== memberId) {
    return reply.status(404).send({ success: false, data: null, error: 'Document not found' });
  }
  if (doc.status === 'verified') {
    return reply.status(403).send({ success: false, data: null, error: 'A verified document cannot be removed' });
  }

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { verificationStatus: true } as any });
  if (!canEditOnboarding((member as any)?.verificationStatus)) {
    return reply.status(403).send({ success: false, data: null, error: 'Documents cannot be removed in the current state' });
  }

  await req.server.prisma.kycDocument.delete({ where: { id: req.params.id } });
  return reply.send({ success: true, data: null, error: null });
}

// POST /api/onboarding/submit — member-facing, submit for admin review
export async function submitOnboardingHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const [member, documentCount] = await Promise.all([
    req.server.prisma.member.findUnique({
      where: { id: memberId },
      select: { phone: true, verificationStatus: true, ...PROFILE_SELECT } as any,
    }),
    req.server.prisma.kycDocument.count({ where: { memberId } }),
  ]);
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  if (!canSubmitOnboarding((member as any).verificationStatus)) {
    return reply.status(403).send({ success: false, data: null, error: 'Onboarding cannot be submitted in its current state' });
  }

  const check = checkOnboardingReadyToSubmit(member as any, documentCount);
  if (!check.valid) {
    return reply.status(400).send({
      success: false,
      data: { missingFields: check.missingFields, hasDocument: check.hasDocument },
      error: 'Please complete all required fields and upload at least one document before submitting',
    });
  }

  const updated = await req.server.prisma.member.update({
    where: { id: memberId },
    data: { verificationStatus: 'under_review', onboardingSubmittedAt: new Date(), onboardingReviewNote: null } as any,
    select: { verificationStatus: true, onboardingSubmittedAt: true } as any,
  });

  // Admins are notified here, not at signup — see SELF_ONBOARDING_SPECKIT.md §5.4.
  const fullName = `${(member as any).firstName} ${(member as any).lastName ?? ''}`.trim();
  req.server.io.to('admin').emit('admin:member_pending', {
    memberId, fullName, phone: (member as any).phone, createdAt: new Date().toISOString(),
  });
  void createAdminNotification(req.server.prisma, {
    title: 'Onboarding Submitted',
    body: `${fullName} submitted their onboarding application for review.`,
    type: 'member_pending',
    metadata: { memberId },
  });

  return reply.send({ success: true, data: updated, error: null });
}

// ── Admin content management (Clerk-protected, registered under /admin) ──

export async function adminListOnboardingContentHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ${CONTENT_COLS}, created_at AS "createdAt", updated_at AS "updatedAt" FROM onboarding_content ORDER BY sort_order ASC`,
  );
  return reply.send({ success: true, data: rows, error: null });
}

export async function adminCreateOnboardingContentHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = onboardingContentSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
  }
  const d = parsed.data;
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO onboarding_content (step_key, title, text_body, video_url, audio_url, image_url, lottie_url, quiz_data, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING ${CONTENT_COLS}`,
    d.stepKey, d.title, d.textBody ?? null, d.videoUrl ?? null, d.audioUrl ?? null,
    d.imageUrl ?? null, d.lottieUrl ?? null,
    d.quizData ? JSON.stringify(d.quizData) : null,
    d.sortOrder ?? 0, d.isActive ?? true,
  );
  return reply.status(201).send({ success: true, data: row, error: null });
}

export async function adminUpdateOnboardingContentHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = onboardingContentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
  }
  const d = parsed.data;
  const setClauses: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (d.stepKey !== undefined)  { setClauses.push(`step_key = $${idx++}`);   vals.push(d.stepKey); }
  if (d.title !== undefined)    { setClauses.push(`title = $${idx++}`);       vals.push(d.title); }
  if (d.textBody !== undefined) { setClauses.push(`text_body = $${idx++}`);   vals.push(d.textBody); }
  if (d.videoUrl !== undefined) { setClauses.push(`video_url = $${idx++}`);   vals.push(d.videoUrl); }
  if (d.audioUrl !== undefined) { setClauses.push(`audio_url = $${idx++}`);   vals.push(d.audioUrl); }
  if (d.imageUrl !== undefined) { setClauses.push(`image_url = $${idx++}`);   vals.push(d.imageUrl); }
  if (d.lottieUrl !== undefined){ setClauses.push(`lottie_url = $${idx++}`);  vals.push(d.lottieUrl); }
  if (d.quizData !== undefined) { setClauses.push(`quiz_data = $${idx++}::jsonb`); vals.push(d.quizData ? JSON.stringify(d.quizData) : null); }
  if (d.sortOrder !== undefined){ setClauses.push(`sort_order = $${idx++}`);  vals.push(d.sortOrder); }
  if (d.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`);   vals.push(d.isActive); }
  if (setClauses.length === 0) return reply.send({ success: true, data: null, error: null });
  setClauses.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE onboarding_content SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING ${CONTENT_COLS}`,
    ...vals,
  );
  return reply.send({ success: true, data: row ?? null, error: null });
}

export async function adminDeleteOnboardingContentHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  await req.server.prisma.$executeRawUnsafe(`DELETE FROM onboarding_content WHERE id = $1::uuid`, req.params.id);
  return reply.send({ success: true, data: null, error: null });
}

// PUT /api/onboarding/admin/content/reorder — { ids: string[] } sets sort_order by array position
export async function adminReorderOnboardingContentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = (req.body ?? {}) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return reply.status(400).send({ success: false, data: null, error: 'ids array is required' });
  }
  await Promise.all(
    ids.map((id, idx) =>
      req.server.prisma.$executeRawUnsafe(
        `UPDATE onboarding_content SET sort_order = $1, updated_at = NOW() WHERE id = $2::uuid`,
        idx,
        id,
      ),
    ),
  );
  return reply.send({ success: true, data: null, error: null });
}
