import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetingRequests, events } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

// ─── Validation ──────────────────────────────────────────────────────

const createRequestSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  meetingType: z.enum(["prospect", "customer"], { message: "Meeting type is required" }),
  noRoomRequired: z.boolean().default(false),
  accountName: z.string().min(1, "Account name is required"),
  estimatedDealSize: z.string().min(1, "Estimated deal size is required"),
  businessImpact: z.string().min(1, "Business impact is required"),
  guestName: z.string().min(1, "Guest name is required"),
  guestEmail: z.string().email("Invalid email address"),
  guestTitle: z.string().min(1, "Guest title is required"),
  guestCompany: z.string().min(1, "Guest company is required"),
  additionalGuests: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    title: z.string().optional(),
    company: z.string().optional(),
  })).optional(),
  goalOutcome: z.string().min(1, "Goal / outcome is required"),
  requiresExec: z.boolean().default(false),
  requestedExecIds: z.array(z.string().uuid()).optional(),
  needsSe: z.boolean().default(false),
  preferredDateWindow: z.string().min(1, "Preferred date window is required"),
  notes: z.string().min(1, "Notes are required"),
  requesterName: z.string().min(1, "Requester name is required"),
  requesterEmail: z.string().email("Invalid requester email"),
});

// ─── GET /api/meeting-requests ──────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const eventId = searchParams.get("eventId");

    const conditions = [];

    if (status) {
      const validStatuses = ["pending", "approved", "rejected", "info_requested", "cancelled"] as const;
      const statuses = status.split(",").filter((s): s is typeof validStatuses[number] =>
        (validStatuses as readonly string[]).includes(s)
      );
      if (statuses.length === 1) {
        conditions.push(eq(meetingRequests.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(meetingRequests.status, statuses));
      }
    }

    if (eventId) {
      conditions.push(eq(meetingRequests.eventId, eventId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      .where(whereClause)
      .orderBy(desc(meetingRequests.createdAt));

    const result = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch meeting requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting requests" },
      { status: 500 }
    );
  }
}

// ─── POST /api/meeting-requests ─────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(meetingRequests)
      .values({
        ...parsed.data,
        source: "in_app",
      })
      .returning();

    return NextResponse.json(
      {
        ...created,
        createdAt: created.createdAt?.toISOString() ?? null,
        updatedAt: created.updatedAt?.toISOString() ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create meeting request:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create meeting request",
      },
      { status: 500 }
    );
  }
}
