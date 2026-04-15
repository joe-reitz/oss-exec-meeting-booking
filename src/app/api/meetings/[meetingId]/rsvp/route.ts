import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingParticipants, people } from "@/db/schema";
import { eq } from "drizzle-orm";

import { pollRsvpStatus, type RsvpStatus } from "@/lib/google/rsvp";

// ─── GET /api/meetings/[meetingId]/rsvp ──────────────────────────────

/**
 * Returns real-time RSVP status for a specific meeting by polling
 * Google Calendar directly. Also updates the DB with fresh data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // ── Fetch meeting ──────────────────────────────────────────────
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

    if (!meeting.googleEventId || !meeting.googleCalendarId) {
      return NextResponse.json(
        { error: "Meeting has no linked Google Calendar event" },
        { status: 400 }
      );
    }

    // ── Poll Google Calendar for fresh RSVP data ───────────────────
    const rsvpStatuses = await pollRsvpStatus({
      calendarId: meeting.googleCalendarId,
      eventId: meeting.googleEventId,
    });

    const rsvpMap = new Map<string, RsvpStatus>(
      rsvpStatuses.map((r) => [r.email.toLowerCase(), r])
    );

    // ── Update external attendee RSVP in DB ────────────────────────
    let externalRsvp: RsvpStatus | null = null;

    if (meeting.externalAttendeeEmail) {
      const externalStatus = rsvpMap.get(
        meeting.externalAttendeeEmail.toLowerCase()
      );
      if (externalStatus) {
        externalRsvp = externalStatus;
        await db
          .update(meetings)
          .set({
            externalRsvpStatus: externalStatus.responseStatus,
            externalRsvpLastChecked: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(meetings.id, meetingId));
      } else {
        // Update last-checked even if attendee not found
        await db
          .update(meetings)
          .set({
            externalRsvpLastChecked: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(meetings.id, meetingId));
      }
    }

    // ── Update internal participants RSVP in DB ────────────────────
    const participants = await db
      .select({
        id: meetingParticipants.id,
        personId: meetingParticipants.personId,
        role: meetingParticipants.role,
        personName: people.name,
        personEmail: people.email,
      })
      .from(meetingParticipants)
      .leftJoin(people, eq(meetingParticipants.personId, people.id))
      .where(eq(meetingParticipants.meetingId, meetingId));

    const participantRsvps: Array<{
      participantId: string;
      personId: string;
      name: string | null;
      email: string | null;
      role: string | null;
      googleRsvpStatus: string | null;
    }> = [];

    for (const participant of participants) {
      let status: string | null = null;

      if (participant.personEmail) {
        const rsvp = rsvpMap.get(participant.personEmail.toLowerCase());
        if (rsvp) {
          status = rsvp.responseStatus;
          await db
            .update(meetingParticipants)
            .set({ googleRsvpStatus: status })
            .where(eq(meetingParticipants.id, participant.id));
        }
      }

      participantRsvps.push({
        participantId: participant.id,
        personId: participant.personId,
        name: participant.personName,
        email: participant.personEmail,
        role: participant.role,
        googleRsvpStatus: status,
      });
    }

    return NextResponse.json({
      meetingId,
      polledAt: new Date().toISOString(),
      externalAttendee: externalRsvp
        ? {
            email: meeting.externalAttendeeEmail,
            name: meeting.externalAttendeeName,
            responseStatus: externalRsvp.responseStatus,
            displayName: externalRsvp.displayName,
          }
        : null,
      participants: participantRsvps,
      allAttendees: rsvpStatuses,
    });
  } catch (error) {
    console.error("Failed to fetch RSVP status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch RSVP status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
