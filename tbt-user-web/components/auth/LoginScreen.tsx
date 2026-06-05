"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useClerk, useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const BG_IMAGES = [
  "/auth/backgrounds/bg1.png",
  "/auth/backgrounds/bg2.png",
  "/auth/backgrounds/bg3.png",
];

const SLIDE_MS = 6000;

type FocusedField = "identifier" | "password" | "code" | null;

export function LoginScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/tbt";

  const [currentBg, setCurrentBg] = useState(0);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<FocusedField>(null);

  // If already signed in, push to redirectUrl immediately
  useEffect(() => {
    if (authLoaded && isSignedIn && !submitting && !verifying) {
      router.replace(redirectUrl);
    }
  }, [authLoaded, isSignedIn, router, redirectUrl, submitting, verifying]);

  // Cinematic background rotation
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentBg((p) => (p + 1) % BG_IMAGES.length);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  const handleVerification = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Give cookies a moment to settle for middleware
        setTimeout(() => router.replace(redirectUrl), 100);
      } else {
        console.error("Incomplete sign in status:", result.status);
        setError("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr.errors?.[0]?.longMessage ||
        clerkErr.errors?.[0]?.message ||
        "Verification failed. Please check the code."
      );
    } finally {
      setTimeout(() => setSubmitting(false), 1000);
    }
  }, [isLoaded, signIn, code, setActive, router, redirectUrl, submitting]);

  const attemptSignIn = useCallback(async () => {
    if (!signIn) return;
    console.log("Starting login for:", identifier);
    const result = await signIn.create({ identifier, password });
    console.log("Clerk status:", result.status);
    console.log("Full result:", result);
    console.log("Supported First Factors:", result.supportedFirstFactors);
    console.log("Supported Second Factors:", result.supportedSecondFactors);

    if (result.status === "complete") {
      console.log("Branch: complete");
      if (setActive) {
        await setActive({ session: result.createdSessionId });
        // Give cookies a moment to settle for middleware
        setTimeout(() => router.replace(redirectUrl), 100);
      }
    } else if (result.status === "needs_first_factor") {
      console.log("Branch: needs_first_factor");
      // Start email code verification
      const factor = result.supportedFirstFactors?.find(f => f.strategy === "email_code") as { emailAddressId: string } | undefined;
      if (factor) {
        console.log("Preparing email_code factor");
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: factor.emailAddressId,
        });
        setVerifying(true);
      } else {
        console.log("Error: email_code factor not found");
        setError("Email verification not available for this account.");
      }
    } else {
      console.log("Branch: error (unknown status)", result.status);
      setError(`Additional verification required (${result.status}). Please use the standard sign-in flow.`);
    }
  }, [signIn, setActive, identifier, password, router, redirectUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isLoaded || submitting) return;

      setSubmitting(true);
      setError("");

      try {
        await attemptSignIn();
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { code?: string; longMessage?: string; message?: string }[] };
        const code = clerkErr.errors?.[0]?.code;

        if (code === "session_exists" || code === "identifier_already_signed_in") {
          try {
            await clerk.signOut({ redirectUrl: window.location.href });
            await new Promise(r => setTimeout(r, 500));
            await attemptSignIn();
            return;
          } catch (retryErr: unknown) {
            const retryClerkErr = retryErr as { errors?: { longMessage?: string; message?: string }[] };
            setError(
              retryClerkErr.errors?.[0]?.longMessage ||
              retryClerkErr.errors?.[0]?.message ||
              "Login failed. Please check your credentials."
            );
          }
        } else {
          setError(
            clerkErr.errors?.[0]?.longMessage ||
            clerkErr.errors?.[0]?.message ||
            "Login failed. Please check your credentials."
          );
        }
      } finally {
        setTimeout(() => setSubmitting(false), 1000);
      }
    },
    [isLoaded, submitting, attemptSignIn, clerk]
  );

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
          {/* Ken Burns zoom */}
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

      {/* Layered overlays for depth */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
      {/* Red tint vignette */}
      <div
        className="absolute inset-0 z-10 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,0.4) 100%)",
        }}
      />

      {/* ── Main Content ── */}
      <div className="relative z-20 flex items-center justify-center w-full h-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="w-full max-w-[420px]"
        >
          {/* ── Glass Card ── */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "rgba(8, 8, 12, 0.72)",
              backdropFilter: "blur(48px) saturate(180%)",
              WebkitBackdropFilter: "blur(48px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.7), 0 16px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)",
            }}
          >
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

            {/* Subtle inner glow */}
            <div
              className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% -20%, rgba(220,38,38,0.07) 0%, transparent 70%)",
              }}
            />

            <div className="relative px-8 pt-10 pb-9">
              {/* ── Brand Header ── */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="flex flex-col items-center mb-8"
              >
                {/* Logo */}
                <div
                  className="flex items-center justify-center w-[68px] h-[68px] rounded-2xl mb-4"
                  style={{
                    background:
                      "linear-gradient(145deg, #dc2626 0%, #991b1b 60%, #7f1d1d 100%)",
                    boxShadow:
                      "0 8px 32px rgba(220,38,38,0.45), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
                  }}
                >
                  <span className="text-white font-black text-[22px] tracking-tighter">
                    TBT
                  </span>
                </div>

                <h1 className="text-[26px] font-bold text-white tracking-tight leading-tight">
                  {verifying ? "Verify Identity" : "Welcome Back"}
                </h1>
                <p className="text-white/35 text-[13px] mt-1 tracking-wide">
                  {verifying ? "Enter the code sent to your email" : "Sign in to continue your journey"}
                </p>
              </motion.div>

              {/* ── Error Banner ── */}
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
                      style={{
                        background: "rgba(220,38,38,0.1)",
                        border: "1px solid rgba(220,38,38,0.25)",
                      }}
                    >
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Form ── */}
              {!verifying ? (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* User ID */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45, duration: 0.55 }}
                  >
                    <InputField
                      type="text"
                      value={identifier}
                      onChange={setIdentifier}
                      placeholder="User ID or Email"
                      icon={<User className="w-[15px] h-[15px]" />}
                      focused={focused === "identifier"}
                      onFocus={() => setFocused("identifier")}
                      onBlur={() => setFocused(null)}
                      autoComplete="username"
                      required
                    />
                  </motion.div>

                  {/* Password */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.52, duration: 0.55 }}
                  >
                    <InputField
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={setPassword}
                      placeholder="Password"
                      icon={<Lock className="w-[15px] h-[15px]" />}
                      focused={focused === "password"}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      autoComplete="current-password"
                      required
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="text-white/30 hover:text-white/60 transition-colors duration-200 flex-shrink-0"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="w-[15px] h-[15px]" />
                          ) : (
                            <Eye className="w-[15px] h-[15px]" />
                          )}
                        </button>
                      }
                    />
                  </motion.div>

                  {/* Forgot password */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="flex justify-end pt-0.5"
                  >
                    <Link
                      href="/sign-in"
                      className="text-[12px] text-white/35 hover:text-red-400 transition-colors duration-200"
                    >
                      Forgot Password?
                    </Link>
                  </motion.div>

                  {/* Login Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65, duration: 0.55 }}
                    className="pt-1"
                  >
                    <motion.button
                      type="submit"
                      disabled={submitting || !isLoaded}
                      whileHover={
                        !submitting ? { scale: 1.015, y: -1 } : undefined
                      }
                      whileTap={!submitting ? { scale: 0.975 } : undefined}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="relative w-full py-[14px] rounded-xl font-semibold text-white text-[14px] tracking-wide overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background:
                          "linear-gradient(135deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%)",
                        boxShadow:
                          "0 4px 24px rgba(220,38,38,0.5), 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                      }}
                    >
                      {/* Shine overlay on hover */}
                      <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-300" />

                      <span className="relative flex items-center justify-center gap-2">
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </motion.button>
                  </motion.div>
                </form>
              ) : (
                <form onSubmit={handleVerification} className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.55 }}
                  >
                    <InputField
                      type="text"
                      value={code}
                      onChange={setCode}
                      placeholder="Enter 6-digit code"
                      icon={<Lock className="w-[15px] h-[15px]" />}
                      focused={focused === "code"}
                      onFocus={() => setFocused("code")}
                      onBlur={() => setFocused(null)}
                      autoComplete="one-time-code"
                      required
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.55 }}
                  >
                    <motion.button
                      type="submit"
                      disabled={submitting || !isLoaded}
                      whileHover={!submitting ? { scale: 1.015, y: -1 } : undefined}
                      whileTap={!submitting ? { scale: 0.975 } : undefined}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="relative w-full py-[14px] rounded-xl font-semibold text-white text-[14px] tracking-wide overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%)",
                        boxShadow: "0 4px 24px rgba(220,38,38,0.5), 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                      }}
                    >
                      <span className="relative flex items-center justify-center gap-2">
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Verify Code
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </motion.button>
                  </motion.div>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifying(false);
                      setCode("");
                      setError("");
                    }}
                    className="w-full text-center text-[12px] text-white/35 hover:text-white/60 transition-colors"
                  >
                    Back to login
                  </button>
                </form>
              )}

              {/* ── Divider ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.5 }}
                className="flex items-center gap-3 mt-6"
              >
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[11px] text-white/20 uppercase tracking-widest">
                  or
                </span>
                <div className="flex-1 h-px bg-white/8" />
              </motion.div>

              {/* ── Sign Up Link ── */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-5 text-center"
              >
                <p className="text-[13px] text-white/35">
                  New to TBT?{" "}
                  <Link href="/sign-up" className="group inline-flex items-center gap-0.5">
                    <motion.span
                      className="text-red-400 font-semibold group-hover:text-red-300 transition-colors duration-200"
                      whileHover={{ x: 1 }}
                    >
                      Sign up here
                    </motion.span>
                    <ArrowRight className="w-3 h-3 text-red-400 group-hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0" />
                  </Link>
                </p>
              </motion.div>
            </div>
          </div>

          {/* ── Slide Indicators ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex justify-center items-center gap-2 mt-5"
          >
            {BG_IMAGES.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setCurrentBg(i)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.85 }}
                animate={{
                  width: i === currentBg ? 28 : 6,
                  opacity: i === currentBg ? 1 : 0.35,
                }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="h-[5px] rounded-full"
                style={{
                  background:
                    i === currentBg
                      ? "linear-gradient(90deg, #ef4444, #dc2626)"
                      : "rgba(255,255,255,0.5)",
                }}
                aria-label={`Switch to background ${i + 1}`}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Reusable Input Field ──────────────────────────────────────────────────────

interface InputFieldProps {
  type: string;
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

function InputField({
  type,
  value,
  onChange,
  placeholder,
  icon,
  focused,
  onFocus,
  onBlur,
  autoComplete,
  required,
  suffix,
}: InputFieldProps) {
  return (
    <div
      className="relative flex items-center rounded-xl transition-all duration-300"
      style={{
        background: focused
          ? "rgba(255,255,255,0.07)"
          : "rgba(255,255,255,0.04)",
        border: focused
          ? "1px solid rgba(220,38,38,0.55)"
          : "1px solid rgba(255,255,255,0.07)",
        boxShadow: focused
          ? "0 0 0 3px rgba(220,38,38,0.12), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Icon */}
      <span
        className="absolute left-4 flex-shrink-0 transition-colors duration-300"
        style={{ color: focused ? "#dc2626" : "rgba(255,255,255,0.28)" }}
      >
        {icon}
      </span>

      {/* Input */}
      <input
        type={type}
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

      {/* Suffix (show/hide toggle) */}
      {suffix && <span className="absolute right-4">{suffix}</span>}
    </div>
  );
}
