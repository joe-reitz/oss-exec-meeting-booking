import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { getOpportunities } from "@/lib/d0/opportunities";
import { sql } from "drizzle-orm";

/**
 * POST /api/cron/sync-opportunities
 *
 * Cron job that syncs opportunities from the d0 API into the local database.
 * Intended to be called every 2 hours via Vercel Cron.
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

    // ── Fetch all opportunities from d0 ───────────────────────────────
    const d0Opportunities = await getOpportunities();

    if (d0Opportunities.length === 0) {
      return NextResponse.json({
        message: "No opportunities returned from d0",
        synced: 0,
      });
    }

    // ── Upsert into local opportunities table ─────────────────────────
    const now = new Date();
    let synced = 0;

    for (const opp of d0Opportunities) {
      await db
        .insert(opportunities)
        .values({
          id: opp.id,
          name: opp.name,
          accountId: opp.accountId,
          accountName: opp.accountName,
          ownerId: opp.ownerId,
          ownerName: opp.ownerName,
          stageName: opp.stageName,
          amount: opp.amount,
          closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
          probability: opp.probability,
          type: opp.type,
          lastSyncedAt: now,
        })
        .onConflictDoUpdate({
          target: opportunities.id,
          set: {
            name: sql`excluded.name`,
            accountId: sql`excluded.account_id`,
            accountName: sql`excluded.account_name`,
            ownerId: sql`excluded.owner_id`,
            ownerName: sql`excluded.owner_name`,
            stageName: sql`excluded.stage_name`,
            amount: sql`excluded.amount`,
            closeDate: sql`excluded.close_date`,
            probability: sql`excluded.probability`,
            type: sql`excluded.type`,
            lastSyncedAt: sql`excluded.last_synced_at`,
          },
        });

      synced++;
    }

    return NextResponse.json({
      message: "Opportunity sync complete",
      synced,
    });
  } catch (error) {
    console.error("Opportunity sync cron failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
