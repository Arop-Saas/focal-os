"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { X, Upload, Download, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_HEADERS = ["firstName", "lastName", "email", "phone", "company", "type"];
const CSV_EXAMPLE_ROWS = [
  ["Jane", "Smith", "jane.smith@realty.com", "587-555-0100", "Smith Realty", "AGENT"],
  ["Mark", "Johnson", "mark.j@broker.com", "780-555-0200", "Johnson Brokerage", "BROKER"],
];
const VALID_TYPES = ["AGENT", "BROKER", "BUILDER", "HOMEOWNER", "PROPERTY_MANAGER", "OTHER"];

function downloadTemplate() {
  const rows = [CSV_HEADERS, ...CSV_EXAMPLE_ROWS];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clients-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

interface ParsedRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  type: "AGENT" | "BROKER" | "BUILDER" | "HOMEOWNER" | "PROPERTY_MANAGER" | "OTHER";
  _rowNum: number;
  _errors: string[];
}

function parseCSV(text: string): { rows: ParsedRow[]; parseErrors: string[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], parseErrors: ["File appears empty or has no data rows."] };

  // Normalize header row
  const rawHeaders = lines[0]
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const colIndex = (names: string[]) => {
    for (const n of names) {
      const i = rawHeaders.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const firstNameCol  = colIndex(["firstname", "first_name", "first name"]);
  const lastNameCol   = colIndex(["lastname", "last_name", "last name"]);
  const emailCol      = colIndex(["email"]);
  const phoneCol      = colIndex(["phone"]);
  const companyCol    = colIndex(["company", "brokerage", "brokerage_name", "brokerage name"]);
  const typeCol       = colIndex(["type", "client type", "clienttype", "role"]);
  const notesCol      = colIndex(["notes", "internal_notes", "internal notes"]);

  const parseErrors: string[] = [];
  if (firstNameCol === -1) parseErrors.push('Missing column: "firstName"');
  if (lastNameCol  === -1) parseErrors.push('Missing column: "lastName"');
  if (emailCol     === -1) parseErrors.push('Missing column: "email"');
  if (parseErrors.length) return { rows: [], parseErrors };

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split respecting quotes
    const cells: string[] = [];
    let inQuote = false;
    let cell = "";
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cells.push(cell.trim()); cell = ""; continue; }
      cell += ch;
    }
    cells.push(cell.trim());

    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

    const firstName = get(firstNameCol);
    const lastName  = get(lastNameCol);
    const email     = get(emailCol).toLowerCase();
    const phone     = get(phoneCol) || undefined;
    const company   = get(companyCol) || undefined;
    const notes     = get(notesCol) || undefined;
    // Normalize Aryeo's "member" role → AGENT; "admin"/"owner" → OTHER
    const rawType   = get(typeCol).toUpperCase()
      .replace("MEMBER", "AGENT")
      .replace("ADMIN", "OTHER")
      .replace("OWNER", "OTHER");
    const type      = VALID_TYPES.includes(rawType) ? rawType as ParsedRow["type"] : "AGENT";

    const rowErrors: string[] = [];
    if (!firstName) rowErrors.push("Missing first name");
    if (!lastName)  rowErrors.push("Missing last name");
    if (!email)     rowErrors.push("Missing email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push("Invalid email");

    rows.push({ firstName, lastName, email, phone, company, notes, type, _rowNum: i + 1, _errors: rowErrors });
  }

  return { rows, parseErrors };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview" | "done";

