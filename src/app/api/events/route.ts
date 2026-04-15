import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  events,
  rooms,
  meetings,
  goals,
  goalSegments,
  eventParticipants,
} from "@/db/schema";
import { eq, asc, count, sql } from "drizzle-orm";
import { createEventType } from "@/lib/calcom/event-types";


const goalSegmentSchema = z.object({
  segmentName: z.string().min(1),
  targetValue: z.number().int().positive(),
});

const goalSchema = z.object({
  name: z.string().min(1),
  targetValue: z.number().int().positive(),
  segments: z.array(goalSegmentSchema).optional(),
});

const createEventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
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
  participantIds: z.array(z.string().uuid()).optional(),
  goals: z.array(goalSchema).optional(),
  meetingDuration: z.number().int().min(15).max(480).default(30),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const conditions =
      active === "true" ? eq(events.isActive, true) : undefined;

    const eventRows = await db
      .select()
      .from(events)
      .where(conditions)
      .orderBy(asc(events.startDate), asc(events.name));

    // Get room and meeting counts for each event
    const result = await Promise.all(
      eventRows.map(async (event) => {
        const [roomCount] = await db
          .select({ cnt: count() })
          .from(rooms)
          .where(eq(rooms.eventId, event.id));

        const [meetingCount] = await db
          .select({ cnt: count() })
          .from(meetings)
          .where(eq(meetings.eventId, event.id));

        return {
          ...event,
          startDate: event.startDate?.toISOString() ?? null,
          endDate: event.endDate?.toISOString() ?? null,
          createdAt: event.createdAt?.toISOString() ?? null,
          updatedAt: event.updatedAt?.toISOString() ?? null,
          roomCount: roomCount?.cnt ?? 0,
          meetingCount: meetingCount?.cnt ?? 0,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      participantIds,
      goals: goalInputs,
      meetingDuration,
      ...eventData
    } = parsed.data;

    // Auto-create Cal.com event type
    let calcomEventTypeId: number | null = null;
    try {
      const eventType = await createEventType({
        title: eventData.name,
        lengthInMinutes: meetingDuration,
        description: eventData.description ?? undefined,
        location: eventData.location ?? undefined,
      });
      calcomEventTypeId = eventType.id;
    } catch (error) {
      console.warn("Failed to auto-create Cal.com event type:", error);
    }

    const [created] = await db
      .insert(events)
      .values({
        ...eventData,
        calcomEventTypeId,
        startDate: eventData.startDate
          ? new Date(eventData.startDate)
          : null,
        endDate: eventData.endDate ? new Date(eventData.endDate) : null,
        createdById: null,
      })
      .returning();

    // Assign execs to event
    if (participantIds && participantIds.length > 0) {
      await db
        .insert(eventParticipants)
        .values(
          participantIds.map((personId) => ({
            eventId: created.id,
            personId,
          }))
        )
        .onConflictDoNothing();
    }

    // Create goals with optional segment breakdown
    if (goalInputs && goalInputs.length > 0) {
      const periodStart = created.startDate ?? new Date();
      const periodEnd = created.endDate ?? new Date();

      for (const goalInput of goalInputs) {
        const [goal] = await db
          .insert(goals)
          .values({
            name: goalInput.name,
            type: "meeting_quota",
            period: "yearly",
            periodStart,
            periodEnd,
            targetValue: goalInput.targetValue,
            unit: "meetings",
            eventId: created.id,
            isActive: true,
            createdById: null,
          })
          .returning();

        if (goalInput.segments && goalInput.segments.length > 0) {
          await db.insert(goalSegments).values(
            goalInput.segments.map((seg) => ({
              goalId: goal.id,
              segmentName: seg.segmentName,
              targetValue: seg.targetValue,
            }))
          );
        }
      }
    }

    return NextResponse.json(
      {
        ...created,
        startDate: created.startDate?.toISOString() ?? null,
        endDate: created.endDate?.toISOString() ?? null,
        createdAt: created.createdAt?.toISOString() ?? null,
        updatedAt: created.updatedAt?.toISOString() ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
