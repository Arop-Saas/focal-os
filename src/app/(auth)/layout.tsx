import { Aperture } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_480px]">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col bg-[#0c1e3d] text-white p-10 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <Aperture className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white">Focal OS</span>
        </Link>

        {/* Hero text */}
        <div className="relative flex-1 flex flex-col justify-center max-w-sm">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">
            Real Estate Photography Platform
          </p>
          <h1 className="text-[32px] font-bold leading-tight text-white mb-4">
            Run your entire photography business from one place.
          </h1>
          <p className="text-slate-400 text-[15px] leading-relaxed">
            Scheduling, delivery, invoicing, and team management — built specifically for real estate media companies.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-5">
            {[
              { label: "Jobs managed / month", value: "2,400+" },
              { label: "Average time saved", value: "12 hrs" },
              { label: "Photographer teams", value: "340+" },
              { label: "Photos delivered", value: "1.2M+" },
            ].map((stat) => (
              <div key={stat.label} className="border border-white/[0.08] rounded-xl p-4">
                <p className="text-[22px] font-bold text-white leading-none">{stat.value}</p>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-slate-600">
          © {new Date().getFullYear()} Focal OS. All rights reserved.
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Aperture className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold text-gray-900">Focal OS</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
