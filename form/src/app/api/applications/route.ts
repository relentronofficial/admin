import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_MIME,
  MAX_FILE_SIZE,
  applicationSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

function parseNumber(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const file = form.get("aadharFile");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { success: false, error: "Aadhar file is required" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: "Aadhar file must be under 5 MB" },
      { status: 400 },
    );
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: "Aadhar file must be JPG, PNG, WebP, or PDF" },
      { status: 400 },
    );
  }

  const raw = {
    fullName: form.get("fullName")?.toString() ?? "",
    email: form.get("email")?.toString() ?? "",
    phone: form.get("phone")?.toString() ?? "",
    dateOfBirth: form.get("dateOfBirth")?.toString() ?? "",
    gender: form.get("gender")?.toString() ?? "",
    maritalStatus: form.get("maritalStatus")?.toString() ?? "",
    nationality: form.get("nationality")?.toString() ?? "",
    aadharNumber: form.get("aadharNumber")?.toString() ?? "",
    currentLatitude: parseNumber(form.get("currentLatitude")),
    currentLongitude: parseNumber(form.get("currentLongitude")),
    locationAccuracy: parseNumber(form.get("locationAccuracy")),
    currentAddressLine1: form.get("currentAddressLine1")?.toString() ?? "",
    currentAddressLine2: form.get("currentAddressLine2")?.toString() ?? "",
    currentCity: form.get("currentCity")?.toString() ?? "",
    currentState: form.get("currentState")?.toString() ?? "",
    currentPincode: form.get("currentPincode")?.toString() ?? "",
    permanentAddressLine1: form.get("permanentAddressLine1")?.toString() ?? "",
    permanentAddressLine2: form.get("permanentAddressLine2")?.toString() ?? "",
    permanentCity: form.get("permanentCity")?.toString() ?? "",
    permanentState: form.get("permanentState")?.toString() ?? "",
    permanentPincode: form.get("permanentPincode")?.toString() ?? "",
    education: form.get("education")?.toString() ?? "",
    experienceYears: Number(form.get("experienceYears") ?? NaN),
    coverLetter: form.get("coverLetter")?.toString() ?? "",
  };

  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { success: false, error: "Validation failed", fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const ext =
    file.type === "application/pdf"
      ? ".pdf"
      : file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
          ? ".webp"
          : ".jpg";
  const objectName = `aadhar/${Date.now()}_${randomBytes(12).toString("hex")}${ext}`;

  let aadharFileUrl: string;
  try {
    const blob = await put(objectName, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    aadharFileUrl = blob.url;
  } catch (err) {
    console.error("Blob upload failed", err);
    return NextResponse.json(
      { success: false, error: "File upload failed. Please try again." },
      { status: 500 },
    );
  }

  const created = await prisma.application.create({
    data: {
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      maritalStatus: data.maritalStatus,
      nationality: data.nationality,
      aadharNumber: data.aadharNumber,
      aadharFileUrl,
      aadharFileName: file.name,
      currentLatitude: data.currentLatitude ?? null,
      currentLongitude: data.currentLongitude ?? null,
      locationAccuracy: data.locationAccuracy ?? null,
      currentAddressLine1: data.currentAddressLine1,
      currentAddressLine2: data.currentAddressLine2 || null,
      currentCity: data.currentCity,
      currentState: data.currentState,
      currentPincode: data.currentPincode,
      permanentAddressLine1: data.permanentAddressLine1,
      permanentAddressLine2: data.permanentAddressLine2 || null,
      permanentCity: data.permanentCity,
      permanentState: data.permanentState,
      permanentPincode: data.permanentPincode,
      education: data.education,
      experienceYears: data.experienceYears,
      coverLetter: data.coverLetter || null,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
