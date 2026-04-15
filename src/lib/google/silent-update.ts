import { calendar_v3 } from "googleapis";
import { getCalendarClient } from "./client";

/**
 * Silently updates a Google Calendar event (no notification emails sent
 * to attendees). Uses events.patch() with sendUpdates: "none".
 */
export async function silentlyUpdateEvent(params: {
  calendarId: string;
  eventId: string;
  updates: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime: string; timeZone: string };
    end?: { dateTime: string; timeZone: string };
  };
  impersonateEmail?: string;
}): Promise<calendar_v3.Schema$Event> {
  const calendar = getCalendarClient(params.impersonateEmail);

  const requestBody: calendar_v3.Schema$Event = {};

  if (params.updates.summary !== undefined) {
    requestBody.summary = params.updates.summary;
  }
  if (params.updates.description !== undefined) {
    requestBody.description = params.updates.description;
  }
  if (params.updates.location !== undefined) {
    requestBody.location = params.updates.location;
  }
  if (params.updates.start !== undefined) {
    requestBody.start = params.updates.start;
  }
  if (params.updates.end !== undefined) {
    requestBody.end = params.updates.end;
  }

  const response = await calendar.events.patch({
    calendarId: params.calendarId,
    eventId: params.eventId,
    sendUpdates: "none",
    requestBody,
  });

  return response.data;
}

/**
 * Silently adds or removes attendees from a Google Calendar event
 * without sending notification emails.
 *
 * Fetches the current event, merges attendee changes, and patches
 * with sendUpdates: "none".
 */
export async function silentlyModifyAttendees(params: {
  calendarId: string;
  eventId: string;
  addEmails?: string[];
  removeEmails?: string[];
  impersonateEmail?: string;
}): Promise<calendar_v3.Schema$Event> {
  const calendar = getCalendarClient(params.impersonateEmail);

  // Fetch current event to get existing attendees
  const currentEvent = await calendar.events.get({
    calendarId: params.calendarId,
    eventId: params.eventId,
  });

  let attendees = currentEvent.data.attendees ?? [];

  // Remove specified emails
  if (params.removeEmails && params.removeEmails.length > 0) {
    const removeSet = new Set(
      params.removeEmails.map((email) => email.toLowerCase())
    );
    attendees = attendees.filter(
      (attendee) => !removeSet.has((attendee.email ?? "").toLowerCase())
    );
  }

  // Add new emails (avoid duplicates)
  if (params.addEmails && params.addEmails.length > 0) {
    const existingEmails = new Set(
      attendees.map((a) => (a.email ?? "").toLowerCase())
    );
    for (const email of params.addEmails) {
      if (!existingEmails.has(email.toLowerCase())) {
        attendees.push({ email });
      }
    }
  }

  const response = await calendar.events.patch({
    calendarId: params.calendarId,
    eventId: params.eventId,
    sendUpdates: "none",
    requestBody: {
      attendees,
    },
  });

  return response.data;
}
