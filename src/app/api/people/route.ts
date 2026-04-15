import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { people } from "@/db/schema";
import { eq, asc } from "drizzle-orm";


const createPersonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  type: z.enum(["exec", "ae"]),
  title: z.string().optional(),
  calcomUsername: z.string().optional(),
  calcomEventTypeId: z.number().int().optional(),
  googleCalendarId: z.string().optional(),
  sfdcOwnerId: z.string().optional(),
  userId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const conditions = (type === "exec" || type === "ae") ? eq(people.type, type) : undefined;

    const results = await db
      .select()
      .from(people)
      .where(conditions)
      .orderBy(asc(people.name));
    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to fetch people:", error);
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createPersonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [created] = await db.insert(people).values(parsed.data).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create person:", error);
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    );
  }
}
