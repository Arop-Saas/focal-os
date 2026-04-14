import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { TRPC_URL } from "@/constants/config";
import { useAppStore } from "@/lib/store";

// ─── tRPC type import ────────────────────────────────────────────────────────
// The AppRouter type comes from the web app's tRPC root router.
// In a monorepo you'd import directly; for now we use `any` and will
// add a shared types package later.
// import type { AppRouter } from "../../../src/server/routers/_app";

type AppRouter = any;

export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        async headers() {
          const token = useAppStore.getState().accessToken;
          return {
            authorization: token ? `Bearer ${token}` : "",
          };
        },
      }),
    ],
  });
}
