"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Send, MessageSquare, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface Message {
  id: string;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface Props {
  jobId: string;
  workspaceSlug: string;
  brandColor?: string;
}

export function PortalMessageThread({ jobId, workspaceSlug, brandColor = "#3B82F6" }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/messages?slug=${workspaceSlug}&jobId=${jobId}`);
      if (res.ok) {
        const data: Message[] = await res.json();
        setMessages(data);
        setUnread(0); // marked read server-side on fetch
      }
    } finally {
      setLoading(false);
    }
  }

  // Count unread (staff messages the client hasn't seen)
  async function checkUnread() {
    try {
      const res = await fetch(`/api/portal/messages?slug=${workspaceSlug}&jobId=${jobId}`);
      if (res.ok) {
        const data: Message[] = await res.json();
        const unreadCount = data.filter((m) => m.senderType === "STAFF" && !m.readAt).length;
        setUnread(unreadCount);
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    checkUnread();
  }, []);

  useEffect(() => {
    if (open) {
      fetchMessages();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/portal/messages?slug=${workspaceSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, message: body.trim() }),
      });
      if (res.ok) {
        setBody("");
        await fetchMessages();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors w-full"
      >
        <MessageSquare className="h-4 w-4" style={{ color: brandColor }} />
        <span>Messages</span>
        {unread > 0 && (
          <span
            className="ml-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: brandColor }}
          >
            {unread}
          </span>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Thread */}
      {open && (
        <div className="mt-3 flex flex-col rounded-xl border bg-gray-50 overflow-hidden">
          {/* Messages area */}
          <div className="flex flex-col gap-3 p-3 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">
                No messages yet. Send us a message below!
              </p>
            ) : (
              messages.map((msg) => {
                const isClient = msg.senderType === "CLIENT";
                return (
                  <div key={msg.id} className={`flex flex-col ${isClient ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                        isClient
                          ? "text-white rounded-br-sm"
                          : "bg-white text-gray-800 border rounded-bl-sm"
                      }`}
                      style={isClient ? { backgroundColor: brandColor } : {}}
                    >
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                      {msg.senderName} · {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t bg-white flex items-end gap-2 p-2.5">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={2}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-gray-50"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
            />
            <button
              onClick={handleSend}
              disabled={!body.trim() || sending}
              className="h-9 w-9 flex items-center justify-center text-white rounded-xl disabled:opacity-50 transition-colors shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
