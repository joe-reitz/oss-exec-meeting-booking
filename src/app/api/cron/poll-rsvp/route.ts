import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingParticipants, people } from "@/db/schema";
import { eq, and, gt, isNotNull, inArray } from "drizzle-orm";
import { pollRsvpStatus } from "@/lib/google/rsvp";

/**
 * POST /api/cron/poll-rsvp
 *
 * Cron job that polls Google Calendar RSVP statuses for all confirmed
 * future meetings. Intended to be called every 5 minutes.
 *
 * Requires CRON_SECRET in the Authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth: verify cron secret ──────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Query future confirmed meetings with Google Calendar data ─────
    const now = new Date();

    const futureMeetings = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.status, "confirmed"),
          gt(meetings.startTime, now),
          isNotNull(meetings.googleEventId),
          isNotNull(meetings.googleCalendarId)
        )
      );

    if (futureMeetings.length === 0) {
      return NextResponse.json({
        message: "No meetings to poll",
        meetingsPolled: 0,
        updates: [],
      });
    }

    const results: Array<{
      meetingId: string;
      title: string;
      externalRsvpUpdated: boolean;
      participantUpdates: number;
      error?: string;
    }> = [];

    // ── Poll each meeting ─────────────────────────────────────────────
    for (const meeting of futureMeetings) {
      try {
        const rsvpStatuses = await pollRsvpStatus({
          calendarId: meeting.googleCalendarId!,
          eventId: meeting.googleEventId!,
        });

        let externalRsvpUpdated = false;
        let participantUpdates = 0;

        // Build a lookup map: email -> responseStatus
        const rsvpMap = new Map(
          rsvpStatuses.map((r) => [r.email.toLowerCase(), r.responseStatus])
        );

        // ── Update external attendee RSVP status ─────────────────────
        if (meeting.externalAttendeeEmail) {
          const externalStatus = rsvpMap.get(
            meeting.externalAttendeeEmail.toLowerCase()
          );
          if (externalStatus && externalStatus !== meeting.externalRsvpStatus) {
            await db
              .update(meetings)
              .set({
                externalRsvpStatus: externalStatus,
                externalRsvpLastChecked: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(meetings.id, meeting.id));
            externalRsvpUpdated = true;
          } else {
            // Still update the last-checked timestamp
            await db
              .update(meetings)
              .set({
                externalRsvpLastChecked: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(meetings.id, meeting.id));
          }
        }

        // ── Update internal participant RSVP statuses ────────────────
        const participants = await db
          .select({
            id: meetingParticipants.id,
            personId: meetingParticipants.personId,
            googleRsvpStatus: meetingParticipants.googleRsvpStatus,
            personEmail: people.email,
          })
          .from(meetingParticipants)
          .leftJoin(people, eq(meetingParticipants.personId, people.id))
          .where(eq(meetingParticipants.meetingId, meeting.id));

        for (const participant of participants) {
          if (!participant.personEmail) continue;

          const newStatus = rsvpMap.get(participant.personEmail.toLowerCase());
          if (newStatus && newStatus !== participant.googleRsvpStatus) {
            await db
              .update(meetingParticipants)
              .set({ googleRsvpStatus: newStatus })
              .where(eq(meetingParticipants.id, participant.id));
            participantUpdates++;
          }
        }

        results.push({
          meetingId: meeting.id,
          title: meeting.title,
          externalRsvpUpdated,
          participantUpdates,
        });
      } catch (error) {
        console.error(
          `Failed to poll RSVP for meeting ${meeting.id}:`,
          error
        );
        results.push({
          meetingId: meeting.id,
          title: meeting.title,
          externalRsvpUpdated: false,
          participantUpdates: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: "RSVP polling complete",
      meetingsPolled: futureMeetings.length,
      updates: results,
    });
  } catch (error) {
    console.error("RSVP poll cron failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
