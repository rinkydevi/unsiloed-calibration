"use client";

import { useState, useEffect } from "react";
import { getAllSchemas, BUILTIN_SCHEMAS } from "@/lib/schemas";
import type { DocSchema } from "@/lib/schemas";

/**
 * Returns all schemas (builtins + user custom) and refreshes when any
 * custom schema is saved or deleted in the same browser tab.
 */
export function useSchemas(): DocSchema[] {
  const [schemas, setSchemas] = useState<DocSchema[]>(() =>
    Object.values(BUILTIN_SCHEMAS)
  );

  useEffect(() => {
    const refresh = () => setSchemas(getAllSchemas());
    refresh(); // pick up custom schemas on mount
    window.addEventListener("unsiloed-schemas-changed", refresh);
    window.addEventListener("storage", refresh); // cross-tab sync
    return () => {
      window.removeEventListener("unsiloed-schemas-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return schemas;
}
