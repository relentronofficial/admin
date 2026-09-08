import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusActions from "./StatusActions";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) notFound();

  const mapLink =
    app.currentLatitude != null && app.currentLongitude != null
      ? `https://www.google.com/maps?q=${app.currentLatitude},${app.currentLongitude}`
      : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to list
        </Link>
        <StatusActions id={app.id} current={app.status} />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{app.fullName}</h1>
        <p className="text-sm text-slate-500">
          Applied for {app.position} · Submitted{" "}
          {new Date(app.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="section-title mb-3">Personal details</h2>
          <dl>
            <Row label="Email">
              <a
                className="text-brand-600 hover:underline"
                href={`mailto:${app.email}`}
              >
                {app.email}
              </a>
            </Row>
            <Row label="Phone">
              <a
                className="text-brand-600 hover:underline"
                href={`tel:${app.phone}`}
              >
                {app.phone}
              </a>
            </Row>
            <Row label="Date of birth">
              {new Date(app.dateOfBirth).toLocaleDateString()}
            </Row>
            <Row label="Gender">{app.gender.replace(/_/g, " ")}</Row>
            <Row label="Marital status">{app.maritalStatus}</Row>
            <Row label="Nationality">{app.nationality}</Row>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="section-title mb-3">Identity & documents</h2>
          <dl>
            <Row label="Aadhar number">
              <span className="font-mono">{app.aadharNumber}</span>
            </Row>
            <Row label="Aadhar file">
              <a
                href={app.aadharFileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                {app.aadharFileName || "View file"}
              </a>
            </Row>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="section-title mb-3">Current location (GPS)</h2>
          {app.currentLatitude != null && app.currentLongitude != null ? (
            <dl>
              <Row label="Latitude">
                <span className="font-mono">{app.currentLatitude}</span>
              </Row>
              <Row label="Longitude">
                <span className="font-mono">{app.currentLongitude}</span>
              </Row>
              <Row label="Accuracy">
                ±{app.locationAccuracy ? Math.round(app.locationAccuracy) : "—"} m
              </Row>
              {mapLink && (
                <Row label="Map">
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                </Row>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No location captured.</p>
          )}
        </section>

        <section className="card p-6">
          <h2 className="section-title mb-3">Qualifications</h2>
          <dl>
            <Row label="Education">{app.education}</Row>
            <Row label="Experience">{app.experienceYears} year(s)</Row>
            <Row label="Cover letter">
              {app.coverLetter ? (
                <p className="whitespace-pre-wrap text-slate-700">
                  {app.coverLetter}
                </p>
              ) : (
                <span className="text-slate-400">Not provided</span>
              )}
            </Row>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="section-title mb-3">Current address</h2>
          <p className="text-sm leading-6 text-slate-700">
            {app.currentAddressLine1}
            {app.currentAddressLine2 ? `, ${app.currentAddressLine2}` : ""}
            <br />
            {app.currentCity}, {app.currentState} — {app.currentPincode}
          </p>
        </section>

        <section className="card p-6">
          <h2 className="section-title mb-3">Permanent address</h2>
          <p className="text-sm leading-6 text-slate-700">
            {app.permanentAddressLine1}
            {app.permanentAddressLine2 ? `, ${app.permanentAddressLine2}` : ""}
            <br />
            {app.permanentCity}, {app.permanentState} — {app.permanentPincode}
          </p>
        </section>
      </div>
    </div>
  );
}
