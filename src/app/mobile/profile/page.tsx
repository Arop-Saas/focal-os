"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "../_components/BottomNav";

export default function MobileProfilePage() {
  const router = useRouter();
  const { data: profile, isLoading, error } = trpc.mobile.getProfile.useQuery(undefined, {
    retry: false,
  });

  if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN") {
    router.replace("/mobile/login");
    return null;
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/mobile/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 pt-safe-top">
        <div className="py-4">
          <h1 className="text-xl font-bold text-white">Profile</h1>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : profile ? (
          <>
            {/* Avatar + name */}
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-4 overflow-hidden">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">
                    {profile.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <h2 className="text-white text-lg font-bold">{profile.fullName}</h2>
              {profile.title && (
                <p className="text-gray-400 text-sm mt-0.5">{profile.title}</p>
              )}
            </div>

            {/* Details card */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="divide-y divide-gray-800">
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Email</p>
                    <p className="text-white text-sm">{profile.email}</p>
                  </div>
                </div>

                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Studio</p>
                    <p className="text-white text-sm">{profile.workspaceName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* App info */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                    <span className="text-blue-400 text-xs font-bold">F</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Scalist</p>
                    <p className="text-gray-500 text-xs">Photographer App</p>
                  </div>
                </div>
                <span className="text-gray-600 text-xs">v1.0</span>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-gray-900 border border-red-900/40 text-red-400 rounded-2xl font-semibold text-base transition-colors active:bg-red-900/20 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}
