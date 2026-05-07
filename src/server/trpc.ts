import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import type { MemberRole } from "@prisma/client";
import { ROLE_HIERARCHY, hasRole } from "@/lib/roles";
import "@/lib/env"; // validates required env vars on startup

export { ROLE_HIERARCHY, hasRole };

// ─── Supabase Admin client for Bearer token validation ──────────────────────
// Uses the service_role key so it can validate any user's JWT server-side
// without needing cookies, localStorage, or REST API calls.
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// ─── Context ──────────────────────────────────────────────────────────────────

interface CreateContextOptions {
  req?: NextRequest;
  authHeader?: string | null;  // Passed explicitly from route handler
}

export async function createTRPCContext(opts: CreateContextOptions) {
  // Mobile clients send Authorization: Bearer <token> instead of cookies.
  // Use the explicitly passed authHeader first (route handler extracts it
  // before tRPC/Next.js can strip it), then fall back to reading from req.
  let supabaseUser = null;
  const authHeader = opts.authHeader ?? opts.req?.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    // Use the admin client to validate the Bearer token from mobile.
    // This works server-side without cookies or localStorage.
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
    if (error) {
      console.error(`[Bearer Auth] Token validation failed: ${error.message}`);
    }
    supabaseUser = data?.user ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    supabaseUser = data.user;
  }

  let user = null;
  let workspace = null;
  let memberRole: MemberRole | null = null;

  if (supabaseUser) {
    console.log(`[tRPC Context] Looking up Prisma user with supabaseId: ${supabaseUser.id}`);
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
    console.log(`[tRPC Context] Prisma user found: ${user ? user.id : "null"}, workspaces: ${user?.workspaces?.length ?? 0}`);

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
