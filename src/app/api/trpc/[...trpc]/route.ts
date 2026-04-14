export const dynamic = 'force-dynamic';
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

const handler = (req: NextRequest) => {
  // Extract the Authorization header BEFORE passing to fetchRequestHandler.
  // Next.js / tRPC can strip headers during request processing, so we
  // capture it here and pass it explicitly to the context.
  const authHeader = req.headers.get("authorization");
  console.log(`[Route Handler] Authorization header: ${authHeader ? "present" : "missing"}`);

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req, authHeader }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`❌ tRPC error on ${path ?? "<no-path>"}: ${error.message}`);
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
