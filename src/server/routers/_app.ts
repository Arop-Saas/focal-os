import { router } from "../trpc";
import { workspaceRouter } from "./workspace";
import { jobsRouter } from "./jobs";
import { clientsRouter } from "./clients";
import { staffRouter } from "./staff";
import { packagesRouter } from "./packages";
import { invoicesRouter } from "./invoices";
import { schedulingRouter } from "./scheduling";
import { bookingRouter } from "./booking";
import { galleryRouter } from "./gallery";

export const appRouter = router({
  workspace: workspaceRouter,
  jobs: jobsRouter,
  clients: clientsRouter,
  staff: staffRouter,
  packages: packagesRouter,
  invoices: invoicesRouter,
  scheduling: schedulingRouter,
  booking: bookingRouter,
  gallery: galleryRouter,
});

export type AppRouter = typeof appRouter;
