import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingParticipants, people, rooms } from "@/db/schema";
import { eq, and, gte, lte, ne } from "drizzle-orm";

import { startOfDay, endOfDay, parseISO } from "date-fns";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD

    const conditions = [
      eq(meetings.eventId, eventId),
      ne(meetings.status, "cancelled"),
    ];

    if (dateParam) {
      const dayStart = startOfDay(parseISO(dateParam));
      const dayEnd = endOfDay(parseISO(dateParam));
      conditions.push(gte(meetings.startTime, dayStart));
      conditions.push(lte(meetings.startTime, dayEnd));
    }

    const meetingRows = await db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(meetings.startTime);

    // Fetch participants for all meetings
    const meetingIds = meetingRows.map((m) => m.id);

    const participantsMap: Record<
      string,
      Array<{
        id: string;
        personId: string;
        role: string | null;
        person: {
          id: string;
          name: string;
          email: string;
          type: string;
        } | null;
      }>
    > = {};

    if (meetingIds.length > 0) {
      const allParticipants = await db
        .select({
          id: meetingParticipants.id,
          meetingId: meetingParticipants.meetingId,
          personId: meetingParticipants.personId,
          role: meetingParticipants.role,
          personName: people.name,
          personEmail: people.email,
          personType: people.type,
        })
        .from(meetingParticipants)
        .leftJoin(people, eq(meetingParticipants.personId, people.id));

      for (const p of allParticipants) {
        if (!meetingIds.includes(p.meetingId)) continue;
        if (!participantsMap[p.meetingId]) {
          participantsMap[p.meetingId] = [];
        }
        participantsMap[p.meetingId].push({
          id: p.id,
          personId: p.personId,
          role: p.role,
          person: p.personName
            ? {
                id: p.personId,
                name: p.personName,
                email: p.personEmail!,
                type: p.personType!,
              }
            : null,
        });
      }
    }

    // Fetch room info
    const roomIds = [
      ...new Set(
        meetingRows.map((m) => m.roomId).filter((r): r is string => !!r)
      ),
    ];

    const roomMap: Record<string, { id: string; name: string }> = {};
    if (roomIds.length > 0) {
      const roomRows = await db
        .select()
        .from(rooms)
        .where(eq(rooms.eventId, eventId));
      for (const r of roomRows) {
        roomMap[r.id] = { id: r.id, name: r.name };
      }
    }

    const result = meetingRows.map((m) => ({
      ...m,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
      createdAt: m.createdAt?.toISOString() ?? null,
      updatedAt: m.updatedAt?.toISOString() ?? null,
      externalRsvpLastChecked:
        m.externalRsvpLastChecked?.toISOString() ?? null,
      lastSilentModificationAt:
        m.lastSilentModificationAt?.toISOString() ?? null,
      participants: participantsMap[m.id] ?? [],
      room: m.roomId ? roomMap[m.roomId] ?? null : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch event meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch event meetings" },
      { status: 500 }
    );
  }
}
