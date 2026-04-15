import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { people } from "@/db/schema";
import { eq } from "drizzle-orm";


const updatePersonSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  type: z.enum(["exec", "ae"]).optional(),
  title: z.string().optional(),
  calcomUsername: z.string().optional(),
  calcomEventTypeId: z.number().int().optional(),
  googleCalendarId: z.string().optional(),
  sfdcOwnerId: z.string().optional(),
  userId: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const { personId } = await params;

    const [person] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error("Failed to fetch person:", error);
    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const { personId } = await params;
    const body = await request.json();
    const parsed = updatePersonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(people)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(people.id, personId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update person:", error);
    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const { personId } = await params;

    const [deleted] = await db
      .delete(people)
      .where(eq(people.id, personId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete person:", error);
    return NextResponse.json(
      { error: "Failed to delete person" },
      { status: 500 }
    );
  }
}
