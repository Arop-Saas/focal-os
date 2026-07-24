"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { MessageCircle, Send, Loader2, Search, Inbox } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-700",
  CONFIRMED:   "bg-blue-100 text-blue-700",
  ASSIGNED:    "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  EDITING:     "bg-orange-100 text-orange-700",
  REVIEW:      "bg-pink-100 text-pink-700",
  DELIVERED:   "bg-teal-100 text-teal-700",
  COMPLETED:   "bg-green-100 text-green-700",
  CANCELLED:   "bg-red-100 text-red-500",
  ON_HOLD:     "bg-gray-100 text-gray-600",
};

export function MessagesInbox() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading, refetch } = api.messages.allConversations.useQuery(
    undefined, { refetchInterval: 10_000 }
  );

  const { data: messages = [], refetch: refetchMessages } = api.messages.list.useQuery(
    { jobId: selectedJobId! },
    { enabled: !!selectedJobId, refetchInterval: 5_000 }
  );

  const markReadMutation = api.messages.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const sendMutation = api.messages.send.useMutation({
    onSuccess: () => {
      setReplyText("");
      refetchMessages();
      refetch();
    },
  });

  // Mark as read when opening a thread
  useEffect(() => {
    if (selectedJobId) {
      markReadMutation.mutate({ jobId: selectedJobId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  // Scroll to bottom when messages load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = conversations.filter((c) => {
    if (filter === "unread" && c.unreadCount === 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${c.client?.firstName} ${c.client?.lastName}`.toLowerCase();
      return name.includes(q) || c.propertyAddress.toLowerCase().includes(q) || c.jobNumber.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedConversation = conversations.find((c) => c.jobId === selectedJobId);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  function handleSend() {
    if (!selectedJobId || !replyText.trim()) return;
    sendMutation.mutate({ jobId: selectedJobId, body: replyText.trim() });
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: Conversation list ── */}
      <div className="w-80 shrink-0 border-r bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients or jobs…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 mt-2">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
              >
                {f === "all" ? "All" : `Unread${totalUnread > 0 ? ` (${totalUnread})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Inbox className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {filter === "unread" ? "No unread messages" : "No conversations yet"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "Conversations appear here once a client sends a message."}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.jobId}
                onClick={() => setSelectedJobId(conv.jobId)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors",
                  selectedJobId === conv.jobId
                    ? "bg-blue-50 border-l-2 border-l-blue-500"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                      {conv.client?.firstName[0]}{conv.client?.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        "text-sm leading-tight truncate",
                        conv.unreadCount > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-700"
                      )}>
                        {conv.client?.firstName} {conv.client?.lastName}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate leading-tight">{conv.propertyAddress}</p>
                    </div>
                  </div>
                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {conv.unreadCount > 0 && (
                      <span className="h-4 min-w-[16px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                    {conv.latestMessage && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.latestMessage.createdAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                </div>
                {/* Latest message preview */}
                {conv.latestMessage && (
                  <p className={cn(
                    "text-xs mt-1.5 truncate",
                    conv.unreadCount > 0 && conv.latestMessage.senderType === "CLIENT"
                      ? "text-gray-700 font-medium"
                      : "text-gray-400"
                  )}>
                    {conv.latestMessage.senderType === "STAFF" ? "You: " : ""}
                    {conv.latestMessage.body}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Thread ── */}
      {selectedJobId && selectedConversation ? (
        <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
          {/* Thread header */}
          <div className="bg-white border-b px-5 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {selectedConversation.client?.firstName} {selectedConversation.client?.lastName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-500">{selectedConversation.propertyAddress}</p>
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  JOB_STATUS_COLORS[selectedConversation.status]
                )}>
                  {selectedConversation.status}
                </span>
              </div>
            </div>
            <Link
              href={`/jobs/${selectedJobId}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View job →
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((msg) => {
              const isStaff = msg.senderType === "STAFF";
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2.5", isStaff ? "justify-end" : "justify-start")}
                >
                  {!isStaff && (
                    <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 mt-0.5">
                      {selectedConversation.client?.firstName[0]}
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-3.5 py-2.5",
                    isStaff
                      ? "bg-blue-600 text-white rounded-tr-md"
                      : "bg-white border text-gray-800 rounded-tl-md"
                  )}>
                    <p className="text-sm leading-relaxed">{msg.body}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      isStaff ? "text-blue-200" : "text-gray-400"
                    )}>
                      {msg.senderName} · {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          <div className="bg-white border-t px-4 py-3 flex items-end gap-2 shrink-0">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Reply to client…"
              rows={2}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={!replyText.trim() || sendMutation.isPending}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors shrink-0"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-blue-300" />
          </div>
          <p className="text-base font-semibold text-gray-700">Select a conversation</p>
          <p className="text-sm text-gray-400 mt-1">Choose a conversation on the left to view messages and reply.</p>
        </div>
      )}
    </div>
  );
}
