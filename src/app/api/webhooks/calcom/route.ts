import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/calcom/webhooks";

// ─── Webhook Event Types ─────────────────────────────────────────────

interface CalcomWebhookPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    bookingId?: number;
    uid?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    references?: Array<{
      type: string;
      uid: string;
      meetingId?: string;
      meetingUrl?: string;
      externalCalendarId?: string;
    }>;
    cancellationReason?: string;
  };
}

// ─── POST /api/webhooks/calcom ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Read the raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-cal-signature-256") ?? "";

    // Verify the webhook signature
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.warn("Invalid Cal.com webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event: CalcomWebhookPayload = JSON.parse(rawBody);
    const { triggerEvent, payload } = event;

    console.log(`Cal.com webhook received: ${triggerEvent}`, {
      bookingId: payload.bookingId,
      uid: payload.uid,
    });

    switch (triggerEvent) {
      case "BOOKING_CREATED": {
        await handleBookingCreated(payload);
        break;
      }

      case "BOOKING_CANCELLED": {
        await handleBookingCancelled(payload);
        break;
      }

      case "BOOKING_RESCHEDULED": {
        await handleBookingRescheduled(payload);
        break;
      }

      default: {
        console.log(`Unhandled Cal.com webhook event: ${triggerEvent}`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to process Cal.com webhook:", error);
    // Return 200 to acknowledge receipt even on errors, to prevent retries
    return NextResponse.json({ received: true, error: "Processing failed" }, { status: 200 });
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────

async function handleBookingCreated(
  payload: CalcomWebhookPayload["payload"]
) {
  if (!payload.uid) {
    console.warn("BOOKING_CREATED: No uid in payload");
    return;
  }

  // Extract Google Calendar event ID from references
  let googleEventId: string | null = null;
  const googleRef = payload.references?.find(
    (ref) => ref.type === "google_calendar" || ref.type === "google"
  );
  if (googleRef?.uid) {
    googleEventId = googleRef.uid;
  }

  // Find the meeting by calcomBookingUid and update it
  const [updated] = await db
    .update(meetings)
    .set({
      calcomBookingId: payload.bookingId ?? null,
      calcomBookingUid: payload.uid,
      googleEventId,
      status: "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(meetings.calcomBookingUid, payload.uid))
    .returning();

  if (!updated) {
    console.log(
      `BOOKING_CREATED: No meeting found with calcomBookingUid=${payload.uid}`
    );
  } else {
    console.log(`BOOKING_CREATED: Updated meeting ${updated.id} to confirmed`);
  }
}

async function handleBookingCancelled(
  payload: CalcomWebhookPayload["payload"]
) {
  if (!payload.uid) {
    console.warn("BOOKING_CANCELLED: No uid in payload");
    return;
  }

  const [updated] = await db
    .update(meetings)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(meetings.calcomBookingUid, payload.uid))
    .returning();

  if (!updated) {
    console.log(
      `BOOKING_CANCELLED: No meeting found with calcomBookingUid=${payload.uid}`
    );
  } else {
    console.log(`BOOKING_CANCELLED: Updated meeting ${updated.id} to cancelled`);
  }
}

async function handleBookingRescheduled(
  payload: CalcomWebhookPayload["payload"]
) {
  if (!payload.uid) {
    console.warn("BOOKING_RESCHEDULED: No uid in payload");
    return;
  }

  const updateData: Record<string, unknown> = {
    status: "rescheduled",
    updatedAt: new Date(),
  };

  // Update start/end times if provided
  if (payload.startTime) {
    updateData.startTime = new Date(payload.startTime);
  }
  if (payload.endTime) {
    updateData.endTime = new Date(payload.endTime);
  }

  const [updated] = await db
    .update(meetings)
    .set(updateData)
    .where(eq(meetings.calcomBookingUid, payload.uid))
    .returning();

  if (!updated) {
    console.log(
      `BOOKING_RESCHEDULED: No meeting found with calcomBookingUid=${payload.uid}`
    );
  } else {
    console.log(
      `BOOKING_RESCHEDULED: Updated meeting ${updated.id} to rescheduled`
    );
  }
}
