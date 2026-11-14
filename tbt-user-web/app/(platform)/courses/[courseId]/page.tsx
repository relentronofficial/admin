"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen, Play, ArrowRight, ShoppingCart, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import {
  useCourse, useCreateRazorpayOrder, useVerifyRazorpayPayment,
  useCreateBundleOrder, useVerifyBundlePayment,
  useCreateAllAccessOrder, useVerifyAllAccessPayment,
} from "@/lib/hooks/useCourses";
import { useMe } from "@/lib/hooks/useUser";
import { toast } from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDurationSecs(s: number): string {
  if (!s || s <= 0) return "";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function fmtHours(h: number | null | undefined): string {
  if (!h || h <= 0) return "";
  if (h < 1) return `${Math.round(h * 60)}m`;
  const whole = Math.floor(h);
  const frac = h - whole;
  return frac > 0.1 ? `${h.toFixed(1)}h` : `${whole}h`;
}

function isRazorpayEnabled(course: any): boolean {
  if (typeof course?.razorpayEnabled === "boolean") return course.razorpayEnabled;
  return Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
}

function padNum(n: number) {
  return String(n).padStart(2, "0");
}

function getVideoEmbed(url: string): { type: "iframe" | "video"; src: string } {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return { type: "iframe", src: `https://www.youtube.com/embed/${m[1]}?rel=0&autoplay=1` };
  }
  if (url.includes("vimeo.com")) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return { type: "iframe", src: `https://player.vimeo.com/video/${m[1]}?autoplay=1` };
  }
  return { type: "video", src: url };
}

// ── Injected CSS (mini-course design, namespaced mc-) ─────────────────────────

const MC_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');

