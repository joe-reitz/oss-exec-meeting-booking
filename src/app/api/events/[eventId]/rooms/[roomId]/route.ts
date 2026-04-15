import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq, and } from "drizzle-orm";


const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
  availabilityStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  availabilityEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  meetingDurationMinutes: z.number().int().positive().optional().nullable(),
  breakDurationMinutes: z.number().int().min(0).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roomId: string }> }
) {
  try {
    const { eventId, roomId } = await params;
    const body = await request.json();
    const parsed = updateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(rooms)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(rooms.id, roomId), eq(rooms.eventId, eventId)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to update room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roomId: string }> }
) {
  try {
    const { eventId, roomId } = await params;

    const [deleted] = await db
      .delete(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.eventId, eventId)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
