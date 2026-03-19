"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function ConfirmEmailContent() {
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
    <div className="space-y-6 text-center">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20">
          <Mail className="h-8 w-8 text-blue-400" />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Check your inbox</h2>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          We sent a confirmation link to{" "}
          {email && <span className="font-semibold text-gray-300">{email}</span>}.
          <br />Click the link to activate your account.
        </p>
      </div>

      {/* Tips box */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4 space-y-2 text-left">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Didn&apos;t get it?</p>
        <ul className="text-[12px] text-gray-600 space-y-1.5">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-gray-700">·</span>Check your spam or junk folder</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-gray-700">·</span>Make sure you entered the right email</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-gray-700">·</span>It may take a minute or two to arrive</li>
        </ul>
      </div>

      {/* Resend button */}
      {status === "sent" ? (
        <div className="flex items-center justify-center gap-2 text-[13px] text-green-400 font-medium">
          <CheckCircle className="h-4 w-4" />
          Email resent — check your inbox
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={status === "loading" || !email}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-40"
        >
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "loading" ? "Sending…" : "Resend confirmation email"}
        </button>
      )}

      {status === "error" && (
        <p className="text-[12px] text-red-400">{errorMsg}</p>
      )}

      {/* Footer link */}
      <p className="text-[13px] text-gray-600">
        Wrong email?{" "}
        <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
          Sign up again
        </Link>
        {" · "}
        <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense>
      <ConfirmEmailContent />
    </Suspense>
  );
}
