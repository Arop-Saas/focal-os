import { Aperture } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col bg-[#0F2547] text-white p-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <Aperture className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold">Focal OS</span>
        </Link>

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Run your entire photography business from one place.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Scheduling, delivery, invoicing, and team management — built
            specifically for real estate media companies.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: "Jobs managed/month", value: "2,400+" },
              { label: "Average time saved", value: "12 hrs" },
              { label: "Photographer teams", value: "340+" },
              { label: "Photos delivered", value: "1.2M+" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} Focal OS. All rights reserved.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
