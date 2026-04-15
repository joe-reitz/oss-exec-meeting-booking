import { db } from "@/db";
import { goals, goalSegments, meetings } from "@/db/schema";
import { eq, and, gte, lte, inArray, sql, count } from "drizzle-orm";

/**
 * Recalculates the currentValue for a single goal based on its type.
 *
 * - meeting_quota: COUNT of confirmed/completed meetings in the period,
 *   optionally scoped to personId (via meeting participants) and eventId.
 * - pipeline_target: SUM of opportunity amounts for meetings that have a
 *   linked sfdcOpportunityId within the period.
 * - account_coverage: COUNT DISTINCT accountNames from opportunities linked
 *   to meetings in the period, intersected with the goal's targetAccountList.
 */
export async function recalculateGoal(
  goalId: string
): Promise<{ currentValue: number }> {
  // Fetch the goal
  const [goal] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, goalId))
    .limit(1);

  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  let currentValue = 0;

  switch (goal.type) {
    case "meeting_quota": {
      currentValue = await calculateMeetingQuota(goal);
      break;
    }
    case "pipeline_target": {
      currentValue = await calculatePipelineTarget(goal);
      break;
    }
    case "account_coverage": {
      currentValue = await calculateAccountCoverage(goal);
      break;
    }
    default: {
      throw new Error(`Unknown goal type: ${goal.type}`);
    }
  }

  // Update the goal's currentValue
  await db
    .update(goals)
    .set({ currentValue, updatedAt: new Date() })
    .where(eq(goals.id, goalId));

  // Recalculate segment breakdowns if they exist
  if (goal.type === "meeting_quota") {
    await recalculateGoalSegments(goal);
  }

  return { currentValue };
}

/**
 * Recalculates all active goals. Returns counts of updated and errored goals.
 */
export async function recalculateAllGoals(): Promise<{
  updated: number;
  errors: number;
}> {
  const activeGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.isActive, true));

  let updated = 0;
  let errors = 0;

  for (const goal of activeGoals) {
    try {
      await recalculateGoal(goal.id);
      updated++;
    } catch (error) {
      console.error(`Failed to recalculate goal ${goal.id}:`, error);
      errors++;
    }
  }

  return { updated, errors };
}

// ─── Segment recalculation ───────────────────────────────────────────

/**
 * Recalculate currentValue for each goal_segment row.
 * Counts confirmed/completed meetings matching the segment name,
 * scoped to the goal's event and period.
 */
async function recalculateGoalSegments(goal: GoalRow): Promise<void> {
  const segments = await db
    .select()
    .from(goalSegments)
    .where(eq(goalSegments.goalId, goal.id));

  if (segments.length === 0) return;

  for (const segment of segments) {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT m.id)::int as cnt
      FROM meetings m
      ${goal.personId ? sql`JOIN meeting_participants mp ON mp.meeting_id = m.id` : sql``}
      WHERE m.status IN ('confirmed', 'completed')
        AND m.start_time >= ${goal.periodStart}
        AND m.start_time <= ${goal.periodEnd}
        AND m.segment = ${segment.segmentName}
        ${goal.eventId ? sql`AND m.event_id = ${goal.eventId}` : sql``}
        ${goal.personId ? sql`AND mp.person_id = ${goal.personId}` : sql``}
    `);

    const rows = result.rows as Array<{ cnt: number }>;
    const currentValue = rows[0]?.cnt ?? 0;

    await db
      .update(goalSegments)
      .set({ currentValue })
      .where(eq(goalSegments.id, segment.id));
  }
}

// ─── Private helpers ──────────────────────────────────────────────────

type GoalRow = typeof goals.$inferSelect;

/**
 * COUNT confirmed or completed meetings in the goal's period.
 * Optionally scoped to personId (via meeting participants) and eventId.
 */
async function calculateMeetingQuota(goal: GoalRow): Promise<number> {
  const conditions = [
    inArray(meetings.status, ["confirmed", "completed"]),
    gte(meetings.startTime, goal.periodStart),
    lte(meetings.startTime, goal.periodEnd),
  ];

  if (goal.eventId) {
    conditions.push(eq(meetings.eventId, goal.eventId));
  }

  // If scoped to a person, we need to join through meeting_participants
  if (goal.personId) {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT m.id)::int as cnt
      FROM meetings m
      JOIN meeting_participants mp ON mp.meeting_id = m.id
      WHERE m.status IN ('confirmed', 'completed')
        AND m.start_time >= ${goal.periodStart}
        AND m.start_time <= ${goal.periodEnd}
        ${goal.eventId ? sql`AND m.event_id = ${goal.eventId}` : sql``}
        AND mp.person_id = ${goal.personId}
    `);

    const rows = result.rows as Array<{ cnt: number }>;
    return rows[0]?.cnt ?? 0;
  }

  const [result] = await db
    .select({ cnt: count() })
    .from(meetings)
    .where(and(...conditions));

  return result?.cnt ?? 0;
}

/**
 * SUM opportunity amounts for meetings linked via sfdcOpportunityId in the period.
 */
async function calculatePipelineTarget(goal: GoalRow): Promise<number> {
  const conditions = [
    gte(meetings.startTime, goal.periodStart),
    lte(meetings.startTime, goal.periodEnd),
    inArray(meetings.status, ["confirmed", "completed"]),
  ];

  if (goal.eventId) {
    conditions.push(eq(meetings.eventId, goal.eventId));
  }

  if (goal.personId) {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(o.amount), 0)::int as total
      FROM meetings m
      JOIN meeting_participants mp ON mp.meeting_id = m.id
      JOIN opportunities o ON o.id = m.sfdc_opportunity_id
      WHERE m.status IN ('confirmed', 'completed')
        AND m.start_time >= ${goal.periodStart}
        AND m.start_time <= ${goal.periodEnd}
        ${goal.eventId ? sql`AND m.event_id = ${goal.eventId}` : sql``}
        AND mp.person_id = ${goal.personId}
    `);

    const rows = result.rows as Array<{ total: number }>;
    return rows[0]?.total ?? 0;
  }

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(o.amount), 0)::int as total
    FROM meetings m
    JOIN opportunities o ON o.id = m.sfdc_opportunity_id
    WHERE m.status IN ('confirmed', 'completed')
      AND m.start_time >= ${goal.periodStart}
      AND m.start_time <= ${goal.periodEnd}
      ${goal.eventId ? sql`AND m.event_id = ${goal.eventId}` : sql``}
  `);

  const rows = result.rows as Array<{ total: number }>;
  return rows[0]?.total ?? 0;
}

/**
 * COUNT DISTINCT accountNames from opportunities linked to meetings in the period,
 * intersected with the goal's targetAccountList.
 */
async function calculateAccountCoverage(goal: GoalRow): Promise<number> {
  const targetAccounts = goal.targetAccountList ?? [];

  if (targetAccounts.length === 0) {
    return 0;
  }

  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT o.account_name)::int as cnt
    FROM meetings m
    JOIN opportunities o ON o.id = m.sfdc_opportunity_id
    WHERE m.status IN ('confirmed', 'completed')
      AND m.start_time >= ${goal.periodStart}
      AND m.start_time <= ${goal.periodEnd}
      AND o.account_name = ANY(${targetAccounts})
  `);

  const rows = result.rows as Array<{ cnt: number }>;
  return rows[0]?.cnt ?? 0;
}
