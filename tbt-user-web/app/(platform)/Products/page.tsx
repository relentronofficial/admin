"use client";

import Image from "next/image";
import { useUserProducts } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Product } from "@/types";

function ProductCard({ product }: { product: Product }) {
  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden border"
      style={{ background: "var(--color-bg-surface)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {product.thumbnailUrl && (
        <div className="aspect-video relative">
          <Image
            src={product.thumbnailUrl}
            alt={product.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-bold text-white text-lg mb-2">{product.title}</h3>
        {product.description && (
          <p className="text-sm flex-1 mb-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            {product.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {product.ctas.map((cta, i) => (
            <a
              key={i}
              href={cta.url}
              target={cta.openInNewTab ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={
                cta.type === "primary"
                  ? { background: "var(--color-accent)", color: "#fff" }
                  : {
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }
              }
            >
              {cta.label}
            </a>
          ))}
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
          <div
            key={i}
            className="h-64 rounded-2xl animate-pulse"
            style={{ background: "var(--color-bg-surface)" }}
          />
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
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          {data.pageTitle}
        </h1>
      )}

      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-center py-16" style={{ color: "rgba(255,255,255,0.4)" }}>
          {uiStrings?.loading}
        </p>
      )}
    </div>
  );
}
