import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

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
    }
  }

  return {
    supabaseUser,
    user,
    workspace,
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
    },
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(enforceAuthenticated);
export const workspaceProcedure = t.procedure.use(enforceWorkspace);
export const createCallerFactory = t.createCallerFactory;
