"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, ArrowRight, Loader2, Phone } from "lucide-react";
import Image from "next/image";
import apiClient from "@/lib/api/client";

const BG_IMAGES = [
  "/auth/backgrounds/bg1.png",
  "/auth/backgrounds/bg2.png",
  "/auth/backgrounds/bg3.png",
];

const SLIDE_MS = 6000;

type Step = "credentials" | "otp" | "first_login";
type FocusedField = "phone" | "password" | "otp" | "newPassword" | null;

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/tbt";

  const [currentBg, setCurrentBg] = useState(0);
  const [step, setStep] = useState<Step>("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<FocusedField>(null);
  const [resolvedPhone, setResolvedPhone] = useState(""); // normalized phone from backend

  // Check if already logged in
  useEffect(() => {
    apiClient.get("/api/user/me")
      .then(() => router.replace(redirectUrl))
      .catch(() => {}); // not logged in — show login form
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cinematic background rotation
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentBg((p) => (p + 1) % BG_IMAGES.length);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) { setError("Please enter your phone number"); return; }

    setSubmitting(true);
    setError("");

    try {
      const res: any = await apiClient.post("/api/user-auth/login", {
        phone: trimmedPhone,
        password: password || undefined,
      });

      if (res.data?.step === "done") {
        router.replace(redirectUrl);
        return;
      }

      setResolvedPhone(res.data?.phone ?? trimmedPhone);

      if (res.data?.step === "first_login") {
        setStep("first_login");
      } else {
        setStep("otp");
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }, [phone, password, submitting]);

  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!otp.trim()) { setError("Please enter the OTP"); return; }

    setSubmitting(true);
    setError("");

    try {
      await apiClient.post("/api/user-auth/verify-otp", {
        phone: resolvedPhone,
        otp: otp.trim(),
      });
      router.replace(redirectUrl);
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Please try again.");
      setSubmitting(false);
    }
  }, [otp, resolvedPhone, redirectUrl, router, submitting]);

  const handleSetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!otp.trim()) { setError("Please enter the OTP sent to your phone"); return; }
    if (!newPassword || newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    setError("");

    try {
      await apiClient.post("/api/user-auth/set-password", {
        phone: resolvedPhone,
        otp: otp.trim(),
        password: newPassword,
      });
      router.replace(redirectUrl);
    } catch (err: any) {
      setError(err.message || "Failed. Please try again.");
      setSubmitting(false);
    }
  }, [otp, newPassword, resolvedPhone, redirectUrl, router, submitting]);

  const handleResendOtp = useCallback(async () => {
    setError("");
    try {
      await apiClient.post("/api/user-auth/resend-otp", { phone: resolvedPhone });
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    }
  }, [resolvedPhone]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* ── Background Slider ── */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentBg}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.04 }}
            animate={{ scale: 1.12 }}
            transition={{ duration: SLIDE_MS / 1000 + 1.8, ease: "linear" }}
          >
            <Image
              src={BG_IMAGES[currentBg]}
              alt="TBT background"
              fill
              className="object-cover"
              priority={currentBg === 0}
              quality={85}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
      <div
        className="absolute inset-0 z-10 opacity-20"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,0.4) 100%)" }}
      />

      {/* ── Main Content ── */}
      <div className="relative z-20 flex items-center justify-center w-full h-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="w-full max-w-[420px]"
        >
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "rgba(8, 8, 12, 0.72)",
              backdropFilter: "blur(48px) saturate(180%)",
              WebkitBackdropFilter: "blur(48px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.7), 0 16px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
            <div
              className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(220,38,38,0.07) 0%, transparent 70%)" }}
            />

            <div className="relative px-8 pt-10 pb-9">
              {/* Brand Header */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="flex flex-col items-center mb-8"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tbt_logo.png" alt="Tamil Business Tribe" className="h-14 w-auto object-contain mb-4" />
                <h1 className="text-[26px] font-bold text-white tracking-tight leading-tight">
                  {step === "credentials" ? "Welcome Back" : step === "first_login" ? "Set Your Password" : "Verify Identity"}
                </h1>
                <p className="text-white/35 text-[13px] mt-1 tracking-wide">
                  {step === "credentials"
                    ? "Sign in to continue your journey"
                    : step === "first_login"
                    ? `OTP sent to ${resolvedPhone}`
                    : `Enter the OTP sent to ${resolvedPhone}`}
                </p>
              </motion.div>

              {/* Error Banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-4 py-3 rounded-xl text-sm text-red-300"
                      style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}
                    >
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Step: credentials ── */}
              {step === "credentials" && (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.55 }}>
                    <div className="flex items-center rounded-xl overflow-hidden"
                      style={{
                        background: focused === "phone" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                        border: focused === "phone" ? "1px solid rgba(220,38,38,0.55)" : "1px solid rgba(255,255,255,0.07)",
                        boxShadow: focused === "phone" ? "0 0 0 3px rgba(220,38,38,0.12)" : undefined,
                      }}
                    >
                      <span className="pl-4 flex-shrink-0 text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>+91</span>
                      <Phone className="ml-2 flex-shrink-0 w-[15px] h-[15px]" style={{ color: focused === "phone" ? "#dc2626" : "rgba(255,255,255,0.28)" }} />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        onFocus={() => setFocused("phone")}
                        onBlur={() => setFocused(null)}
                        placeholder="10-digit mobile number"
                        autoComplete="tel"
                        required
                        className="flex-1 bg-transparent pl-2 pr-4 py-[13px] text-white text-[14px] placeholder-white/20 outline-none"
                        style={{ caretColor: "#dc2626" }}
                      />
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.52, duration: 0.55 }}>
                    <InputField
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={setPassword}
                      placeholder="Password (leave blank if first login)"
                      icon={<Lock className="w-[15px] h-[15px]" />}
                      focused={focused === "password"}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      autoComplete="current-password"
                      suffix={
                        <button type="button" onClick={() => setShowPassword((v) => !v)}
                          className="text-white/30 hover:text-white/60 transition-colors duration-200 flex-shrink-0">
                          {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                        </button>
                      }
                    />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.55 }} className="pt-1">
                    <SubmitButton submitting={submitting} label="Continue" loadingLabel="Checking..." />
                  </motion.div>
                </form>
              )}

              {/* ── Step: otp ── */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <InputField
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    icon={<Lock className="w-[15px] h-[15px]" />}
                    focused={focused === "otp"}
                    onFocus={() => setFocused("otp")}
                    onBlur={() => setFocused(null)}
                    autoComplete="one-time-code"
                    required
                  />
                  <SubmitButton submitting={submitting} label="Verify & Sign In" loadingLabel="Verifying..." />
                  <div className="flex justify-between items-center pt-1">
                    <button type="button" onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
                      className="text-[12px] text-white/35 hover:text-white/60 transition-colors">
                      ← Back
                    </button>
                    <button type="button" onClick={handleResendOtp}
                      className="text-[12px] transition-colors" style={{ color: "var(--color-accent, #dc2626)" }}>
                      Resend OTP
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step: first_login ── */}
              {step === "first_login" && (
                <form onSubmit={handleSetPassword} className="space-y-3.5">
                  <InputField
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter OTP sent to your phone"
                    icon={<Lock className="w-[15px] h-[15px]" />}
                    focused={focused === "otp"}
                    onFocus={() => setFocused("otp")}
                    onBlur={() => setFocused(null)}
                    autoComplete="one-time-code"
                    required
                  />
                  <InputField
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Set a new password (min 6 chars)"
                    icon={<Lock className="w-[15px] h-[15px]" />}
                    focused={focused === "newPassword"}
                    onFocus={() => setFocused("newPassword")}
                    onBlur={() => setFocused(null)}
                    autoComplete="new-password"
                    required
                    suffix={
                      <button type="button" onClick={() => setShowNewPassword((v) => !v)}
                        className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
                        {showNewPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                      </button>
                    }
                  />
                  <SubmitButton submitting={submitting} label="Set Password & Sign In" loadingLabel="Setting up..." />
                  <div className="flex justify-between items-center pt-1">
                    <button type="button" onClick={() => { setStep("credentials"); setOtp(""); setNewPassword(""); setError(""); }}
                      className="text-[12px] text-white/35 hover:text-white/60 transition-colors">
                      ← Back
                    </button>
                    <button type="button" onClick={handleResendOtp}
                      className="text-[12px] transition-colors" style={{ color: "var(--color-accent, #dc2626)" }}>
                      Resend OTP
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Slide Indicators */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}
            className="flex justify-center items-center gap-2 mt-5">
            {BG_IMAGES.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setCurrentBg(i)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.85 }}
                animate={{ width: i === currentBg ? 28 : 6, opacity: i === currentBg ? 1 : 0.35 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="h-[5px] rounded-full"
                style={{ background: i === currentBg ? "linear-gradient(90deg, #ef4444, #dc2626)" : "rgba(255,255,255,0.5)" }}
                aria-label={`Switch to background ${i + 1}`}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface InputFieldProps {
  type: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  autoComplete?: string;
  required?: boolean;
  suffix?: React.ReactNode;
}

function InputField({ type, inputMode, value, onChange, placeholder, icon, focused, onFocus, onBlur, autoComplete, required, suffix }: InputFieldProps) {
  return (
    <div
      className="relative flex items-center rounded-xl transition-all duration-300"
      style={{
        background: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: focused ? "1px solid rgba(220,38,38,0.55)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: focused ? "0 0 0 3px rgba(220,38,38,0.12), inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <span className="absolute left-4 flex-shrink-0 transition-colors duration-300" style={{ color: focused ? "#dc2626" : "rgba(255,255,255,0.28)" }}>
        {icon}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full bg-transparent pl-10 pr-4 py-[13px] text-white text-[14px] placeholder-white/20 outline-none"
        style={{ caretColor: "#dc2626" }}
      />
      {suffix && <span className="absolute right-4">{suffix}</span>}
    </div>
  );
}

function SubmitButton({ submitting, label, loadingLabel }: { submitting: boolean; label: string; loadingLabel: string }) {
  return (
    <motion.button
      type="submit"
      disabled={submitting}
      whileHover={!submitting ? { scale: 1.015, y: -1 } : undefined}
      whileTap={!submitting ? { scale: 0.975 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="relative w-full py-[14px] rounded-xl font-semibold text-white text-[14px] tracking-wide overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%)",
        boxShadow: "0 4px 24px rgba(220,38,38,0.5), 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
      }}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-300" />
      <span className="relative flex items-center justify-center gap-2">
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{loadingLabel}</>
        ) : (
          <>{label}<ArrowRight className="w-4 h-4" /></>
        )}
      </span>
    </motion.button>
  );
}
