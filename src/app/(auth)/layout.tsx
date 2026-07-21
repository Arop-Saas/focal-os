import { Camera } from "lucide-react";
import { AuthBrandPanel, AuthFormReveal } from "@/components/auth/auth-brand-panel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_480px] bg-[#080808]">
      {/* Left — animated branding panel */}
      <AuthBrandPanel />

      {/* Right — form panel */}
      <div className="flex items-center justify-center p-8 bg-[#0d0d0d] border-l border-white/[0.06]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">Scalist</span>
          </div>
          <AuthFormReveal>{children}</AuthFormReveal>
        </div>
      </div>
    </div>
  );
}
