import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  meetings,
  meetingParticipants,
  people,
  rooms,
  events,
} from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

/**
 * GET /api/my-meetings
 *
 * Returns meetings where the current user is a participant.
 * Query params:
 *   - eventId: filter to a specific event
 *   - format: "csv" to return CSV download
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get("personId");

    if (!personId) {
      return NextResponse.json([]);
    }

    const [person] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);

    if (!person) {
      return NextResponse.json([]);
    }

    const eventId = searchParams.get("eventId");
    const format = searchParams.get("format");

    // Find all meeting IDs where this person is a participant
    const participantRows = await db
      .select({ meetingId: meetingParticipants.meetingId })
      .from(meetingParticipants)
      .where(eq(meetingParticipants.personId, person.id));

    const meetingIds = participantRows.map((r) => r.meetingId);
    if (meetingIds.length === 0) {
      if (format === "csv") {
        return new NextResponse(
          "Date,Time,Title,External Attendee,Company,Room,Event,Status,Prep Notes\n",
          {
            headers: {
              "Content-Type": "text/csv",
              "Content-Disposition": 'attachment; filename="my-meetings.csv"',
            },
          }
        );
      }
      return NextResponse.json([]);
    }

    // Build conditions
    const conditions = [
      inArray(meetings.id, meetingIds),
      inArray(meetings.status, [
        "draft",
        "pending",
        "confirmed",
        "completed",
      ]),
    ];

    if (eventId) {
      conditions.push(eq(meetings.eventId, eventId));
    }

    // Fetch meetings with room and event info
    const results = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        description: meetings.description,
        startTime: meetings.startTime,
        endTime: meetings.endTime,
        durationMinutes: meetings.durationMinutes,
        status: meetings.status,
        externalAttendeeName: meetings.externalAttendeeName,
        externalAttendeeCompany: meetings.externalAttendeeCompany,
        externalRsvpStatus: meetings.externalRsvpStatus,
        prepNotes: meetings.prepNotes,
        segment: meetings.segment,
        noRoomRequired: meetings.noRoomRequired,
        timezone: meetings.timezone,
        eventId: meetings.eventId,
        roomName: rooms.name,
        eventName: events.name,
        eventTimezone: events.timezone,
      })
      .from(meetings)
      .leftJoin(rooms, eq(meetings.roomId, rooms.id))
      .leftJoin(events, eq(meetings.eventId, events.id))
      .where(and(...conditions))
      .orderBy(asc(meetings.startTime));

    if (format === "csv") {
      const header =
        "Date,Time,Title,External Attendee,Company,Room,Event,Status,Prep Notes";
      const rows = results.map((m) => {
        const date = m.startTime.toISOString().split("T")[0];
        const time = m.startTime.toISOString().split("T")[1]?.slice(0, 5);
        const csvEscape = (s: string | null) => {
          if (!s) return "";
          return s.includes(",") || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        };
        return [
          date,
          time,
          csvEscape(m.title),
          csvEscape(m.externalAttendeeName),
          csvEscape(m.externalAttendeeCompany),
          csvEscape(m.roomName),
          csvEscape(m.eventName),
          m.status,
          csvEscape(m.prepNotes),
        ].join(",");
      });

      return new NextResponse([header, ...rows].join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="my-meetings.csv"',
        },
      });
    }

    return NextResponse.json(
      results.map((m) => ({
        ...m,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to fetch my meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}
