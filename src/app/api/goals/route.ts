import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { goals, goalSegments } from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { recalculateGoal } from "@/lib/goals/calculator";

const segmentSchema = z.object({
  segmentName: z.string().min(1),
  targetValue: z.number().int().positive(),
});

const createGoalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["meeting_quota", "pipeline_target", "account_coverage"]),
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  targetValue: z.number().int().positive("Target value must be positive"),
  unit: z.string().min(1, "Unit is required"),
  personId: z.string().uuid().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  targetAccountList: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  segments: z.array(segmentSchema).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");
    const personId = searchParams.get("personId");

    // Build conditions array
    const conditions = [];
    if (active === "true") {
      conditions.push(eq(goals.isActive, true));
    }
    if (personId) {
      conditions.push(eq(goals.personId, personId));
    }

    let results;
    if (conditions.length > 0) {
      results = await db
        .select()
        .from(goals)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(asc(goals.name));
    } else {
      results = await db.select().from(goals).orderBy(asc(goals.name));
    }

    // Fetch segments for all goals
    const goalIds = results.map((g) => g.id);
    const segments = goalIds.length > 0
      ? await db
          .select()
          .from(goalSegments)
          .where(inArray(goalSegments.goalId, goalIds))
      : [];

    const segmentsByGoal: Record<string, typeof segments> = {};
    for (const seg of segments) {
      if (!segmentsByGoal[seg.goalId]) segmentsByGoal[seg.goalId] = [];
      segmentsByGoal[seg.goalId].push(seg);
    }

    return NextResponse.json(
      results.map((g) => ({
        ...g,
        segments: segmentsByGoal[g.id] ?? [],
      }))
    );
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createGoalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { segments, ...goalData } = parsed.data;

    const [created] = await db
      .insert(goals)
      .values({
        ...goalData,
        periodStart: new Date(goalData.periodStart),
        periodEnd: new Date(goalData.periodEnd),
        createdById: null,
      })
      .returning();

    if (segments && segments.length > 0) {
      await db.insert(goalSegments).values(
        segments.map((seg) => ({
          goalId: created.id,
          segmentName: seg.segmentName,
          targetValue: seg.targetValue,
        }))
      );
    }

    // Recalculate immediately so the goal reflects current data
    recalculateGoal(created.id).catch((err) =>
      console.error("Failed to recalculate new goal:", err)
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create goal:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
