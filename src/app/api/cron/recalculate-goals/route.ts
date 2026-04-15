import { NextRequest, NextResponse } from "next/server";
import { recalculateAllGoals } from "@/lib/goals/calculator";

/**
 * POST /api/cron/recalculate-goals
 *
 * Cron job that recalculates all active goals.
 * Intended to be called every hour via Vercel Cron.
 *
 * Requires CRON_SECRET in the Authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth: verify cron secret ──────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Recalculate all active goals ──────────────────────────────────
    const results = await recalculateAllGoals();

    return NextResponse.json({
      message: "Goal recalculation complete",
      ...results,
    });
  } catch (error) {
    console.error("Goal recalculation cron failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
