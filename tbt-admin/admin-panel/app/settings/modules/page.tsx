'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useModuleConfigs, useUpdateModuleConfig, type ModuleConfig } from '@/lib/hooks/useTbt';
import { useGetPresignedUrl } from '@/lib/hooks/useAdmin';
import toast from 'react-hot-toast';

const MODULE_NAMES = ['Product', 'Service', 'Coaching'];

export default function ModuleConfigPage() {
  const { data: configs = [], isLoading } = useModuleConfigs();
  const updateConfig = useUpdateModuleConfig();
  const getPresignedUrl = useGetPresignedUrl();

  const [forms, setForms] = useState<Record<string, Partial<ModuleConfig>>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (configs.length === 0) return;
    const init: Record<string, Partial<ModuleConfig>> = {};
    for (const cfg of configs) {
      init[cfg.moduleName] = { ...cfg };
    }
    // Ensure all known modules have a form entry
    for (const name of MODULE_NAMES) {
      if (!init[name]) {
        init[name] = { moduleName: name, displayName: '', tagline: '', description: '', bannerUrl: null, iconUrl: null, accentColor: null, sortOrder: MODULE_NAMES.indexOf(name) + 1 };
      }
    }
    setForms(init);
  }, [configs]);

  const set = (moduleName: string, key: keyof ModuleConfig, value: any) => {
    setForms(prev => ({ ...prev, [moduleName]: { ...prev[moduleName], [key]: value } }));
  };

  const handleBannerUpload = async (moduleName: string, file: File) => {
    try {
      setUploading(prev => ({ ...prev, [moduleName]: true }));
      const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
        bucket: 'site-assets',
        pathPrefix: 'module-banners',
      });
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      set(moduleName, 'bannerUrl', publicUrl);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(prev => ({ ...prev, [moduleName]: false }));
    }
  };

  const handleSave = async (moduleName: string) => {
    const form = forms[moduleName];
    if (!form) return;
    try {
      await updateConfig.mutateAsync({ moduleName, ...form });
      toast.success(`${moduleName} config saved`);
    } catch {
      toast.error('Save failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest mb-6">
          Course Module Branding
        </h1>
        <p className="text-[#a0a0a0] text-sm mb-8">
          Configure display names, taglines, banners and accent colors for each course module. These control how the /courses page appears to members assigned to a module.
        </p>

        {isLoading ? (
          <div className="text-[#a0a0a0]">Loading...</div>
        ) : (
          <div className="space-y-6">
            {MODULE_NAMES.map(moduleName => {
              const form = forms[moduleName] ?? {};
              return (
                <div key={moduleName} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6">
                  <h2 className="text-lg font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest mb-5">
                    {moduleName}
                  </h2>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                        Display Name
                      </label>
                      <input
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] w-full"
                        placeholder={`e.g. ${moduleName} Mastery`}
                        value={form.displayName ?? ''}
                        onChange={e => set(moduleName, 'displayName', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                        Accent Color (hex)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          className="h-11 w-16 rounded bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer"
                          value={form.accentColor ?? '#dc2626'}
                          onChange={e => set(moduleName, 'accentColor', e.target.value)}
                        />
                        <input
                          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] flex-1"
                          placeholder="#dc2626"
                          value={form.accentColor ?? ''}
                          onChange={e => set(moduleName, 'accentColor', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                      Tagline
                    </label>
                    <input
                      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] w-full"
                      placeholder="One-line tagline shown on the courses page"
                      value={form.tagline ?? ''}
                      onChange={e => set(moduleName, 'tagline', e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] w-full resize-none"
                      placeholder="Short description shown when this is the member's only module"
                      value={form.description ?? ''}
                      onChange={e => set(moduleName, 'description', e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                      Hero Banner Image
                    </label>
                    {form.bannerUrl && (
                      <div className="mb-2 relative w-full h-28 rounded-lg overflow-hidden border border-[#2a2a2a]">
                        <img src={form.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                        <button
                          onClick={() => set(moduleName, 'bannerUrl', null)}
                          className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-[#a0a0a0] text-sm hover:border-[#dc2626] transition-colors">
                        {uploading[moduleName] ? 'Uploading...' : 'Choose Image'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading[moduleName]}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleBannerUpload(moduleName, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {form.bannerUrl && (
                        <span className="text-[#606060] text-xs truncate max-w-xs">{form.bannerUrl}</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] w-32"
                      value={form.sortOrder ?? 0}
                      onChange={e => set(moduleName, 'sortOrder', Number(e.target.value))}
                    />
                  </div>

                  <button
                    onClick={() => handleSave(moduleName)}
                    disabled={updateConfig.isPending}
                    className="bg-[#dc2626] hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    Save {moduleName}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
