import { db } from "@/db";
import { people, meetings } from "@/db/schema";
import { eq, and, gte, lte, inArray, ne, notInArray } from "drizzle-orm";
import { getAvailableSlots } from "@/lib/calcom/slots";

// ─── Types ───────────────────────────────────────────────────────────

export interface AvailableSlot {
  start: string;
  end: string;
}

export interface GetCombinedAvailabilityParams {
  personIds: string[];
  roomId?: string;
  startDate: string;
  endDate: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Compute the intersection of two sorted lists of non-overlapping time ranges.
 */
function intersectRanges(a: TimeRange[], b: TimeRange[]): TimeRange[] {
  const result: TimeRange[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    const start = a[i].start > b[j].start ? a[i].start : b[j].start;
    const end = a[i].end < b[j].end ? a[i].end : b[j].end;

    if (start < end) {
      result.push({ start, end });
    }

    // Advance the pointer whose interval ends first
    if (a[i].end < b[j].end) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}

/**
 * Subtract a list of blocked ranges from available ranges.
 * Both inputs must be sorted by start time.
 */
function subtractRanges(
  available: TimeRange[],
  blocked: TimeRange[]
): TimeRange[] {
  const result: TimeRange[] = [];

  for (const slot of available) {
    let current = new Date(slot.start.getTime());

    for (const block of blocked) {
      if (block.end <= slot.start) continue; // block is before slot
      if (block.start >= slot.end) break; // block is after slot

      // There is overlap
      if (block.start > current) {
        result.push({ start: new Date(current.getTime()), end: new Date(block.start.getTime()) });
      }
      if (block.end > current) {
        current = new Date(block.end.getTime());
      }
    }

    if (current < slot.end) {
      result.push({ start: current, end: new Date(slot.end.getTime()) });
    }
  }

  return result;
}

/**
 * Parse Cal.com slot response into sorted TimeRange[].
 * Cal.com returns slots keyed by date string. Each slot has a `time` field
 * representing the start of the slot. We assume consecutive slots represent
 * contiguous availability, so we merge adjacent slots.
 * For intersection purposes we treat each slot as a 30-minute window.
 */
function calcomSlotsToRanges(
  slotsMap: Record<string, { time: string }[]>
): TimeRange[] {
  const ranges: TimeRange[] = [];

  for (const dateSlots of Object.values(slotsMap)) {
    for (const slot of dateSlots) {
      const start = new Date(slot.time);
      // Default slot duration: 30 minutes; this is used purely for intersection
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      ranges.push({ start, end });
    }
  }

  // Sort by start time
  ranges.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge contiguous / overlapping ranges
  const merged: TimeRange[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start.getTime() <= last.end.getTime()) {
      last.end = r.end > last.end ? r.end : last.end;
    } else {
      merged.push({ start: new Date(r.start.getTime()), end: new Date(r.end.getTime()) });
    }
  }

  return merged;
}

// ─── Main Function ───────────────────────────────────────────────────

/**
 * Fetch combined availability for a set of people (and optionally a room)
 * within a date range. Returns the intersection of all participants'
 * Cal.com availability minus existing meetings in the room.
 */
export async function getCombinedAvailability(
  params: GetCombinedAvailabilityParams
): Promise<AvailableSlot[]> {
  const { personIds, roomId, startDate, endDate } = params;

  // 1. Fetch people from DB to get their calcomUsernames
  const peopleRows = await db
    .select()
    .from(people)
    .where(inArray(people.id, personIds));

  // 2. Collect calcom usernames
  const usernames = peopleRows
    .map((p) => p.calcomUsername)
    .filter((u): u is string => !!u);

  // 3. Query Cal.com for availability of each person individually,
  //    then intersect their availabilities.
  let combinedRanges: TimeRange[] | null = null;

  if (usernames.length > 0) {
    for (const username of usernames) {
      try {
        const response = await getAvailableSlots({
          startTime: startDate,
          endTime: endDate,
          usernames: [username],
        });

        const personRanges = calcomSlotsToRanges(response.data.slots);

        if (combinedRanges === null) {
          combinedRanges = personRanges;
        } else {
          combinedRanges = intersectRanges(combinedRanges, personRanges);
        }
      } catch (error) {
        console.error(
          `Failed to fetch Cal.com slots for ${username}:`,
          error
        );
      }
    }
  }

  // If no Cal.com data available, create a full-range availability
  if (combinedRanges === null) {
    combinedRanges = [
      {
        start: new Date(startDate),
        end: new Date(endDate),
      },
    ];
  }

  // 4. If a room is specified, subtract existing meetings in that room
  if (roomId) {
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    const existingMeetings = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.roomId, roomId),
          notInArray(meetings.status, ["cancelled", "rescheduled"]),
          lte(meetings.startTime, rangeEnd),
          gte(meetings.endTime, rangeStart)
        )
      );

    const meetingRanges: TimeRange[] = existingMeetings
      .map((m) => ({
        start: new Date(m.startTime),
        end: new Date(m.endTime),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    combinedRanges = subtractRanges(combinedRanges, meetingRanges);
  }

  // 5. Convert to AvailableSlot[]
  return combinedRanges.map((r) => ({
    start: r.start.toISOString(),
    end: r.end.toISOString(),
  }));
}
