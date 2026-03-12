import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { generateInvoiceNumber } from "@/lib/utils";

export const invoicesRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z
          .enum(["DRAFT", "SENT", "VIEWED", "PARTIAL", "PAID", "OVERDUE", "VOID"])
          .optional(),
        clientId: z.string().optional(),
        search: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, ...filters } = input;
      const skip = (page - 1) * limit;

      const where = {
        workspaceId: ctx.workspace.id,
        ...(filters.status && { status: filters.status }),
        ...(filters.clientId && { clientId: filters.clientId }),
        ...(filters.search && {
          OR: [
            { invoiceNumber: { contains: filters.search, mode: "insensitive" as const } },
            {
              client: {
                OR: [
                  { firstName: { contains: filters.search, mode: "insensitive" as const } },
                  { lastName: { contains: filters.search, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        }),
        ...(filters.dateFrom || filters.dateTo
          ? { createdAt: { ...(filters.dateFrom && { gte: filters.dateFrom }), ...(filters.dateTo && { lte: filters.dateTo }) } }
          : {}),
      };

      const [invoices, total] = await Promise.all([
        ctx.prisma.invoice.findMany({
          where,
          include: {
            client: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { id: true, jobNumber: true, propertyAddress: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        ctx.prisma.invoice.count({ where }),
      ]);

      return { invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          client: true,
          job: true,
          lineItems: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      return invoice;
    }),

  create: workspaceProcedure
    .input(
      z.object({
        jobId: z.string().optional(),
        clientId: z.string(),
        lineItems: z.array(
          z.object({
            description: z.string(),
            quantity: z.number().default(1),
            unitPrice: z.number(),
          })
        ),
        taxRate: z.number().default(0),
        discountAmount: z.number().default(0),
        dueAt: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subtotal = input.lineItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );
      const taxAmount = (subtotal * input.taxRate) / 100;
      const totalAmount = subtotal + taxAmount - input.discountAmount;
      const amountDue = totalAmount;

      // Get next invoice number
      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspace.id },
        select: { invoiceNextNumber: true, invoicePrefix: true },
      });
      const invoiceNumber = generateInvoiceNumber(
        ws?.invoicePrefix ?? "INV",
        ws?.invoiceNextNumber ?? 1001
      );

      await ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: { invoiceNextNumber: { increment: 1 } },
      });

      return ctx.prisma.invoice.create({
        data: {
          workspaceId: ctx.workspace.id,
          invoiceNumber,
          clientId: input.clientId,
          jobId: input.jobId,
          subtotal,
          taxRate: input.taxRate,
          taxAmount,
          discountAmount: input.discountAmount,
          totalAmount,
          amountDue,
          dueAt: input.dueAt,
          notes: input.notes,
          status: "DRAFT",
          lineItems: {
            create: input.lineItems.map((item, i) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
              sortOrder: i,
            })),
          },
        },
        include: { lineItems: true, client: true },
      });
    }),

  send: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: { client: true },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already sent." });
      }

      // TODO: Create Stripe payment link
      // TODO: Send email via Resend

      return ctx.prisma.invoice.update({
        where: { id: input.id },
        data: { status: "SENT", issuedAt: new Date() },
      });
    }),

  markPaid: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        amount: z.number(),
        method: z.enum(["CARD", "ACH", "CHECK", "CASH", "WIRE", "OTHER"]).default("CARD"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      const newAmountPaid = invoice.amountPaid + input.amount;
      const newAmountDue = invoice.totalAmount - newAmountPaid;
      const newStatus =
        newAmountDue <= 0
          ? "PAID"
          : newAmountPaid > 0
          ? "PARTIAL"
          : invoice.status;

      return ctx.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            invoiceId: input.id,
            amount: input.amount,
            method: input.method,
            status: "SUCCEEDED",
            notes: input.notes,
            paidAt: new Date(),
          },
        });

        return tx.invoice.update({
          where: { id: input.id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: Math.max(0, newAmountDue),
            status: newStatus,
            paidAt: newStatus === "PAID" ? new Date() : null,
          },
        });
      });
    }),

  void: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status === "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot void a paid invoice." });
      }
      return ctx.prisma.invoice.update({
        where: { id: input.id },
        data: { status: "VOID" },
      });
    }),
});
