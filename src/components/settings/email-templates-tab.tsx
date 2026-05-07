"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/trpc/client";
import {
  Mail, ChevronRight, ArrowLeft, Save, RotateCcw, Loader2, Eye, Code,
  Copy, Check, ToggleLeft, ToggleRight, Variable,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Variable chip: click to insert ──────────────────────────────────────────

function VariableChip({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-mono border border-blue-200 hover:bg-blue-100 transition-colors"
    >
      <Variable className="w-3 h-3" />
      {`{{${name}}}`}
    </button>
  );
}

// ─── Live preview of the email ───────────────────────────────────────────────

function EmailPreview({ subject, body, workspaceName }: { subject: string; body: string; workspaceName: string }) {
  const sampleVars: Record<string, string> = {
    clientName: "Jane Smith",
    jobNumber: "JOB-1042",
    propertyAddress: "123 Main St, Scottsdale AZ",
    scheduledDate: "Monday, April 20",
    scheduledTime: "10:00 AM",
    packageName: "Full Package",
    accessNotes: "Lockbox code: 1234",
    photographerName: "Mike Johnson",
    jobUrl: "#",
    galleryUrl: "#",
    invoiceNumber: "INV-0087",
    amount: "$399.00",
    dueDate: "May 15, 2026",
    paidDate: "April 16, 2026",
    paymentLink: "#",
    portalUrl: "#",
    reason: "Client requested cancellation",
    workspaceName,
  };

  function replaceVars(text: string) {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleVars[key] ?? `{{${key}}}`);
  }

  const renderedSubject = replaceVars(subject);
  const renderedBody = replaceVars(body);

  return (
    <div className="bg-[#f0f4f8] rounded-xl p-4 max-h-[600px] overflow-y-auto">
      {/* Fake email client header */}
      <div className="bg-white rounded-t-lg border border-gray-200 px-4 py-3">
        <div className="text-[11px] text-gray-400 mb-1">Subject</div>
        <div className="text-sm font-medium text-gray-900">{renderedSubject}</div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
          <span>From: {workspaceName} &lt;noreply@yourdomain.com&gt;</span>
          <span>|</span>
          <span>To: jane@example.com</span>
        </div>
      </div>
      {/* Email body */}
      <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 overflow-hidden">
        <div style={{ background: "#1B4F9E", padding: "16px 24px" }}>
          <span style={{ color: "#fff", fontSize: "16px", fontWeight: 700 }}>{workspaceName}</span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", marginLeft: "6px" }}>Real Estate Photography</span>
        </div>
        <div
          className="p-6 text-sm text-gray-700 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_p]:mb-3 [&_p]:leading-relaxed [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: renderedBody }}
        />
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-3">
          <p className="text-[11px] text-gray-400">
            You're receiving this because you have an appointment with {workspaceName}. Questions? Reply to this email.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Template Editor (single template) ───────────────────────────────────────

function TemplateEditor({
  template,
  workspaceName,
  onBack,
}: {
  template: {
    eventType: string;
    label: string;
    description: string;
    variables: string[];
    subject: string;
    body: string;
    enabled: boolean;
    isCustom: boolean;
  };
  workspaceName: string;
  onBack: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const utils = api.useUtils();

  const saveMutation = api.emailTemplates.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      utils.emailTemplates.list.invalidate();
    },
  });

  const toggleMutation = api.emailTemplates.toggle.useMutation({
    onSuccess: () => utils.emailTemplates.list.invalidate(),
  });

  const resetMutation = api.emailTemplates.reset.useMutation({
    onSuccess: (_, variables) => {
      // Refetch and reset fields to defaults
      utils.emailTemplates.list.invalidate();
      utils.emailTemplates.get.invalidate({ eventType: variables.eventType });
      // We need to reset the local state to defaults
      // The parent will re-render with fresh data
      onBack();
    },
  });

  function insertVariable(varName: string) {
    const tag = `{{${varName}}}`;
    if (bodyRef.current) {
      const ta = bodyRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newBody = body.substring(0, start) + tag + body.substring(end);
      setBody(newBody);
      // Restore cursor position
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + tag.length;
        ta.focus();
      }, 0);
    } else {
      setBody((prev) => prev + tag);
    }
  }

  function handleSave() {
    saveMutation.mutate({
      eventType: template.eventType,
      subject,
      body,
      enabled,
    });
  }

  function handleToggle() {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    toggleMutation.mutate({ eventType: template.eventType, enabled: newEnabled });
  }

  function handleReset() {
    if (confirm("Reset this template to the default? Your custom changes will be lost.")) {
      resetMutation.mutate({ eventType: template.eventType });
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{template.label}</h3>
            <p className="text-xs text-gray-500">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleToggle} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", enabled ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200")}>
            {enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            {enabled ? "Enabled" : "Disabled"}
          </button>
          {template.isCustom && (
            <button onClick={handleReset} disabled={resetMutation.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-3 h-3" />
              Reset to Default
            </button>
          )}
        </div>
      </div>

      {/* Variables */}
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Available Variables (click to insert)</p>
        <div className="flex flex-wrap gap-1.5">
          {template.variables.map((v) => (
            <VariableChip key={v} name={v} onClick={() => insertVariable(v)} />
          ))}
        </div>
      </div>

      {/* Edit / Preview toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setMode("edit")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors", mode === "edit" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
          <Code className="w-3 h-3" /> Edit
        </button>
        <button onClick={() => setMode("preview")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors", mode === "preview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
          <Eye className="w-3 h-3" /> Preview
        </button>
      </div>

      {mode === "edit" ? (
        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Email Body (HTML)</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed resize-y"
              placeholder="Email body HTML..."
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Saved!" : "Save Template"}
            </button>
            {saveMutation.isError && (
              <p className="text-xs text-red-500">Failed to save. Please try again.</p>
            )}
          </div>
        </div>
      ) : (
        <EmailPreview subject={subject} body={body} workspaceName={workspaceName} />
      )}
    </div>
  );
}

// ─── Main Email Templates Tab ────────────────────────────────────────────────

export function EmailTemplatesTab({ workspaceName }: { workspaceName: string }) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const { data: templates, isLoading } = api.emailTemplates.list.useQuery();
  const { data: selectedTemplate } = api.emailTemplates.get.useQuery(
    { eventType: selectedEvent! },
    { enabled: !!selectedEvent }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  // Editing a specific template
  if (selectedEvent && selectedTemplate) {
    return (
      <TemplateEditor
        key={selectedEvent}
        template={selectedTemplate}
        workspaceName={workspaceName}
        onBack={() => setSelectedEvent(null)}
      />
    );
  }

  // Template list
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-sm text-gray-500">
            Customize the emails sent to clients and staff for each event. Use dynamic variables like{" "}
            <code className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{"{{clientName}}"}</code>{" "}
            to personalize content.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {templates?.map((t) => (
          <button
            key={t.eventType}
            onClick={() => setSelectedEvent(t.eventType)}
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group"
          >
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", t.enabled ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400")}>
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{t.label}</span>
                {t.isCustom && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Customized</span>}
                {!t.enabled && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Disabled</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
