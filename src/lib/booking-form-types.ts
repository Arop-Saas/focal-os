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
