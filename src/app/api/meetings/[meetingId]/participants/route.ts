import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetingParticipants, meetings, people } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const addParticipantSchema = z.object({
  personId: z.string().uuid(),
  role: z.enum(["exec", "ae", "host"]).optional().nullable(),
});

const removeParticipantSchema = z.object({
  personId: z.string().uuid(),
});

// ─── GET /api/meetings/[meetingId]/participants ─────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    const results = await db
      .select({
        id: meetingParticipants.id,
        meetingId: meetingParticipants.meetingId,
        personId: meetingParticipants.personId,
        role: meetingParticipants.role,
        googleRsvpStatus: meetingParticipants.googleRsvpStatus,
        createdAt: meetingParticipants.createdAt,
        personName: people.name,
        personEmail: people.email,
        personType: people.type,
        personTitle: people.title,
      })
      .from(meetingParticipants)
      .leftJoin(people, eq(meetingParticipants.personId, people.id))
      .where(eq(meetingParticipants.meetingId, meetingId));

    return NextResponse.json(
      results.map((r) => ({
        id: r.id,
        meetingId: r.meetingId,
        personId: r.personId,
        role: r.role,
        googleRsvpStatus: r.googleRsvpStatus,
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
    console.error("Failed to fetch meeting participants:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting participants" },
      { status: 500 }
    );
  }
}

// ─── POST /api/meetings/[meetingId]/participants ────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Verify meeting exists
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

    const body = await request.json();
    const parsed = addParticipantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(meetingParticipants)
      .values({
        meetingId,
        personId: parsed.data.personId,
        role: parsed.data.role ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        ...created,
        createdAt: created.createdAt?.toISOString() ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to add meeting participant:", error);
    return NextResponse.json(
      { error: "Failed to add meeting participant" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/meetings/[meetingId]/participants ───────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const parsed = removeParticipantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(meetingParticipants)
      .where(
        and(
          eq(meetingParticipants.meetingId, meetingId),
          eq(meetingParticipants.personId, parsed.data.personId)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove meeting participant:", error);
    return NextResponse.json(
      { error: "Failed to remove meeting participant" },
      { status: 500 }
    );
  }
}
