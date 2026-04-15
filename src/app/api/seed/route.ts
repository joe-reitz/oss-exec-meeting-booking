import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  meetings,
  meetingParticipants,
  opportunities,
} from "@/db/schema";

/**
 * POST /api/seed — bulk-insert demo meetings and opportunities.
 * Bypasses Cal.com booking flow for seed data only.
 */

const meetingSchema = z.object({
  title: z.string(),
  eventId: z.string().uuid(),
  roomId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().int(),
  status: z.enum([
    "draft",
    "pending",
    "confirmed",
    "cancelled",
    "rescheduled",
    "completed",
  ]),
  externalAttendeeName: z.string(),
  externalAttendeeEmail: z.string(),
  externalAttendeeCompany: z.string().optional(),
  externalAttendeeTitle: z.string().optional(),
  externalRsvpStatus: z
    .enum(["needsAction", "declined", "tentative", "accepted"])
    .optional(),
  segment: z.string().optional(),
  sfdcOpportunityId: z.string().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
});

const opportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  accountName: z.string().optional(),
  ownerName: z.string().optional(),
  ownerId: z.string().optional(),
  stageName: z.string().optional(),
  amount: z.number().optional(),
  closeDate: z.string().optional(),
  probability: z.number().optional(),
  type: z.string().optional(),
});

const seedSchema = z.object({
  meetings: z.array(meetingSchema).default([]),
  opportunities: z.array(opportunitySchema).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = seedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const results = { meetings: 0, opportunities: 0 };

    // Insert meetings
    for (const m of parsed.data.meetings) {
      const { participantIds, ...meetingData } = m;

      const [created] = await db
        .insert(meetings)
        .values({
          ...meetingData,
          startTime: new Date(m.startTime),
          endTime: new Date(m.endTime),
        })
        .returning();

      // Add participants
      if (participantIds.length > 0 && created) {
        await db.insert(meetingParticipants).values(
          participantIds.map((personId) => ({
            meetingId: created.id,
            personId,
          }))
        );
      }

      results.meetings++;
    }

    // Insert opportunities
    for (const opp of parsed.data.opportunities) {
      await db
        .insert(opportunities)
        .values({
          ...opp,
          amount: opp.amount ?? null,
          closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
          probability: opp.probability ?? null,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: opportunities.id,
          set: {
            name: opp.name,
            accountName: opp.accountName,
            ownerName: opp.ownerName,
            stageName: opp.stageName,
            amount: opp.amount ?? null,
            probability: opp.probability ?? null,
            lastSyncedAt: new Date(),
          },
        });

      results.opportunities++;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Seed failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
