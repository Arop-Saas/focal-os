"use client";

import { useEffect } from "react";

/**
 * Triggers window.print() automatically when the page loads.
 * Used on the invoice print page so users can immediately save to PDF.
 */
export function AutoPrint() {
  useEffect(() => {
    // Small delay so the page fully renders before the print dialog opens
    const timer = setTimeout(() => {
      window.print();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
