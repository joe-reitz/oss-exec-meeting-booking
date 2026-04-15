import { NextResponse } from "next/server";
import { db } from "@/db";
import { meetingRequests } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  try {
    const [result] = await db
      .select({ pending: count() })
      .from(meetingRequests)
      .where(eq(meetingRequests.status, "pending"));

    return NextResponse.json({ pending: result.pending });
  } catch (error) {
    console.error("Failed to count meeting requests:", error);
    return NextResponse.json(
      { error: "Failed to count meeting requests" },
      { status: 500 }
    );
  }
}
