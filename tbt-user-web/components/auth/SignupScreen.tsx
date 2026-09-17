"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, ArrowRight, Loader2, Phone, User, Mail, Building2, MapPin, MessageSquare } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api/client";

type Step = "form" | "otp";
type FocusedField = "firstName" | "lastName" | "phone" | "email" | "password" | "businessName" | "city" | "state" | "otp" | null;

const BUSINESS_TYPES = ["Product-based", "Service-based", "Both", "Other"] as const;

export function SignupScreen() {
  const router = useRouter();

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [productServiceType, setProductServiceType] = useState("");

  // Location dropdowns
  const [states, setStates] = useState<{ name: string; isoCode: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP step
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");

  // UI state
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<FocusedField>(null);

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!firstName.trim()) { setError("First name is required"); return; }
    if (!phone.trim() || phone.length < 10) { setError("Enter a valid 10-digit phone number"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    setError("");

    try {
      // Step 1: create account
      await apiClient.post("/api/user-auth/signup", {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        businessName: businessName.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        productServiceType: productServiceType || undefined,
      });

      // Step 2: trigger OTP so user can log in without leaving this page
      const loginRes: any = await apiClient.post("/api/user-auth/login", {
        phone: phone.trim(),
        password,
      });
      // In dev the OTP is returned directly
      if (loginRes.data?.otp) setDevOtp(loginRes.data.otp);

      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, phone, email, password, businessName, city, state, productServiceType, submitting]);

  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!otp.trim()) { setError("Please enter the OTP"); return; }

    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/api/user-auth/verify-otp", {
        phone: phone.trim(),
        otp: otp.trim(),
      });
      router.replace("/onboarding");
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [otp, phone, submitting, router]);

  const handleResendOtp = useCallback(async () => {
    setError("");
    try {
      const res: any = await apiClient.post("/api/user-auth/resend-otp", { phone: phone.trim() });
      if (res.data?.otp) setDevOtp(res.data.otp);
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    }
  }, [phone]);

  useEffect(() => {
    apiClient.get("/api/location/states?countryCode=IN")
      .then((res: any) => setStates(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStateCode) { setCities([]); return; }
    apiClient.get(`/api/location/cities?countryCode=IN&stateCode=${selectedStateCode}`)
      .then((res: any) => setCities(res.data || []))
      .catch(() => {});
  }, [selectedStateCode]);

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-black px-4 py-8">
      <div className="absolute inset-0 z-0"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.10) 0%, transparent 55%)" }} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[460px]"
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
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                {step === "form" ? "Create Account" : "Verify Your Phone"}
              </h1>
              <p className="text-white/65 text-[13px] mt-1">
                {step === "form"
                  ? "Join Tamil Business Tribe"
                  : `Enter the OTP sent to +91 ${phone}`}
              </p>
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

            {/* ── Step: form ── */}
            {step === "form" && (
              <form onSubmit={handleSignup} className="space-y-3">
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

                {/* Business Type */}
                <div className="relative flex items-center rounded-xl transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                  <span className="absolute left-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.28)" }}>
                    <MessageSquare className="w-[14px] h-[14px]" />
                  </span>
                  <select
                    value={productServiceType}
                    onChange={e => setProductServiceType(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-4 py-[12px] text-[13px] outline-none appearance-none cursor-pointer"
                    style={{ color: productServiceType ? "white" : "rgba(255,255,255,0.2)" }}
                  >
                    <option value="" disabled style={{ color: "#888", background: "#111" }}>Business Type (optional)</option>
                    {BUSINESS_TYPES.map(t => (
                      <option key={t} value={t} style={{ color: "white", background: "#111" }}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* State + City */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State" focused={focused === "state"}>
                    <FieldIcon focused={focused === "state"}><MapPin className="w-[14px] h-[14px]" /></FieldIcon>
                    <select
                      value={state}
                      onChange={e => {
                        const s = states.find(s => s.name === e.target.value);
                        setState(e.target.value);
                        setSelectedStateCode(s?.isoCode ?? "");
                        setCity("");
                      }}
                      onFocus={() => setFocused("state")} onBlur={() => setFocused(null)}
                      className="w-full bg-transparent pl-10 pr-4 py-[12px] text-[13px] outline-none appearance-none cursor-pointer"
                      style={{ color: state ? "white" : "rgba(255,255,255,0.2)", colorScheme: "dark" }}
                    >
                      <option value="" style={{ color: "#888", background: "#1a1a1a" }}>State</option>
                      {states.map(s => (
                        <option key={s.isoCode} value={s.name} style={{ color: "#f0f0f0", background: "#1a1a1a" }}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="City" focused={focused === "city"}>
                    <FieldIcon focused={focused === "city"}><MapPin className="w-[14px] h-[14px]" /></FieldIcon>
                    <select
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      onFocus={() => setFocused("city")} onBlur={() => setFocused(null)}
                      disabled={!selectedStateCode}
                      className="w-full bg-transparent pl-10 pr-4 py-[12px] text-[13px] outline-none appearance-none cursor-pointer disabled:opacity-40"
                      style={{ color: city ? "white" : "rgba(255,255,255,0.2)", colorScheme: "dark" }}
                    >
                      <option value="" style={{ color: "#888", background: "#1a1a1a" }}>
                        {selectedStateCode ? "City" : "Select state first"}
                      </option>
                      {cities.map(c => (
                        <option key={c} value={c} style={{ color: "#f0f0f0", background: "#1a1a1a" }}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>

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
                    className="absolute right-4 text-white/60 hover:text-white/60 transition-colors">
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
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Please wait...</>
                        : <>Create Account<ArrowRight className="w-4 h-4" /></>}
                    </span>
                  </motion.button>
                </div>
              </form>
            )}

            {/* ── Step: otp ── */}
            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <Field label="OTP *" focused={focused === "otp"}>
                  <input
                    type="text" inputMode="numeric" value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onFocus={() => setFocused("otp")} onBlur={() => setFocused(null)}
                    placeholder="Enter 6-digit OTP" autoComplete="one-time-code"
                    className="w-full bg-transparent pl-10 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none tracking-[0.2em]"
                    style={{ caretColor: "#dc2626" }}
                    autoFocus
                  />
                  <FieldIcon focused={focused === "otp"}><Phone className="w-[14px] h-[14px]" /></FieldIcon>
                </Field>

                {devOtp && (
                  <p className="text-[11px] text-center" style={{ color: "rgba(220,38,38,0.7)" }}>
                    Dev OTP: {devOtp}
                  </p>
                )}

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
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</>
                        : <>Verify & Continue<ArrowRight className="w-4 h-4" /></>}
                    </span>
                  </motion.button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                    className="text-[12px] text-white/50 hover:text-white/80 transition-colors">
                    ← Back
                  </button>
                  <button type="button" onClick={handleResendOtp}
                    className="text-[12px] transition-colors hover:opacity-80" style={{ color: "#dc2626" }}>
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-[12px] text-white/60 mt-5">
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
