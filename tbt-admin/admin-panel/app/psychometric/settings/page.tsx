"use client";

import { useEffect, useState } from "react";
import { api, getToken, type ApiEnvelope } from "@/lib/psychometric/api";
import { useToast } from "@/components/psychometric/ToastProvider";
import PageHeader from "@/components/psychometric/PageHeader";

export default function SettingsPage() {
  const showToast = useToast();
  const token = getToken();

  const [duration, setDuration] = useState<number | "">("");
  const [savingDuration, setSavingDuration] = useState(false);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get<ApiEnvelope<{ assessment_duration_minutes: number }>>("/admin/settings", token);
      if (ok && data.data) {
        setDuration(data.data.assessment_duration_minutes);
      }
    })();
  }, [token]);

  // The standalone app's "Admin Profile" and "Change Password" cards are not
  // here: Psychometric is reached with the TBT Admin session through a shared
  // service account, so there is no personal Psychometric account to manage.

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

  return (
    <>
      <PageHeader title="Settings" breadcrumb="Manage assessment settings" />
      <main className="p-6 space-y-4 max-w-3xl mx-auto">
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
