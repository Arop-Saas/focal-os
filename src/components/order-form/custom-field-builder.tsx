"use client";

import { useState } from "react";
import {
  Plus, GripVertical, Trash2, ChevronDown, ChevronUp,
  Type, AlignLeft, ChevronDownSquare, CheckSquare, List,
  ListChecks, FileText, Hash, Calendar,
} from "lucide-react";
import {
  type CustomField, type CustomFieldType, CUSTOM_FIELD_TYPE_LABELS,
} from "@/lib/booking-form-types";

const FIELD_TYPE_ICONS: Record<CustomFieldType, React.ElementType> = {
  text:        Type,
  textarea:    AlignLeft,
  dropdown:    ChevronDownSquare,
  checkbox:    CheckSquare,
  select:      List,
  multiselect: ListChecks,
  description: FileText,
  number:      Hash,
  date:        Calendar,
};

function generateId() {
  return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Add Field Menu ─────────────────────────────────────────────────────────

function AddFieldMenu({ step, onAdd }: { step: number; onAdd: (field: CustomField) => void }) {
  const [open, setOpen] = useState(false);

  function handleAdd(type: CustomFieldType) {
    const newField: CustomField = {
      id: generateId(),
      type,
      label: CUSTOM_FIELD_TYPE_LABELS[type],
      placeholder: type === "description" ? undefined : "",
      helpText: "",
      required: false,
      options: ["dropdown", "select", "multiselect"].includes(type) ? ["Option 1", "Option 2"] : undefined,
      step: step as 1 | 2 | 3 | 4 | 5,
      sortOrder: 999,
    };
    onAdd(newField);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
      >
        <Plus className="w-4 h-4" /> Add Field
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">Field Types</p>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {(Object.keys(CUSTOM_FIELD_TYPE_LABELS) as CustomFieldType[]).map((type) => {
                const Icon = FIELD_TYPE_ICONS[type];
                return (
                  <button key={type} onClick={() => handleAdd(type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                    {CUSTOM_FIELD_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Single Field Editor ────────────────────────────────────────────────────

function FieldEditor({
  field, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  field: CustomField;
  onChange: (updated: CustomField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = FIELD_TYPE_ICONS[field.type];
  const hasOptions = ["dropdown", "select", "multiselect"].includes(field.type);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Collapsed header */}
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <Icon className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{field.label || "Untitled"}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider shrink-0">{CUSTOM_FIELD_TYPE_LABELS[field.type]}</span>
        {field.required && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 p-3 space-y-3">
          {/* Label */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Label</label>
            <input value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              placeholder="Field label"
            />
          </div>

          {/* Placeholder (not for description/checkbox) */}
          {field.type !== "description" && field.type !== "checkbox" && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Placeholder</label>
              <input value={field.placeholder ?? ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                placeholder="Placeholder text…"
              />
            </div>
          )}

          {/* Help text (shows as description for "description" type) */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {field.type === "description" ? "Content" : "Help Text"}
            </label>
            <textarea value={field.helpText ?? ""}
              onChange={(e) => onChange({ ...field, helpText: e.target.value })}
              rows={field.type === "description" ? 4 : 2}
              className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
              placeholder={field.type === "description" ? "Write your description text…" : "Help text shown below the field"}
            />
          </div>

          {/* Options (for dropdown/select/multiselect) */}
          {hasOptions && (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Options</label>
              <div className="mt-1 space-y-1.5">
                {(field.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 w-4 text-right">{i + 1}</span>
                    <input value={opt}
                      onChange={(e) => {
                        const newOpts = [...(field.options ?? [])];
                        newOpts[i] = e.target.value;
                        onChange({ ...field, options: newOpts });
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <button onClick={() => {
                      const newOpts = (field.options ?? []).filter((_, j) => j !== i);
                      onChange({ ...field, options: newOpts });
                    }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => onChange({ ...field, options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                >
                  + Add option
                </button>
              </div>
            </div>
          )}

          {/* Required toggle (not for description) */}
          {field.type !== "description" && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Required</p>
              <button onClick={() => onChange({ ...field, required: !field.required })}
                className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full transition-colors ${field.required ? "bg-amber-500" : "bg-gray-300"}`}
              >
                <span className={`pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform mt-[2px] ${field.required ? "translate-x-[20px]" : "translate-x-[2px]"}`} />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex gap-1">
              <button onClick={onMoveUp} disabled={isFirst}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded transition-colors"
              ><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={onMoveDown} disabled={isLast}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded transition-colors"
              ><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <button onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Builder ───────────────────────────────────────────────────────────

export function CustomFieldBuilder({
  step, fields, onChange,
}: {
  step: number;
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}) {
  const stepFields = fields
    .filter((f) => f.step === step)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function handleAdd(field: CustomField) {
    const maxOrder = stepFields.length > 0 ? Math.max(...stepFields.map((f) => f.sortOrder)) : -1;
    onChange([...fields, { ...field, sortOrder: maxOrder + 1 }]);
  }

  function handleUpdate(id: string, updated: CustomField) {
    onChange(fields.map((f) => (f.id === id ? updated : f)));
  }

  function handleDelete(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function handleMove(id: string, direction: "up" | "down") {
    const idx = stepFields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stepFields.length) return;
    const temp = stepFields[idx].sortOrder;
    const updated = fields.map((f) => {
      if (f.id === stepFields[idx].id) return { ...f, sortOrder: stepFields[swapIdx].sortOrder };
      if (f.id === stepFields[swapIdx].id) return { ...f, sortOrder: temp };
      return f;
    });
    onChange(updated);
  }

  return (
    <div className="space-y-2">
      {stepFields.length > 0 && (
        <div className="space-y-2">
          {stepFields.map((field, i) => (
            <FieldEditor
              key={field.id}
              field={field}
              onChange={(updated) => handleUpdate(field.id, updated)}
              onDelete={() => handleDelete(field.id)}
              onMoveUp={() => handleMove(field.id, "up")}
              onMoveDown={() => handleMove(field.id, "down")}
              isFirst={i === 0}
              isLast={i === stepFields.length - 1}
            />
          ))}
        </div>
      )}
      <AddFieldMenu step={step} onAdd={handleAdd} />
    </div>
  );
}
