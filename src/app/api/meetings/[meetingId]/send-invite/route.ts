import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  meetings,
  events,
  rooms,
  externalAttendees,
  meetingParticipants,
  people,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createBooking } from "@/lib/calcom/bookings";
import { sendBookingConfirmationEmail } from "@/lib/email/send";

/**
 * POST /api/meetings/[meetingId]/send-invite
 *
 * Creates a Cal.com booking for a draft meeting, sending calendar
 * invitations to all attendees. Uses allowConflicts to bypass
 * availability checks.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (meeting.calcomBookingId) {
      return NextResponse.json(
        { error: "Invite already sent for this meeting" },
        { status: 400 }
      );
    }

    if (!meeting.eventId) {
      return NextResponse.json(
        { error: "Meeting is not linked to an event" },
        { status: 400 }
      );
    }

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, meeting.eventId))
      .limit(1);

    if (!event?.calcomEventTypeId) {
      return NextResponse.json(
        {
          error:
            "Cal.com is not set up for this event. Go to the event page and click 'Set Up Cal.com' first.",
        },
        { status: 400 }
      );
    }

    // Look up room name for the location
    let roomName: string | null = null;
    if (meeting.roomId) {
      const [roomRow] = await db
        .select({ name: rooms.name })
        .from(rooms)
        .where(eq(rooms.id, meeting.roomId))
        .limit(1);
      roomName = roomRow?.name ?? null;
    }
    const calcomNotes = roomName
      ? `Room: ${roomName}\n\n${meeting.description ?? ""}`
      : meeting.description ?? "";

    // Look up additional attendees for guest emails
    const additionalAttendeeRows = await db
      .select({ email: externalAttendees.email })
      .from(externalAttendees)
      .where(eq(externalAttendees.meetingId, meetingId));
    const guestEmails = additionalAttendeeRows
      .map((a) => a.email)
      .filter(Boolean);

    const calcomResponse = await createBooking({
      eventTypeId: event.calcomEventTypeId,
      start: meeting.startTime.toISOString(),
      attendee: {
        name: meeting.externalAttendeeName ?? "Guest",
        email: meeting.externalAttendeeEmail ?? "",
        timeZone: meeting.timezone ?? "America/Los_Angeles",
      },
      guests: guestEmails.length > 0 ? guestEmails : undefined,
      bookingFieldsResponses: { notes: calcomNotes },
      allowConflicts: true,
    });

    // Extract Google Calendar event ID if available
    let googleEventId: string | null = null;
    const googleRef = calcomResponse.data.references?.find(
      (ref: { type: string; uid?: string }) =>
        ref.type === "google_calendar" || ref.type === "google"
    );
    if (googleRef?.uid) {
      googleEventId = googleRef.uid;
    }

    await db
      .update(meetings)
      .set({
        calcomBookingId: calcomResponse.data.id,
        calcomBookingUid: calcomResponse.data.uid,
        googleEventId,
        status: "confirmed",
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meetingId));

    // Send branded confirmation email (fire-and-forget)
    const participantRows = await db
      .select({ name: people.name, email: people.email, title: people.title })
      .from(meetingParticipants)
      .innerJoin(people, eq(meetingParticipants.personId, people.id))
      .where(eq(meetingParticipants.meetingId, meetingId));

    const allExternalAttendees = await db
      .select()
      .from(externalAttendees)
      .where(eq(externalAttendees.meetingId, meetingId));

    sendBookingConfirmationEmail({
      meetingId,
      meetingTitle: meeting.title ?? "Meeting",
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime.toISOString(),
      timezone: meeting.timezone ?? "America/Los_Angeles",
      durationMinutes: meeting.durationMinutes ?? 30,
      location:
        [roomName, event.location].filter(Boolean).join(", ") || undefined,
      description: meeting.description ?? undefined,
      internalAttendees: participantRows.map((p) => ({
        name: p.name,
        email: p.email,
        title: p.title ?? undefined,
      })),
      externalAttendees: [
        {
          name: meeting.externalAttendeeName ?? "Guest",
          email: meeting.externalAttendeeEmail ?? "",
          title: meeting.externalAttendeeTitle ?? undefined,
          company: meeting.externalAttendeeCompany ?? undefined,
        },
        ...allExternalAttendees.map((a) => ({
          name: a.name,
          email: a.email,
          title: a.title ?? undefined,
          company: a.company ?? undefined,
        })),
      ],
    }).catch((err) =>
      console.error("Failed to send booking confirmation email:", err)
    );

    return NextResponse.json({
      success: true,
      calcomBookingId: calcomResponse.data.id,
      status: "confirmed",
    });
  } catch (error) {
    console.error("Failed to send invite:", error);
    const raw = error instanceof Error ? error.message : "Failed to send invite";
    const match = raw.match(/"message":"([^"]+)"/);
    return NextResponse.json(
      { error: match ? match[1] : raw },
      { status: 500 }
    );
  }
}
