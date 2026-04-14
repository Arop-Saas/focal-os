import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";

import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import { generateJobNumber } from "@/lib/utils";

// ─── Mobile procedure — requires logged-in user with a StaffProfile ──────────

const mobileProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const staffProfile = await ctx.prisma.staffProfile.findFirst({
    where: {
      member: { userId: ctx.user.id },
      isActive: true,
    },
    include: {
      member: { include: { workspace: true } },
    },
  });

  if (!staffProfile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active staff profile found for this account.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      staffProfile,
      workspace: staffProfile.member.workspace,
    },
  });
});

// ─── Admin procedure — requires OWNER, ADMIN, or MANAGER role ────────────────

const ADMIN_ROLES = ["OWNER", "ADMIN", "MANAGER"];

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const member = await ctx.prisma.workspaceMember.findFirst({
    where: {
      userId: ctx.user.id,
      role: { in: ADMIN_ROLES },
    },
    include: { workspace: true },
  });

  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    });
  }

  return next({
    ctx: { ...ctx, member, workspace: member.workspace },
  });
});

// ─── Client procedure — requires logged-in user with a Client record ─────────

const clientProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const client = await ctx.prisma.client.findFirst({
    where: { email: ctx.user.email },
    include: { workspace: true },
  });

  if (!client) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No client profile found for this account.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      client,
      workspace: client.workspace,
    },
  });
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const mobileRouter = router({

  // Detect whether the logged-in user is admin, staff, or a client
  getMyRole: protectedProcedure.query(async ({ ctx }) => {
    // Admin check first (OWNER / ADMIN / MANAGER)
    const adminMember = await ctx.prisma.workspaceMember.findFirst({
      where: { userId: ctx.user.id, role: { in: ADMIN_ROLES } },
      select: { id: true },
    });
    if (adminMember) return { role: "admin" as const };

    // Staff check
    const staffProfile = await ctx.prisma.staffProfile.findFirst({
      where: { member: { userId: ctx.user.id }, isActive: true },
      select: { id: true },
    });
    if (staffProfile) return { role: "staff" as const };

    // Client check
    const client = await ctx.prisma.client.findFirst({
      where: { email: ctx.user.email },
      select: { id: true },
    });
    if (client) return { role: "client" as const };

    return { role: "unknown" as const };
  }),

  // ── Admin portal endpoints ──────────────────────────────────────────────

  // Live overview stats: today's jobs by status, month revenue, staff on field
  getAdminOverview: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [todayJobs, monthInvoices, activeStaff, upcomingJobs] = await Promise.all([
      ctx.prisma.job.findMany({
        where: { workspaceId: ctx.workspace.id, scheduledAt: { gte: todayStart, lte: todayEnd } },
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignments: {
            include: { staff: { include: { member: { include: { user: true } } } } },
            take: 1,
          },
        },
        orderBy: { scheduledAt: "asc" },
      }),
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId: ctx.workspace.id,
          status: { in: ["PAID", "PARTIAL"] },
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amountPaid: true },
      }),
      ctx.prisma.staffProfile.count({
        where: { member: { workspaceId: ctx.workspace.id }, isActive: true },
      }),
      ctx.prisma.job.count({
        where: {
          workspaceId: ctx.workspace.id,
          scheduledAt: { gte: todayEnd },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const job of todayJobs) {
      statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1;
    }

    const mappedJobs = todayJobs.map((j) => ({
      id: j.id, status: j.status, propertyAddress: j.propertyAddress,
      scheduledAt: j.scheduledAt, totalAmount: j.totalAmount,
      client: j.client,
      assignments: j.assignments.map((a) => ({
        staff: { displayName: a.staff.member.user.fullName },
      })),
    }));

    return {
      todayJobs: mappedJobs,
      statusCounts,
      monthRevenue: monthInvoices._sum.amountPaid ?? 0,
      activeStaff,
      upcomingJobs,
      workspaceName: ctx.workspace.name,
    };
  }),

  // All workspace jobs — today + next 14 days
  getAdminJobs: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const jobs = await ctx.prisma.job.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        scheduledAt: { gte: startOfDay(now), lte: endOfDay(addDays(now, 14)) },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        package: { select: { name: true } },
        assignments: {
          include: {
            staff: { include: { member: { include: { user: true } } } },
          },
        },
      },
    });
    return jobs.map((j) => ({
      id: j.id, status: j.status, propertyAddress: j.propertyAddress,
      propertyCity: j.propertyCity, scheduledAt: j.scheduledAt,
      isRush: j.isRush, totalAmount: j.totalAmount,
      client: j.client, package: j.package,
      assignments: j.assignments.map((a) => ({
        role: a.role,
        staff: { displayName: a.staff.member.user.fullName },
      })),
    }));
  }),

  // All active staff with today's job count and clock-in status
  getAdminStaff: adminProcedure.query(async ({ ctx }) => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const staff = await ctx.prisma.staffProfile.findMany({
      where: { workspaceId: ctx.workspace.id, isActive: true },
      include: {
        member: { include: { user: true } },
        jobAssignments: {
          where: { job: { scheduledAt: { gte: todayStart, lte: todayEnd } } },
          include: { job: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return staff.map((s) => {
      const todayAssignments = s.jobAssignments;
      const clockedIn = todayAssignments.some(
        (a) => a.job.actualStartAt && !a.job.actualEndAt
      );
      const currentJob = todayAssignments.find((a) => a.job.actualStartAt && !a.job.actualEndAt)?.job ?? null;
      return {
        id: s.id,
        displayName: s.member.user.fullName,
        title: s.title,
        email: s.member.user.email,
        phone: s.member.user.phone,
        avatarUrl: s.member.user.avatarUrl,
        role: s.member.role,
        todayJobCount: todayAssignments.length,
        clockedIn,
        currentJob: currentJob ? { id: currentJob.id, propertyAddress: currentJob.propertyAddress, status: currentJob.status } : null,
      };
    });
  }),

  // Admin profile
  getAdminProfile: adminProcedure.query(async ({ ctx }) => {
    return {
      email: ctx.user.email,
      role: ctx.member.role,
      workspaceName: ctx.workspace.name,
      workspaceSlug: ctx.workspace.slug,
    };
  }),

  // ── Admin: month overview for calendar (all workspace jobs per day) ──────
  getAdminMonthOverview: adminProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      const monthStart = startOfMonth(new Date(input.year, input.month - 1));
      const monthEnd = endOfMonth(new Date(input.year, input.month - 1));

      const jobs = await ctx.prisma.job.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          scheduledAt: { gte: monthStart, lte: monthEnd },
          status: { notIn: ["CANCELLED"] },
        },
        select: { scheduledAt: true, status: true },
      });

      const days: Record<number, { count: number; statuses: string[] }> = {};
      for (const j of jobs) {
        const day = j.scheduledAt?.getDate();
        if (day) {
          if (!days[day]) days[day] = { count: 0, statuses: [] };
          days[day].count++;
          days[day].statuses.push(j.status);
        }
      }
      return { days };
    }),

  // ── Admin: jobs for a specific date ─────────────────────────────────────
  getAdminJobsByDate: adminProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const date = new Date(input.date);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const jobs = await ctx.prisma.job.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          client: { select: { firstName: true, lastName: true, phone: true } },
          package: { select: { name: true } },
          assignments: {
            include: {
              staff: { include: { member: { include: { user: true } } } },
            },
          },
        },
      });

      return jobs.map((j) => ({
        id: j.id,
        status: j.status,
        propertyAddress: j.propertyAddress,
        propertyCity: j.propertyCity,
        scheduledAt: j.scheduledAt,
        isRush: j.isRush,
        totalAmount: j.totalAmount,
        client: j.client,
        package: j.package,
        assignments: j.assignments.map((a) => ({
          role: a.role,
          staff: { displayName: a.staff.member.user.fullName },
        })),
      }));
    }),

  // ── Client portal endpoints ─────────────────────────────────────────────

  // Client's jobs (all, ordered newest first)
  getClientOrders: clientProcedure.query(async ({ ctx }) => {
    return ctx.prisma.job.findMany({
      where: { clientId: ctx.client.id },
      orderBy: { scheduledAt: "desc" },
      select: {
        id: true,
        propertyAddress: true,
        propertyCity: true,
        propertyState: true,
        scheduledAt: true,
        status: true,
        package: { select: { name: true } },
        assignments: {
          where: { role: "PHOTOGRAPHER" },
          select: { staff: { select: { member: { select: { user: { select: { fullName: true } } } } } } },
          take: 1,
        },
      },
    });
  }),

  // Client's invoices
  getClientInvoices: clientProcedure.query(async ({ ctx }) => {
    return ctx.prisma.invoice.findMany({
      where: { clientId: ctx.client.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        amountDue: true,
        amountPaid: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        paymentLink: true,
        job: { select: { propertyAddress: true } },
      },
    });
  }),

  // Client profile info
  getClientProfile: clientProcedure.query(async ({ ctx }) => {
    return {
      firstName: ctx.client.firstName,
      lastName: ctx.client.lastName,
      email: ctx.client.email,
      phone: ctx.client.phone,
      company: ctx.client.company,
      workspaceName: ctx.workspace.name,
      totalJobs: ctx.client.totalJobs,
    };
  }),

  // Get my assigned jobs — today + next 7 days
  getMyJobs: mobileProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const rangeStart = startOfDay(now);
    const rangeEnd = endOfDay(addDays(now, 7));

    const assignments = await ctx.prisma.jobAssignment.findMany({
      where: {
        staffId: ctx.staffProfile.id,
        job: {
          workspaceId: ctx.workspace.id,
          scheduledAt: { gte: rangeStart, lte: rangeEnd },
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      },
      include: {
        job: {
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true, phone: true, email: true },
            },
            package: { select: { id: true, name: true } },
            services: {
              include: { service: { select: { id: true, name: true } } },
            },
            gallery: { select: { id: true, mediaCount: true, slug: true } },
            assignments: {
              include: {
                staff: {
                  include: {
                    member: {
                      include: {
                        user: { select: { fullName: true, avatarUrl: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { job: { scheduledAt: "asc" } },
    });

    return assignments.map((a) => a.job);
  }),

  // Get single job detail
  getJob: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify this photographer is assigned to the job
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not assigned to this job." });
      }

      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          package: { select: { id: true, name: true } },
          services: {
            include: { service: { select: { id: true, name: true } } },
          },
          gallery: { select: { id: true, mediaCount: true, slug: true } },
          checklist: { orderBy: { sortOrder: "asc" } },
          assignments: {
            include: {
              staff: {
                include: {
                  member: {
                    include: {
                      user: { select: { fullName: true, avatarUrl: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  // Clock in — sets actualStartAt + moves job to IN_PROGRESS
  clockIn: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.actualStartAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Already clocked in." });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: {
          actualStartAt: new Date(),
          status: "IN_PROGRESS",
        },
        select: { id: true, actualStartAt: true, status: true },
      });
    }),

  // Clock out — sets actualEndAt
  clockOut: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (!job.actualStartAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Not clocked in yet." });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { actualEndAt: new Date() },
        select: { id: true, actualStartAt: true, actualEndAt: true },
      });
    }),

  // Mark job complete
  completeJob: mobileProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: {
          status: "EDITING",
          actualEndAt: (await ctx.prisma.job.findUnique({ where: { id: input.jobId }, select: { actualEndAt: true } }))?.actualEndAt ?? new Date(),
        },
        select: { id: true, status: true },
      });
    }),

  // Add/update field note
  saveNote: mobileProcedure
    .input(z.object({ jobId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.jobAssignment.findFirst({
        where: { jobId: input.jobId, staffId: ctx.staffProfile.id },
      });
      if (!assignment) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { internalNotes: input.note },
        select: { id: true, internalNotes: true },
      });
    }),

  // All assigned jobs (no date filter) — for Listings tab
  getAllMyJobs: mobileProcedure.query(async ({ ctx }) => {
    const assignments = await ctx.prisma.jobAssignment.findMany({
      where: {
        staffId: ctx.staffProfile.id,
        job: {
          workspaceId: ctx.workspace.id,
          status: { notIn: ["CANCELLED"] },
        },
      },
      include: {
        job: {
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
            package: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { job: { scheduledAt: "desc" } },
    });
    return assignments.map((a) => a.job);
  }),

  // Unique clients from all assigned jobs — for Customers tab
  getMyClients: mobileProcedure.query(async ({ ctx }) => {
    const assignments = await ctx.prisma.jobAssignment.findMany({
      where: {
        staffId: ctx.staffProfile.id,
        job: { workspaceId: ctx.workspace.id, status: { notIn: ["CANCELLED"] } },
      },
      include: {
        job: {
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            propertyAddress: true,
            client: {
              select: {
                id: true, firstName: true, lastName: true,
                phone: true, email: true, company: true, clientType: true,
              },
            },
          },
        },
      },
    });

    // Deduplicate clients, attach job count + most recent job
    const clientMap = new Map<string, {
      id: string; firstName: string; lastName: string;
      phone: string | null; email: string | null;
      company: string | null; clientType: string;
      jobCount: number; lastJobAt: Date | null; lastAddress: string | null;
    }>();

    for (const a of assignments) {
      const c = a.job.client;
      if (!c) continue;
      const existing = clientMap.get(c.id);
      const jobDate = a.job.scheduledAt;
      if (!existing) {
        clientMap.set(c.id, {
          ...c,
          jobCount: 1,
          lastJobAt: jobDate,
          lastAddress: a.job.propertyAddress,
        });
      } else {
        existing.jobCount += 1;
        if (jobDate && (!existing.lastJobAt || jobDate > existing.lastJobAt)) {
          existing.lastJobAt = jobDate;
          existing.lastAddress = a.job.propertyAddress;
        }
      }
    }

    return Array.from(clientMap.values()).sort((a, b) =>
      a.lastName.localeCompare(b.lastName)
    );
  }),

  // ── Admin: data needed to render the new-job form ────────────────────────
  getJobFormData: adminProcedure.query(async ({ ctx }) => {
    const [clients, packages, staff] = await Promise.all([
      ctx.prisma.client.findMany({
        where: { workspaceId: ctx.workspace.id, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, email: true, company: true },
        orderBy: { lastName: "asc" },
      }),
      ctx.prisma.package.findMany({
        where: { workspaceId: ctx.workspace.id, isActive: true },
        select: {
          id: true, name: true, price: true,
          items: { select: { service: { select: { name: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      }),
      ctx.prisma.staffProfile.findMany({
        where: { workspaceId: ctx.workspace.id, isActive: true },
        select: {
          id: true,
          member: { select: { user: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { clients, packages, staff };
  }),

  // ── Admin: create a new job ───────────────────────────────────────────────
  createJob: adminProcedure
    .input(
      z.object({
        clientId: z.string(),
        packageId: z.string().optional(),
        propertyAddress: z.string().min(5),
        propertyCity: z.string(),
        propertyState: z.string(),
        propertyZip: z.string().optional(),
        propertyType: z
          .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "MULTI_FAMILY", "RENTAL", "NEW_CONSTRUCTION"])
          .default("RESIDENTIAL"),
        squareFootage: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        mlsNumber: z.string().optional(),
        accessNotes: z.string().optional(),
        scheduledAt: z.string().optional(), // ISO string from mobile
        estimatedDurationMins: z.number().default(90),
        internalNotes: z.string().optional(),
        clientNotes: z.string().optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
        isRush: z.boolean().default(false),
        rushFee: z.number().default(0),
        assignedStaffIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { assignedStaffIds, scheduledAt, ...jobData } = input;

      // Resolve package price → subtotal
      let subtotal = 0;
      if (jobData.packageId) {
        const pkg = await ctx.prisma.package.findFirst({
          where: { id: jobData.packageId, workspaceId: ctx.workspace.id },
        });
        if (pkg) subtotal = pkg.price;
      }
      const taxAmount = (subtotal * (ctx.workspace.defaultTaxRate ?? 0)) / 100;
      const totalAmount = subtotal + taxAmount + (jobData.rushFee ?? 0);

      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspace.id },
        select: { invoiceNextNumber: true, invoicePrefix: true },
      });
      const jobNumber = generateJobNumber(
        ws?.invoicePrefix ?? "JOB",
        ws?.invoiceNextNumber ?? 1001
      );

      const job = await ctx.prisma.$transaction(async (tx) => {
        await tx.workspace.update({
          where: { id: ctx.workspace.id },
          data: { invoiceNextNumber: { increment: 1 } },
        });

        const newJob = await tx.job.create({
          data: {
            workspaceId: ctx.workspace.id,
            jobNumber,
            ...jobData,
            packageId: jobData.packageId || null,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            subtotal,
            taxAmount,
            totalAmount,
            status: "PENDING",
          },
        });

        if (assignedStaffIds.length > 0) {
          await tx.jobAssignment.createMany({
            data: assignedStaffIds.map((staffId) => ({
              jobId: newJob.id,
              staffId,
              role: "PHOTOGRAPHER",
            })),
          });
        }

        await tx.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            entityType: "job",
            entityId: newJob.id,
            action: "job.created",
            metadata: { jobNumber, source: "mobile" },
          },
        });

        return newJob;
      });

      return { id: job.id, jobNumber: job.jobNumber };
    }),

  // ── Month overview for calendar (job counts per day) ────────────────────────
  getMonthOverview: mobileProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      const monthStart = startOfMonth(new Date(input.year, input.month - 1));
      const monthEnd = endOfMonth(new Date(input.year, input.month - 1));

      const assignments = await ctx.prisma.jobAssignment.findMany({
        where: {
          staffId: ctx.staffProfile.id,
          job: {
            workspaceId: ctx.workspace.id,
            scheduledAt: { gte: monthStart, lte: monthEnd },
            status: { notIn: ["CANCELLED"] },
          },
        },
        select: {
          job: { select: { scheduledAt: true, status: true } },
        },
      });

      const days: Record<number, { count: number; statuses: string[] }> = {};
      for (const a of assignments) {
        const day = a.job.scheduledAt?.getDate();
        if (day) {
          if (!days[day]) days[day] = { count: 0, statuses: [] };
          days[day].count++;
          days[day].statuses.push(a.job.status);
        }
      }
      return { days };
    }),

  // ── Register push notification token ────────────────────────────────────────
  registerPushToken: mobileProcedure
    .input(z.object({
      token: z.string(),
      platform: z.enum(["ios", "android"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.staffProfile.update({
        where: { id: ctx.staffProfile.id },
        data: {
          pushToken: input.token,
          pushPlatform: input.platform,
        },
      });
      return { success: true };
    }),

  // ── Unregister push notification token (on logout) ──────────────────────────
  unregisterPushToken: mobileProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.staffProfile.update({
      where: { id: ctx.staffProfile.id },
      data: { pushToken: null, pushPlatform: null },
    });
    return { success: true };
  }),

  // ── Get staff profile for profile screen ────────────────────────────────────
  getProfile: mobileProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.staffProfile.findUnique({
      where: { id: ctx.staffProfile.id },
      include: {
        member: { select: { role: true } },
        homeTerritory: { select: { name: true } },
      },
    });

    return {
      id: profile?.id,
      fullName: ctx.user.fullName,
      email: ctx.user.email,
      title: profile?.title,
      phone: profile?.phone,
      avatarUrl: profile?.avatarUrl ?? ctx.user.avatarUrl,
      role: profile?.member?.role,
      workspaceName: ctx.workspace.name,
      workspaceLogo: ctx.workspace.logoUrl,
      homeTerritoryName: profile?.homeTerritory?.name ?? null,
    };
  }),

});
