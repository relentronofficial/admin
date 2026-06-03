"use client";

import Image from "next/image";
import { useUserProducts } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Product } from "@/types";

// Default diagonal teal→purple gradient used when API doesn't supply pageBg
const DEFAULT_GRADIENT =
  "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)";

function ProductCard({ product }: { product: Product }) {
  return (
    <div
      className="rounded-2xl flex flex-col flex-1 min-w-[240px] max-w-sm overflow-hidden"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)" }}
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
          <p className="text-sm text-white/70 flex-1 mb-5 leading-relaxed">
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
                      background: "rgba(255,255,255,0.12)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.25)",
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
    <div
      className="-mx-4 md:-mx-6 -my-6 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center"
      style={{ background: DEFAULT_GRADIENT }}
    >
      <div className="w-48 h-8 rounded-lg animate-pulse bg-white/20 mb-10" />
      <div className="flex gap-6 px-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="w-72 h-64 rounded-2xl animate-pulse"
            style={{ background: "rgba(0,0,0,0.3)" }}
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

  const bg = data?.pageBg || DEFAULT_GRADIENT;
  const products = data?.products ?? [];

  return (
    // Negative margins break out of the platform layout's padding so the
    // gradient fills edge-to-edge within the content area.
    <div
      className="-mx-4 md:-mx-6 -my-6 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-16"
      style={{ background: bg }}
    >
      {/* Page heading — large white text */}
      {data?.pageTitle && (
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white text-center mb-12 tracking-tight max-w-2xl">
          {data.pageTitle}
        </h1>
      )}

      {/* Product cards — horizontal row, wrap on small screens */}
      {products.length > 0 ? (
        <div className="flex flex-row flex-wrap justify-center gap-6 w-full max-w-4xl">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="text-white/60 text-sm">{uiStrings?.loading}</p>
      )}
    </div>
  );
}
