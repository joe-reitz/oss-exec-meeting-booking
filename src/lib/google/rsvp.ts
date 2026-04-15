import { getCalendarClient } from "./client";

export interface RsvpStatus {
  email: string;
  responseStatus: "needsAction" | "declined" | "tentative" | "accepted";
  displayName?: string;
}

/**
 * Polls Google Calendar for the current RSVP status of all attendees
 * on a specific event.
 */
export async function pollRsvpStatus(params: {
  calendarId: string;
  eventId: string;
  impersonateEmail?: string;
}): Promise<RsvpStatus[]> {
  const calendar = getCalendarClient(params.impersonateEmail);

  const response = await calendar.events.get({
    calendarId: params.calendarId,
    eventId: params.eventId,
  });

  const event = response.data;

  if (!event.attendees || event.attendees.length === 0) {
    return [];
  }

  return event.attendees
    .filter((attendee) => attendee.email)
    .map((attendee) => ({
      email: attendee.email!,
      responseStatus: (attendee.responseStatus as RsvpStatus["responseStatus"]) ?? "needsAction",
      displayName: attendee.displayName ?? undefined,
    }));
}
