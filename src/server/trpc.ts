import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { MemberRole } from "@prisma/client";
import { ROLE_HIERARCHY, hasRole } from "@/lib/roles";
import "@/lib/env"; // validates required env vars on startup

export { ROLE_HIERARCHY, hasRole };

// ─── Context ──────────────────────────────────────────────────────────────────

/**
 * Validate a Supabase JWT by calling the Auth REST API directly.
 * This avoids SSR cookie-client issues when mobile sends a Bearer token.
 */
async function getUserFromBearerToken(jwt: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    }
  );
  if (!res.ok) {
    console.error(`[Bearer Auth] Supabase returned ${res.status} for token validation`);
    return null;
  }
  return res.json();
}

interface CreateContextOptions {
  req?: NextRequest;
}

export async function createTRPCContext(opts: CreateContextOptions) {
  // Mobile clients send Authorization: Bearer <token> instead of cookies.
  // Check the header first; fall back to cookie-based session.
  let supabaseUser = null;
  const authHeader = opts.req?.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    // For Bearer token auth (mobile), call Supabase Auth REST API directly.
    // The SSR cookie-based client and browser client both have issues
    // validating raw JWTs in a server-side context.
    supabaseUser = await getUserFromBearerToken(bearerToken);
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    supabaseUser = data.user;
  }

  let user = null;
  let workspace = null;
  let memberRole: MemberRole | null = null;

  if (supabaseUser) {
    user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: {
        workspaces: {
          include: { workspace: true },
          orderBy: { joinedAt: "asc" },
          take: 1,
        },
      },
    });

    // Auto-create Prisma user on first tRPC request after Supabase signup
    if (!user && supabaseUser.email) {
      user = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email,
          fullName:
            (supabaseUser.user_metadata?.full_name as string | undefined) ??
            supabaseUser.email.split("@")[0],
        },
        include: {
          workspaces: {
            include: { workspace: true },
            orderBy: { joinedAt: "asc" },
            take: 1,
          },
        },
      });
    }

    if (user?.workspaces[0]) {
      workspace = user.workspaces[0].workspace;
      memberRole = user.workspaces[0].role;
    }

    // ── Impersonation override ──────────────────────────────────────────────
    // If a super-admin has set the admin_impersonating cookie, swap the
    // workspace context so all tRPC procedures operate on that workspace.
    if (user?.isSuperAdmin) {
      const cookieHeader = opts.req?.headers.get("cookie") ?? "";
      const match = cookieHeader.match(/admin_impersonating=([^;]+)/);
      const impersonatingId = match?.[1] ?? null;
      if (impersonatingId) {
        const impersonatedWs = await prisma.workspace.findUnique({
          where: { id: impersonatingId },
        });
        if (impersonatedWs) {
          workspace = impersonatedWs;
          memberRole = "OWNER"; // grant full access when impersonating
        }
      }
    }
    // ───────────────────────────────────────────────────────────────────────
  }

  return {
    supabaseUser,
    user,
    workspace,
    memberRole,
    prisma,
    req: opts.req,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// ─── tRPC Init ────────────────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

const enforceAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.supabaseUser || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({
    ctx: {
      ...ctx,
      supabaseUser: ctx.supabaseUser,
      user: ctx.user,
    },
  });
});

const enforceWorkspace = t.middleware(({ ctx, next }) => {
  if (!ctx.supabaseUser || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  if (!ctx.workspace) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No workspace found. Complete onboarding first.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      supabaseUser: ctx.supabaseUser,
      user: ctx.user,
      workspace: ctx.workspace,
      memberRole: ctx.memberRole,
    },
  });
});

/**
 * Role-gate middleware factory. Use this to create role-specific procedures.
 *
 * Example:
 *   export const adminProcedure = workspaceProcedure.use(requireRole("ADMIN"));
 */
function requireRole(minRole: MemberRole) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.workspace || !ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!hasRole(ctx.memberRole, minRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires the ${minRole} role or higher.`,
      });
    }
    return next({ ctx });
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(enforceAuthenticated);
export const workspaceProcedure = t.procedure.use(enforceWorkspace);
export const createCallerFactory = t.createCallerFactory;

// Role-gated procedures — compose these onto workspaceProcedure
export const managerProcedure = workspaceProcedure.use(requireRole("MANAGER"));
export const adminProcedure   = workspaceProcedure.use(requireRole("ADMIN"));
export const ownerProcedure   = workspaceProcedure.use(requireRole("OWNER"));
