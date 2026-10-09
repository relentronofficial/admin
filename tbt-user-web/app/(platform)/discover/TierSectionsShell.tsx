"use client";

import { useState } from "react";
import type { ContentSection } from "@/types";
import { TbtSections, TierAwareSectionsRefetch } from "./TbtClient";

export function TierSectionsShell({
  initialSections,
}: {
  initialSections: ContentSection[];
}) {
  const [sections, setSections] = useState<ContentSection[]>(initialSections);

  return (
    <>
      {/* Silently upgrades sections when user tier > 1, no loading state shown */}
      <TierAwareSectionsRefetch onSections={setSections} />
      <TbtSections sections={sections} />
    </>
  );
}
