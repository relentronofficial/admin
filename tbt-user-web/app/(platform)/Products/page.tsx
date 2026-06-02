"use client";

import Image from "next/image";
import { useUserProducts } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Product } from "@/types";

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card flex flex-col">
      {product.thumbnailUrl && (
        <div className="aspect-video relative">
          <Image src={product.thumbnailUrl} alt={product.title} fill className="object-cover" />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-foreground mb-2">{product.title}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground flex-1 mb-4">{product.description}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {product.ctas.map((cta, i) => (
            <a
              key={i}
              href={cta.url}
              target={cta.openInNewTab ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 text-white"
              style={{
                background: cta.type === "primary" ? "var(--color-accent)" : "var(--color-bg-surface)",
                border: cta.type === "secondary" ? "1px solid var(--color-accent)" : undefined,
                color: cta.type === "secondary" ? "var(--color-accent)" : "white",
              }}
            >
              {cta.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { data, isLoading } = useUserProducts();
  const { uiStrings } = useSiteConfig();

  if (isLoading)
    return <p className="text-sm text-muted-foreground">{uiStrings?.loading}</p>;

  return (
    <div className="space-y-6">
      <h1
        className="text-2xl font-bold text-foreground py-8 px-6 rounded-2xl text-center"
        style={{ background: data?.pageBg || "var(--color-bg-surface)" }}
      >
        {data?.pageTitle}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(data?.products ?? []).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
