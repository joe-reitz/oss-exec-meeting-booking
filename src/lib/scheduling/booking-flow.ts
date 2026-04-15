import { db } from "@/db";
import {
  meetings,
  meetingParticipants,
  externalAttendees,
  events,
  people,
  rooms,
  opportunities,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { checkRoomConflict } from "@/lib/scheduling/room-conflict";
import { createBooking } from "@/lib/calcom/bookings";
import { getCalendarClient } from "@/lib/google/client";
import { recalculateAllGoals } from "@/lib/goals/calculator";
import { sendBookingConfirmationEmail } from "@/lib/email/send";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────

export interface BookMeetingParams {
  title: string;
  description?: string;
  eventId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  durationMinutes: number;
  roomId?: string;
  participantIds: string[];
  externalAttendeeName: string;
  externalAttendeeEmail: string;
  externalAttendeeCompany?: string;
  externalAttendeeTitle?: string;
  additionalAttendees?: Array<{
    name: string;
    email: string;
    company?: string;
    title?: string;
  }>;
  sfdcOpportunityId?: string;
  noRoomRequired?: boolean;
  createdById?: string | null;
}

export type Meeting = typeof meetings.$inferSelect;

// ─── Main Function ───────────────────────────────────────────────────

/**
 * Orchestrate the full booking flow:
 * 1. Look up the event to get the calcomEventTypeId
 * 2. Create a booking via the Cal.com API
 * 3. Insert a meeting row in the DB
 * 4. Insert meeting_participants rows
 * 5. Return the created meeting
 */
export async function bookMeeting(params: BookMeetingParams): Promise<Meeting> {
  const {
    title,
    description,
    eventId,
    startTime,
    endTime,
    timezone,
    durationMinutes,
    roomId,
    participantIds,
    externalAttendeeName,
    externalAttendeeEmail,
    externalAttendeeCompany,
    externalAttendeeTitle,
    additionalAttendees,
    sfdcOpportunityId,
    noRoomRequired,
    createdById,
  } = params;

  // 1. Look up the event for calcomEventTypeId
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  // 1b. Check for room conflicts before proceeding
  if (roomId) {
    await checkRoomConflict({
      roomId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });
  }

  // 2. Look up participants to determine roles
  const participantRows =
    participantIds.length > 0
      ? await db
          .select()
          .from(people)
          .where(inArray(people.id, participantIds))
      : [];

  // 3. Look up room name for the description
  let roomName: string | null = null;
  if (roomId) {
    const [roomRow] = await db
      .select({ name: rooms.name })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    roomName = roomRow?.name ?? null;
  }

  // 4. Build rich calendar description
  const calendarDescription = buildCalendarDescription({
    participants: participantRows,
    externalAttendeeName,
    externalAttendeeEmail,
    externalAttendeeTitle,
    externalAttendeeCompany,
    roomName,
    eventLocation: event.location,
    startTime,
    durationMinutes,
  });

  // Use the rich description if none was provided
  const meetingDescription = description ?? calendarDescription;

  // 5. Create booking via Cal.com (with allowConflicts to bypass availability)
  //    Falls back to direct Google Calendar if Cal.com is not configured.
  //    Skipped entirely for no-room-required (AE) meetings.
  let calcomBookingId: number | null = null;
  let calcomBookingUid: string | null = null;
  let googleEventId: string | null = null;
  let googleCalendarId: string | null = null;
  let inviteError: string | null = null;

  if (noRoomRequired) {
    // No-room meetings skip calendar integrations entirely
  } else if (event.calcomEventTypeId) {
    try {
      // Build description with room + additional attendees for Cal.com email
      const notesParts: string[] = [];
      if (roomName) notesParts.push(`Room: ${roomName}`);
      if (additionalAttendees?.length) {
        notesParts.push("Additional Attendees:");
        for (const a of additionalAttendees) {
          const parts = [a.name, a.title, a.company].filter(Boolean);
          notesParts.push(`  - ${parts.join(", ")} (${a.email})`);
        }
      }
      notesParts.push("", meetingDescription);
      const calcomNotes = notesParts.join("\n");

      // Collect additional attendee emails for Cal.com guests
      const guestEmails = additionalAttendees
        ?.filter((a) => a.email)
        .map((a) => a.email) ?? [];

      const calcomResponse = await createBooking({
        eventTypeId: event.calcomEventTypeId,
        start: startTime,
        attendee: {
          name: externalAttendeeName,
          email: externalAttendeeEmail,
          timeZone: timezone,
        },
        guests: guestEmails.length > 0 ? guestEmails : undefined,
        bookingFieldsResponses: { notes: calcomNotes },
        allowConflicts: true,
      });

      calcomBookingId = calcomResponse.data.id;
      calcomBookingUid = calcomResponse.data.uid;

      const googleRef = calcomResponse.data.references?.find(
        (ref) => ref.type === "google_calendar" || ref.type === "google"
      );
      if (googleRef?.uid) {
        googleEventId = googleRef.uid;
      }
    } catch (error) {
      console.error("Failed to create Cal.com booking:", error);
      const raw = error instanceof Error ? error.message : "Cal.com booking failed";
      const match = raw.match(/"message":"([^"]+)"/);
      inviteError = match ? match[1] : raw;
    }
  }

  // Fallback: if Cal.com failed or not configured, try Google Calendar directly
  if (!noRoomRequired && !googleEventId) {
    const calendarOwner = participantRows.find((p) => p.googleCalendarId);
    const hasGoogleCreds = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY;

    if (calendarOwner?.googleCalendarId && hasGoogleCreds) {
      try {
        const calendar = getCalendarClient(calendarOwner.email);
        const attendees = [
          { email: externalAttendeeEmail, displayName: externalAttendeeName },
          ...participantRows
            .filter((p) => p.id !== calendarOwner.id && p.email)
            .map((p) => ({ email: p.email, displayName: p.name })),
        ];

        const response = await calendar.events.insert({
          calendarId: calendarOwner.googleCalendarId,
          sendUpdates: "all",
          requestBody: {
            summary: title,
            description: meetingDescription,
            location: [roomName, event.location].filter(Boolean).join(", ") || undefined,
            start: { dateTime: startTime, timeZone: timezone },
            end: { dateTime: endTime, timeZone: timezone },
            attendees,
          },
        });

        googleEventId = response.data.id ?? null;
        googleCalendarId = calendarOwner.googleCalendarId;
        inviteError = null; // Clear Cal.com error since Google succeeded
      } catch (error) {
        console.error("Failed to create Google Calendar event:", error);
        if (!inviteError) {
          inviteError = error instanceof Error ? error.message : "Calendar invite failed";
        }
      }
    }
  }

  // 6. Look up account segment + linked opportunities via mOperator
  let segment: string | null = null;
  let linkedOpportunityId: string | null = sfdcOpportunityId ?? null;

  if (externalAttendeeEmail) {
    try {
      const moperatorUrl = process.env.MOPERATOR_API_URL;
      const moperatorKey = process.env.MOPERATOR_API_KEY;
      const moperatorBypass = process.env.MOPERATOR_BYPASS_SECRET;
      if (moperatorUrl && moperatorKey) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-api-key": moperatorKey,
        };
        if (moperatorBypass) {
          headers["x-vercel-protection-bypass"] = moperatorBypass;
        }

        const agentRes = await fetch(`${moperatorUrl}/api/agent`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [{
              role: "user",
              content: `What is the hierarchy_segment__c for the account associated with the contact with email ${externalAttendeeEmail}? Also list any opportunities where this contact has an OpportunityContactRole. Return as JSON only with keys "hierarchy_segment__c" and "opportunities" (array of {id, name, amount, stageName, accountId, accountName, ownerId, ownerName, closeDate, probability, type}). If contact not found, return {"hierarchy_segment__c": null, "opportunities": []}.`,
            }],
          }),
        });

        if (agentRes.ok) {
          const text = await agentRes.text();
          // Extract JSON from response (may be wrapped in markdown code block)
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            segment = data.hierarchy_segment__c ?? null;
            // Auto-link to first opportunity if none was manually specified
            if (!linkedOpportunityId && data.opportunities?.length > 0) {
              linkedOpportunityId = data.opportunities[0].id;
            }
            // Upsert returned opportunities into local DB
            if (data.opportunities?.length > 0) {
              for (const opp of data.opportunities) {
                if (!opp.id) continue;
                await db
                  .insert(opportunities)
                  .values({
                    id: opp.id,
                    name: opp.name ?? null,
                    accountId: opp.accountId ?? null,
                    accountName: opp.accountName ?? null,
                    ownerId: opp.ownerId ?? null,
                    ownerName: opp.ownerName ?? null,
                    stageName: opp.stageName ?? null,
                    amount: opp.amount ?? null,
                    closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
                    probability: opp.probability ?? null,
                    type: opp.type ?? null,
                    lastSyncedAt: new Date(),
                  })
                  .onConflictDoUpdate({
                    target: opportunities.id,
                    set: {
                      name: sql`excluded.name`,
                      accountName: sql`excluded.account_name`,
                      stageName: sql`excluded.stage_name`,
                      amount: sql`excluded.amount`,
                      lastSyncedAt: sql`excluded.last_synced_at`,
                    },
                  })
                  .catch(() => {}); // best-effort
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch contact data from mOperator:", error);
    }
  }

  // 7. Determine initial status
  // No-room meetings are always confirmed (no calendar integration needed)
  const status = noRoomRequired ? "confirmed" : (calcomBookingUid || googleEventId) ? "confirmed" : "draft";

  // 8. Insert meeting row
  const [meeting] = await db
    .insert(meetings)
    .values({
      title,
      description: meetingDescription,
      eventId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone,
      durationMinutes,
      status,
      roomId: roomId ?? null,
      noRoomRequired: noRoomRequired ?? false,
      calcomBookingId,
      calcomBookingUid,
      googleEventId,
      googleCalendarId,
      sfdcOpportunityId: linkedOpportunityId,
      externalAttendeeName,
      externalAttendeeEmail,
      externalAttendeeCompany: externalAttendeeCompany ?? null,
      externalAttendeeTitle: externalAttendeeTitle ?? null,
      segment,
      createdById: createdById ?? null,
    })
    .returning();

  // 9. Insert meeting_participants rows
  if (participantRows.length > 0) {
    await db.insert(meetingParticipants).values(
      participantRows.map((p) => ({
        meetingId: meeting.id,
        personId: p.id,
        role: p.type as "exec" | "ae",
      }))
    );
  }

  // 10. Insert additional external attendees
  if (additionalAttendees && additionalAttendees.length > 0) {
    await db.insert(externalAttendees).values(
      additionalAttendees.map((a) => ({
        meetingId: meeting.id,
        name: a.name,
        email: a.email,
        company: a.company ?? null,
        title: a.title ?? null,
      }))
    );
  }

  // 11. Add external attendees to SFDC campaigns via mOperator (fire-and-forget)
  const hasExec = participantRows.some((p) => p.type === "exec");
  const hasAe = participantRows.some((p) => p.type === "ae");
  const campaignsToAdd: Array<{ campaignId: string; label: string }> = [];
  if (event.sfdcExecCampaignId && hasExec) {
    campaignsToAdd.push({ campaignId: event.sfdcExecCampaignId, label: "exec" });
  }
  if (event.sfdcAeCampaignId && hasAe) {
    campaignsToAdd.push({ campaignId: event.sfdcAeCampaignId, label: "ae" });
  }

  console.log("[SFDC Campaign] participant types:", participantRows.map((p) => ({ name: p.name, type: p.type })));
  console.log("[SFDC Campaign] exec campaign:", event.sfdcExecCampaignId, "hasExec:", hasExec);
  console.log("[SFDC Campaign] ae campaign:", event.sfdcAeCampaignId, "hasAe:", hasAe);
  console.log("[SFDC Campaign] campaigns to add:", campaignsToAdd);

  if (campaignsToAdd.length > 0) {
    const allEmails = [
      externalAttendeeEmail,
      ...(additionalAttendees?.map((a) => a.email).filter(Boolean) ?? []),
    ];
    const emailList = allEmails.map((e) => `- ${e}`).join("\n");

    console.log("[SFDC Campaign] emails to add:", allEmails);

    const moperatorUrl = process.env.MOPERATOR_API_URL;
    const moperatorKey = process.env.MOPERATOR_API_KEY;
    const moperatorBypass = process.env.MOPERATOR_BYPASS_SECRET;

    if (moperatorUrl && moperatorKey) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": moperatorKey,
      };
      if (moperatorBypass) {
        headers["x-vercel-protection-bypass"] = moperatorBypass;
      }

      for (const { campaignId, label } of campaignsToAdd) {
        const prompt = `Add the following contacts as CampaignMembers to Campaign ${campaignId} with status "Responded". For each email, look up the Contact by email and create a CampaignMember record linking that Contact to the Campaign. If a Contact doesn't exist for an email, skip it.\n${emailList}`;
        console.log("[SFDC Campaign] sending mOperator request for", label, "campaign:", campaignId);

        fetch(`${moperatorUrl}/api/agent`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
          }),
        })
          .then(async (res) => {
            const body = await res.text();
            console.log("[SFDC Campaign] mOperator response for", label, "campaign:", res.status, body.slice(0, 500));
          })
          .catch((err) =>
            console.error(`[SFDC Campaign] Failed to add contacts to ${label} SFDC campaign:`, err)
          );
      }
    } else {
      console.log("[SFDC Campaign] mOperator not configured, skipping");
    }
  }

  // 12. Send branded confirmation email (fire-and-forget)
  sendBookingConfirmationEmail({
    meetingId: meeting.id,
    meetingTitle: title,
    startTime,
    endTime,
    timezone,
    durationMinutes,
    location: [roomName, event.location].filter(Boolean).join(", ") || undefined,
    description: meetingDescription,
    internalAttendees: participantRows.map((p) => ({
      name: p.name,
      email: p.email,
      title: p.title ?? undefined,
    })),
    externalAttendees: [
      {
        name: externalAttendeeName,
        email: externalAttendeeEmail,
        title: externalAttendeeTitle,
        company: externalAttendeeCompany,
      },
      ...(additionalAttendees ?? []),
    ],
  }).catch((err) =>
    console.error("Failed to send booking confirmation email:", err)
  );

  // 12. Recalculate goals (fire-and-forget so it doesn't block the response)
  recalculateAllGoals().catch((err) =>
    console.error("Failed to recalculate goals after booking:", err)
  );

  // @ts-expect-error — attaching non-schema field for API layer to surface
  meeting._inviteError = inviteError;
  return meeting;
}

