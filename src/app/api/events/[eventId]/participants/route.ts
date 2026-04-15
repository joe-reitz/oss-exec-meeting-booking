import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { eventParticipants, events, people } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const upsertParticipantsSchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
});

const removeParticipantsSchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
});

// ─── GET /api/events/[eventId]/participants ─────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const results = await db
      .select({
        id: eventParticipants.id,
        eventId: eventParticipants.eventId,
        personId: eventParticipants.personId,
        createdAt: eventParticipants.createdAt,
        personName: people.name,
        personEmail: people.email,
        personType: people.type,
        personTitle: people.title,
      })
      .from(eventParticipants)
      .leftJoin(people, eq(eventParticipants.personId, people.id))
      .where(eq(eventParticipants.eventId, eventId));

    return NextResponse.json(
      results.map((r) => ({
        id: r.id,
        eventId: r.eventId,
        personId: r.personId,
        createdAt: r.createdAt?.toISOString() ?? null,
        person: r.personName
          ? {
              id: r.personId,
              name: r.personName,
              email: r.personEmail,
              type: r.personType,
              title: r.personTitle,
            }
          : null,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch event participants:", error);
    return NextResponse.json(
      { error: "Failed to fetch event participants" },
      { status: 500 }
    );
  }
}

// ─── POST /api/events/[eventId]/participants ────────────────────────

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
    const parsed = upsertParticipantsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Bulk upsert — insert ignoring conflicts on (eventId, personId)
    const inserted = await db
      .insert(eventParticipants)
      .values(
        parsed.data.personIds.map((personId) => ({
          eventId,
          personId,
        }))
      )
      .onConflictDoNothing()
      .returning();

    return NextResponse.json(
      inserted.map((r) => ({
        ...r,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to add event participants:", error);
    return NextResponse.json(
      { error: "Failed to add event participants" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/events/[eventId]/participants ──────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const parsed = removeParticipantsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          inArray(eventParticipants.personId, parsed.data.personIds)
        )
      );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove event participants:", error);
    return NextResponse.json(
      { error: "Failed to remove event participants" },
      { status: 500 }
    );
  }
}
