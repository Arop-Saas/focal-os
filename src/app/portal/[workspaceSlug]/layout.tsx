import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Access your orders, invoices, and delivered files.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
