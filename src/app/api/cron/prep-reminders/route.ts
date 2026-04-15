import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  meetings,
  meetingParticipants,
  people,
  events,
  rooms,
} from "@/db/schema";
import { eq, and, gte, lte, isNull, inArray } from "drizzle-orm";
import { addDays, startOfDay, endOfDay } from "date-fns";

const MOPERATOR_URL = process.env.MOPERATOR_API_URL;
const MOPERATOR_API_KEY = process.env.MOPERATOR_API_KEY;

/**
 * POST /api/cron/prep-reminders
 *
 * Daily cron that sends Slack DM reminders to AEs for meetings
 * happening in 3 days that don't have prep notes yet.
 *
 * Requires CRON_SECRET in the Authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const reminderDayStart = startOfDay(addDays(now, 3));
    const reminderDayEnd = endOfDay(addDays(now, 3));

    // Find confirmed/pending meetings 3 days from now without a reminder sent
    const meetingRows = await db
      .select({
        meetingId: meetings.id,
        meetingTitle: meetings.title,
        startTime: meetings.startTime,
        eventId: meetings.eventId,
        roomId: meetings.roomId,
        externalAttendeeName: meetings.externalAttendeeName,
        externalAttendeeCompany: meetings.externalAttendeeCompany,
      })
      .from(meetings)
      .where(
        and(
          gte(meetings.startTime, reminderDayStart),
          lte(meetings.startTime, reminderDayEnd),
          inArray(meetings.status, ["confirmed", "pending"]),
          isNull(meetings.prepReminderSentAt)
        )
      );

    let sent = 0;
    let skipped = 0;

    for (const meeting of meetingRows) {
      // Find AE participant
      const participants = await db
        .select({
          personId: meetingParticipants.personId,
          role: meetingParticipants.role,
          personEmail: people.email,
          personName: people.name,
        })
        .from(meetingParticipants)
        .leftJoin(people, eq(meetingParticipants.personId, people.id))
        .where(eq(meetingParticipants.meetingId, meeting.meetingId));

      const ae = participants.find((p) => p.role === "ae");
      if (!ae?.personEmail) {
        skipped++;
        continue;
      }

      // Build reminder message
      const company = meeting.externalAttendeeCompany
        ? ` with ${meeting.externalAttendeeCompany}`
        : "";
      const attendee = meeting.externalAttendeeName
        ? ` (${meeting.externalAttendeeName})`
        : "";
      const dateStr = meeting.startTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      const message = [
        `:wave: Hey ${ae.personName?.split(" ")[0] ?? "there"}!`,
        ``,
        `Your meeting *${meeting.meetingTitle}*${company}${attendee} is coming up on *${dateStr}*.`,
        ``,
        `Please add your meeting prep notes in the Exec Meeting Booking app.`,
        `This helps the team prepare and makes the meeting more productive.`,
      ].join("\n");

      // Send Slack DM via mOperator
      if (MOPERATOR_URL && MOPERATOR_API_KEY) {
        try {
          const res = await fetch(
            `${MOPERATOR_URL}/api/notifications/slack-dm`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": MOPERATOR_API_KEY,
              },
              body: JSON.stringify({
                email: ae.personEmail,
                message,
              }),
            }
          );

          if (res.ok) {
            // Mark reminder as sent
            await db
              .update(meetings)
              .set({ prepReminderSentAt: new Date() })
              .where(eq(meetings.id, meeting.meetingId));
            sent++;
          } else {
            console.error(
              `Failed to send reminder for meeting ${meeting.meetingId}:`,
              await res.text()
            );
            skipped++;
          }
        } catch (error) {
          console.error(
            `Error sending reminder for meeting ${meeting.meetingId}:`,
            error
          );
          skipped++;
        }
      } else {
        console.warn("MOPERATOR_API_URL or MOPERATOR_API_KEY not configured");
        skipped++;
      }
    }

    return NextResponse.json({
      message: "Prep reminder cron complete",
      total: meetingRows.length,
      sent,
      skipped,
    });
  } catch (error) {
    console.error("Prep reminder cron failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
