"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const confirmed = searchParams.get("confirmed") === "true";
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        router.push(`/confirm-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      setServerError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : error.message
      );
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Welcome back</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sign in to your account to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {confirmed && (
          <div className="flex items-center gap-2.5 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-[13px] text-green-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Email confirmed! Sign in to get started.
          </div>
        )}
        {serverError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-300">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          {errors.email && (
            <p className="text-[11px] text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[13px] font-medium text-gray-300">Password</label>
            <Link href="/forgot-password" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[11px] text-red-400">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 text-white font-semibold py-2.5 text-sm transition-all disabled:opacity-50 mt-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-[13px] text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
          Start free trial
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
