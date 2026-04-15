import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  meetings,
  meetingParticipants,
  people,
  externalAttendees,
  rooms,
  events,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateIcs } from "@/lib/email/ics";

/**
 * GET /api/meetings/[meetingId]/ics
 *
 * Serves a downloadable .ics calendar file for the meeting.
 * Linked from the booking confirmation email.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Gather attendees
  const participantRows = await db
    .select({ name: people.name, email: people.email })
    .from(meetingParticipants)
    .innerJoin(people, eq(meetingParticipants.personId, people.id))
    .where(eq(meetingParticipants.meetingId, meetingId));

  const externalRows = await db
    .select({ name: externalAttendees.name, email: externalAttendees.email })
    .from(externalAttendees)
    .where(eq(externalAttendees.meetingId, meetingId));

  const attendees = [
    ...participantRows,
    ...(meeting.externalAttendeeEmail
      ? [{ name: meeting.externalAttendeeName ?? "Guest", email: meeting.externalAttendeeEmail }]
      : []),
    ...externalRows,
  ];

  // Build location string
  let location: string | undefined;
  if (meeting.roomId) {
    const [roomRow] = await db
      .select({ name: rooms.name })
      .from(rooms)
      .where(eq(rooms.id, meeting.roomId))
      .limit(1);
    if (roomRow) location = roomRow.name;
  }
  if (meeting.eventId) {
    const [eventRow] = await db
      .select({ location: events.location })
      .from(events)
      .where(eq(events.id, meeting.eventId))
      .limit(1);
    if (eventRow?.location) {
      location = location ? `${location}, ${eventRow.location}` : eventRow.location;
    }
  }

  const icsContent = generateIcs({
    title: meeting.title ?? "Meeting",
    description: meeting.description ?? undefined,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime.toISOString(),
    location,
    attendees,
  });

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="invite.ics"`,
    },
  });
}
