/**
 * Shared role utilities — safe to import from both server and client code.
 *
 * Keep this file free of any server-only imports (prisma, next/headers, etc.).
 */
import type { MemberRole } from "@prisma/client";

// Ordered hierarchy — higher index = more privilege
export const ROLE_HIERARCHY: MemberRole[] = [
  "VIEWER",
  "VA",
  "EDITOR",
  "PHOTOGRAPHER",
  "MANAGER",
  "ADMIN",
  "OWNER",
];

/**
 * Returns true if the given role has AT LEAST the required role's privilege level.
 */
export function hasRole(role: MemberRole | null, required: MemberRole): boolean {
  if (!role) return false;
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(required);
}
