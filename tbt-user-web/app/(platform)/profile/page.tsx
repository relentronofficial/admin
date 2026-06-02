"use client";

import { useState } from "react";
import { User, Mail, Phone, MapPin, Building2, Award } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useMe, useUpdateProfile } from "@/lib/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import { toast } from "react-hot-toast";
import { planLabel } from "@/lib/utils/format";

const profileSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  businessName: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: me?.firstName ?? "",
      lastName: me?.lastName ?? "",
      city: me?.city ?? "",
      state: me?.state ?? "",
      businessName: me?.businessName ?? "",
    },
  });

  if (isLoading) return <PageLoader />;
  if (!me) return null;

  const onSubmit = async (data: ProfileForm) => {
    try {
      await updateProfile.mutateAsync(data);
      toast.success("Profile updated");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage your account information.</p>
      </div>

      {/* Member card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
            {me.profilePhotoUrl ? (
              <img src={me.profilePhotoUrl} alt={me.firstName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={28} className="text-brand-600" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg">{me.firstName} {me.lastName}</h3>
            <p className="text-sm text-muted-foreground">{me.memberId}</p>
            <span className="inline-block mt-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              {planLabel[me.membershipPlan] ?? me.membershipPlan}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail size={14} className="shrink-0" /><span className="truncate">{me.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone size={14} className="shrink-0" /><span>{me.phone}</span>
          </div>
          {(me.city || me.state) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin size={14} className="shrink-0" /><span>{[me.city, me.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {me.businessName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 size={14} className="shrink-0" /><span className="truncate">{me.businessName}</span>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-black">{me.totalPoints}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Points</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black">{me.currentStreak}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Streak</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black">{me.healthScore}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">Health</p>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">Edit Information</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">First Name</label>
              <input
                {...register("firstName")}
                disabled={!editing}
                className={cn("w-full h-10 px-3 rounded-lg border text-sm outline-none transition-colors",
                  editing ? "border-border focus:border-brand-600 bg-background" : "border-transparent bg-muted"
                )}
              />
              {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Last Name</label>
              <input {...register("lastName")} disabled={!editing}
                className={cn("w-full h-10 px-3 rounded-lg border text-sm outline-none transition-colors",
                  editing ? "border-border focus:border-brand-600 bg-background" : "border-transparent bg-muted"
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">City</label>
              <input {...register("city")} disabled={!editing}
                className={cn("w-full h-10 px-3 rounded-lg border text-sm outline-none transition-colors",
                  editing ? "border-border focus:border-brand-600 bg-background" : "border-transparent bg-muted"
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">State</label>
              <input {...register("state")} disabled={!editing}
                className={cn("w-full h-10 px-3 rounded-lg border text-sm outline-none transition-colors",
                  editing ? "border-border focus:border-brand-600 bg-background" : "border-transparent bg-muted"
                )}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Business Name</label>
            <input {...register("businessName")} disabled={!editing}
              className={cn("w-full h-10 px-3 rounded-lg border text-sm outline-none transition-colors",
                editing ? "border-border focus:border-brand-600 bg-background" : "border-transparent bg-muted"
              )}
            />
          </div>

          {editing && (
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={updateProfile.isPending}
                className="px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors">
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="px-5 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
