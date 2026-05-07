"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

interface PortalInviteButtonProps {
  clientId: string;
}

type State = "idle" | "loading" | "sent" | "error";

export function PortalInviteButton({ clientId }: PortalInviteButtonProps) {
  const [state, setState] = useState<State>("idle");

  async function handleInvite() {
    setState("loading");
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) throw new Error("Failed");
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Invite sent!
        </div>
        <button
          onClick={() => setState("idle")}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Resend
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-red-600">Failed to send. Try again.</span>
        <Button variant="outline" size="sm" onClick={handleInvite}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleInvite}
      disabled={state === "loading"}
      className="gap-2"
    >
      {state === "loading" ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending…
        </>
      ) : (
        <>
          <Send className="w-4 h-4" />
          Invite to Portal
        </>
      )}
    </Button>
  );
}
