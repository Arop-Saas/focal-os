"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/trpc/client";

export function NotificationBell() {
  const pathname = usePathname();
  const isActive = pathname === "/notifications";

  const { data, refetch } = api.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const markAllRead = api.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

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
      title="Notifications"
      className="relative flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
    >
      <Bell className="h-[15px] w-[15px]" />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