export function ClientImportModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [duplicateEmails, setDuplicateEmails] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const importMutation = trpc.clients.importCsv.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      utils.clients.list.invalidate();
      onSuccess();
    },
    onError: (err) => alert(err.message),
  });

  // Check for duplicates against existing clients via a lightweight list query
  const checkDuplicatesAndPreview = useCallback(
    async (parsedRows: ParsedRow[], existingEmails: string[]) => {
      const existingSet = new Set(existingEmails.map((e) => e.toLowerCase()));
      const dupes = new Set(
        parsedRows.filter((r) => existingSet.has(r.email)).map((r) => r.email)
      );
      setDuplicateEmails(dupes);
      setStep("preview");
    },
    []
  );

  const { data: existingClients } = trpc.clients.list.useQuery(
    { limit: 2000 },
    { enabled: step === "preview" }
  );

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setParseErrors(["Please upload a .csv file."]);
        return;
      }
      const text = await file.text();
      const { rows: parsed, parseErrors: errs } = parseCSV(text);
      if (errs.length) { setParseErrors(errs); return; }
      setParseErrors([]);
      setRows(parsed);
      // Duplicate check happens after existingClients loads
      const emails = existingClients?.clients.map((c) => c.email) ?? [];
      await checkDuplicatesAndPreview(parsed, emails);
    },
    [existingClients, checkDuplicatesAndPreview]
  );

  // Re-check duplicates when existingClients loads after rows are set
  const prevRowsRef = useRef<ParsedRow[]>([]);
  if (step === "preview" && rows.length > 0 && rows !== prevRowsRef.current && existingClients) {
    prevRowsRef.current = rows;
    const emails = existingClients.clients.map((c) => c.email);
    const existingSet = new Set(emails.map((e) => e.toLowerCase()));
    const dupes = new Set(rows.filter((r) => existingSet.has(r.email)).map((r) => r.email));
    setDuplicateEmails(dupes);
  }

  const validRows   = rows.filter((r) => r._errors.length === 0 && !duplicateEmails.has(r.email));
  const invalidRows = rows.filter((r) => r._errors.length > 0);
  const dupeRows    = rows.filter((r) => r._errors.length === 0 && duplicateEmails.has(r.email));

  const handleImport = () => {
    if (validRows.length === 0) return;
    importMutation.mutate(
      validRows.map(({ firstName, lastName, email, phone, company, notes, type }) => ({
        firstName, lastName, email, phone, company, notes, type,
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {step === "done" ? "Import Complete" : "Import Clients from CSV"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "upload" && "Upload a CSV file to bulk-add clients to your workspace."}
              {step === "preview" && `${rows.length} rows detected — review before importing.`}
              {step === "done" && "Your clients have been added successfully."}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── UPLOAD step ── */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Template download */}
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Download the template first</p>
                    <p className="text-xs text-gray-500">Fill it in with your clients, then upload it here.</p>
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                )}
              >
                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">
                  Drop your CSV here or <span className="text-blue-600">click to browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV files only · Max 500 clients</p>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              </div>

              {/* Required columns reference */}
              <div className="text-xs text-gray-400 bg-gray-50 border rounded-lg px-4 py-3 space-y-1">
                <p className="font-semibold text-gray-600 mb-1">Required columns</p>
                <p><span className="font-medium text-gray-700">firstName, lastName, email</span> — required</p>
                <p><span className="font-medium text-gray-700">phone, company</span> — optional</p>
                <p><span className="font-medium text-gray-700">type</span> — optional · AGENT, BROKER, BUILDER, HOMEOWNER, PROPERTY_MANAGER, OTHER</p>
              </div>

              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1">
                  {parseErrors.map((e, i) => (
                    <p key={i} className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PREVIEW step ── */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {validRows.length} will be imported
                </span>
                {dupeRows.length > 0 && (
                  <span className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {dupeRows.length} duplicate{dupeRows.length !== 1 ? "s" : ""} — will be skipped
                  </span>
                )}
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {invalidRows.length} invalid row{invalidRows.length !== 1 ? "s" : ""} — will be skipped
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">#</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Name</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Email</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Company</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Type</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row) => {
                      const isDupe    = duplicateEmails.has(row.email);
                      const hasErrors = row._errors.length > 0;
                      return (
                        <tr
                          key={`${row._rowNum}-${row.email}`}
                          className={cn(
                            "transition-colors",
                            isDupe    ? "bg-yellow-50" :
                            hasErrors ? "bg-red-50" :
                            "bg-white"
                          )}
                        >
                          <td className="px-3 py-2 text-gray-400">{row._rowNum}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{row.email}</td>
                          <td className="px-3 py-2 text-gray-500">{row.company ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{row.type}</td>
                          <td className="px-3 py-2">
                            {hasErrors ? (
                              <span className="text-red-500 font-medium" title={row._errors.join(", ")}>
                                ✕ {row._errors[0]}
                              </span>
                            ) : isDupe ? (
                              <span className="text-yellow-600 font-medium">⚠ Duplicate</span>
                            ) : (
                              <span className="text-green-600 font-medium">✓ Ready</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DONE step ── */}
          {step === "done" && result && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-2xl font-black text-gray-900 mb-1">{result.imported} clients imported</p>
              {result.skipped > 0 && (
                <p className="text-sm text-gray-400">{result.skipped} duplicate{result.skipped !== 1 ? "s" : ""} skipped</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0">
          {step === "upload" && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Cancel
              </button>
              <p className="text-xs text-gray-400">Upload a CSV file to continue</p>
            </>
          )}
          {step === "preview" && (
            <>
              <button
                onClick={() => { setStep("upload"); setRows([]); setParseErrors([]); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-lg transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0 || importMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Importing…
                  </>
                ) : (
                  <>Import {validRows.length} client{validRows.length !== 1 ? "s" : ""}</>
                )}
              </button>
            </>
          )}
          {step === "done" && (
            <button
              onClick={onClose}
              className="ml-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
