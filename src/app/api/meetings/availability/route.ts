import { NextRequest, NextResponse } from "next/server";

import { getCombinedAvailability } from "@/lib/scheduling/availability";

// ─── GET /api/meetings/availability ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personIdsParam = searchParams.get("personIds");
    const roomId = searchParams.get("roomId") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!personIdsParam || !startDate || !endDate) {
      return NextResponse.json(
        {
          error:
            "Missing required query parameters: personIds, startDate, endDate",
        },
        { status: 400 }
      );
    }

    const personIds = personIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (personIds.length === 0) {
      return NextResponse.json(
        { error: "At least one personId is required" },
        { status: 400 }
      );
    }

    const slots = await getCombinedAvailability({
      personIds,
      roomId,
      startDate,
      endDate,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Failed to fetch availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
