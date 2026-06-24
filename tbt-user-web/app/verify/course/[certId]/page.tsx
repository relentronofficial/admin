import { CheckCircle2, XCircle, Award, Calendar, User } from "lucide-react";

interface CertData {
  memberName: string;
  courseTitle: string;
  completedAt: string;
}

async function fetchCert(certId: string): Promise<CertData | null> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${api}/api/pub/certificates/course/${encodeURIComponent(certId)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export default async function CertVerifyPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  const cert = await fetchCert(certId);

  const completedLabel = cert
    ? new Date(cert.completedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const displayId = certId.slice(0, 16).toUpperCase();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: "var(--color-bg-primary, #0f0f0f)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{ borderColor: cert ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "#333", background: "var(--color-bg-surface, #181818)" }}
      >
        {/* Header strip */}
        <div
          className="px-8 py-5 flex items-center gap-3"
          style={{ background: cert ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "color-mix(in srgb, #ef4444 8%, transparent)", borderBottom: "1px solid " + (cert ? "color-mix(in srgb, var(--color-accent) 25%, transparent)" : "color-mix(in srgb, #ef4444 25%, transparent)") }}
        >
          {cert ? (
            <CheckCircle2 size={28} style={{ color: "var(--color-accent)" }} />
          ) : (
            <XCircle size={28} className="text-red-500" />
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Tamil Business Tribe
            </p>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              {cert ? "Certificate Verified" : "Certificate Not Found"}
            </h1>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {cert ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  This certifies that
                </p>
                <p className="text-2xl font-bold text-foreground">{cert.memberName}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  has successfully completed
                </p>
                <p
                  className="text-base font-semibold"
                  style={{ color: "var(--color-accent)" }}
                >
                  {cert.courseTitle}
                </p>
              </div>

              <div className="border-t border-border pt-5 space-y-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Calendar size={15} />
                  <span>
                    Completed on{" "}
                    <span className="text-foreground font-medium">{completedLabel}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Award size={15} />
                  <span>
                    Certificate ID:{" "}
                    <span className="text-foreground font-mono text-xs">{displayId}</span>
                  </span>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground pt-2">
                This certificate was issued by Tamil Business Tribe and its authenticity
                has been verified.
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4 py-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                No certificate was found for this ID. The certificate may be invalid,
                revoked, or the ID may have been entered incorrectly.
              </p>
              <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-3 py-1.5 inline-block">
                ID: {displayId}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-8 py-4 border-t border-border flex items-center justify-between"
          style={{ background: "color-mix(in srgb, var(--color-bg-primary, #0f0f0f) 60%, transparent)" }}
        >
          <span className="text-xs text-muted-foreground">
            tamilbusinesstribe.com
          </span>
          {cert && (
            <span
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "var(--color-accent)" }}
            >
              <CheckCircle2 size={11} /> Authentic
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  const cert = await fetchCert(certId);
  if (!cert) return { title: "Certificate Not Found" };
  return {
    title: `Certificate — ${cert.memberName}`,
    description: `${cert.memberName} completed "${cert.courseTitle}" on Tamil Business Tribe.`,
  };
}
