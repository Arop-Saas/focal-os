/**
 * Google Calendar integration
 * Uses googleapis to create/update/delete events on photographer calendars
 */

import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// ─── OAuth2 Client ────────────────────────────────────────────────────────────

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!  // e.g. https://focal-os.vercel.app/api/auth/google/callback
  );
}

export function getAuthUrl(stateUserId: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token every time
    scope: SCOPES,
    state: stateUserId, // pass userId so callback knows who to update
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// ─── Calendar API Helpers ─────────────────────────────────────────────────────

function getCalendarClient(refreshToken: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  calendarId?: string; // defaults to "primary"
}

export async function createCalendarEvent(
  refreshToken: string,
  event: CalendarEventInput
): Promise<string | null | undefined> {
  try {
    const calendar = getCalendarClient(refreshToken);
    const res = await calendar.events.insert({
      calendarId: event.calendarId ?? "primary",
      requestBody: {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startAt.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: event.endAt.toISOString(),
          timeZone: "UTC",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 24h before
            { method: "popup", minutes: 60 },        // 1h before
          ],
        },
      },
    });
    return res.data.id;
  } catch (err) {
    console.error("[gcal] createCalendarEvent error:", err);
    return null;
  }
}

export async function deleteCalendarEvent(
  refreshToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<boolean> {
  try {
    const calendar = getCalendarClient(refreshToken);
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (err) {
    console.error("[gcal] deleteCalendarEvent error:", err);
    return false;
  }
}

export async function updateCalendarEvent(
  refreshToken: string,
  eventId: string,
  event: Partial<CalendarEventInput> & { calendarId?: string }
): Promise<boolean> {
  try {
    const calendar = getCalendarClient(refreshToken);
    const body: Record<string, unknown> = {};
    if (event.title) body.summary = event.title;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;
    if (event.startAt)
      body.start = { dateTime: event.startAt.toISOString(), timeZone: "UTC" };
    if (event.endAt)
      body.end = { dateTime: event.endAt.toISOString(), timeZone: "UTC" };

    await calendar.events.patch({
      calendarId: event.calendarId ?? "primary",
      eventId,
      requestBody: body,
    });
    return true;
  } catch (err) {
    console.error("[gcal] updateCalendarEvent error:", err);
    return false;
  }
}
