import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "FocalOS",
  description: "Your shoots, uploads, and schedule — all in one place.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FocalOS",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#111827",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-root" style={{ WebkitTapHighlightColor: "transparent" }}>
      {children}
    </div>
  );
}
