import { router } from "../trpc";
import { workspaceRouter } from "./workspace";
import { jobsRouter } from "./jobs";
import { clientsRouter } from "./clients";
import { staffRouter } from "./staff";
import { packagesRouter } from "./packages";
import { invoicesRouter } from "./invoices";
import { schedulingRouter } from "./scheduling";

export const appRouter = router({
  workspace: workspaceRouter,
  jobs: jobsRouter,
  clients: clientsRouter,
  staff: staffRouter,
  packages: packagesRouter,
  invoices: invoicesRouter,
  scheduling: schedulingRouter,
});

export type AppRouter = typeof appRouter;
