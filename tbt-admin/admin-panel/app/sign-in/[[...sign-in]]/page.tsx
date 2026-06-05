"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [strategy, setStrategy] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setLoading(true);
    setError("");

    try {
      if (verifying) {
        // Phase 2: Handle 2FA Verification
        console.log("DEBUG: Attempting 2FA verification with code:", code, "and strategy:", strategy);
        const result = await signIn.attemptSecondFactor({
          strategy: (strategy as any) || "email_code",
          code,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          router.push("/dashboard");
        } else {
          setError(`Verification failed. Status: ${result.status}`);
        }
      } else {
        // Phase 1: Initial Sign-in
        const trimmedIdentifier = identifier.trim();
        if (!trimmedIdentifier || !password) {
          setError("Please enter both identifier and password.");
          setLoading(false);
          return;
        }

        console.log("DEBUG: Attempting sign-in for:", trimmedIdentifier);
        
        const result = await signIn.create({
          identifier: trimmedIdentifier,
          password: password,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          router.push("/dashboard");
        } else if (result.status === "needs_second_factor") {
          console.log("DEBUG: Sign-in requires 2FA. Supported factors:", result.supportedSecondFactors);
          const factor = result.supportedSecondFactors?.[0];
          if (factor) {
            console.log("DEBUG: Preparing factor with strategy:", factor.strategy);
            setStrategy(factor.strategy);
            await signIn.prepareSecondFactor({ strategy: factor.strategy as any });
            setVerifying(true);
          } else {
            setError("2FA is required but no method is available.");
          }
        } else {
          setError(`Sign-in status: ${result.status}. Please ensure your account is fully set up in Clerk.`);
        }
      }
    } catch (err: any) {
      console.error("DEBUG: Clerk Error Details:", err);
      const firstError = err.errors?.[0];
      
      if (verifying) {
        // Errors during 2FA
        setError(firstError?.longMessage || firstError?.message || "Invalid verification code.");
      } else {
        // Errors during initial sign-in
        if (err.status === 422) {
          setError(`Identifier "${identifier}" not recognized. Please try your email address or check Clerk Dashboard > Identifiers.`);
        } else {
          setError(firstError?.longMessage || firstError?.message || "Invalid credentials");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0404] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-login-glow pointer-events-none" />

      <div className="card w-full max-w-[420px] bg-[#1c1c1c] rounded-[16px] p-[44px] pt-[44px] pb-[40px] relative z-10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_rgba(0,0,0,0.6),0_4px_16px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-bottom-5 duration-500">
        
        {/* LOGO */}
        <div className="flex items-center justify-center gap-[10px] mb-[28px]">
          <div className="w-[48px] h-[48px] flex-shrink-0">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <rect x="4" y="6" width="22" height="7" rx="1.5" fill="#e02020"/>
              <rect x="11" y="13" width="8" height="22" rx="1.5" fill="#e02020"/>
              <rect x="18" y="12" width="22" height="6" rx="1.5" fill="#ffffff" opacity=".9"/>
              <rect x="25" y="18" width="8" height="20" rx="1.5" fill="#ffffff" opacity=".9"/>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-rajdhani font-bold text-[18px] tracking-[2px] text-white">TAMIL BUSINESS</span>
            <small className="font-rajdhani text-[11px] tracking-[3px] text-[#888] font-medium mt-[1px]">TRIBE</small>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold text-white text-center tracking-[-0.2px] mb-[6px]">
          {verifying ? "Verify Identity" : "Admin Portal Login"}
        </h1>
        <p className="text-[13px] text-[#666] text-center font-normal mb-[32px]">
          {verifying 
            ? "Please enter the verification code sent to your device." 
            : "Secure access for authorized personnel only"}
        </p>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-[20px]">
          {!verifying ? (
            <>
              <div className="field">
                <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                  Username or Email
                </label>
                <div className="relative flex items-center group">
                  <span className="absolute left-[14px] text-[#555] group-focus-within:text-[#e02020] transition-colors duration-200">
                    <User size={16} strokeWidth={2} />
                  </span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Username or email address"
                    className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[14px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#444]"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                  Password
                </label>
                <div className="relative flex items-center group">
                  <span className="absolute left-[14px] text-[#555] group-focus-within:text-[#e02020] transition-colors duration-200">
                    <Lock size={16} strokeWidth={2} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[42px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#444]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-[14px] text-[#555] hover:text-[#aaa] transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end !mt-[14px] mb-[24px]">
                <Link
                  href="/forgot-password"
                  className="text-[11.5px] font-semibold tracking-[0.8px] uppercase text-[#e02020] hover:text-[#ff4444] transition-colors duration-200"
                >
                  Forgot Password?
                </Link>
              </div>
            </>
          ) : (
            <div className="field">
              <label className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[#888] mb-[8px]">
                Verification Code
              </label>
              <div className="relative flex items-center group">
                <span className="absolute left-[14px] text-[#555] group-focus-within:text-[#e02020] transition-colors duration-200">
                  <ShieldCheck size={16} strokeWidth={2} />
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[8px] text-[#e0e0e0] text-[14px] py-[13px] pl-[42px] pr-[14px] outline-none transition-all duration-200 focus:border-[#e02020] focus:ring-[3px] focus:ring-[#e02020]/12 placeholder:text-[#444] tracking-[4px] font-bold text-center"
                  required
                  autoFocus
                />
              </div>
              <button 
                type="button"
                onClick={() => setVerifying(false)}
                className="mt-2 text-[11px] text-[#666] hover:text-[#e02020] transition-colors uppercase font-semibold tracking-wider"
              >
                ← Back to Login
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e02020] hover:bg-[#f02525] text-white font-rajdhani font-bold py-[15px] rounded-[8px] shadow-[0_4px_20px_rgba(224,32,32,0.35)] hover:shadow-[0_6px_28px_rgba(224,32,32,0.5)] active:scale-[0.985] transition-all duration-200 tracking-[2px] text-[15px] uppercase relative overflow-hidden disabled:opacity-80 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              verifying ? "Verify Code" : "Sign In"
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
          </button>
        </form>

        {error && <p className="mt-4 text-[12px] text-red-500 text-center font-medium whitespace-pre-wrap">{error}</p>}

        <div className="mt-[20px] flex items-center gap-[8px] bg-[#181818] border border-[#2a2a2a] rounded-[8px] p-[11px]">
          <ShieldCheck size={15} strokeWidth={2} className="text-[#e02020] flex-shrink-0" />
          <span className="text-[12px] text-[#666] leading-[1.4]">
            Authorized personnel login only.
          </span>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-8 py-[18px] z-5">
        <div className="text-[11px] text-[#3a3a3a] tracking-[0.5px] uppercase">
          © 2026 Tamil Business Tribe. All Rights Reserved.
        </div>
        <div className="flex gap-[24px]">
          <Link href="/privacy" className="text-[11px] text-[#3a3a3a] hover:text-[#777] transition-colors duration-200 tracking-[0.5px] uppercase">Privacy Policy</Link>
          <Link href="/terms" className="text-[11px] text-[#3a3a3a] hover:text-[#777] transition-colors duration-200 tracking-[0.5px] uppercase">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
