// Shared types for booking form settings — safe to import in both
// server code (routers) and client components (booking page, order-form)

export interface BookingFormSettings {
  welcomeMessage?: string;
  fields: {
    propertyType: { visible: boolean; required: boolean };
    sqft:         { visible: boolean; required: boolean };
    beds:         { visible: boolean; required: boolean };
    baths:        { visible: boolean; required: boolean };
    mlsNumber:    { visible: boolean; required: boolean };
    accessNotes:  { visible: boolean; required: boolean };
    phone:        { visible: boolean; required: boolean };
    company:      { visible: boolean; required: boolean };
    clientNotes:  { visible: boolean; required: boolean };
  };
}

// ─── Custom Fields ──────────────────────────────────────────────────────────

export type CustomFieldType =
  | "text"
  | "textarea"
  | "dropdown"
  | "checkbox"
  | "select"       // radio-style single-select
  | "multiselect"  // checkbox-style multi-select
  | "description"  // read-only text block (no input)
  | "number"
  | "date";

export interface CustomField {
  id: string;
  type: CustomFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[];           // for dropdown, select, multiselect
  step: 1 | 2 | 3 | 4 | 5;    // which booking step it appears on
  sortOrder: number;
}

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text:        "Short Text",
  textarea:    "Long Text",
  dropdown:    "Dropdown",
  checkbox:    "Checkbox",
  select:      "Single Select",
  multiselect: "Multi Select",
  description: "Description",
  number:      "Number",
  date:        "Date",
};

export const DEFAULT_BOOKING_FORM_SETTINGS: BookingFormSettings = {
  welcomeMessage: "",
  fields: {
    propertyType: { visible: true,  required: false },
    sqft:         { visible: true,  required: false },
    beds:         { visible: true,  required: false },
    baths:        { visible: true,  required: false },
    mlsNumber:    { visible: true,  required: false },
    accessNotes:  { visible: true,  required: false },
    phone:        { visible: true,  required: false },
    company:      { visible: true,  required: false },
    clientNotes:  { visible: true,  required: false },
  },
};
