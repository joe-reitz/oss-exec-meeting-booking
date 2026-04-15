import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createEventType, patchEventType } from "@/lib/calcom/event-types";

const setupSchema = z.object({
  lengthInMinutes: z.number().int().min(15).max(480).default(30),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const eventType = await createEventType({
      title: event.name,
      lengthInMinutes: parsed.data.lengthInMinutes,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
    });

    // Attempt to disable Cal.com's default confirmation emails
    // so we can send our own branded emails via SendGrid instead.
    try {
      await patchEventType(eventType.id, {
        disableBookingConfirmationEmails: true,
      });
    } catch (err) {
      console.warn(
        "Failed to disable Cal.com confirmation emails for event type",
        eventType.id,
        "— you may need to toggle this manually in the Cal.com dashboard.",
        err
      );
    }

    const [updated] = await db
      .update(events)
      .set({
        calcomEventTypeId: eventType.id,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    return NextResponse.json({
      calcomEventTypeId: eventType.id,
      calcomSlug: eventType.slug,
      lengthInMinutes: eventType.lengthInMinutes,
      event: {
        ...updated,
        startDate: updated.startDate?.toISOString() ?? null,
        endDate: updated.endDate?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to set up Cal.com event type:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Cal.com event type",
      },
      { status: 500 }
    );
  }
}
