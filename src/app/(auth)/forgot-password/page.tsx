"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Check your inbox</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            We sent a password reset link to{" "}
            <span className="font-medium text-gray-300">{getValues("email")}</span>.
            It may take a minute or two to arrive.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Forgot password?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 text-white font-semibold py-2.5 text-sm transition-all disabled:opacity-50 mt-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}
