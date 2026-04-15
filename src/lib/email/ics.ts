/**
 * Generate a valid .ics (iCalendar) string for a meeting invite.
 *
 * The output can be attached to an email so recipients can add
 * the meeting to their calendar (Gmail, Outlook, Apple Mail all
 * handle .ics natively).
 */

interface IcsAttendee {
  name: string;
  email: string;
}

interface IcsParams {
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  location?: string;
  organizer?: IcsAttendee;
  attendees?: IcsAttendee[];
  uid?: string; // unique ID for the event — defaults to random
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(iso: string): string {
  // Convert "2026-06-30T14:00:00.000Z" → "20260630T140000Z"
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function generateIcs(params: IcsParams): string {
  const {
    title,
    description,
    startTime,
    endTime,
    location,
    organizer,
    attendees,
    uid = `${crypto.randomUUID()}@meeting`,
  } = params;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vercel//Meeting Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(startTime)}`,
    `DTEND:${toIcsDate(endTime)}`,
    `SUMMARY:${escapeIcsText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeIcsText(organizer.name)}:mailto:${organizer.email}`
    );
  }
  if (attendees) {
    for (const a of attendees) {
      lines.push(
        `ATTENDEE;CN=${escapeIcsText(a.name)};RSVP=TRUE:mailto:${a.email}`
      );
    }
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}
