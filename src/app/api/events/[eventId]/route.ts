import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events, rooms, meetings, meetingParticipants, goals, opportunities, meetingRequests } from "@/db/schema";
import { eq, count, inArray } from "drizzle-orm";


const updateEventSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  timezone: z.string().optional(),
  calcomEventTypeId: z.number().int().optional().nullable(),
  sfdcExecCampaignId: z.string().optional().nullable(),
  sfdcAeCampaignId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const [roomCount] = await db
      .select({ cnt: count() })
      .from(rooms)
      .where(eq(rooms.eventId, eventId));

    const [meetingCount] = await db
      .select({ cnt: count() })
      .from(meetings)
      .where(eq(meetings.eventId, eventId));

    return NextResponse.json({
      ...event,
      startDate: event.startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
      createdAt: event.createdAt?.toISOString() ?? null,
      updatedAt: event.updatedAt?.toISOString() ?? null,
      roomCount: roomCount?.cnt ?? 0,
      meetingCount: meetingCount?.cnt ?? 0,
    });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updatedAt: new Date(),
    };
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate
        ? new Date(parsed.data.startDate)
        : null;
    }
    if (parsed.data.endDate !== undefined) {
      updateData.endDate = parsed.data.endDate
        ? new Date(parsed.data.endDate)
        : null;
    }

    const [updated] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, eventId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updated,
      startDate: updated.startDate?.toISOString() ?? null,
      endDate: updated.endDate?.toISOString() ?? null,
      createdAt: updated.createdAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to update event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    // 1. Find all meetings for this event
    const eventMeetings = await db
      .select({ id: meetings.id, sfdcOpportunityId: meetings.sfdcOpportunityId })
      .from(meetings)
      .where(eq(meetings.eventId, eventId));

    const meetingIds = eventMeetings.map((m) => m.id);

    // 2. Delete meeting requests (references meetings AND events)
    await db.delete(meetingRequests).where(eq(meetingRequests.eventId, eventId));

    // 3. Delete meeting participants
    if (meetingIds.length > 0) {
      await db
        .delete(meetingParticipants)
        .where(inArray(meetingParticipants.meetingId, meetingIds));
    }

    // 4. Delete meetings
    await db.delete(meetings).where(eq(meetings.eventId, eventId));

    // 5. Delete linked opportunities (seed/demo data)
    const oppIds = eventMeetings
      .map((m) => m.sfdcOpportunityId)
      .filter((id): id is string => id !== null);
    if (oppIds.length > 0) {
      await db.delete(opportunities).where(inArray(opportunities.id, oppIds));
    }

    // 6. Delete goals for this event
    await db.delete(goals).where(eq(goals.eventId, eventId));

    // 7. Delete the event (rooms, event_participants cascade automatically)
    const [deleted] = await db
      .delete(events)
      .where(eq(events.id, eventId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
