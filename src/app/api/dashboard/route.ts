import { NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, goals, opportunities, auditLog } from "@/db/schema";
import {
  eq,
  and,
  gte,
  lte,
  inArray,
  desc,
  sql,
  count,
} from "drizzle-orm";

import {
  startOfWeek,
  endOfWeek,
  addDays,
  startOfDay,
  endOfDay,
} from "date-fns";

/**
 * GET /api/dashboard
 *
 * Returns all dashboard data in a single request:
 * - stats: meetings this week, RSVP rate, pipeline influenced, avg goal progress
 * - upcomingMeetings: next 7 days
 * - goals: active goals with progress
 * - pipelineSummary: $ by opportunity stage
 * - recentActivity: last 20 audit log entries
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const next7DaysEnd = endOfDay(addDays(now, 7));

    // ── 1. Meetings This Week ─────────────────────────────────────────
    const [meetingsThisWeekResult] = await db
      .select({ cnt: count() })
      .from(meetings)
      .where(
        and(
          gte(meetings.startTime, weekStart),
          lte(meetings.startTime, weekEnd),
          inArray(meetings.status, [
            "confirmed",
            "completed",
            "pending",
          ]),
          eventId ? eq(meetings.eventId, eventId) : undefined
        )
      );
    const meetingsThisWeek = meetingsThisWeekResult?.cnt ?? 0;

    // ── 2. RSVP Acceptance Rate ───────────────────────────────────────
    const [totalConfirmed] = await db
      .select({ cnt: count() })
      .from(meetings)
      .where(
        and(
          inArray(meetings.status, ["confirmed", "completed"]),
          eventId ? eq(meetings.eventId, eventId) : undefined
        )
      );

    const [acceptedRsvp] = await db
      .select({ cnt: count() })
      .from(meetings)
      .where(
        and(
          inArray(meetings.status, ["confirmed", "completed"]),
          eq(meetings.externalRsvpStatus, "accepted"),
          eventId ? eq(meetings.eventId, eventId) : undefined
        )
      );

    const rsvpRate =
      (totalConfirmed?.cnt ?? 0) > 0
        ? Math.round(
            ((acceptedRsvp?.cnt ?? 0) / (totalConfirmed?.cnt ?? 1)) * 100
          )
        : 0;

    // ── 3. Pipeline Influenced ────────────────────────────────────────
    const pipelineResult = await db.execute(sql`
      SELECT COALESCE(SUM(o.amount), 0)::int as total,
             COUNT(DISTINCT o.id)::int as opp_count
      FROM meetings m
      JOIN opportunities o ON o.id = m.sfdc_opportunity_id
      WHERE m.status IN ('confirmed', 'completed')
      ${eventId ? sql`AND m.event_id = ${eventId}` : sql``}
    `);
    const pipelineRows = pipelineResult.rows as Array<{
      total: number;
      opp_count: number;
    }>;
    const pipelineInfluenced = pipelineRows[0]?.total ?? 0;
    const pipelineOppCount = pipelineRows[0]?.opp_count ?? 0;

    // ── 4. Active Goals Progress ──────────────────────────────────────
    const activeGoals = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.isActive, true),
          eventId ? eq(goals.eventId, eventId) : undefined
        )
      );

    const avgGoalProgress =
      activeGoals.length > 0
        ? Math.round(
            activeGoals.reduce((acc, g) => {
              const pct = g.targetValue > 0
                ? ((g.currentValue ?? 0) / g.targetValue) * 100
                : 0;
              return acc + Math.min(pct, 100);
            }, 0) / activeGoals.length
          )
        : 0;

    // ── 5. Upcoming Meetings (next 7 days) ────────────────────────────
    const upcomingMeetings = await db
      .select()
      .from(meetings)
      .where(
        and(
          gte(meetings.startTime, startOfDay(now)),
          lte(meetings.startTime, next7DaysEnd),
          inArray(meetings.status, [
            "confirmed",
            "pending",
            "draft",
          ]),
          eventId ? eq(meetings.eventId, eventId) : undefined
        )
      )
      .orderBy(meetings.startTime);

    // ── 6. Pipeline Summary by Stage ──────────────────────────────────
    const pipelineSummary = eventId
      ? await db.execute(sql`
          SELECT
            o.stage_name as "stageName",
            COALESCE(SUM(o.amount), 0)::int as "totalAmount",
            COUNT(*)::int as "count"
          FROM opportunities o
          JOIN meetings m ON m.sfdc_opportunity_id = o.id
          WHERE o.stage_name IS NOT NULL
            AND m.event_id = ${eventId}
          GROUP BY o.stage_name
          ORDER BY "totalAmount" DESC
        `)
      : await db.execute(sql`
          SELECT
            stage_name as "stageName",
            COALESCE(SUM(amount), 0)::int as "totalAmount",
            COUNT(*)::int as "count"
          FROM opportunities
          WHERE stage_name IS NOT NULL
          GROUP BY stage_name
          ORDER BY "totalAmount" DESC
        `);

    // ── 7. Recent Activity (last 20 audit log entries) ────────────────
    const recentActivity = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(20);

    // ── Assemble response ─────────────────────────────────────────────
    return NextResponse.json({
      stats: {
        meetingsThisWeek,
        rsvpRate,
        pipelineInfluenced,
        pipelineOppCount,
        avgGoalProgress,
        activeGoalCount: activeGoals.length,
      },
      upcomingMeetings: upcomingMeetings.map((m) => ({
        ...m,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
        createdAt: m.createdAt?.toISOString() ?? null,
        updatedAt: m.updatedAt?.toISOString() ?? null,
        externalRsvpLastChecked:
          m.externalRsvpLastChecked?.toISOString() ?? null,
        lastSilentModificationAt:
          m.lastSilentModificationAt?.toISOString() ?? null,
      })),
      goals: activeGoals.map((g) => ({
        ...g,
        periodStart: g.periodStart.toISOString(),
        periodEnd: g.periodEnd.toISOString(),
        createdAt: g.createdAt?.toISOString() ?? null,
        updatedAt: g.updatedAt?.toISOString() ?? null,
      })),
      pipelineSummary: pipelineSummary.rows as Array<{
        stageName: string;
        totalAmount: number;
        count: number;
      }>,
      recentActivity: recentActivity.map((a) => ({
        ...a,
        createdAt: a.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
