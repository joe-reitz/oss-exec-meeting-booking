import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetings, meetingParticipants, people, rooms } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

import { bookMeeting } from "@/lib/scheduling/booking-flow";
import { RoomConflictError } from "@/lib/scheduling/room-conflict";

// ─── Validation ──────────────────────────────────────────────────────

const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  eventId: z.string().uuid("Invalid event ID"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  timezone: z.string().default("America/Los_Angeles"),
  durationMinutes: z.number().int().positive("Duration must be positive"),
  roomId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
  externalAttendeeName: z.string().min(1, "External attendee name is required"),
  externalAttendeeEmail: z.string().email("Invalid email address"),
  externalAttendeeCompany: z.string().optional(),
  externalAttendeeTitle: z.string().optional(),
  additionalAttendees: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    company: z.string().optional(),
    title: z.string().optional(),
  })).default([]),
  sfdcOpportunityId: z.string().optional(),
});

// ─── GET /api/meetings ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const personId = searchParams.get("personId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build conditions
    const conditions = [];

    if (
      status &&
      [
        "draft",
        "pending",
        "confirmed",
        "cancelled",
        "rescheduled",
        "completed",
      ].includes(status)
    ) {
      conditions.push(
        eq(
          meetings.status,
          status as
            | "draft"
            | "pending"
            | "confirmed"
            | "cancelled"
            | "rescheduled"
            | "completed"
        )
      );
    }

    if (startDate) {
      conditions.push(gte(meetings.startTime, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(meetings.startTime, new Date(endDate)));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch meetings
    const meetingRows = await db
      .select()
      .from(meetings)
      .where(whereClause)
      .orderBy(desc(meetings.startTime));

    // If filtering by personId, filter meetings that have this person as participant
    let filteredMeetings = meetingRows;
    if (personId) {
      const participantMeetingIds = await db
        .select({ meetingId: meetingParticipants.meetingId })
        .from(meetingParticipants)
        .where(eq(meetingParticipants.personId, personId));

      const meetingIdSet = new Set(
        participantMeetingIds.map((p) => p.meetingId)
      );
      filteredMeetings = meetingRows.filter((m) => meetingIdSet.has(m.id));
    }

    // Fetch participants for these meetings
    const meetingIds = filteredMeetings.map((m) => m.id);

    const participantsMap: Record<
      string,
      Array<{
        id: string;
        personId: string;
        role: string | null;
        person: { id: string; name: string; email: string; type: string } | null;
      }>
    > = {};

    if (meetingIds.length > 0) {
      const allParticipants = await db
        .select({
          id: meetingParticipants.id,
          meetingId: meetingParticipants.meetingId,
          personId: meetingParticipants.personId,
          role: meetingParticipants.role,
          personName: people.name,
          personEmail: people.email,
          personType: people.type,
        })
        .from(meetingParticipants)
        .leftJoin(people, eq(meetingParticipants.personId, people.id));

      for (const p of allParticipants) {
        if (!meetingIds.includes(p.meetingId)) continue;
        if (!participantsMap[p.meetingId]) {
          participantsMap[p.meetingId] = [];
        }
        participantsMap[p.meetingId].push({
          id: p.id,
          personId: p.personId,
          role: p.role,
          person: p.personName
            ? {
                id: p.personId,
                name: p.personName,
                email: p.personEmail!,
                type: p.personType!,
              }
            : null,
        });
      }
    }

    // Fetch room info
    const roomIds = [
      ...new Set(
        filteredMeetings.map((m) => m.roomId).filter((v): v is string => !!v)
      ),
    ];

    const roomMap: Record<string, { id: string; name: string }> = {};

    if (roomIds.length > 0) {
      const roomRows = await db.select().from(rooms);
      for (const r of roomRows) {
        if (roomIds.includes(r.id)) {
          roomMap[r.id] = { id: r.id, name: r.name };
        }
      }
    }

    // Combine
    const result = filteredMeetings.map((m) => ({
      ...m,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
      createdAt: m.createdAt?.toISOString() ?? null,
      updatedAt: m.updatedAt?.toISOString() ?? null,
      externalRsvpLastChecked: m.externalRsvpLastChecked?.toISOString() ?? null,
      lastSilentModificationAt:
        m.lastSilentModificationAt?.toISOString() ?? null,
      participants: participantsMap[m.id] ?? [],
      room: m.roomId ? roomMap[m.roomId] ?? null : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

// ─── POST /api/meetings ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createMeetingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const meeting = await bookMeeting({
      ...parsed.data,
      createdById: null,
    });

    const meetingResult = meeting as Record<string, unknown>;
    const inviteError = meetingResult._inviteError ?? null;
    delete meetingResult._inviteError;

    return NextResponse.json(
      {
        ...meetingResult,
        startTime: (meetingResult.startTime as Date).toISOString(),
        endTime: (meetingResult.endTime as Date).toISOString(),
        createdAt: (meetingResult.createdAt as Date | null)?.toISOString() ?? null,
        updatedAt: (meetingResult.updatedAt as Date | null)?.toISOString() ?? null,
        _inviteError: inviteError,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RoomConflictError) {
      return NextResponse.json(
        {
          error: "Room conflict",
          message: error.message,
          conflictingMeeting: {
            id: error.conflictingMeetingId,
            title: error.conflictingMeetingTitle,
            startTime: error.conflictingStartTime.toISOString(),
            endTime: error.conflictingEndTime.toISOString(),
          },
        },
        { status: 409 }
      );
    }
    console.error("Failed to create meeting:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create meeting",
      },
      { status: 500 }
    );
  }
}
