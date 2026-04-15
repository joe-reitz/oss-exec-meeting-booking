import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetings, meetingParticipants, people, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";

import { cancelBooking } from "@/lib/calcom/bookings";
import { checkRoomConflict, RoomConflictError } from "@/lib/scheduling/room-conflict";

// ─── Validation ──────────────────────────────────────────────────────

const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z
    .enum([
      "draft",
      "pending",
      "confirmed",
      "cancelled",
      "rescheduled",
      "completed",
    ])
    .optional(),
  roomId: z.string().uuid().optional().nullable(),
  sfdcOpportunityId: z.string().optional().nullable(),
  externalAttendeeName: z.string().optional(),
  externalAttendeeEmail: z.string().email().optional(),
  externalAttendeeCompany: z.string().optional().nullable(),
  externalAttendeeTitle: z.string().optional().nullable(),
  prepNotes: z.string().optional().nullable(),
});

// ─── Helpers ─────────────────────────────────────────────────────────

function serializeMeeting(m: typeof meetings.$inferSelect) {
  return {
    ...m,
    startTime: m.startTime.toISOString(),
    endTime: m.endTime.toISOString(),
    createdAt: m.createdAt?.toISOString() ?? null,
    updatedAt: m.updatedAt?.toISOString() ?? null,
    externalRsvpLastChecked: m.externalRsvpLastChecked?.toISOString() ?? null,
    lastSilentModificationAt:
      m.lastSilentModificationAt?.toISOString() ?? null,
    prepReminderSentAt: m.prepReminderSentAt?.toISOString() ?? null,
  };
}

// ─── GET /api/meetings/[meetingId] ───────────────────────────────────

export async function GET(
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

    // Fetch participants
    const participants = await db
      .select({
        id: meetingParticipants.id,
        personId: meetingParticipants.personId,
        role: meetingParticipants.role,
        googleRsvpStatus: meetingParticipants.googleRsvpStatus,
        personName: people.name,
        personEmail: people.email,
        personType: people.type,
        personTitle: people.title,
      })
      .from(meetingParticipants)
      .leftJoin(people, eq(meetingParticipants.personId, people.id))
      .where(eq(meetingParticipants.meetingId, meetingId));

    // Fetch room
    let room = null;
    if (meeting.roomId) {
      const [roomRow] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, meeting.roomId))
        .limit(1);
      if (roomRow) {
        room = {
          id: roomRow.id,
          name: roomRow.name,
          capacity: roomRow.capacity,
        };
      }
    }

    return NextResponse.json({
      ...serializeMeeting(meeting),
      participants: participants.map((p) => ({
        id: p.id,
        personId: p.personId,
        role: p.role,
        googleRsvpStatus: p.googleRsvpStatus,
        person: p.personName
          ? {
              id: p.personId,
              name: p.personName,
              email: p.personEmail,
              type: p.personType,
              title: p.personTitle,
            }
          : null,
      })),
      room,
    });
  } catch (error) {
    console.error("Failed to fetch meeting:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/meetings/[meetingId] ─────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const parsed = updateMeetingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for room conflicts when roomId or times are changing
    if (parsed.data.roomId || parsed.data.startTime || parsed.data.endTime) {
      const [current] = await db
        .select({
          startTime: meetings.startTime,
          endTime: meetings.endTime,
          roomId: meetings.roomId,
        })
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);

      if (current) {
        const effectiveRoom = parsed.data.roomId ?? current.roomId;
        const effectiveStart = parsed.data.startTime
          ? new Date(parsed.data.startTime)
          : current.startTime;
        const effectiveEnd = parsed.data.endTime
          ? new Date(parsed.data.endTime)
          : current.endTime;

        if (effectiveRoom) {
          await checkRoomConflict({
            roomId: effectiveRoom,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            excludeMeetingId: meetingId,
          });
        }
      }
    }

    // Build update payload, converting time strings to Dates
    const { startTime, endTime, ...rest } = parsed.data;
    const updatePayload: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (startTime) updatePayload.startTime = new Date(startTime);
    if (endTime) updatePayload.endTime = new Date(endTime);

    // Recalculate duration if times changed
    if (startTime || endTime) {
      const [current] = !updatePayload.startTime || !updatePayload.endTime
        ? await db
            .select({ startTime: meetings.startTime, endTime: meetings.endTime })
            .from(meetings)
            .where(eq(meetings.id, meetingId))
            .limit(1)
        : [null];
      const s = (updatePayload.startTime as Date) ?? current?.startTime;
      const e = (updatePayload.endTime as Date) ?? current?.endTime;
      if (s && e) {
        updatePayload.durationMinutes = Math.round(
          (e.getTime() - s.getTime()) / 60000
        );
      }
    }

    const [updated] = await db
      .update(meetings)
      .set(updatePayload)
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeMeeting(updated));
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
    console.error("Failed to update meeting:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/meetings/[meetingId] ────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Fetch the meeting to get calcom booking UID
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

    // Cancel Cal.com booking if it exists
    if (meeting.calcomBookingUid) {
      try {
        await cancelBooking(
          meeting.calcomBookingUid,
          "Cancelled via Exec Meeting Booking app"
        );
      } catch (error) {
        console.error("Failed to cancel Cal.com booking:", error);
      }
    }

    // Soft-delete: set status to cancelled
    const [updated] = await db
      .update(meetings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(meetings.id, meetingId))
      .returning();

    return NextResponse.json(serializeMeeting(updated));
  } catch (error) {
    console.error("Failed to cancel meeting:", error);
    return NextResponse.json(
      { error: "Failed to cancel meeting" },
      { status: 500 }
    );
  }
}
