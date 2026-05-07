"use client";

import { api } from "@/lib/trpc/client";

export function MessagesUnreadBadge() {
  const { data } = api.messages.totalUnread.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const count = data?.count ?? 0;
  if (count === 0) return null;

  return (
    <span className="ml-auto h-4 min-w-[16px] px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}
