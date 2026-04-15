import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingParticipants, people, goals } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/leaderboard
 *
 * Returns ranked AE/exec data for the leaderboard.
 * Query params:
 *   - view: "meetings" | "pipeline" | "goals" (default: "meetings")
 *   - eventId: optional event filter
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "meetings";
    const eventId = searchParams.get("eventId");

    switch (view) {
      case "meetings":
        return NextResponse.json(await getMeetingsLeaderboard(eventId));
      case "pipeline":
        return NextResponse.json(await getPipelineLeaderboard(eventId));
      case "goals":
        return NextResponse.json(await getGoalsLeaderboard(eventId));
      default:
        return NextResponse.json(
          { error: "Invalid view. Use: meetings, pipeline, goals" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}

interface LeaderboardEntry {
  personId: string;
  personName: string;
  personEmail: string;
  personType: string;
  value: number;
  rank: number;
}

async function getMeetingsLeaderboard(
  eventId: string | null
): Promise<LeaderboardEntry[]> {
  const result = await db.execute(sql`
    SELECT
      p.id as "personId",
      p.name as "personName",
      p.email as "personEmail",
      p.type as "personType",
      COUNT(DISTINCT m.id)::int as value
    FROM people p
    JOIN meeting_participants mp ON mp.person_id = p.id
    JOIN meetings m ON m.id = mp.meeting_id
    WHERE m.status IN ('confirmed', 'completed')
    ${eventId ? sql`AND m.event_id = ${eventId}` : sql``}
    GROUP BY p.id, p.name, p.email, p.type
    ORDER BY value DESC
  `);

  return (result.rows as Array<Omit<LeaderboardEntry, "rank">>).map(
    (row, i) => ({
      ...row,
      rank: i + 1,
    })
  );
}

async function getPipelineLeaderboard(
  eventId: string | null
): Promise<LeaderboardEntry[]> {
  const result = await db.execute(sql`
    SELECT
      p.id as "personId",
      p.name as "personName",
      p.email as "personEmail",
      p.type as "personType",
      COALESCE(SUM(o.amount), 0)::int as value
    FROM people p
    JOIN meeting_participants mp ON mp.person_id = p.id
    JOIN meetings m ON m.id = mp.meeting_id
    JOIN opportunities o ON o.id = m.sfdc_opportunity_id
    WHERE m.status IN ('confirmed', 'completed')
    ${eventId ? sql`AND m.event_id = ${eventId}` : sql``}
    GROUP BY p.id, p.name, p.email, p.type
    HAVING SUM(o.amount) > 0
    ORDER BY value DESC
  `);

  return (result.rows as Array<Omit<LeaderboardEntry, "rank">>).map(
    (row, i) => ({
      ...row,
      rank: i + 1,
    })
  );
}

async function getGoalsLeaderboard(
  eventId: string | null
): Promise<
  Array<LeaderboardEntry & { targetValue: number; goalCount: number }>
> {
  const result = await db.execute(sql`
    SELECT
      p.id as "personId",
      p.name as "personName",
      p.email as "personEmail",
      p.type as "personType",
      COUNT(g.id)::int as "goalCount",
      SUM(g.target_value)::int as "targetValue",
      SUM(g.current_value)::int as value,
      CASE WHEN SUM(g.target_value) > 0
        THEN ROUND((SUM(g.current_value)::numeric / SUM(g.target_value)::numeric) * 100)::int
        ELSE 0
      END as "completionPct"
    FROM people p
    JOIN goals g ON g.person_id = p.id
    WHERE g.is_active = true
    ${eventId ? sql`AND g.event_id = ${eventId}` : sql``}
    GROUP BY p.id, p.name, p.email, p.type
    ORDER BY "completionPct" DESC
  `);

  return (
    result.rows as Array<
      Omit<LeaderboardEntry, "rank"> & {
        targetValue: number;
        goalCount: number;
        completionPct: number;
      }
    >
  ).map((row, i) => ({
    ...row,
    rank: i + 1,
  }));
}
