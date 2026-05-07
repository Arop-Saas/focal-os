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
import { notificationsRouter } from "./notifications";
import { availabilityRouter } from "./availability";
import { territoriesRouter } from "./territories";
import { messagesRouter } from "./messages";
import { checklistRouter } from "./checklist";
import { brokeragesRouter } from "./brokerages";
import { teamsRouter } from "./teams";
import { mobileRouter } from "./mobile";
import { orderFormRouter } from "./order-form";
import { couponsRouter } from "./coupons";
import { weatherRouter } from "./weather";
import { emailTemplatesRouter } from "./email-templates";

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
  notifications: notificationsRouter,
  availability: availabilityRouter,
  territories: territoriesRouter,
  messages: messagesRouter,
  checklist: checklistRouter,
  brokerages: brokeragesRouter,
  teams: teamsRouter,
  mobile: mobileRouter,
  orderForm: orderFormRouter,
  coupons: couponsRouter,
  weather: weatherRouter,
  emailTemplates: emailTemplatesRouter,
});

export type AppRouter = typeof appRouter;
