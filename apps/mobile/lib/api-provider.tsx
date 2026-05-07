import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, getTrpcClient } from "@/lib/trpc";

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 1000 * 60, // 1 minute
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  const [trpcClient] = useState(() => getTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
