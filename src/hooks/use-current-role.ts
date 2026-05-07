"use client";

import { api } from "@/lib/trpc/client";
import { hasRole } from "@/lib/roles";
import type { MemberRole } from "@prisma/client";

/**
 * Returns the current user's workspace role plus convenience helpers.
 *
 * Usage:
 *   const { role, can } = useCurrentRole();
 *   if (can("MANAGER")) { ... }
 */
export function useCurrentRole() {
  const { data, isLoading } = api.workspace.getMyMembership.useQuery(undefined, {
    staleTime: 60_000,   // role rarely changes — cache for 1 min
  });

  const role     = data?.role ?? null;
  const isOwner  = data?.isOwner ?? false;

  function can(minRole: MemberRole): boolean {
    if (isOwner) return true;   // owners can do everything
    return hasRole(role, minRole);
  }

  return { role, isOwner, isLoading, can };
}
