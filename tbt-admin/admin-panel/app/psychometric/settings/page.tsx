"use client";

import { useEffect, useState } from "react";
import { api, getToken, type ApiEnvelope } from "@/lib/psychometric/api";
import { useToast } from "@/components/psychometric/ToastProvider";
import PageHeader from "@/components/psychometric/PageHeader";

type SettingsData = { assessment_duration_minutes: number; members_access_code_id: string | null };
type CodeOption = { _id: string; code: string; label: string; isActive: boolean; questionSetId: { _id: string; name: string } | null };

export default function SettingsPage() {
  const showToast = useToast();
  const token = getToken();

  const [duration, setDuration] = useState<number | "">("");
  const [savingDuration, setSavingDuration] = useState(false);
  const [membersCode, setMembersCode] = useState("");
  const [codes, setCodes] = useState<CodeOption[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get<ApiEnvelope<SettingsData>>("/admin/settings", token);
      if (ok && data.data) {
        setDuration(data.data.assessment_duration_minutes);
        setMembersCode(data.data.members_access_code_id ?? "");
      }
    })();
    (async () => {
      const { ok, data } = await api.get<ApiEnvelope<CodeOption[]>>("/admin/shared-ids", token);
      if (ok) setCodes(data.data.filter((c) => c.isActive && c.questionSetId));
    })();
  }, [token]);

  // The standalone app's "Admin Profile" and "Change Password" cards are not
  // here: Psychometric runs inside TBT with the TBT Admin session, so there is
  // no Psychometric account to manage.

  async function saveSettings() {
    if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
      return showToast("Please enter a valid duration in minutes.", "error");
    }
    setSavingDuration(true);
    const { ok, data } = await api.post<ApiEnvelope>("/admin/settings", { assessment_duration_minutes: Number(duration) }, token);
    setSavingDuration(false);
    if (!ok) {
      showToast(data.message || "Failed to update settings.", "error");
      return;
    }
    showToast("Settings updated successfully.", "success");
  }

  async function saveMembersAssessment() {
    setSavingMembers(true);
    const { ok, data } = await api.post<ApiEnvelope>("/admin/settings", { members_access_code_id: membersCode || null }, token);
    setSavingMembers(false);
    if (!ok) {
      showToast(data.message || "Failed to update settings.", "error");
      return;
    }
    showToast(membersCode ? "TBT members' assessment updated." : "The assessment is now off for TBT members.", "success");
  }

  return (
    <>
      <PageHeader title="Settings" breadcrumb="Manage assessment settings" />
      <main className="p-6 space-y-4 max-w-3xl mx-auto">
        <div className="card">
          <h3 className="font-bold mb-3" style={{ color: "var(--tbt-primary)" }}>TBT Members&apos; Assessment</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Members take the question set of this access code</label>
              <select value={membersCode} onChange={(e) => setMembersCode(e.target.value)}
                className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
                <option value="">Off — members can&apos;t take the assessment</option>
                {codes.map((c) => (
                  <option key={c._id} value={c._id}>{c.code} — {c.label} ({c.questionSetId?.name})</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--tbt-muted)" }}>
                Members sign in with their TBT login — no access code to type. Only active codes with a question set are listed.
              </p>
            </div>
            <button onClick={saveMembersAssessment} disabled={savingMembers} className="btn btn-primary">
              {savingMembers ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-3" style={{ color: "var(--tbt-primary)" }}>Assessment Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Assessment Time Limit (in minutes)</label>
              <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
                className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
            <button onClick={saveSettings} disabled={savingDuration} className="btn btn-primary">
              {savingDuration ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
