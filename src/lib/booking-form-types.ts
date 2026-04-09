// Shared types for booking form settings — safe to import in both
// server code (routers) and client components (booking page, order-form)

export interface BookingFormSettings {
  welcomeMessage?: string;
  /** Show a Mapbox map pin after the address is entered on Step 1 */
  showMapPreview?: boolean;
  /** Number of columns in the package/service grid on Step 2 (3–5) */
  gridColumns?: number;
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

// ─── Portal Settings ───────────────────────────────────────────────────────

export interface PortalSettings {
  /** Hero / background image URL (uploaded to Supabase) */
  heroImageUrl?: string;
  /** Welcome heading shown on the portal */
  welcomeTitle?: string;
  /** Subtitle / description below the heading */
  welcomeText?: string;
  /** Contact phone displayed on portal */
  contactPhone?: string;
  /** Contact email displayed on portal */
  contactEmail?: string;
  /** Layout style: split (left form / right hero), centered, or fullHero */
  layout?: "split" | "centered" | "fullHero";
  /** Show the "I have an account" sign-in option */
  showLogin?: boolean;
  /** Show the "I don't have an account" registration option */
  showRegister?: boolean;
  /** Show order form cards for direct ordering */
  showOrderForms?: boolean;
  /** Which order form IDs to display (empty = show all public) */
  visibleOrderFormIds?: string[];
  /** Feature bullets shown on the right panel */
  featureBullets?: string[];
}

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  heroImageUrl: "",
  welcomeTitle: "",
  welcomeText: "",
  contactPhone: "",
  contactEmail: "",
  layout: "split",
  showLogin: true,
  showRegister: true,
  showOrderForms: true,
  visibleOrderFormIds: [],
  featureBullets: [
    "Book new shoots online",
    "Track your order status",
    "Download delivered photos",
    "View and pay invoices",
  ],
};

export const DEFAULT_BOOKING_FORM_SETTINGS: BookingFormSettings = {
  welcomeMessage: "",
  showMapPreview: true,
  gridColumns: 3,
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
