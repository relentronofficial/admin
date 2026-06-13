"use client";

import Image from "next/image";
import { useUserProducts } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Product } from "@/types";
import { ShoppingBag, Tag } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  book: "Book",
  apparel: "Apparel",
  digital: "Digital",
  other: "Other",
  general: "General",
};

const STOCK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  in_stock:    { label: "In Stock",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  out_of_stock:{ label: "Out of Stock",color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  pre_order:   { label: "Pre-Order",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

function formatPrice(price: number | null | undefined, currency = "INR") {
  if (!price && price !== 0) return null;
  if (currency === "INR") return `₹${price.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${price.toLocaleString("en-US")}`;
  return `${currency} ${price}`;
}

function ProductCard({ product }: { product: Product }) {
  const stock = STOCK_CONFIG[product.stockStatus ?? "in_stock"] ?? STOCK_CONFIG.in_stock;
  const priceStr = formatPrice(product.price, product.currency);
  const categoryLabel = product.category ? (CATEGORY_LABELS[product.category] ?? product.category) : null;

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
            <span
              className="text-2xl font-black tracking-tight"
              style={{ color: "var(--color-accent, #dc2626)" }}
            >
              {priceStr}
            </span>
          </div>
        )}

        {/* CTAs */}
        {product.ctas.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-auto">
            {product.ctas.map((cta, i) => (
              <a
                key={i}
                href={product.stockStatus === "out_of_stock" ? undefined : cta.url}
                target={cta.openInNewTab ? "_blank" : "_self"}
                rel="noopener noreferrer"
                aria-disabled={product.stockStatus === "out_of_stock"}
                onClick={product.stockStatus === "out_of_stock" ? (e) => e.preventDefault() : undefined}
                className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={
                  product.stockStatus === "out_of_stock"
                    ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", cursor: "not-allowed" }
                    : cta.type === "primary"
                    ? { background: "var(--color-accent)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }
                }
              >
                {product.stockStatus === "out_of_stock" && cta.type === "primary" ? "Unavailable" : cta.label}
              </a>
            ))}
          </div>
        )}
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
  const { uiStrings } = useSiteConfig();

  if (isLoading) return <ProductsSkeleton />;

  const products = data?.products ?? [];

  return (
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
            <ProductCard key={p.id} product={p} />
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
  );
}
