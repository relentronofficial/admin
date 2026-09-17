import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_STATUS = ["pending", "shortlisted", "rejected", "hired"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const status = (body as { status?: string })?.status;
  if (!status || !ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number])) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 },
    );
  }

  const updated = await prisma.application
    .update({ where: { id }, data: { status } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Application not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { id: updated.id, status: updated.status },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Application not found" },
      { status: 404 },
    );
  }

  if (existing.aadharFileUrl) {
    try {
      await del(existing.aadharFileUrl);
    } catch (err) {
      console.error("Blob delete failed", err);
    }
  }

  await prisma.application.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
