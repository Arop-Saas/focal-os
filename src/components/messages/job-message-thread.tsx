"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/trpc/client";
import { format } from "date-fns";
import { Send, MessageSquare, Loader2 } from "lucide-react";

interface Props {
  jobId: string;
}

export function JobMessageThread({ jobId }: Props) {
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, refetch } = api.messages.list.useQuery({ jobId });
  const markRead = api.messages.markRead.useMutation();
  const sendMutation = api.messages.send.useMutation({
    onSuccess: () => {
      setBody("");
      refetch();
    },
  });

  // Mark client messages read when staff views thread
  useEffect(() => {
    if (messages.some((m) => m.senderType === "CLIENT" && !m.readAt)) {
      markRead.mutate({ jobId });
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!body.trim()) return;
    sendMutation.mutate({ jobId, body: body.trim() });
  }

  return (
    <div className="bg-white rounded-xl border flex flex-col" style={{ height: "420px" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b shrink-0">
        <MessageSquare className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold text-gray-800">Client Messages</span>
        {messages.some((m) => m.senderType === "CLIENT" && !m.readAt) && (
          <span className="ml-auto h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300 mt-0.5">Send a message to your client</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isStaff = msg.senderType === "STAFF";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    isStaff
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.body}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {msg.senderName} · {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 flex items-end gap-2 shrink-0">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message your client..."
          rows={2}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sendMutation.isPending}
          className="h-9 w-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors shrink-0"
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
