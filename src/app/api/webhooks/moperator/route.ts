import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { meetingRequests } from "@/db/schema";

const WEBHOOK_SECRET = process.env.MOPERATOR_WEBHOOK_SECRET;

const moperatorPayloadSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  meetingType: z.enum(["prospect", "customer"]).default("prospect"),
  noRoomRequired: z.boolean().default(false),
  accountName: z.string().min(1),
  estimatedDealSize: z.string().default("Unknown"),
  businessImpact: z.string().default("Not specified"),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestTitle: z.string().default("Not specified"),
  guestCompany: z.string().default("Not specified"),
  additionalGuests: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    title: z.string().optional(),
    company: z.string().optional(),
  })).optional(),
  goalOutcome: z.string().default("Not specified"),
  requiresExec: z.boolean().default(false),
  requestedExecIds: z.array(z.string()).optional(),
  needsSe: z.boolean().default(false),
  preferredDateWindow: z.string().default("Flexible"),
  notes: z.string().default("Submitted via mOperator"),
  requesterName: z.string().min(1),
  requesterEmail: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    if (WEBHOOK_SECRET) {
      const secret = request.headers.get("x-webhook-secret");
      if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();
    const parsed = moperatorPayloadSchema.safeParse(body);

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
        source: "moperator",
      })
      .returning();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    return NextResponse.json(
      {
        success: true,
        requestId: created.id,
        url: `${appUrl}/requests?highlight=${created.id}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to process mOperator webhook:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}
