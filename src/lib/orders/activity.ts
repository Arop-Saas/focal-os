import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Order activity log — ONE helper every mutation calls so the order timeline
 * is complete and consistent. Messages are written as plain human sentences
 * (the timeline renders them verbatim).
 *
 * Collapse: rapid repeats (bulk photo uploads, raw drops) fold into a single
 * row — pass a collapseKey and a plural message builder; repeats within the
 * window increment the row instead of flooding the feed.
 */
export async function logOrderActivity(
  db: Db,
  args: {
    workspaceId: string;
    jobId: string;
    userId?: string | null;
    message: string;
    collapseKey?: string;
    /** message when n>1 events collapsed, e.g. (n) => `${n} photos uploaded` */
    plural?: (n: number) => string;
    collapseWindowMins?: number;
  }
): Promise<void> {
  try {
    if (args.collapseKey) {
      const windowMs = (args.collapseWindowMins ?? 10) * 60_000;
      const recent = await db.activityLog.findFirst({
        where: {
          workspaceId: args.workspaceId,
          entityType: "job",
          entityId: args.jobId,
          createdAt: { gte: new Date(Date.now() - windowMs) },
        },
        orderBy: { createdAt: "desc" },
      });
      const meta = recent?.metadata as { collapseKey?: string; count?: number } | null;
      if (recent && meta?.collapseKey === args.collapseKey) {
        const count = (meta.count ?? 1) + 1;
        await db.activityLog.update({
          where: { id: recent.id },
          data: {
            action: args.plural ? args.plural(count) : `${args.message} (×${count})`,
            metadata: { collapseKey: args.collapseKey, count },
            createdAt: new Date(),
          },
        });
        return;
      }
    }

    await db.activityLog.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId ?? undefined,
        action: args.message,
        entityType: "job",
        entityId: args.jobId,
        ...(args.collapseKey ? { metadata: { collapseKey: args.collapseKey, count: 1 } } : {}),
      },
    });
  } catch (e) {
    // Logging must never break a mutation
    console.error("logOrderActivity failed:", e);
  }
}
