import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rooms, events } from "@/db/schema";
import { eq, asc } from "drizzle-orm";


const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
  availabilityStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  availabilityEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  meetingDurationMinutes: z.number().int().positive().optional().nullable(),
  breakDurationMinutes: z.number().int().min(0).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const results = await db
      .select()
      .from(rooms)
      .where(eq(rooms.eventId, eventId))
      .orderBy(asc(rooms.sortOrder), asc(rooms.name));

    return NextResponse.json(
      results.map((r) => ({
        ...r,
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    // Verify event exists
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

    const body = await request.json();
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(rooms)
      .values({
        ...parsed.data,
        eventId,
      })
      .returning();

    return NextResponse.json(
      {
        ...created,
        createdAt: created.createdAt?.toISOString() ?? null,
        updatedAt: created.updatedAt?.toISOString() ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
