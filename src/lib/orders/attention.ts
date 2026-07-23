import type { InvoiceStatus, ProductionStatus } from "@prisma/client";
import { computeOrderStage, type OrderStage, type StageInput } from "./stage";

/**
 * "What must happen now?" — derives the single next action for an order and
 * the list of attention reasons (non-empty = shows in Needs Attention).
 * Exception-first: quiet when work is on track, loud only for blockers.
 * Every reason is backed by real data — nothing speculative.
 */

export interface AttentionInput extends Omit<StageInput, "productionTasks"> {
  productionTasks?: { status: ProductionStatus; dueAt?: Date | string | null }[];
  hasAssignment: boolean;
  accessNotes?: string | null;
  createdAt: Date;
  /** evaluation time — pass once so a whole list renders consistently */
  now: Date;
}

export interface OrderAttention {
  stage: OrderStage;
  nextAction: string;
  /** human-readable blockers; non-empty ⇒ belongs in Needs Attention */
  attention: string[];
}

const UNPAID: InvoiceStatus[] = ["SENT", "VIEWED", "PARTIAL", "OVERDUE"];

export function computeOrderAttention(input: AttentionInput): OrderAttention {
  const stage = computeOrderStage(input);
  const attention: string[] = [];
  let nextAction = "—";

  const invoiceOverdue = input.invoiceStatus === "OVERDUE";
  const invoiceUnpaid = input.invoiceStatus != null && UNPAID.includes(input.invoiceStatus);
  const shootTime = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const hoursUntilShoot = shootTime ? (shootTime.getTime() - input.now.getTime()) / 36e5 : null;

  switch (stage) {
    case "CANCELLED":
    case "CLOSED":
      return { stage, nextAction: "—", attention: [] };

    case "ON_HOLD":
      attention.push("Order on hold");
      nextAction = "Resolve hold";
      break;

    case "NEEDS_SCHEDULING":
      attention.push("Not scheduled");
      nextAction = "Schedule shoot";
      break;

    case "SCHEDULED": {
      if (!input.hasAssignment) {
        attention.push("No photographer assigned");
        nextAction = "Assign photographer";
      } else if (hoursUntilShoot != null && hoursUntilShoot < -4) {
        // shoot time passed but nothing marked captured
        attention.push("Shoot time passed — confirm capture");
        nextAction = "Confirm capture";
      } else if (hoursUntilShoot != null && hoursUntilShoot <= 48 && !input.accessNotes) {
        attention.push("Missing access info");
        nextAction = "Add access info";
      } else {
        nextAction = "Awaiting shoot day";
      }
      break;
    }

    case "CAPTURE":
      nextAction = "Shoot in progress";
      break;

    case "PRODUCTION": {
      const overdue = (input.productionTasks ?? []).some(
        (t) => t.status !== "READY" && t.dueAt != null && new Date(t.dueAt).getTime() < input.now.getTime()
      );
      if (overdue) {
        attention.push("Production overdue");
        nextAction = "Chase production";
      } else {
        nextAction = "In production";
      }
      break;
    }

    case "QA":
      attention.push("QA review required");
      nextAction = "Review QA";
      break;

    case "READY": {
      if (invoiceOverdue) {
        attention.push("Ready — invoice overdue");
        nextAction = "Collect payment";
      } else if (invoiceUnpaid) {
        attention.push("Ready — awaiting payment");
        nextAction = "Collect payment";
      } else {
        attention.push("Ready to deliver");
        nextAction = "Deliver to client";
      }
      break;
    }

    case "DELIVERED": {
      if (invoiceOverdue) {
        attention.push("Invoice overdue");
        nextAction = "Chase payment";
      } else if (invoiceUnpaid) {
        nextAction = "Awaiting payment";
      } else {
        nextAction = "Complete";
      }
      break;
    }
  }

  return { stage, nextAction, attention };
}
