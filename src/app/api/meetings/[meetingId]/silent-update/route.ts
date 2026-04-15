import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import { checkRoomConflict, RoomConflictError } from "@/lib/scheduling/room-conflict";
import {
  silentlyUpdateEvent,
  silentlyModifyAttendees,
} from "@/lib/google/silent-update";

// ─── Validation ──────────────────────────────────────────────────────

const silentUpdateSchema = z.object({
  newStartTime: z.string().datetime().optional(),
  newEndTime: z.string().datetime().optional(),
  newTitle: z.string().min(1).optional(),
  newDescription: z.string().optional(),
  newLocation: z.string().optional(),
  addAttendeeEmails: z.array(z.string().email()).optional(),
  removeAttendeeEmails: z.array(z.string().email()).optional(),
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
  };
}

// ─── PATCH /api/meetings/[meetingId]/silent-update ───────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // ── Validate request body ────────────────────────────────────────
    const body = await request.json();
    const parsed = silentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      newStartTime,
      newEndTime,
      newTitle,
      newDescription,
      newLocation,
      addAttendeeEmails,
      removeAttendeeEmails,
    } = parsed.data;

    // ── Fetch meeting ────────────────────────────────────────────────
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

    // Check for room conflicts when times are changing
    if ((newStartTime || newEndTime) && meeting.roomId) {
      await checkRoomConflict({
        roomId: meeting.roomId,
        startTime: newStartTime ? new Date(newStartTime) : meeting.startTime,
        endTime: newEndTime ? new Date(newEndTime) : meeting.endTime,
        excludeMeetingId: meetingId,
      });
    }

    const timezone = meeting.timezone ?? "America/Los_Angeles";
    const changes: Record<string, unknown> = {};

    // ── Apply event field updates to Google Calendar ──────────────────
    const hasFieldUpdates =
      newStartTime || newEndTime || newTitle || newDescription || newLocation;

    if (hasFieldUpdates) {
      const updates: Parameters<typeof silentlyUpdateEvent>[0]["updates"] = {};

      if (newTitle) {
        updates.summary = newTitle;
        changes.title = { from: meeting.title, to: newTitle };
      }
      if (newDescription !== undefined) {
        updates.description = newDescription;
        changes.description = {
          from: meeting.description,
          to: newDescription,
        };
      }
      if (newLocation) {
        updates.location = newLocation;
        changes.location = { to: newLocation };
      }
      if (newStartTime) {
        updates.start = { dateTime: newStartTime, timeZone: timezone };
        changes.startTime = {
          from: meeting.startTime.toISOString(),
          to: newStartTime,
        };
      }
      if (newEndTime) {
        updates.end = { dateTime: newEndTime, timeZone: timezone };
        changes.endTime = {
          from: meeting.endTime.toISOString(),
          to: newEndTime,
        };
      }

      await silentlyUpdateEvent({
        calendarId: meeting.googleCalendarId,
        eventId: meeting.googleEventId,
        updates,
      });
    }

    // ── Apply attendee modifications to Google Calendar ───────────────
    const hasAttendeeChanges =
      (addAttendeeEmails && addAttendeeEmails.length > 0) ||
      (removeAttendeeEmails && removeAttendeeEmails.length > 0);

    if (hasAttendeeChanges) {
      await silentlyModifyAttendees({
        calendarId: meeting.googleCalendarId,
        eventId: meeting.googleEventId,
        addEmails: addAttendeeEmails,
        removeEmails: removeAttendeeEmails,
      });

      if (addAttendeeEmails && addAttendeeEmails.length > 0) {
        changes.addedAttendees = addAttendeeEmails;
      }
      if (removeAttendeeEmails && removeAttendeeEmails.length > 0) {
        changes.removedAttendees = removeAttendeeEmails;
      }
    }

    // ── Update local DB record ───────────────────────────────────────
    const dbUpdates: Partial<typeof meetings.$inferInsert> = {
      silentlyModified: true,
      lastSilentModificationAt: new Date(),
      updatedAt: new Date(),
    };

    if (newTitle) dbUpdates.title = newTitle;
    if (newDescription !== undefined) dbUpdates.description = newDescription;
    if (newStartTime) dbUpdates.startTime = new Date(newStartTime);
    if (newEndTime) dbUpdates.endTime = new Date(newEndTime);

    // Recalculate duration if times changed
    if (newStartTime || newEndTime) {
      const start = newStartTime
        ? new Date(newStartTime)
        : meeting.startTime;
      const end = newEndTime ? new Date(newEndTime) : meeting.endTime;
      dbUpdates.durationMinutes = Math.round(
        (end.getTime() - start.getTime()) / 60000
      );
    }

    const [updated] = await db
      .update(meetings)
      .set(dbUpdates)
      .where(eq(meetings.id, meetingId))
      .returning();

    // ── Write audit log ──────────────────────────────────────────────
    await logAudit({
      userId: null,
      action: "silent_update",
      entityType: "meeting",
      entityId: meetingId,
      changes,
    });

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
    console.error("Silent update failed:", error);
    return NextResponse.json(
      {
        error: "Silent update failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
