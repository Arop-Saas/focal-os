"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleResend() {
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
          <Mail className="h-8 w-8 text-blue-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Check your inbox</h2>
        <p className="text-[13px] text-gray-400 leading-relaxed">
          We sent a confirmation link to{" "}
          {email && <span className="font-semibold text-white">{email}</span>}.
          Click the link in the email to activate your account.
        </p>
      </div>

      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-5 py-4 space-y-1.5 text-left">
        <p className="text-[12px] font-medium text-gray-300">Didn&apos;t get the email?</p>
        <ul className="text-[12px] text-gray-500 space-y-1 list-disc list-inside">
          <li>Check your spam or junk folder</li>
          <li>Make sure you entered the right email address</li>
          <li>It may take a minute or two to arrive</li>
        </ul>
      </div>

      {status === "sent" ? (
        <div className="flex items-center justify-center gap-2 text-[13px] text-green-400">
          <CheckCircle className="h-4 w-4" />
          Email resent — check your inbox
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={status === "loading" || !email}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.08] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
        >
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "loading" ? "Sending…" : "Resend confirmation email"}
        </button>
      )}

      {status === "error" && (
        <p className="text-[12px] text-red-400">{errorMsg}</p>
      )}

      <p className="text-center text-[13px] text-gray-500">
        Wrong email?{" "}
        <Link
          href="/register"
          className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          Sign up again
        </Link>
      </p>
    </div>
  );
}
