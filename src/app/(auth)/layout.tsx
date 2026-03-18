import { Camera } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_480px] bg-[#080808]">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col bg-[#080808] text-white p-10 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-0 w-[600px] h-[500px] bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">scalist</span>
        </Link>

        {/* Hero text */}
        <div className="relative flex-1 flex flex-col justify-center max-w-sm">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">
            Real Estate Photography Platform
          </p>
          <h1 className="text-[32px] font-extrabold leading-tight text-white mb-4 tracking-tight">
            Run your entire photography business from one place.
          </h1>
          <p className="text-gray-500 text-[15px] leading-relaxed">
            Scheduling, delivery, invoicing, and team management — built specifically for real estate media companies.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: "Jobs managed / month", value: "2,400+" },
              { label: "Average time saved", value: "12 hrs" },
              { label: "Photographer teams", value: "340+" },
              { label: "Photos delivered", value: "1.2M+" },
            ].map((stat) => (
              <div key={stat.label} className="border border-white/[0.08] rounded-xl bg-white/[0.03] p-4">
                <p className="text-[22px] font-extrabold text-white leading-none">{stat.value}</p>
                <p className="text-[11px] text-gray-600 mt-1.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-gray-700">
          © {new Date().getFullYear()} Scalist. All rights reserved.
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center p-8 bg-[#0d0d0d] border-l border-white/[0.06]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">scalist</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