.mc-page{--mc-red:var(--color-accent,#f21f2b);--mc-red-dark:#d91420;--mc-maroon:#4b080b;overflow-x:hidden;background:#fff;color:#17151a;font-family:"DM Sans",sans-serif;line-height:1.55}
.mc-page *,.mc-page *::before,.mc-page *::after{box-sizing:border-box}
.mc-page a{color:inherit;text-decoration:none}
.mc-page button{font:inherit}

.mc-hero{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 10%,#fff 0,#fff8f8 45%,#ffe8e9 100%);padding:40px 20px 30px}
.mc-hero-orb{position:absolute;width:32px;height:32px;border-radius:10px;filter:blur(2px);opacity:.5;transform:rotate(20deg)}
.mc-orb-one{background:#48b9ec;left:8%;top:30%}
.mc-orb-two{background:#9ce21c;right:8%;top:37%}
.mc-hero-inner{max-width:1030px;margin:auto;text-align:center;position:relative;z-index:1}
.mc-eyebrow{font-size:10px;letter-spacing:1.5px;color:var(--mc-red);font-weight:800;margin:0 0 9px;display:block}
.mc-hero h1{font:700 clamp(30px,4.4vw,54px)/1.12 Outfit,sans-serif;letter-spacing:-1.6px;margin:0 auto 12px;max-width:900px}
.mc-hero h1 span,.mc-section-heading h2 span,.mc-earning-copy h2 span{color:var(--mc-red)}
.mc-hero-copy{max-width:720px;margin:0 auto 26px;color:#625b62;font-size:14px}
.mc-hero-showcase{display:grid;grid-template-columns:1.5fr .75fr;gap:28px;align-items:center;max-width:850px;margin:0 auto 22px}
.mc-hero-showcase>*{min-width:0}
.mc-video-preview{aspect-ratio:16/9;height:auto;border:0;padding:0;position:relative;overflow:hidden;border-radius:17px;background:#18151a;cursor:pointer;box-shadow:0 15px 35px #29101320;width:100%;display:block}
.mc-video-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block}
.mc-video-preview::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#0008,transparent 45%);pointer-events:none}
.mc-play-button{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);width:58px;height:58px;border:2px solid white;border-radius:50%;display:grid;place-items:center;background:#ffffff20;backdrop-filter:blur(4px);transition:.25s}
.mc-play-button span{width:0;height:0;border-top:9px solid transparent;border-bottom:9px solid transparent;border-left:14px solid #fff;margin-left:4px;display:block}
.mc-video-preview:hover .mc-play-button{background:var(--mc-red);scale:1.08}
.mc-video-caption{position:absolute;z-index:2;bottom:15px;left:18px;color:#fff;font-size:9px;letter-spacing:1.6px;font-weight:800}
.mc-hero-facts{display:grid;gap:19px;text-align:left}
.mc-fact{display:flex;align-items:center;gap:12px}
.mc-fact-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#ffe3e5;color:var(--mc-red);font-size:17px;flex-shrink:0}
.mc-fact small{display:block;color:#777;font-size:10px}
.mc-fact strong{display:block;color:var(--mc-red);font:700 15px Outfit,sans-serif}
.mc-offer-strip{max-width:850px;margin:auto;padding:17px 20px;border:1px solid #f5dfe1;border-radius:14px;background:#fff;display:flex;justify-content:space-between;align-items:center;text-align:left;box-shadow:0 8px 25px #6e1b2010}
.mc-offer-strip small{font-size:10px;color:#555}
.mc-discount{background:var(--mc-red);color:#fff;border-radius:20px;padding:3px 8px;margin-left:7px;font-size:8px}
.mc-offer-price{font:800 25px Outfit;color:var(--mc-red);line-height:1.3}
.mc-offer-price del{font:500 11px "DM Sans";color:#999}
.mc-offer-note{color:#438b36!important}
.mc-offer-actions{display:grid;gap:8px;width:220px}
.mc-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 19px;border-radius:30px;font-size:11px;font-weight:800;border:1px solid transparent;transition:transform .25s,background .25s,box-shadow .25s;cursor:pointer;font-family:"DM Sans",sans-serif;line-height:1}
.mc-btn:disabled{opacity:.6;cursor:not-allowed}
.mc-btn-red{background:var(--mc-red);color:#fff;box-shadow:0 8px 20px rgba(242,31,43,.15)}
.mc-btn-red:hover:not(:disabled){background:var(--mc-red-dark);transform:translateY(-2px)}
.mc-btn-outline{border-color:#2b2528;background:#fff;color:#1c191b}
.mc-btn-outline:hover{border-color:var(--mc-red);color:var(--mc-red);transform:translateY(-2px)}
.mc-btn-dark{background:#111;color:#fff}
.mc-btn-dark:hover:not(:disabled){background:var(--mc-red);transform:translateY(-2px)}
.mc-btn-white{background:#fff;color:#111}
.mc-btn-white:hover{transform:translateY(-2px);box-shadow:0 8px 20px #0003}
.mc-btn-green{background:#22c55e;color:#fff}
.mc-btn-green:hover{background:#16a34a;transform:translateY(-2px)}

.mc-ticker{overflow:hidden;border-bottom:1px solid #f2eeee;padding:15px 0;white-space:nowrap;background:var(--mc-red)}
.mc-ticker-track{display:flex;align-items:center;gap:24px;min-width:max-content;animation:mc-ticker 28s linear infinite;font:700 12px Outfit;letter-spacing:.5px;color:#fff}
.mc-ticker-track i{font-style:normal;color:rgba(255,255,255,.55);font-size:16px}
@keyframes mc-ticker{to{transform:translateX(-50%)}}

.mc-section{padding:82px 5vw}
.mc-section-heading{text-align:center;max-width:760px;margin:0 auto 35px}
.mc-section-heading h2,.mc-earning-copy h2{font:700 clamp(27px,3vw,38px)/1.15 Outfit,sans-serif;letter-spacing:-.8px;margin:0 0 10px}
.mc-section-heading>p:last-child{font-size:13px;color:#77717a;margin:0}
.mc-section-heading.mc-light h2{color:#fff}
.mc-section-heading.mc-light>p:last-child{color:#e8cfd0}
.mc-section-heading.mc-light .mc-eyebrow{color:#ffb7ba}

.mc-module-grid{max-width:1050px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.mc-module-list{display:grid;gap:10px;align-content:start}
.mc-module-card{border:1px solid #e9e5e6;border-radius:12px;overflow:hidden;background:#fff;transition:box-shadow .25s,border-color .25s}
.mc-module-card:hover{border-color:#f4a4a9;box-shadow:0 8px 22px #2d11110c}
.mc-module-card.mc-featured{border-color:#ff8f96}
.mc-module-trigger{width:100%;display:flex;align-items:center;gap:9px;text-align:left;padding:13px 12px;background:#fff;border:0;cursor:pointer}
.mc-module-number{display:grid;place-items:center;flex:0 0 25px;height:25px;border-radius:7px;background:#17171a;color:#fff;font-size:10px;font-weight:800}
.mc-featured .mc-module-number{background:var(--mc-red)}
.mc-module-title{font-size:11px;font-weight:800;flex:1;line-height:1.35}
.mc-module-tag{font-size:8px;color:#777;background:#f6f3f3;border-radius:20px;padding:4px 7px;white-space:nowrap}
.mc-chevron{color:#777;transition:transform .25s;display:block;font-style:normal;line-height:1}
.mc-module-trigger[aria-expanded="true"] .mc-chevron{transform:rotate(180deg)}
.mc-module-details{display:none;padding:0 14px 12px 47px;font-size:10px;color:#686168}
.mc-module-trigger[aria-expanded="true"]+.mc-module-details{display:block;animation:mc-drop .25s ease}
.mc-module-details>div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid #f1eeee}
.mc-module-details small{white-space:nowrap;color:#999}
.mc-module-details p{margin:5px 0}
.mc-center-btn{display:flex;width:max-content;margin:28px auto 0}

.mc-related-section{background:linear-gradient(130deg,#430709,#570b0d 55%,#390608);padding:75px 5vw 65px;color:#fff}
.mc-course-grid{max-width:1000px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.mc-course-card{min-width:0;cursor:pointer}
.mc-course-art{height:175px;border-radius:13px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 25px #16030570;isolation:isolate}
.mc-course-art::before{content:"";position:absolute;inset:0;background:linear-gradient(130deg,#ffffff20,transparent 50%);z-index:0}
.mc-course-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;background:#111;z-index:0}
.mc-course-art-overlay{position:absolute;inset:0;background:linear-gradient(0deg,#000a,transparent 50%);z-index:1}
.mc-course-art-text{position:relative;z-index:2;text-align:center;padding:12px}
.mc-course-art b{font:800 clamp(18px,2.5vw,28px)/.95 Outfit;text-align:center;letter-spacing:-1px;text-shadow:0 3px 12px #0007;color:#fff}
.mc-course-art em{font-style:normal;font-size:.65em;display:block}
.mc-art-label{position:absolute;top:12px;left:12px;background:#fff;color:#111;padding:5px 8px;border-radius:5px;font-weight:900;font-size:11px;z-index:3}
.mc-art-shape{position:absolute;bottom:-50px;right:-15px;width:150px;height:100px;border:2px solid #ffffff55;border-radius:50%;transform:rotate(-25deg);z-index:1}
.mc-course-card h3{font:700 15px Outfit;margin:13px 0 3px;color:#fff}
.mc-course-card>p{font-size:11px;color:#e8cfd0;margin:0 0 7px;max-width:300px}
.mc-course-card>span{font-size:10px;color:#ffe54c;font-weight:700;text-decoration:underline}

.mc-plans-section{background:#fff}
.mc-plans-grid{max-width:1080px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
.mc-plans-grid.mc-g2{grid-template-columns:repeat(2,1fr);max-width:720px}
.mc-plans-grid.mc-g1{grid-template-columns:1fr;max-width:420px}
.mc-plan-card{position:relative;border:1px solid #e8e4e5;border-radius:17px;padding:24px 22px 20px;display:flex;flex-direction:column;box-shadow:0 9px 28px #16060908;transition:transform .3s,box-shadow .3s}
.mc-plan-card:hover{transform:translateY(-7px);box-shadow:0 12px 35px rgba(36,10,14,.08)}
.mc-plan-card.mc-popular{border:1.5px solid var(--mc-red);box-shadow:0 12px 30px rgba(242,31,43,.1)}
.mc-popular-label{position:absolute;top:-12px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:20px;background:var(--mc-red);color:#fff;padding:5px 15px;font-size:8px;font-weight:800;letter-spacing:.5px}
.mc-plan-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:9px;font-weight:800;color:#555}
.mc-pill{background:#f5f2f2;border-radius:20px;padding:4px 8px;font-size:8px;white-space:nowrap}
.mc-plan-card h3{font:700 21px Outfit;margin:18px 0 7px}
.mc-plan-card>p{font-size:11px;color:#777;min-height:52px;margin:0}
.mc-plan-price{font:800 29px Outfit;margin:15px 0 20px;white-space:nowrap}
.mc-plan-price del{font:500 11px "DM Sans";color:#aaa}
.mc-plan-price small{font:700 9px "DM Sans";background:#e6faed;color:#248849;padding:4px 7px;border-radius:5px;margin-left:4px}
.mc-plan-subtitle{font-size:9px;font-weight:800;color:#777;margin-bottom:7px}
.mc-plan-feature-title{font-size:11px;color:#292329;display:block;margin-bottom:4px}
.mc-plan-card ul{list-style:none;padding:0;margin:13px 0 22px;flex:1}
.mc-plan-card li{font-size:10px;color:#5e575e;padding:7px 0 7px 18px;position:relative;border-bottom:1px solid #f6f1f1}
.mc-plan-card li::before{content:"✓";position:absolute;left:0;color:var(--mc-red);font-weight:900}
.mc-plan-btn{width:100%;margin-top:auto;border-radius:8px!important}

.mc-earning-section{display:grid;grid-template-columns:.9fr 1.1fr;gap:35px;align-items:center;padding:75px 5vw 60px}
.mc-earning-copy h2{max-width:480px;font:700 clamp(27px,3vw,38px)/1.15 Outfit,sans-serif;letter-spacing:-.8px;margin:0 0 10px}
.mc-earning-copy>p:not(.mc-eyebrow){color:#777;font-size:13px;max-width:460px}
.mc-button-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.mc-steps-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.mc-steps-grid article{background:#fff2f3;border-radius:15px;padding:18px 17px;min-height:135px;transition:transform .25s,background .25s}
.mc-steps-grid article:hover{transform:translateY(-4px);background:#ffe5e7}
.mc-step-icon{display:block;color:var(--mc-red);font-size:23px;margin-bottom:4px}
.mc-steps-grid h3{font:700 15px Outfit;margin:4px 0}
.mc-steps-grid p{font-size:10px;color:#6d6269;margin:0}
.mc-testimonial{grid-column:1/-1;display:flex;align-items:flex-start;gap:15px;background:#fff3f3;border-radius:13px;padding:17px 20px;margin:0}
.mc-avatar{flex:0 0 42px;height:42px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#f6c6a3,#5a2725);color:#fff;font-weight:800;font-size:14px}
.mc-testimonial p{font-size:11px;color:#63575e;margin:0}
.mc-testimonial small{display:block;margin-top:7px;color:#9a4248;font-size:9px}

.mc-quote-section{background:#fff1f2;text-align:center;padding:48px 20px}
.mc-quote-section p{max-width:850px;margin:0 auto 13px;font:700 clamp(22px,3vw,32px)/1.3 Outfit;letter-spacing:-.5px}
.mc-quote-section p span{color:var(--mc-red)}
.mc-quote-section small{display:block;font-size:9px;letter-spacing:1px;margin-bottom:16px;color:#77717a}
.mc-quote-section .mc-btn{min-width:150px}

.mc-faq-section{padding:75px 5vw 85px}
.mc-faq-list{max-width:760px;margin:auto;display:grid;gap:8px}
.mc-faq-item{border-radius:9px;background:#fff3f3;overflow:hidden}
.mc-faq-item button{width:100%;border:0;background:transparent;display:flex;justify-content:space-between;align-items:center;padding:14px 17px;text-align:left;font-size:12px;font-weight:700;cursor:pointer;color:#17151a}
.mc-faq-item button span{transition:transform .25s;display:block;font-style:normal;font-size:16px;line-height:1}
.mc-faq-item button[aria-expanded="true"] span{transform:rotate(180deg)}
.mc-faq-answer{display:none;padding:0 17px 15px;font-size:11px;color:#6d6269;max-width:680px}
.mc-faq-item button[aria-expanded="true"]+.mc-faq-answer{display:block;animation:mc-drop .25s ease}

.mc-modal-overlay{position:fixed;inset:0;background:#100508d9;z-index:1000;display:grid;place-items:center;padding:20px}
.mc-modal-panel{width:min(760px,100%);position:relative;background:#1c1114;border-radius:16px;padding:15px}
.mc-modal-close{position:absolute;right:8px;top:5px;border:0;background:transparent;color:#fff;font-size:30px;cursor:pointer;z-index:2;line-height:1;padding:4px 10px}
.mc-modal-body{border-radius:10px;overflow:hidden;aspect-ratio:16/9}
.mc-modal-body iframe,.mc-modal-body video{width:100%;height:100%;border:0;display:block}
.mc-modal-placeholder{height:300px;display:grid;place-content:center;justify-items:center;color:#fff;background:radial-gradient(circle at 50% 50%,#4e242a,#100b0d 70%);border-radius:10px;gap:8px}
.mc-modal-placeholder p{margin:0;font:700 16px Outfit}
.mc-modal-placeholder small{color:#cdbfc1;font-size:11px}

.mc-sticky-bar{position:fixed;bottom:0;inset-inline:0;z-index:50;background:#fff;border-top:1px solid #f5dfe1;box-shadow:0 -4px 20px #0001;padding-bottom:env(safe-area-inset-bottom,0px)}
.mc-sticky-bar-inner{display:flex;align-items:center;gap:12px;padding:10px 20px}
.mc-sticky-title{flex:1;min-width:0;font-size:12px;font-weight:700;color:#17151a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-sticky-price{font:800 14px Outfit;color:var(--mc-red);white-space:nowrap}
.mc-sticky-orig{font-size:11px;color:#aaa;text-decoration:line-through;margin-left:4px}

@keyframes mc-drop{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}

@media(max-width:900px){
  .mc-hero-showcase{max-width:740px}
  .mc-plan-card{padding:20px 15px}
  .mc-plan-price{font-size:25px}
  .mc-module-trigger{gap:6px}
  .mc-module-tag{display:none}
}
@media(max-width:680px){
  .mc-hero{padding:28px 17px 25px}
  .mc-hero h1{font-size:35px;letter-spacing:-1px}
  .mc-hero-copy{font-size:12px}
  .mc-hero-showcase{grid-template-columns:1fr;gap:17px}
  .mc-hero-facts{grid-template-columns:1fr 1fr;gap:13px}
  .mc-offer-strip{padding:14px;gap:12px;align-items:flex-start;flex-wrap:wrap}
  .mc-offer-actions{width:100%;grid-template-columns:1fr 1fr}
  .mc-offer-price{font-size:22px}
  .mc-section{padding:60px 18px}
  .mc-section-heading{margin-bottom:25px}
  .mc-section-heading h2,.mc-earning-copy h2{font-size:29px}
  .mc-module-grid{grid-template-columns:1fr;gap:10px}
  .mc-module-title{font-size:10px}
  .mc-module-details{padding-left:43px}
  .mc-related-section{padding:58px 18px}
  .mc-course-grid{grid-template-columns:1fr;gap:24px;max-width:420px;margin:auto}
  .mc-course-art{height:190px}
  .mc-plans-grid,.mc-plans-grid.mc-g2,.mc-plans-grid.mc-g3{grid-template-columns:1fr;max-width:440px;gap:25px;margin:auto}
  .mc-plan-card>p{min-height:0}
  .mc-plan-price{font-size:29px}
  .mc-plan-card li{font-size:11px}
  .mc-earning-section{grid-template-columns:1fr;gap:25px;padding:60px 18px}
  .mc-steps-grid article{min-height:115px;padding:15px}
  .mc-quote-section{padding:40px 20px}
  .mc-quote-section p{font-size:23px}
  .mc-faq-section{padding:58px 18px 65px}
  .mc-faq-item button{font-size:11px;padding:13px}
}
@media(max-width:380px){
  .mc-hero h1{font-size:30px}
  .mc-offer-strip{flex-direction:column}
  .mc-steps-grid{gap:8px}
  .mc-steps-grid article{padding:12px}
}
@media(prefers-reduced-motion:reduce){
  .mc-ticker-track{animation-duration:.01ms!important}
  .mc-module-trigger[aria-expanded="true"]+.mc-module-details,.mc-faq-item button[aria-expanded="true"]+.mc-faq-answer{animation:none}
}
`;

// ── Video Modal ───────────────────────────────────────────────────────────────

function MCVideoModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="mc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mc-modal-panel">
        <button className="mc-modal-close" onClick={onClose} aria-label="Close preview">×</button>
        {url ? (() => {
          const { type, src } = getVideoEmbed(url);
          return (
            <div className="mc-modal-body">
              {type === "iframe"
                ? <iframe src={src} allow="autoplay; fullscreen" allowFullScreen title="Course Preview" />
                : <video src={src} controls autoPlay />}
            </div>
          );
        })() : (
          <div className="mc-modal-placeholder">
            <div className="mc-play-button" style={{ position: "static", transform: "none" }}><span /></div>
            <p>Course Preview</p>
            <small>No preview video configured yet.</small>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function MCHeroSection({
  course, courseId, buying, onBuy, onVideoPreview,
}: {
  course: any; courseId: string; buying: boolean; onBuy: () => void; onVideoPreview: () => void;
}) {
  const router = useRouter();
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const hasPrice = course.price != null && Number(course.price) > 0;
  const price = hasPrice ? Number(course.price) : 0;
  const origPrice = course.originalPrice != null ? Number(course.originalPrice) : null;
  const discountPct = origPrice && origPrice > price && price > 0
    ? Math.round(((origPrice - price) / origPrice) * 100) : null;
  const hasBundlePrice = course.bundlePrice != null && Number(course.bundlePrice) > 0;
  const hasAllAccessPrice = course.allAccessPrice != null && Number(course.allAccessPrice) > 0;
  const isMultiTier = hasBundlePrice || hasAllAccessPrice;
  const razorpayOn = isRazorpayEnabled(course);

  const durationLabel = totalSecs > 0
    ? fmtDurationSecs(totalSecs)
    : course.durationHours
    ? fmtHours(course.durationHours)
    : lessons.length > 0 ? `${lessons.length} Lessons` : "";

  const facts = [
    { icon: "▤", label: "Learning Methodology", value: "Self-Paced" },
    { icon: "◷", label: "Timing Starts at", value: "Immediately" },
    { icon: "▣", label: durationLabel ? "Course Duration" : "Total Lessons", value: durationLabel || `${lessons.length} Lessons` },
    { icon: "▧", label: "Will be Held in", value: "TBT Course Portal" },
  ];

  function handleHeroCta() {
    if (course.hasAccess) { router.push(`/learning/${courseId}`); return; }
    // Hero CTA never opens checkout directly — it takes the member to the
    // pricing plans, where each plan's own button starts payment.
    const plans = document.getElementById("mc-plans");
    if (plans) {
      plans.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      onBuy();
    }
  }

  const heroCtaLabel = course.hasAccess
    ? "Continue Learning →"
    : isMultiTier
    ? "Choose Your Plan →"
    : hasPrice && razorpayOn
    ? `Enroll for ₹${price.toLocaleString("en-IN")} →`
    : "Start Learning Free →";

  return (
    <section className="mc-hero">
      <div className="mc-hero-orb mc-orb-one" />
      <div className="mc-hero-orb mc-orb-two" />
      <div className="mc-hero-inner">
        <p className="mc-eyebrow">
          {course.module ? `${course.module.toUpperCase()} COURSE · LEARN THE SKILL` : "LEARN A SKILL. BUILD A BUSINESS."}
        </p>
        <h1>
          {course.purchaseHeadline
            ? course.purchaseHeadline
            : (() => {
                // Highlight the last two words; short titles are highlighted whole (no repeated words).
                const words = course.title.trim().split(/\s+/);
                const lead = words.slice(0, -2).join(" ");
                return (<>{lead && <>{lead}{" "}</>}<span>{words.slice(-2).join(" ")}</span></>);
              })()
          }
        </h1>
        {course.description && (
          <p className="mc-hero-copy">{course.description}</p>
        )}

        <div className="mc-hero-showcase">
          <button
            className="mc-video-preview"
            aria-label="Play course preview"
            onClick={onVideoPreview}
          >
            {course.thumbnailUrl ? (
              <img src={course.thumbnailUrl} alt={course.title} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#2a1a1b", display: "grid", placeItems: "center" }}>
                <BookOpen size={48} color="#ffffff44" />
              </div>
            )}
            <div className="mc-play-button"><span /></div>
            {course.videoPreviewUrl && (
              <span className="mc-video-caption">WATCH COURSE PREVIEW</span>
            )}
          </button>

          <div className="mc-hero-facts">
            {facts.map((f, i) => (
              <div className="mc-fact" key={i}>
                <span className="mc-fact-icon">{f.icon}</span>
                <div>
                  <small>{f.label}</small>
                  <strong>{f.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mc-offer-strip">
          <div>
            {hasPrice && !course.hasAccess ? (
              <>
                <small>
                  Special Course Access
                  {discountPct && <b className="mc-discount">{discountPct}% OFF</b>}
                </small>
                <div className="mc-offer-price">
                  ₹{price.toLocaleString("en-IN")}
                  {origPrice && origPrice > price && <del> ₹{origPrice.toLocaleString("en-IN")}</del>}
                </div>
                <small className="mc-offer-note">✓ Instant access · Learn at your own pace</small>
              </>
            ) : course.hasAccess ? (
              <>
                <small>You&apos;re enrolled in this course</small>
                <div className="mc-offer-price" style={{ color: "#22c55e" }}>Already Enrolled ✓</div>
                <small className="mc-offer-note">✓ Continue from where you left off</small>
              </>
            ) : (
              <>
                <small>Free Course Access</small>
                <div className="mc-offer-price" style={{ color: "#22c55e" }}>Free Access</div>
                <small className="mc-offer-note">✓ Instant access · No payment required</small>
              </>
            )}
          </div>
          <div className="mc-offer-actions">
            <button
              className={`mc-btn ${course.hasAccess ? "mc-btn-green" : "mc-btn-red"}`}
              onClick={handleHeroCta}
            >
              {heroCtaLabel}
            </button>
            <a className="mc-btn mc-btn-outline" href="#mc-curriculum">
              Explore Curriculum →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────

function MCTickerSection({ course }: { course: any }) {
  const title = course?.title ? course.title.toUpperCase() : null;
  const module = course?.module ? course.module.toUpperCase() : null;
  const items = [
    "LEARN THE SKILL", "✦", "BUILD YOUR PORTFOLIO", "✦",
    title ?? "GROW YOUR BUSINESS", "✦", "SELL YOUR SERVICE", "✦",
    module ?? "START TODAY", "✦", "LEARN AT YOUR OWN PACE", "✦",
  ];
  const repeated = [...items, ...items];
  return (
    <div className="mc-ticker" aria-hidden="true">
      <div className="mc-ticker-track">
        {repeated.map((item, i) => (
          item === "✦" ? <i key={i}>✦</i> : <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// ── Curriculum ───────────────────────────────────────────────────────────────

function MCCurriculumSection({ course }: { course: any }) {
  const lessons: any[] = (course.lessons ?? []).slice().sort((a: any, b: any) => a.order - b.order);
  const sections: any[] = (course.sections ?? []).slice().sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  type Group = { title: string; tag?: string; lessons: any[]; featured?: boolean };
  const groups: Group[] = [];

  if (sections.length > 0) {
    sections.forEach((sec: any, i: number) => {
      const sl = lessons.filter((l: any) => l.sectionId === sec.id);
      if (sl.length > 0) groups.push({ title: sec.title, tag: sec.description?.slice(0, 20) ?? undefined, lessons: sl, featured: i === 0 });
    });
    const unsectioned = lessons.filter((l: any) => !l.sectionId);
    if (unsectioned.length > 0) groups.push({ title: "General", lessons: unsectioned });
  } else {
    lessons.forEach((l: any, i: number) => {
      groups.push({ title: l.title, tag: l.type ?? undefined, lessons: [l], featured: i === 0 });
    });
  }

  if (groups.length === 0) return null;

  const mid = Math.ceil(groups.length / 2);
  const leftGroups = groups.slice(0, mid);
  const rightGroups = groups.slice(mid);

  return (
    <section className="mc-section" id="mc-curriculum">
      <div className="mc-section-heading">
        <p className="mc-eyebrow">YOUR LEARNING ROADMAP</p>
        <h2>Everything You Need to <span>Start Earning</span></h2>
        <p>
          Explore the step-by-step curriculum, master the skills, and build what businesses pay for.
        </p>
      </div>

      <div className="mc-module-grid" style={{ gridTemplateColumns: rightGroups.length > 0 ? undefined : "1fr" }}>
        <div className="mc-module-list">
          {leftGroups.map((g, i) => (
            <MCModuleCard key={i} index={i} group={g} />
          ))}
        </div>
        {rightGroups.length > 0 && (
          <div className="mc-module-list">
            {rightGroups.map((g, i) => (
              <MCModuleCard key={i + mid} index={i + mid} group={g} />
            ))}
          </div>
        )}
      </div>

      <a className="mc-btn mc-btn-dark mc-center-btn" href="#mc-plans">
        Explore Pricing Plans →
      </a>
    </section>
  );
}

function MCModuleCard({ index, group }: { index: number; group: { title: string; tag?: string; lessons: any[]; featured?: boolean } }) {
  const [open, setOpen] = useState(index === 0);
  const totalSecs = group.lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);

  return (
    <article className={`mc-module-card${group.featured ? " mc-featured" : ""}`}>
      <button
        className="mc-module-trigger"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="mc-module-number">{padNum(index + 1)}</span>
        <span className="mc-module-title">{group.title}</span>
        {group.tag && <span className="mc-module-tag">{group.tag}</span>}
        {totalSecs > 0 && <span className="mc-module-tag">{fmtDurationSecs(totalSecs)}</span>}
        <i className="mc-chevron">⌄</i>
      </button>
      <div className="mc-module-details">
        {group.lessons.map((l: any, j: number) => (
          <div key={l.id ?? j}>
            <span>{j + 1}. {l.title}</span>
            {l.durationSeconds > 0 && <small>{fmtDurationSecs(l.durationSeconds)}</small>}
          </div>
        ))}
        {group.lessons.length === 0 && <p>Lessons loading…</p>}
      </div>
    </article>
  );
}

// ── Related Courses ───────────────────────────────────────────────────────────

const ART_BG = [
  "radial-gradient(circle at 70% 80%,#65b3f1,#102f66 50%,#06142b)",
  "radial-gradient(circle at 70% 70%,#c77c39,#38201a 50%,#101016)",
  "radial-gradient(circle at 75% 75%,#5ecf8e,#1a5c38 50%,#0a1c10)",
];

function MCRelatedSection({ courses }: { courses: any[] }) {
  const router = useRouter();
  const shown = courses.slice(0, 3);
  if (!shown.length) return null;

  return (
    <section className="mc-related-section">
      <div className="mc-section-heading mc-light">
        <p className="mc-eyebrow">GROW YOUR SKILLS</p>
        <h2>Skills That Work Even Better <span>Together.</span></h2>
        <p>Explore complementary courses that help you expand your services and deliver more value.</p>
      </div>

      <div className="mc-course-grid" style={{ gridTemplateColumns: shown.length === 1 ? "1fr" : shown.length === 2 ? "repeat(2,1fr)" : undefined }}>
        {shown.map((c: any, i: number) => (
          <article
            key={c.id}
            className="mc-course-card"
            onClick={() => router.push(`/courses/${c.id}`)}
          >
            <div className="mc-course-art" style={{ background: c.thumbnailUrl ? "#000" : ART_BG[i % ART_BG.length] }}>
              {c.thumbnailUrl && <img src={c.thumbnailUrl} alt={c.title} />}
              <div className="mc-course-art-overlay" />
              {!c.thumbnailUrl && (
                <div className="mc-course-art-text">
                  <b>{c.title.toUpperCase()}</b>
                </div>
              )}
              <span className="mc-art-label">{c.price > 0 ? `₹${Number(c.price).toLocaleString("en-IN")}` : "Free"}</span>
              <span className="mc-art-shape" />
            </div>
            <h3>{c.title}</h3>
            {c.description && <p>{c.description.slice(0, 90)}{c.description.length > 90 ? "…" : ""}</p>}
            <span>View Course →</span>
          </article>
        ))}
      </div>

      <a className="mc-btn mc-btn-white mc-center-btn" href="/courses">
        View All Courses →
      </a>
    </section>
  );
}

// ── Plans ─────────────────────────────────────────────────────────────────────

function MCPlansSection({
  course, courseId, buying, onBuy,
  buyingBundle, onBuyBundle,
  buyingAllAccess, onBuyAllAccess,
}: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
  buyingBundle: boolean; onBuyBundle: () => void;
  buyingAllAccess: boolean; onBuyAllAccess: () => void;
}) {
  const router = useRouter();
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const hasPrice = course.price != null && Number(course.price) > 0;
  const hasBundlePrice = course.bundlePrice != null && Number(course.bundlePrice) > 0;
  const hasAllAccessPrice = course.allAccessPrice != null && Number(course.allAccessPrice) > 0;
  const origPrice = course.originalPrice != null ? Number(course.originalPrice) : null;
  const price = hasPrice ? Number(course.price) : 0;
  const discountPct = origPrice && origPrice > price && price > 0
    ? Math.round(((origPrice - price) / origPrice) * 100) : null;
  const razorpayOn = isRazorpayEnabled(course);

  const basePerks = [
    lessons.length > 0 && `${lessons.length} lesson${lessons.length !== 1 ? "s" : ""}`,
    totalSecs > 0 && `${fmtDurationSecs(totalSecs)} of content`,
    course.accessDurationDays ? `${course.accessDurationDays}-day access` : "Lifetime access",
    "Learn at your own pace",
    "Start immediately",
  ].filter(Boolean) as string[];

  const headline = course.purchaseHeadline || "Choose Your Learning Plan";
  const tierCount = 1 + (hasBundlePrice ? 1 : 0) + (hasAllAccessPrice ? 1 : 0);
  const gridClass = tierCount === 1 ? "mc-plans-grid mc-g1" : tierCount === 2 ? "mc-plans-grid mc-g2" : "mc-plans-grid";

  return (
    <section className="mc-section mc-plans-section" id="mc-plans">
      <div className="mc-section-heading">
        <p className="mc-eyebrow">PICK YOUR LEARNING PATH</p>
        <h2>Choose Your <span>Learning Plan</span></h2>
        <p>Select the plan that best matches your learning goals.</p>
      </div>

      <div className={gridClass}>
        {/* Single course card */}
        <article className={`mc-plan-card${hasBundlePrice ? "" : " mc-popular"}`}>
          {!hasBundlePrice && !hasAllAccessPrice && <div className="mc-popular-label">✦ BEST VALUE</div>}
          <div className="mc-plan-top">
            <span>STANDALONE COURSE</span>
            <span className="mc-pill">Self-Paced</span>
          </div>
          <h3>{course.title}</h3>
          <p>{course.description?.slice(0, 90) ?? "Complete course access with everything you need to get started."}</p>
          <div className="mc-plan-price">
            {course.hasAccess
              ? <span style={{ color: "#22c55e", fontSize: "24px" }}>Enrolled ✓</span>
              : hasPrice
              ? (<>{`₹${price.toLocaleString("en-IN")}`}{origPrice && origPrice > price && <del>{`₹${origPrice.toLocaleString("en-IN")}`}</del>}{discountPct && <small>{discountPct}% OFF</small>}</>)
              : "Free"}
          </div>
          <div className="mc-plan-subtitle">CURRICULUM SCOPE:</div>
          <b className="mc-plan-feature-title">Complete {lessons.length}-Lesson Course</b>
          <ul>
            {basePerks.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          {course.hasAccess ? (
            <button className="mc-btn mc-btn-green mc-plan-btn" onClick={() => router.push(`/learning/${courseId}`)}>
              Continue Learning →
            </button>
          ) : hasPrice && razorpayOn ? (
            <button className="mc-btn mc-btn-dark mc-plan-btn" disabled={buying} onClick={onBuy}>
              {buying ? <><Loader2 size={12} style={{ display: "inline", animation: "spin 1s linear infinite" }} /> Processing…</> : `Enroll in Course →`}
            </button>
          ) : (
            <button className="mc-btn mc-btn-red mc-plan-btn" onClick={() => router.push(`/learning/${courseId}`)}>
              Start Learning Free →
            </button>
          )}
        </article>

        {/* Bundle card */}
        {hasBundlePrice && (
          <article className="mc-plan-card mc-popular">
            <div className="mc-popular-label">✦ BEST VALUE FOR CREATORS</div>
            <div className="mc-plan-top">
              <span>CURATED BUNDLE</span>
              <span className="mc-pill">Most Popular</span>
            </div>
            <h3>Creative Skill Bundle</h3>
            <p>Get this course plus a curated set of complementary courses at a special bundle price.</p>
            <div className="mc-plan-price">
              {`₹${Number(course.bundlePrice).toLocaleString("en-IN")}`}
              <small>Bundle Discount</small>
            </div>
            <div className="mc-plan-subtitle">INCLUDES:</div>
            <b className="mc-plan-feature-title">{course.title} + Bundle Courses</b>
            <ul>
              <li>Everything in the standalone course</li>
              {(course.bundleCourses ?? []).slice(0, 3).map((bc: any) => <li key={bc.id}>{bc.title}</li>)}
              <li>Bundle discount applied</li>
              ...{basePerks.slice(0, 2).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <button className="mc-btn mc-btn-red mc-plan-btn" disabled={buyingBundle} onClick={onBuyBundle}>
              {buyingBundle ? "Processing…" : `Get Bundle →`}
            </button>
          </article>
        )}

        {/* All-access card */}
        {hasAllAccessPrice && (
          <article className="mc-plan-card">
            <div className="mc-plan-top">
              <span>ALL-ACCESS</span>
              <span className="mc-pill">Maximum Value</span>
            </div>
            <h3>All-Access Pass</h3>
            <p>Get access to every published course on the platform. Best for serious learners and business builders.</p>
            <div className="mc-plan-price">
              {`₹${Number(course.allAccessPrice).toLocaleString("en-IN")}`}
              <small>All Courses</small>
            </div>
            <div className="mc-plan-subtitle">INCLUDES:</div>
            <b className="mc-plan-feature-title">All Published Courses</b>
            <ul>
              <li>All currently published courses</li>
              <li>Future courses included</li>
              <li>Best value for serious learners</li>
              <li>Priority support access</li>
              {basePerks.slice(0, 2).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <button className="mc-btn mc-btn-dark mc-plan-btn" disabled={buyingAllAccess} onClick={onBuyAllAccess}>
              {buyingAllAccess ? "Processing…" : `Get All Access →`}
            </button>
          </article>
        )}
      </div>
    </section>
  );
}

// ── Earning ───────────────────────────────────────────────────────────────────

const EARN_STEPS = [
  { icon: "♟", title: "Learn", desc: "Master the tools, techniques, and practical workflows from Tamil creators." },
  { icon: "♧", title: "Implement", desc: "Turn your skills into real projects that showcase your capabilities." },
  { icon: "◎", title: "Monetize", desc: "Discover service ideas, offer packaging, pricing models, and your first 3 clients." },
  { icon: "▥", title: "Scale", desc: "Retain clients, build repeatable systems, and turn your skill into a sustainable business." },
];

function MCEarningSection({ course, onBuy }: { course: any; onBuy: () => void }) {
  const router = useRouter();
  const hasPrice = course.price != null && Number(course.price) > 0;

  return (
    <section className="mc-earning-section">
      <div className="mc-earning-copy">
        <p className="mc-eyebrow">FROM LEARNING TO EARNING</p>
        <h2>Don&apos;t Just Learn the Skill. <span>Learn How to Earn</span> From It.</h2>
        <p>Every learning path connects technical skills with the business side — because a skill only changes your life when someone pays for it.</p>
        <div className="mc-button-row">
          <button className="mc-btn mc-btn-red" onClick={course.hasAccess ? () => router.push(`/learning/${course.id}`) : onBuy}>
            {course.hasAccess ? "Continue Learning →" : hasPrice ? "Explore Pricing →" : "Start Learning →"}
          </button>
          <a className="mc-btn mc-btn-outline" href="#mc-curriculum">Explore Curriculum</a>
        </div>
      </div>

      <div>
        <div className="mc-steps-grid">
          {EARN_STEPS.map((s, i) => (
            <article key={i}>
              <span className="mc-step-icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>

        <div className="mc-testimonial" style={{ marginTop: "13px" }}>
          <div className="mc-avatar">SK</div>
          <p>
            &ldquo;Most courses stop at showing how the buttons work. TBT taught me how to package my skills into a monthly social media retainer. I closed my first local client within 3 weeks of finishing.&rdquo;
            <small><b>Santhosh Kumar</b> · Freelance Creator · TBT Member</small>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Quote ─────────────────────────────────────────────────────────────────────

function MCQuoteSection({ course, onBuy }: { course: any; onBuy: () => void }) {
  const router = useRouter();
  const hasPrice = course.price != null && Number(course.price) > 0;

  return (
    <section className="mc-quote-section">
      <p>
        &ldquo;You don&apos;t need to know everything before you start.{" "}
        <span>Start with one skill.</span> Learn to use it. Discover how to{" "}
        <span>sell it.</span> Build from there.&rdquo;
      </p>
      <small>TBT CORE PRINCIPLE</small>
      <div>
        <button
          className="mc-btn mc-btn-red"
          onClick={course.hasAccess ? () => router.push(`/learning/${course.id}`) : onBuy}
        >
          {course.hasAccess ? "Continue Learning →" : hasPrice ? "Get Started →" : "Start Free →"}
        </button>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function MCFAQSection({ course }: { course: any }) {
  const faqs = [
    { q: "1. What is Tamil Business Tribe?", a: "Tamil Business Tribe (TBT) is a learning platform focused on helping you learn practical digital and business skills, build a portfolio, and explore ways to offer those skills as services." },
    { q: "2. Who are these courses for?", a: "The courses are designed for beginners, creators, freelancers, and business owners who want to develop practical skills and monetize their knowledge." },
    { q: "3. Can I start if I haven't started a business yet?", a: "Absolutely. You can start by learning the skill and creating portfolio projects before offering a service. Many of our members started with zero business experience." },
    { q: `4. How long do I have access to ${course.title}?`, a: course.accessDurationDays ? `You will have access for ${course.accessDurationDays} days from the date of purchase.` : "You have lifetime access to this course. Learn at your own pace and revisit lessons anytime." },
    { q: "5. What payment methods are accepted?", a: "We accept all major credit/debit cards, UPI, net banking, and wallets through our secure Razorpay payment gateway." },
    { q: "6. Will I receive a certificate?", a: "Yes! Upon completing the course you can download your TBT completion certificate to showcase on LinkedIn and your portfolio." },
    { q: "7. Will I learn how to earn from my skills?", a: "The learning path includes practical guidance on portfolio building, service ideas, pricing, and client acquisition — not just the technical skill." },
    { q: "8. How do I access the course after purchase?", a: "The course is delivered through the TBT Course Portal. You'll have immediate access to all lessons after enrollment." },
    { q: "9. Is there a refund policy?", a: "Please contact our support team within 7 days of purchase if you are unsatisfied. Refunds are assessed on a case-by-case basis." },
  ];

  return (
    <section className="mc-faq-section" id="mc-faq">
      <div className="mc-section-heading">
        <p className="mc-eyebrow">NEED A LITTLE CLARITY?</p>
        <h2>Frequently Asked <span>Questions</span></h2>
        <p>Everything you need to know about our courses and learning methodology.</p>
      </div>
      <div className="mc-faq-list">
        {faqs.map((f, i) => (
          <MCFAQItem key={i} q={f.q} a={f.a} />
        ))}
      </div>
    </section>
  );
}

function MCFAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="mc-faq-item">
      <button aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {q}
        <span>⌄</span>
      </button>
      <div className="mc-faq-answer">{a}</div>
    </article>
  );
}

// ── Sticky Mobile Bar ─────────────────────────────────────────────────────────

function StickyBuyBar({ course, courseId, buying, onBuy }: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  if (!visible) return null;

  const hasPrice = course.price != null && Number(course.price) > 0;
  const razorpayOn = isRazorpayEnabled(course);
  const origPrice = course.originalPrice != null ? Number(course.originalPrice) : null;

  return (
    <div className="mc-sticky-bar lg:hidden">
      <div className="mc-sticky-bar-inner">
        <div className="mc-sticky-title">{course.title}</div>
        {hasPrice && !course.hasAccess && (
          <div>
            <span className="mc-sticky-price">₹{Number(course.price).toLocaleString("en-IN")}</span>
            {origPrice && origPrice > Number(course.price) && (
              <span className="mc-sticky-orig">₹{origPrice.toLocaleString("en-IN")}</span>
            )}
          </div>
        )}
        {course.hasAccess ? (
          <button className="mc-btn mc-btn-green" style={{ padding: "10px 16px", fontSize: "10px" }} onClick={() => router.push(`/learning/${courseId}`)}>
            Continue →
          </button>
        ) : hasPrice && razorpayOn ? (
          <button className="mc-btn mc-btn-red" style={{ padding: "10px 16px", fontSize: "10px" }} disabled={buying} onClick={onBuy}>
            {buying ? "…" : "Buy Now"}
          </button>
        ) : (
          <button className="mc-btn mc-btn-red" style={{ padding: "10px 16px", fontSize: "10px" }} onClick={() => router.push(`/learning/${courseId}`)}>
            Start →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoursePurchasePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const { data: course, isLoading } = useCourse(courseId);
  const { data: meData } = useMe();
  const createOrder = useCreateRazorpayOrder();
  const verifyPayment = useVerifyRazorpayPayment();
  const createBundleOrder = useCreateBundleOrder();
  const verifyBundlePayment = useVerifyBundlePayment();
  const createAllAccessOrder = useCreateAllAccessOrder();
  const verifyAllAccessPayment = useVerifyAllAccessPayment();
  const [buying, setBuying] = useState(false);
  const [buyingBundle, setBuyingBundle] = useState(false);
  const [buyingAllAccess, setBuyingAllAccess] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  useEffect(() => {
    if (!course) return;
    const c = course as any;
    const needsRazorpay =
      (c.price && Number(c.price) > 0) ||
      (c.bundlePrice && Number(c.bundlePrice) > 0) ||
      (c.allAccessPrice && Number(c.allAccessPrice) > 0);
    if (!needsRazorpay) return;
    if (document.getElementById("rzp-checkout-js")) return;
    const s = document.createElement("script");
    s.id = "rzp-checkout-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, [course]);

  const handleBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuying(true);
    try {
      const orderRes = await createOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;
      const c = course as any;
      const options: any = {
        key: keyId, amount, currency, order_id: orderId,
        name: "Tamil Business Tribe",
        description: c?.title ?? "Course Purchase",
        image: c?.thumbnailUrl ?? undefined,
        handler: async (response: any) => {
          setBuying(false);
          try {
            await verifyPayment.mutateAsync({
              courseId,
              razorpayOrderId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentRecordId,
            });
            const paid = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `Payment of ${paid} successful! Check your WhatsApp for confirmation. Ref: ${response.razorpay_payment_id}`,
              { duration: 8000 }
            );
            router.push(`/learning/${courseId}`);
          } catch {
            toast.error(
              `Payment received but verification failed. Keep your payment ID ${response.razorpay_payment_id} and contact support.`,
              { duration: 10000 }
            );
            setBuying(false);
          }
        },
        prefill: { name: (meData as any)?.name ?? "", contact: (meData as any)?.phone ?? "" },
        theme: { color: "#dc2626" },
        modal: { ondismiss: () => setBuying(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuying(false);
        toast.error(
          resp?.error?.description ?? resp?.error?.reason ?? "Payment failed. Please try again.",
          { duration: 6000 }
        );
      });
      rzp.open();
    } catch (e: any) {
      setBuying(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  const handleBundleBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuyingBundle(true);
    try {
      const orderRes = await createBundleOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;
      const c = course as any;
      const options: any = {
        key: keyId, amount, currency, order_id: orderId,
        name: "Tamil Business Tribe",
        description: "Curated Bundle",
        image: c?.thumbnailUrl ?? undefined,
        handler: async (response: any) => {
          setBuyingBundle(false);
          try {
            await verifyBundlePayment.mutateAsync({
              courseId,
              razorpayOrderId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentRecordId,
            });
            const paid = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `Bundle payment of ${paid} successful! Ref: ${response.razorpay_payment_id}`,
              { duration: 8000 }
            );
            router.push(`/learning/${courseId}`);
          } catch {
            toast.error(
              `Payment received but verification failed. Keep ID ${response.razorpay_payment_id} and contact support.`,
              { duration: 10000 }
            );
            setBuyingBundle(false);
          }
        },
        prefill: { name: (meData as any)?.name ?? "", contact: (meData as any)?.phone ?? "" },
        theme: { color: "#dc2626" },
        modal: { ondismiss: () => setBuyingBundle(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuyingBundle(false);
        toast.error(
          resp?.error?.description ?? resp?.error?.reason ?? "Payment failed. Please try again.",
          { duration: 6000 }
        );
      });
      rzp.open();
    } catch (e: any) {
      setBuyingBundle(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  const handleAllAccessBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuyingAllAccess(true);
    try {
      const orderRes = await createAllAccessOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;
      const c = course as any;
      const options: any = {
        key: keyId, amount, currency, order_id: orderId,
        name: "Tamil Business Tribe",
        description: "All-Access Package",
        image: c?.thumbnailUrl ?? undefined,
        handler: async (response: any) => {
          setBuyingAllAccess(false);
          try {
            await verifyAllAccessPayment.mutateAsync({
              courseId,
              razorpayOrderId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentRecordId,
            });
            const paid = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `All-Access payment of ${paid} successful! Ref: ${response.razorpay_payment_id}`,
              { duration: 8000 }
            );
            router.push(`/learning/${courseId}`);
          } catch {
            toast.error(
              `Payment received but verification failed. Keep ID ${response.razorpay_payment_id} and contact support.`,
              { duration: 10000 }
            );
            setBuyingAllAccess(false);
          }
        },
        prefill: { name: (meData as any)?.name ?? "", contact: (meData as any)?.phone ?? "" },
        theme: { color: "#dc2626" },
        modal: { ondismiss: () => setBuyingAllAccess(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuyingAllAccess(false);
        toast.error(
          resp?.error?.description ?? resp?.error?.reason ?? "Payment failed. Please try again.",
          { duration: 6000 }
        );
      });
      rzp.open();
    } catch (e: any) {
      setBuyingAllAccess(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <BookOpen size={40} style={{ color: "var(--color-text-subtle)" }} />
        <p style={{ color: "var(--color-text-secondary)" }}>Course not found.</p>
        <button onClick={() => router.push("/courses")} style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: "14px" }}>
          ← Back to Courses
        </button>
      </div>
    );
  }

  const c = course as any;
  const related = [...(c.upsellCourses ?? []), ...(c.crossSellCourses ?? [])].filter(
    (x: any, i: number, arr: any[]) => arr.findIndex((y: any) => y.id === x.id) === i
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MC_CSS }} />
      <div
        className="mc-page"
        style={{
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          width: "100vw",
          marginTop: "-1.5rem",
        }}
      >
        <MCHeroSection
          course={c}
          courseId={courseId}
          buying={buying}
          onBuy={handleBuy}
          onVideoPreview={() => setVideoModalOpen(true)}
        />
        <MCTickerSection course={c} />
        <MCCurriculumSection course={c} />
        {related.length > 0 && <MCRelatedSection courses={related} />}
        <MCPlansSection
          course={c}
          courseId={courseId}
          buying={buying}
          onBuy={handleBuy}
          buyingBundle={buyingBundle}
          onBuyBundle={handleBundleBuy}
          buyingAllAccess={buyingAllAccess}
          onBuyAllAccess={handleAllAccessBuy}
        />
        <MCEarningSection course={c} onBuy={handleBuy} />
        <MCQuoteSection course={c} onBuy={handleBuy} />
        <MCFAQSection course={c} />
        <div style={{ height: "5rem" }} className="lg:hidden" />
      </div>

      {videoModalOpen && (
        <MCVideoModal
          url={c.videoPreviewUrl ?? null}
          onClose={() => setVideoModalOpen(false)}
        />
      )}

      <StickyBuyBar course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
    </>
  );
}
