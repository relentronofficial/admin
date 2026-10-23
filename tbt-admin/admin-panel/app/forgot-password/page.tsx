"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Mail, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type Phase = "request" | "reset";

export default function ForgotPasswordPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0d0404] flex items-center justify-center font-rajdhani">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#e02020]/30 border-t-[#e02020] rounded-full animate-spin" />
          <p className="text-[#666] text-xs uppercase tracking-[2px] font-bold">Initializing Auth...</p>
        </div>
      </div>
    );
  }

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setError("");
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      });
      setPhase("reset");
    } catch (err: any) {
      const firstError = err.errors?.[0];
      setError(firstError?.longMessage || firstError?.message || "Failed to send reset code. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setSuccess("Password reset successfully. Redirecting…");
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        setError(`Unexpected status: ${result.status}. Please try again.`);
      }
    } catch (err: any) {
      const firstError = err.errors?.[0];
      setError(firstError?.longMessage || firstError?.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0404] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="fixed inset-0 bg-login-glow pointer-events-none" />

      <div className="card w-full max-w-[420px] bg-[#1c1c1c] rounded-[16px] p-[44px] pt-[44px] pb-[40px] relative z-10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_rgba(0,0,0,0.6),0_4px_16px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-bottom-5 duration-500">

        {/* Logo */}
        <div className="flex items-center justify-center mb-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbt_logo.png" alt="Tamil Business Tribe" className="h-12 w-auto object-contain" />
        </div>

        <h1 className="text-[22px] font-semibold text-white text-center tracking-[-0.2px] mb-[6px]">
          {phase === "request" ? "Reset Password" : "Set New Password"}
        </h1>
        <p className="text-[13px] text-[#666] text-center font-normal mb-[32px]">
          {phase === "request"
            ? "Enter your email address and we'll send a reset code."
            : `Enter the code sent to ${email} and choose a new password.`}
        </p>

        {phase === "request" ? (
          <form onSubmit={handleRequestCode} className="space-y-[20px]">
            <div className="field">
              <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                Email Address
              </label>
              <div className="relative flex items-center group">
                <span className="absolute left-[14px] text-[#888] group-focus-within:text-[#e02020] transition-colors duration-200">
                  <Mail size={16} strokeWidth={2} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[14px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#777]"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#e02020] hover:bg-[#f02525] text-white font-rajdhani font-bold py-[15px] rounded-[8px] shadow-[0_4px_20px_rgba(224,32,32,0.35)] hover:shadow-[0_6px_28px_rgba(224,32,32,0.5)] active:scale-[0.985] transition-all duration-200 tracking-[2px] text-[15px] uppercase relative overflow-hidden disabled:opacity-80 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : "Send Reset Code"}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-[20px]">
            {/* Code */}
            <div className="field">
              <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                Reset Code
              </label>
              <div className="relative flex items-center group">
                <span className="absolute left-[14px] text-[#888] group-focus-within:text-[#e02020] transition-colors duration-200">
                  <ShieldCheck size={16} strokeWidth={2} />
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[14px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#777] tracking-[4px] font-bold"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* New password */}
            <div className="field">
              <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                New Password
              </label>
              <div className="relative flex items-center group">
                <span className="absolute left-[14px] text-[#888] group-focus-within:text-[#e02020] transition-colors duration-200">
                  <Lock size={16} strokeWidth={2} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[42px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#777]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-[14px] text-[#888] hover:text-[#aaa] transition-colors duration-200"
                >
                  {showPassword ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="field">
              <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                Confirm Password
              </label>
              <div className="relative flex items-center group">
                <span className="absolute left-[14px] text-[#888] group-focus-within:text-[#e02020] transition-colors duration-200">
                  <Lock size={16} strokeWidth={2} />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[42px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#777]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-[14px] text-[#888] hover:text-[#aaa] transition-colors duration-200"
                >
                  {showConfirm ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPhase("request"); setError(""); setCode(""); setPassword(""); setConfirmPassword(""); }}
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] text-[#888] hover:text-[#ccc] font-rajdhani font-bold py-[15px] rounded-[8px] transition-all duration-200 tracking-[2px] text-[13px] uppercase"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-[#e02020] hover:bg-[#f02525] text-white font-rajdhani font-bold py-[15px] rounded-[8px] shadow-[0_4px_20px_rgba(224,32,32,0.35)] hover:shadow-[0_6px_28px_rgba(224,32,32,0.5)] active:scale-[0.985] transition-all duration-200 tracking-[2px] text-[15px] uppercase relative overflow-hidden disabled:opacity-80 disabled:pointer-events-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                ) : "Reset Password"}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="mt-4 text-[12px] text-red-500 text-center font-medium whitespace-pre-wrap">{error}</p>
        )}
        {success && (
          <p className="mt-4 text-[12px] text-green-400 text-center font-medium">{success}</p>
        )}

        <div className="mt-[24px] text-center">
          <Link
            href="/sign-in"
            className="text-[11.5px] font-semibold tracking-[0.8px] uppercase text-[#e02020] hover:text-[#ff4444] transition-colors duration-200"
          >
            ← Back to Login
          </Link>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-8 py-[18px] z-5">
        <div className="text-[11px] text-[#3a3a3a] tracking-[0.5px] uppercase">
          © 2026 Tamil Business Tribe. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
