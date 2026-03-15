"use client";

export function PrintButton({ brandColor }: { brandColor: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ background: brandColor, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
    >
      🖨️ Print / Save as PDF
    </button>
  );
}
