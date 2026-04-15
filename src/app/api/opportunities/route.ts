import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { eq, and, ilike, or, asc } from "drizzle-orm";


/**
 * GET /api/opportunities
 *
 * Returns opportunities from the local database (cached from d0 sync).
 * Supports filters: ?ownerId=, ?accountName=, ?stageName=, ?search=
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");
    const accountName = searchParams.get("accountName");
    const stageName = searchParams.get("stageName");
    const search = searchParams.get("search");

    // Build conditions
    const conditions = [];

    if (ownerId) {
      conditions.push(eq(opportunities.ownerId, ownerId));
    }

    if (accountName) {
      conditions.push(eq(opportunities.accountName, accountName));
    }

    if (stageName) {
      conditions.push(eq(opportunities.stageName, stageName));
    }

    if (search) {
      conditions.push(
        or(
          ilike(opportunities.name, `%${search}%`),
          ilike(opportunities.accountName, `%${search}%`)
        )
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(opportunities)
      .where(whereClause)
      .orderBy(asc(opportunities.name));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to fetch opportunities:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}
