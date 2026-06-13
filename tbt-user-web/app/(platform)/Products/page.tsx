"use client";

import { useState } from "react";
import Image from "next/image";
import { useUserProducts, useSubmitProductInquiry } from "@/lib/hooks/useConfig";
import { useMe } from "@/lib/hooks/useUser";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Product } from "@/types";
import { ShoppingBag, Tag, X, CheckCircle, Loader2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  book: "Book",
  apparel: "Apparel",
  digital: "Digital",
  other: "Other",
  general: "General",
};

const STOCK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  in_stock:     { label: "In Stock",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  out_of_stock: { label: "Out of Stock",color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  pre_order:    { label: "Pre-Order",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

function formatPrice(price: number | null | undefined, currency = "INR") {
  if (!price && price !== 0) return null;
  if (currency === "INR") return `₹${price.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${price.toLocaleString("en-US")}`;
  return `${currency} ${price}`;
}

interface InquiryModalProps {
  product: Product;
  memberName: string;
  onClose: () => void;
}

function InquiryModal({ product, memberName, onClose }: InquiryModalProps) {
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitInquiry = useSubmitProductInquiry();

  const handleSubmit = async () => {
    if (submitInquiry.isPending) return;
    try {
      await submitInquiry.mutateAsync({ productId: product.id, message: message.trim() || undefined });
      setSubmitted(true);
    } catch {
      // silent — leave modal open so user can retry
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-bg-surface, #1a1a1a)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {submitted ? (
          /* ── Success state ── */
          <div className="p-8 text-center space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "rgba(34,197,94,0.15)" }}
            >
              <CheckCircle size={32} style={{ color: "#22c55e" }} />
            </div>
            <h3 className="text-xl font-bold text-white">Request Sent!</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              Your request for <span className="text-white font-semibold">{product.title}</span> has been sent to the admin. We will contact you soon!
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-80"
              style={{ background: "var(--color-accent, #dc2626)" }}
            >
              Got it
            </button>
          </div>
        ) : (
          /* ── Inquiry form state ── */
          <>
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div>
                <h3 className="font-bold text-white text-base">Buy Now</h3>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {product.title}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                {product.thumbnailUrl ? (
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                    <Image src={product.thumbnailUrl} alt={product.title} width={56} height={56} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <ShoppingBag size={20} style={{ color: "rgba(255,255,255,0.25)" }} />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white text-sm leading-snug">{product.title}</p>
                  {formatPrice(product.price, product.currency) && (
                    <p className="text-base font-black mt-0.5" style={{ color: "var(--color-accent, #dc2626)" }}>
                      {formatPrice(product.price, product.currency)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Your Name
                </label>
                <div
                  className="w-full rounded-xl px-4 h-11 flex items-center text-sm"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
                >
                  {memberName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Message <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Any questions or special requirements..."
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-accent, #dc2626)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>

              {submitInquiry.isError && (
                <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                  Something went wrong. Please try again.
                </p>
              )}
            </div>

            <div
              className="px-6 py-4 flex gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitInquiry.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-85 disabled:opacity-60"
                style={{ background: "var(--color-accent, #dc2626)" }}
              >
                {submitInquiry.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Sending...</>
                ) : (
                  "Send Request"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onBuyNow,
}: {
  product: Product;
  onBuyNow: (product: Product) => void;
}) {
  const stock = STOCK_CONFIG[product.stockStatus ?? "in_stock"] ?? STOCK_CONFIG.in_stock;
  const priceStr = formatPrice(product.price, product.currency);
  const categoryLabel = product.category ? (CATEGORY_LABELS[product.category] ?? product.category) : null;
  const isUnavailable = product.stockStatus === "out_of_stock";

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden border group transition-all hover:border-white/20"
      style={{ background: "var(--color-bg-surface)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-black/20">
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={40} style={{ color: "rgba(255,255,255,0.12)" }} />
          </div>
        )}

        {/* Category badge — top left */}
        {categoryLabel && (
          <div
            className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)" }}
          >
            <Tag size={10} />
            {categoryLabel}
          </div>
        )}

        {/* Stock badge — top right */}
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ background: stock.bg, color: stock.color, backdropFilter: "blur(8px)" }}
        >
          {stock.label}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-white text-[17px] leading-snug mb-1.5">{product.title}</h3>

        {product.description && (
          <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: "rgba(255,255,255,0.55)" }}>
            {product.description}
          </p>
        )}

        {/* Price */}
        {priceStr && (
          <div className="mb-4">
            <span className="text-2xl font-black tracking-tight" style={{ color: "var(--color-accent, #dc2626)" }}>
              {priceStr}
            </span>
          </div>
        )}

        <div className="mt-auto space-y-2">
          {/* Buy Now button */}
          <button
            onClick={() => !isUnavailable && onBuyNow(product)}
            disabled={isUnavailable}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-85"
            style={{ background: isUnavailable ? "rgba(255,255,255,0.08)" : "var(--color-accent, #dc2626)", color: isUnavailable ? "rgba(255,255,255,0.3)" : "#fff" }}
          >
            {isUnavailable ? "Unavailable" : "Buy Now"}
          </button>

          {/* Extra CTAs (secondary links) */}
          {product.ctas.filter(c => c.type !== "primary").length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.ctas
                .filter(c => c.type !== "primary")
                .map((cta, i) => (
                  <a
                    key={i}
                    href={cta.url}
                    target={cta.openInNewTab ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {cta.label}
                  </a>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-72 rounded-2xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { data, isLoading } = useUserProducts();
  const { data: me } = useMe();
  const { uiStrings } = useSiteConfig();
  const [inquiryProduct, setInquiryProduct] = useState<Product | null>(null);

  if (isLoading) return <ProductsSkeleton />;

  const products = data?.products ?? [];
  const memberName = me ? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || "Member" : "Member";

  return (
    <>
      <div className="space-y-8">
        {data?.pageTitle && (
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{data.pageTitle}</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {products.length} {products.length === 1 ? "item" : "items"} available
            </p>
          </div>
        )}

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onBuyNow={setInquiryProduct} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-3">
            <ShoppingBag size={40} className="mx-auto" style={{ color: "rgba(255,255,255,0.12)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {uiStrings?.loading ?? "No products available"}
            </p>
          </div>
        )}
      </div>

      {inquiryProduct && (
        <InquiryModal
          product={inquiryProduct}
          memberName={memberName}
          onClose={() => setInquiryProduct(null)}
        />
      )}
    </>
  );
}
