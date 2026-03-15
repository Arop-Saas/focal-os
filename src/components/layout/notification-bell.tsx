"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const pathname = usePathname();
  const isActive = pathname === "/notifications";

  const { data, refetch } = api.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
  });

  const markAllRead = api.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  // Mark all read when the notifications page is open
  useEffect(() => {
    if (isActive && (data?.count ?? 0) > 0) {
      markAllRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const unread = data?.count ?? 0;

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all",
        isActive
          ? "bg-white/[0.08] text-white"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-blue-400" />
      )}
      <div className="relative shrink-0">
        <Bell
          className={cn(
            "h-[15px] w-[15px] transition-colors",
            isActive ? "text-blue-400" : "text-slate-500"
          )}
        />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      Notifications
      {unread > 0 && (
        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] font-semibold text-red-400">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
