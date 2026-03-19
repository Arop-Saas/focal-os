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
  firstName: z.string().min(1, "Please enter your first name"),
  lastName: z.string().min(1, "Please enter your last name"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms" }),
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
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

    const fullName = `${data.firstName} ${data.lastName}`;

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: fullName, first_name: data.firstName, last_name: data.lastName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    router.push(`/confirm-email?email=${encodeURIComponent(data.email)}`);
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Start your free trial</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          14 days free · No credit card required
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-gray-300">First name</label>
            <input
              {...register("firstName")}
              autoComplete="given-name"
              placeholder="Alex"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            {errors.firstName && <p className="text-[11px] text-red-400">{errors.firstName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-gray-300">Last name</label>
            <input
              {...register("lastName")}
              autoComplete="family-name"
              placeholder="Johnson"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            {errors.lastName && <p className="text-[11px] text-red-400">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-300">Work email</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="alex@yourcompany.com"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          {errors.email && <p className="text-[11px] text-red-400">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-300">Password</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="new-password"
            placeholder="Min. 8 chars, one uppercase, one number"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          {errors.password && <p className="text-[11px] text-red-400">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-300">Confirm password</label>
          <input
            {...register("confirmPassword")}
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          {errors.confirmPassword && <p className="text-[11px] text-red-400">{errors.confirmPassword.message}</p>}
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            {...register("agreeToTerms")}
            type="checkbox"
            id="terms"
            className="mt-0.5 h-4 w-4 rounded border-white/[0.15] bg-white/[0.05] text-blue-500 accent-blue-500"
          />
          <label htmlFor="terms" className="text-[12px] text-gray-500 leading-relaxed">
            I agree to the{" "}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>
          </label>
        </div>
        {errors.agreeToTerms && (
          <p className="text-[11px] text-red-400">{errors.agreeToTerms.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 text-white font-semibold py-2.5 text-sm transition-all disabled:opacity-50 mt-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Creating account…" : "Create free account"}
        </button>
      </form>

      <p className="text-center text-[13px] text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
