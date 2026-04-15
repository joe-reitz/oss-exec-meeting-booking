import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { goals, goalSegments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recalculateGoal } from "@/lib/goals/calculator";

const segmentSchema = z.object({
  segmentName: z.string().min(1),
  targetValue: z.number().int().positive(),
});

const updateGoalSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  type: z.enum(["meeting_quota", "pipeline_target", "account_coverage"]).optional(),
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  targetValue: z.number().int().positive("Target value must be positive").optional(),
  currentValue: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  personId: z.string().uuid().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  targetAccountList: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  segments: z.array(segmentSchema).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;

    const [goal] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, goalId))
      .limit(1);

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const segments = await db
      .select()
      .from(goalSegments)
      .where(eq(goalSegments.goalId, goalId));

    return NextResponse.json({ ...goal, segments });
  } catch (error) {
    console.error("Failed to fetch goal:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;
    const body = await request.json();
    const parsed = updateGoalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { segments, ...rest } = parsed.data;

    // Convert date strings to Date objects if present
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (rest.periodStart) {
      updateData.periodStart = new Date(rest.periodStart);
    }
    if (rest.periodEnd) {
      updateData.periodEnd = new Date(rest.periodEnd);
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, goalId))
      .returning();

    // Replace segments if provided
    if (segments !== undefined) {
      await db.delete(goalSegments).where(eq(goalSegments.goalId, goalId));
      if (segments.length > 0) {
        await db.insert(goalSegments).values(
          segments.map((seg) => ({
            goalId,
            segmentName: seg.segmentName,
            targetValue: seg.targetValue,
          }))
        );
      }
    }

    if (!updated) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Recalculate so progress reflects current data
    recalculateGoal(goalId).catch((err) =>
      console.error("Failed to recalculate updated goal:", err)
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update goal:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const { goalId } = await params;

    const [deleted] = await db
      .delete(goals)
      .where(eq(goals.id, goalId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