// ─── Calendar Description Builder ───────────────────────────────────

function buildCalendarDescription(params: {
  participants: Array<{ name: string; title: string | null; type: string }>;
  externalAttendeeName: string;
  externalAttendeeEmail: string;
  externalAttendeeTitle?: string;
  externalAttendeeCompany?: string;
  roomName: string | null;
  eventLocation: string | null;
  startTime: string;
  durationMinutes: number;
}): string {
  const lines: string[] = [];

  // Internal attendees
  if (params.participants.length > 0) {
    lines.push("Internal Attendees:");
    for (const p of params.participants) {
      const role = p.type === "exec" ? "Exec" : "AE";
      const title = p.title ? `, ${p.title}` : "";
      lines.push(`  - ${p.name}${title} (${role})`);
    }
    lines.push("");
  }

  // External attendee
  lines.push("External Attendee:");
  const extTitle = params.externalAttendeeTitle
    ? `, ${params.externalAttendeeTitle}`
    : "";
  const extCompany = params.externalAttendeeCompany
    ? ` at ${params.externalAttendeeCompany}`
    : "";
  lines.push(
    `  - ${params.externalAttendeeName}${extTitle}${extCompany}`
  );
  lines.push(`    ${params.externalAttendeeEmail}`);
  lines.push("");

  // Location
  const locationParts = [params.roomName, params.eventLocation].filter(
    Boolean
  );
  if (locationParts.length > 0) {
    lines.push(`Location: ${locationParts.join(", ")}`);
  }

  // Time
  const start = new Date(params.startTime);
  const timeStr = format(start, "EEEE, MMMM d 'at' h:mm a");
  lines.push(`Time: ${timeStr} (${params.durationMinutes} min)`);

  return lines.join("\n");
}
