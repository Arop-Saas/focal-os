"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

const schema = z.object({
  fullName: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms" }),
  }),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Start your free trial</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          14 days free · No credit card required
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-600">
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-700">Full name</label>
          <input
            {...register("fullName")}
            autoComplete="name"
            placeholder="Alex Johnson"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
          />
          {errors.fullName && <p className="text-[11px] text-red-500">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-700">Work email</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="alex@yourcompany.com"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
          />
          {errors.email && <p className="text-[11px] text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-700">Password</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="new-password"
            placeholder="Min. 8 chars, one uppercase, one number"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
          />
          {errors.password && <p className="text-[11px] text-red-500">{errors.password.message}</p>}
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            {...register("agreeToTerms")}
            type="checkbox"
            id="terms"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
          />
          <label htmlFor="terms" className="text-[12px] text-gray-500 leading-relaxed">
            I agree to the{" "}
            <Link href="/terms" className="text-blue-600 hover:text-blue-700 transition-colors">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700 transition-colors">Privacy Policy</Link>
          </label>
        </div>
        {errors.agreeToTerms && (
          <p className="text-[11px] text-red-500">{errors.agreeToTerms.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-60 shadow-sm mt-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Creating account…" : "Create free account"}
        </button>
      </form>

      <p className="text-center text-[13px] text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
