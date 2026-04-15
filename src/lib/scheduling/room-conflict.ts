import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, eq, lt, gt, notInArray, ne } from "drizzle-orm";

// ─── Error Class ────────────────────────────────────────────────────

export class RoomConflictError extends Error {
  conflictingMeetingId: string;
  conflictingMeetingTitle: string;
  conflictingStartTime: Date;
  conflictingEndTime: Date;

  constructor(conflicting: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
  }) {
    super(
      `Room conflict: overlaps with "${conflicting.title}" (${conflicting.startTime.toISOString()} – ${conflicting.endTime.toISOString()})`
    );
    this.name = "RoomConflictError";
    this.conflictingMeetingId = conflicting.id;
    this.conflictingMeetingTitle = conflicting.title;
    this.conflictingStartTime = conflicting.startTime;
    this.conflictingEndTime = conflicting.endTime;
  }
}

// ─── Conflict Check ─────────────────────────────────────────────────

export async function checkRoomConflict(params: {
  roomId: string;
  startTime: Date;
  endTime: Date;
  excludeMeetingId?: string;
}): Promise<void> {
  const { roomId, startTime, endTime, excludeMeetingId } = params;

  const conditions = [
    eq(meetings.roomId, roomId),
    notInArray(meetings.status, ["cancelled", "rescheduled"]),
    lt(meetings.startTime, endTime), // existing starts before new ends
    gt(meetings.endTime, startTime), // existing ends after new starts
  ];

  if (excludeMeetingId) {
    conditions.push(ne(meetings.id, excludeMeetingId));
  }

  const [conflict] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
    })
    .from(meetings)
    .where(and(...conditions))
    .limit(1);

  if (conflict) {
    throw new RoomConflictError(conflict);
  }
}
