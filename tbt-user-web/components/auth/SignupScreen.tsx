"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, ArrowRight, Loader2, Phone, User, Mail, Building2, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import apiClient from "@/lib/api/client";

type FocusedField = "firstName" | "lastName" | "phone" | "email" | "password" | "businessName" | null;

export function SignupScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<FocusedField>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!firstName.trim()) { setError("First name is required"); return; }
    if (!phone.trim() || phone.length < 10) { setError("Enter a valid 10-digit phone number"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    setError("");

    try {
      await apiClient.post("/api/user-auth/signup", {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        businessName: businessName.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, phone, email, password, businessName, submitting]);

  if (success) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center bg-black px-4 py-8">
        <div className="absolute inset-0 z-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.12) 0%, transparent 60%)" }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[420px] text-center"
        >
          <div
            className="rounded-2xl px-8 py-10"
            style={{
              background: "rgba(8,8,12,0.85)",
              backdropFilter: "blur(48px)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              <CheckCircle2 size={30} className="text-green-400" />
            </div>
            <h2 className="text-white text-xl font-bold mb-3">Registration Submitted!</h2>
            <p className="text-white/45 text-sm leading-relaxed mb-7">
              Your account is under review. You&apos;ll be able to log in once an admin approves your registration.
            </p>
            <Link
              href="/login"
              className="block w-full py-[13px] rounded-xl text-white text-[14px] font-semibold text-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%)" }}
            >
              Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-black px-4 py-8">
      <div className="absolute inset-0 z-0"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.10) 0%, transparent 55%)" }} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(8,8,12,0.80)",
            backdropFilter: "blur(48px) saturate(180%)",
            WebkitBackdropFilter: "blur(48px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.09)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          <div className="px-8 pt-9 pb-8">
            {/* Header */}
            <div className="flex flex-col items-center mb-7">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tbt_logo.png" alt="Tamil Business Tribe" className="h-12 w-auto object-contain mb-4" />
              <h1 className="text-[24px] font-bold text-white tracking-tight">Create Account</h1>
              <p className="text-white/35 text-[13px] mt-1">Join Tamil Business Tribe</p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 rounded-xl text-sm text-red-300"
                    style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}>
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" focused={focused === "firstName"}>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    onFocus={() => setFocused("firstName")} onBlur={() => setFocused(null)}
                    placeholder="First name" autoComplete="given-name" required
                    className="w-full bg-transparent pl-10 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
                    style={{ caretColor: "#dc2626" }} />
                  <FieldIcon focused={focused === "firstName"}><User className="w-[14px] h-[14px]" /></FieldIcon>
                </Field>
                <Field label="Last Name" focused={focused === "lastName"}>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                    onFocus={() => setFocused("lastName")} onBlur={() => setFocused(null)}
                    placeholder="Last name" autoComplete="family-name"
                    className="w-full bg-transparent pl-10 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
                    style={{ caretColor: "#dc2626" }} />
                  <FieldIcon focused={focused === "lastName"}><User className="w-[14px] h-[14px]" /></FieldIcon>
                </Field>
              </div>

              {/* Phone */}
              <Field label="Phone *" focused={focused === "phone"}>
                <span className="absolute left-4 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>+91</span>
                <input type="tel" inputMode="numeric" value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)}
                  placeholder="10-digit mobile number" autoComplete="tel" required
                  className="w-full bg-transparent pl-12 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
                  style={{ caretColor: "#dc2626" }} />
              </Field>

              {/* Email */}
              <Field label="Email *" focused={focused === "email"}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                  placeholder="your@email.com" autoComplete="email" required
                  className="w-full bg-transparent pl-10 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
                  style={{ caretColor: "#dc2626" }} />
                <FieldIcon focused={focused === "email"}><Mail className="w-[14px] h-[14px]" /></FieldIcon>
              </Field>

              {/* Business Name */}
              <Field label="Business Name" focused={focused === "businessName"}>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  onFocus={() => setFocused("businessName")} onBlur={() => setFocused(null)}
                  placeholder="Your business name (optional)"
                  className="w-full bg-transparent pl-10 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
                  style={{ caretColor: "#dc2626" }} />
                <FieldIcon focused={focused === "businessName"}><Building2 className="w-[14px] h-[14px]" /></FieldIcon>
              </Field>

              {/* Password */}
              <Field label="Password *" focused={focused === "password"}>
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                  placeholder="Min. 6 characters" autoComplete="new-password" required
                  className="w-full bg-transparent pl-10 pr-10 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
                  style={{ caretColor: "#dc2626" }} />
                <FieldIcon focused={focused === "password"}><Lock className="w-[14px] h-[14px]" /></FieldIcon>
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 text-white/30 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff className="w-[14px] h-[14px]" /> : <Eye className="w-[14px] h-[14px]" />}
                </button>
              </Field>

              {/* Submit */}
              <div className="pt-1">
                <motion.button type="submit" disabled={submitting}
                  whileHover={!submitting ? { scale: 1.015, y: -1 } : undefined}
                  whileTap={!submitting ? { scale: 0.975 } : undefined}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="relative w-full py-[13px] rounded-xl font-semibold text-white text-[14px] tracking-wide overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%)",
                    boxShadow: "0 4px 24px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                      : <>Create Account<ArrowRight className="w-4 h-4" /></>}
                  </span>
                </motion.button>
              </div>
            </form>

            <p className="text-center text-[12px] text-white/30 mt-5">
              Already have an account?{" "}
              <Link href="/login" className="transition-colors hover:opacity-80" style={{ color: "#dc2626" }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ children, focused }: { label: string; focused: boolean; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center rounded-xl transition-all duration-200"
      style={{
        background: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: focused ? "1px solid rgba(220,38,38,0.5)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: focused ? "0 0 0 3px rgba(220,38,38,0.1)" : undefined,
      }}>
      {children}
    </div>
  );
}

function FieldIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <span className="absolute left-3.5 flex-shrink-0 transition-colors duration-200"
      style={{ color: focused ? "#dc2626" : "rgba(255,255,255,0.28)" }}>
      {children}
    </span>
  );
}
