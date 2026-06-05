"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Save, Upload, X, Image as ImageIcon } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGetSiteConfig, useUpdateSiteConfig } from "@/lib/hooks/useTbt";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";

const COLOR_FIELDS = [
  { key: "accentColor", label: "Accent Color" },
  { key: "alertColor", label: "Alert Color" },
  { key: "successColor", label: "Success Color" },
  { key: "bgPrimary", label: "BG Primary" },
  { key: "bgSurface", label: "BG Surface" },
];

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  onUploaded: (key: string, url: string) => void;
  uploading: string | null;
  setUploading: (key: string | null) => void;
}

function ImageUploadField({ label, value, fieldKey, onUploaded, uploading, setUploading }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const isUploading = uploading === fieldKey;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    try {
      setUploading(fieldKey);
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: `site/${fieldKey}` });
      onUploaded(fieldKey, publicUrl);
      toast.success(`${label} uploaded`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg border border-[#333] bg-[#141414] flex items-center justify-center overflow-hidden flex-shrink-0">
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-contain" />
          ) : (
            <ImageIcon size={20} className="text-[#444]" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-[#222] border border-[#333] text-[#f0f0f0] px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {isUploading ? "Uploading..." : "Upload"}
          </button>
          {value && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={value}
                className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded-lg h-8 px-3 text-[#606060] text-[11px] font-mono truncate outline-none"
              />
              <button type="button" onClick={() => onUploaded(fieldKey, "")} className="text-[#606060] hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

export default function SiteConfigPage() {
  const { data, isLoading } = useGetSiteConfig();
  const updateConfig = useUpdateSiteConfig();

  const config = (data as any)?.data;

  const [form, setForm] = useState({
    siteName: "",
    logoUrl: "",
    faviconUrl: "",
    splashLogoUrl: "",
    footerText: "",
    splashDurationMs: 2000,
    accentColor: "#00c4cc",
    alertColor: "#ff3d8b",
    successColor: "#22c55e",
    bgPrimary: "#000000",
    bgSurface: "#111111",
  });

  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (config) setForm(f => ({ ...f, ...config }));
  }, [config]);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(form);
      toast.success("Site config saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  if (isLoading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Site Config</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Branding, theme colors, logo, footer.</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending || !!uploadingField}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {updateConfig.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>

        {/* Branding */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
          <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani border-b border-[#2a2a2a] pb-3">Branding</p>

          <div>
            <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Site Name</label>
            <input
              value={form.siteName}
              onChange={e => set("siteName", e.target.value)}
              placeholder="TBT"
              className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm"
            />
          </div>

          <ImageUploadField
            label="Logo"
            value={form.logoUrl}
            fieldKey="logoUrl"
            onUploaded={set}
            uploading={uploadingField}
            setUploading={setUploadingField}
          />

          <ImageUploadField
            label="Favicon"
            value={form.faviconUrl}
            fieldKey="faviconUrl"
            onUploaded={set}
            uploading={uploadingField}
            setUploading={setUploadingField}
          />

          <ImageUploadField
            label="Splash Logo"
            value={form.splashLogoUrl}
            fieldKey="splashLogoUrl"
            onUploaded={set}
            uploading={uploadingField}
            setUploading={setUploadingField}
          />

          <div>
            <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Splash Duration (ms)</label>
            <input
              type="number"
              value={form.splashDurationMs}
              onChange={e => set("splashDurationMs", Number(e.target.value))}
              className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Footer Text</label>
            <input
              value={form.footerText}
              onChange={e => set("footerText", e.target.value)}
              placeholder="© Tamil Business Tribe"
              className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm"
            />
          </div>
        </div>

        {/* Theme Colors */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
          <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani border-b border-[#2a2a2a] pb-3">Theme Colors</p>

          <div className="grid grid-cols-1 gap-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">{label}</label>
                  <input
                    value={(form as any)[key] || ""}
                    onChange={e => set(key, e.target.value)}
                    className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono"
                  />
                </div>
                <div className="flex flex-col items-center gap-1 mt-5">
                  <div className="w-10 h-10 rounded-lg border border-[#333] cursor-pointer overflow-hidden relative">
                    <input
                      type="color"
                      value={(form as any)[key] || "#000000"}
                      onChange={e => set(key, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div className="w-full h-full rounded-lg" style={{ backgroundColor: (form as any)[key] || "#000000" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live Preview */}
          <div className="mt-2 rounded-xl border border-[#2a2a2a] overflow-hidden">
            <div className="px-4 py-2 bg-[#111] border-b border-[#2a2a2a]">
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani">Live Preview</p>
            </div>
            <div className="p-5" style={{ backgroundColor: form.bgPrimary }}>
              {/* Nav bar mockup */}
              <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: form.bgSurface }}>
                <div className="flex items-center gap-2">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="logo" className="w-6 h-6 object-contain" />
                  ) : (
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: form.accentColor }} />
                  )}
                  <span className="text-xs font-bold font-rajdhani" style={{ color: form.accentColor }}>
                    {form.siteName || "Site Name"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: form.accentColor }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: form.alertColor }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: form.successColor }} />
                </div>
              </div>

              {/* Content mockup */}
              <div className="space-y-2">
                <div className="h-2 w-3/4 rounded-full opacity-20" style={{ backgroundColor: form.accentColor }} />
                <div className="h-2 w-1/2 rounded-full opacity-10" style={{ backgroundColor: form.accentColor }} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[form.accentColor, form.alertColor, form.successColor].map((color, i) => (
                  <div key={i} className="h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
                    <span className="text-[9px] font-bold text-black opacity-70 font-mono">{color}</span>
                  </div>
                ))}
              </div>

              {/* Footer mockup */}
              <div className="mt-4 pt-2 border-t" style={{ borderColor: form.bgSurface }}>
                <p className="text-[10px] opacity-40" style={{ color: form.accentColor }}>
                  {form.footerText || "Footer text"}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
