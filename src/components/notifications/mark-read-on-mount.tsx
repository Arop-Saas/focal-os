"use client";

import { useEffect } from "react";
import { api } from "@/lib/trpc/client";

/** Silently marks all in-app notifications as read when this component mounts. */
export function MarkReadOnMount() {
  const markAllRead = api.notifications.markAllRead.useMutation();

  useEffect(() => {
    markAllRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
