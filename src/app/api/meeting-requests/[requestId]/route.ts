import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetingRequests, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { bookMeeting } from "@/lib/scheduling/booking-flow";
import { RoomConflictError } from "@/lib/scheduling/room-conflict";
import {
  sendSlackNotification,
  sendSlackDM,
  buildRequestApprovedMessage,
  buildInfoRequestedMessage,
} from "@/lib/notifications/slack";
import { auth } from "@/lib/auth";

// ─── Validation ──────────────────────────────────────────────────────

const approveSchema = z.object({
  status: z.literal("approved"),
  roomId: z.string().uuid("Room is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  durationMinutes: z.number().int().positive(),
  participantIds: z.array(z.string().uuid()).default([]),
});

const approveNoRoomSchema = z.object({
  status: z.literal("approved"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  durationMinutes: z.number().int().positive(),
  participantIds: z.array(z.string().uuid()).default([]),
});

const rejectSchema = z.object({
  status: z.literal("rejected"),
  rejectionReason: z.string().min(1, "Rejection reason is required"),
});

const infoRequestSchema = z.object({
  status: z.literal("info_requested"),
  infoRequestMessage: z.string().min(1, "Message is required"),
});

const cancelSchema = z.object({
  status: z.literal("cancelled"),
});

// ─── GET /api/meeting-requests/[requestId] ──────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    const rows = await db
      .select({
        id: meetingRequests.id,
        eventId: meetingRequests.eventId,
        status: meetingRequests.status,
        meetingType: meetingRequests.meetingType,
        noRoomRequired: meetingRequests.noRoomRequired,
        accountName: meetingRequests.accountName,
        estimatedDealSize: meetingRequests.estimatedDealSize,
        businessImpact: meetingRequests.businessImpact,
        guestName: meetingRequests.guestName,
        guestEmail: meetingRequests.guestEmail,
        guestTitle: meetingRequests.guestTitle,
        guestCompany: meetingRequests.guestCompany,
        additionalGuests: meetingRequests.additionalGuests,
        goalOutcome: meetingRequests.goalOutcome,
        requiresExec: meetingRequests.requiresExec,
        requestedExecIds: meetingRequests.requestedExecIds,
        needsSe: meetingRequests.needsSe,
        preferredDateWindow: meetingRequests.preferredDateWindow,
        notes: meetingRequests.notes,
        requesterName: meetingRequests.requesterName,
        requesterEmail: meetingRequests.requesterEmail,
        source: meetingRequests.source,
        rejectionReason: meetingRequests.rejectionReason,
        infoRequestMessage: meetingRequests.infoRequestMessage,
        meetingId: meetingRequests.meetingId,
        createdAt: meetingRequests.createdAt,
        updatedAt: meetingRequests.updatedAt,
        eventName: events.name,
      })
      .from(meetingRequests)
      .leftJoin(events, eq(meetingRequests.eventId, events.id))
      .where(eq(meetingRequests.id, requestId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Meeting request not found" },
        { status: 404 }
      );
    }

    const r = rows[0];
    return NextResponse.json({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch meeting request:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting request" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/meeting-requests/[requestId] ────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    // Require authenticated marketing or admin user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!["marketing", "admin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { requestId } = await params;
    const body = await request.json();

    // Look up current request
    const [existing] = await db
      .select()
      .from(meetingRequests)
      .where(eq(meetingRequests.id, requestId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Meeting request not found" },
        { status: 404 }
      );
    }

    const status = body.status;

    // ── Approve ─────────────────────────────────────────────────────
    if (status === "approved") {
      const isNoRoom = existing.noRoomRequired;
      const schema = isNoRoom ? approveNoRoomSchema : approveSchema;
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      // Look up event for timezone
      const [eventForTz] = await db
        .select({ timezone: events.timezone })
        .from(events)
        .where(eq(events.id, existing.eventId))
        .limit(1);

      // Create meeting via booking flow
      const meeting = await bookMeeting({
        title: `${existing.guestCompany || existing.accountName} - ${existing.guestName}`,
        eventId: existing.eventId,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        timezone: eventForTz?.timezone ?? "America/Los_Angeles",
        durationMinutes: parsed.data.durationMinutes,
        roomId: "roomId" in parsed.data ? (parsed.data as { roomId: string }).roomId : undefined,
        participantIds: parsed.data.participantIds,
        externalAttendeeName: existing.guestName,
        externalAttendeeEmail: existing.guestEmail,
        externalAttendeeCompany: existing.guestCompany ?? undefined,
        externalAttendeeTitle: existing.guestTitle ?? undefined,
        additionalAttendees: (existing.additionalGuests as Array<{ name: string; email: string; company?: string; title?: string }>) ?? undefined,
        noRoomRequired: isNoRoom,
        createdById: null,
      });

      const [updated] = await db
        .update(meetingRequests)
        .set({
          status: "approved",
          meetingId: meeting.id,
          updatedAt: new Date(),
        })
        .where(eq(meetingRequests.id, requestId))
        .returning();

      // Look up event name for Slack notification
      const [eventRow] = await db
        .select({ name: events.name })
        .from(events)
        .where(eq(events.id, existing.eventId))
        .limit(1);

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      // Fire-and-forget Slack notification
      sendSlackNotification(
        buildRequestApprovedMessage({
          accountName: existing.accountName,
          guestName: existing.guestName,
          eventName: eventRow?.name ?? "Unknown Event",
          meetingUrl: `${appUrl}/events/${existing.eventId}`,
        })
      ).catch(() => {});

      return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      });
    }

    // ── Reject ──────────────────────────────────────────────────────
    if (status === "rejected") {
      const parsed = rejectSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const [updated] = await db
        .update(meetingRequests)
        .set({
          status: "rejected",
          rejectionReason: parsed.data.rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(meetingRequests.id, requestId))
        .returning();

      return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      });
    }

    // ── Info Requested ──────────────────────────────────────────────
    if (status === "info_requested") {
      const parsed = infoRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const [updated] = await db
        .update(meetingRequests)
        .set({
          status: "info_requested",
          infoRequestMessage: parsed.data.infoRequestMessage,
          updatedAt: new Date(),
        })
        .where(eq(meetingRequests.id, requestId))
        .returning();

      // Send Slack DM to requester
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      sendSlackDM(
        existing.requesterEmail,
        buildInfoRequestedMessage({
          accountName: existing.accountName,
          requesterName: existing.requesterName,
          message: parsed.data.infoRequestMessage,
          requestUrl: `${appUrl}/requests`,
        })
      ).catch(() => {});

      return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      });
    }

    // ── Cancel ──────────────────────────────────────────────────────
    if (status === "cancelled") {
      const parsed = cancelSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const [updated] = await db
        .update(meetingRequests)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(meetingRequests.id, requestId))
        .returning();

      return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      });
    }

    return NextResponse.json(
      { error: "Invalid status transition" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof RoomConflictError) {
      return NextResponse.json(
        {
          error: "Room conflict",
          message: error.message,
          conflictingMeeting: {
            id: error.conflictingMeetingId,
            title: error.conflictingMeetingTitle,
            startTime: error.conflictingStartTime.toISOString(),
            endTime: error.conflictingEndTime.toISOString(),
          },
        },
        { status: 409 }
      );
    }
    console.error("Failed to update meeting request:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update meeting request",
      },
      { status: 500 }
    );
  }
}
