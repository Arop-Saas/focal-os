"use client";

import { createTRPCReact } from "@trpc/react-query";
import { type AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

// alias used by some components
export const api = trpc;
