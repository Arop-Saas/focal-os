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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Check your inbox</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            We sent a password reset link to{" "}
            <span className="font-medium text-gray-700">{getValues("email")}</span>.
            It may take a minute or two to arrive.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Forgot password?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-600">
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-700">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
          />
          {errors.email && (
            <p className="text-[11px] text-red-500">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 shadow-sm mt-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Sending\u2026" : "Send reset link"}
        </button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}
