import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { MemberRole } from "@prisma/client";
import { ROLE_HIERARCHY, hasRole } from "@/lib/roles";

export { ROLE_HIERARCHY, hasRole };

// ─── Context ──────────────────────────────────────────────────────────────────

interface CreateContextOptions {
  req?: NextRequest;
}

export async function createTRPCContext(opts: CreateContextOptions) {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

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
