import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { people, events, rooms, goals } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import { getCombinedAvailability } from "@/lib/scheduling/availability";
import { bookMeeting } from "@/lib/scheduling/booking-flow";

// ─── Tool definitions for the AI scheduling agent ──────────────────────

export const schedulingTools = {
  findAvailability: tool({
    description:
      "Find available meeting times for specified people and optionally a room. Returns time slots where all participants are free.",
    inputSchema: z.object({
      personNames: z
        .array(z.string())
        .describe("Names of execs/AEs to check availability for"),
      roomName: z.string().optional().describe("Optional room name"),
      eventName: z.string().optional().describe("Optional event/conference name to scope room search"),
      startDate: z
        .string()
        .describe("Start date for availability search (YYYY-MM-DD)"),
      endDate: z
        .string()
        .describe("End date for availability search (YYYY-MM-DD)"),
    }),
    execute: async ({
      personNames,
      roomName,
      eventName,
      startDate,
      endDate,
    }: {
      personNames: string[];
      roomName?: string;
      eventName?: string;
      startDate: string;
      endDate: string;
    }) => {
      // Look up people by name using ILIKE for flexible matching
      const matchedPeople = [];
      for (const name of personNames) {
        const results = await db
          .select()
          .from(people)
          .where(ilike(people.name, `%${name}%`));
        matchedPeople.push(...results);
      }

      if (matchedPeople.length === 0) {
        return {
          success: false as const,
          message: `Could not find any people matching: ${personNames.join(", ")}`,
          slots: [] as never[],
        };
      }

      // Look up room by name if provided
      let roomId: string | undefined;
      let matchedRoom: {
        id: string;
        name: string;
        capacity: number | null;
      } | null = null;
      if (roomName) {
        const roomConditions = [ilike(rooms.name, `%${roomName}%`)];
        if (eventName) {
          // Find event first, then scope room search
          const [event] = await db
            .select()
            .from(events)
            .where(ilike(events.name, `%${eventName}%`))
            .limit(1);
          if (event) {
            roomConditions.push(eq(rooms.eventId, event.id));
          }
        }

        const roomResults = await db
          .select()
          .from(rooms)
          .where(and(...roomConditions))
          .limit(1);

        if (roomResults.length > 0) {
          roomId = roomResults[0].id;
          matchedRoom = {
            id: roomResults[0].id,
            name: roomResults[0].name,
            capacity: roomResults[0].capacity,
          };
        } else {
          return {
            success: false as const,
            message: `Could not find room matching: ${roomName}`,
            slots: [] as never[],
          };
        }
      }

      // Get combined availability
      const personIds = matchedPeople.map((p) => p.id);
      const slots = await getCombinedAvailability({
        personIds,
        roomId,
        startDate,
        endDate,
      });

      return {
        success: true as const,
        participants: matchedPeople.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          title: p.title,
        })),
        room: matchedRoom,
        dateRange: { startDate, endDate },
        slots: slots.map((slot) => ({
          start: slot.start,
          end: slot.end,
          startFormatted: new Date(slot.start).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Los_Angeles",
          }),
          endFormatted: new Date(slot.end).toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Los_Angeles",
          }),
        })),
        totalSlots: slots.length,
      };
    },
  }),

  lookupPerson: tool({
    description:
      "Look up an executive or account executive by name. Returns matching people from the database.",
    inputSchema: z.object({
      name: z.string().describe("Name or partial name to search for"),
    }),
    execute: async ({ name }: { name: string }) => {
      const results = await db
        .select()
        .from(people)
        .where(
          or(
            ilike(people.name, `%${name}%`),
            ilike(people.email, `%${name}%`)
          )
        );

      if (results.length === 0) {
        return {
          success: false as const,
          message: `No people found matching "${name}"`,
          people: [] as never[],
        };
      }

      return {
        success: true as const,
        people: results.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          type: p.type,
          title: p.title,
          calcomUsername: p.calcomUsername,
        })),
      };
    },
  }),

  listRooms: tool({
    description:
      "List available rooms for a specific event/conference. Returns room details including capacity.",
    inputSchema: z.object({
      eventName: z.string().optional().describe("Event/conference name to list rooms for"),
    }),
    execute: async ({ eventName }: { eventName?: string }) => {
      if (eventName) {
        const [event] = await db
          .select()
          .from(events)
          .where(
            and(
              ilike(events.name, `%${eventName}%`),
              eq(events.isActive, true)
            )
          )
          .limit(1);

        if (!event) {
          return {
            success: false as const,
            message: `Could not find event matching: ${eventName}`,
            rooms: [] as never[],
          };
        }

        const roomResults = await db
          .select()
          .from(rooms)
          .where(eq(rooms.eventId, event.id));

        return {
          success: true as const,
          event: { id: event.id, name: event.name, location: event.location },
          rooms: roomResults.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            capacity: r.capacity,
          })),
          total: roomResults.length,
        };
      }

      // List all rooms grouped by event
      const allRooms = await db.select().from(rooms);
      return {
        success: true as const,
        rooms: allRooms.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          capacity: r.capacity,
          eventId: r.eventId,
        })),
        total: allRooms.length,
      };
    },
  }),

  listEvents: tool({
    description:
      "List available events/conferences. Returns active events with their dates and location.",
    inputSchema: z.object({}),
    execute: async () => {
      const results = await db
        .select()
        .from(events)
        .where(eq(events.isActive, true));

      return {
        success: true as const,
        events: results.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          location: e.location,
          startDate: e.startDate?.toISOString() ?? null,
          endDate: e.endDate?.toISOString() ?? null,
          timezone: e.timezone,
          color: e.color,
        })),
        total: results.length,
      };
    },
  }),

  checkGoalProgress: tool({
    description:
      "Check current progress toward meeting goals. Can filter by person or show team-wide goals.",
    inputSchema: z.object({
      personName: z
        .string()
        .optional()
        .describe("Person to check goals for, or omit for team-wide"),
    }),
    execute: async ({ personName }: { personName?: string }) => {
      let goalResults;

      if (personName) {
        // Find the person first
        const personResults = await db
          .select()
          .from(people)
          .where(ilike(people.name, `%${personName}%`))
          .limit(1);

        if (personResults.length === 0) {
          return {
            success: false as const,
            message: `No person found matching "${personName}"`,
            goals: [] as never[],
          };
        }

        const person = personResults[0];
        goalResults = await db
          .select()
          .from(goals)
          .where(
            and(eq(goals.personId, person.id), eq(goals.isActive, true))
          );
      } else {
        goalResults = await db
          .select()
          .from(goals)
          .where(eq(goals.isActive, true));
      }

      // For each goal, also look up the person's name if it has a personId
      const goalsWithPeople = await Promise.all(
        goalResults.map(async (goal) => {
          let goalPersonName: string | null = null;
          if (goal.personId) {
            const [person] = await db
              .select({ name: people.name })
              .from(people)
              .where(eq(people.id, goal.personId))
              .limit(1);
            goalPersonName = person?.name ?? null;
          }

          const progressPercent =
            goal.targetValue > 0
              ? Math.round(
                  ((goal.currentValue ?? 0) / goal.targetValue) * 100
                )
              : 0;

          return {
            id: goal.id,
            name: goal.name,
            type: goal.type,
            period: goal.period,
            periodStart: goal.periodStart.toISOString(),
            periodEnd: goal.periodEnd.toISOString(),
            targetValue: goal.targetValue,
            currentValue: goal.currentValue ?? 0,
            progressPercent,
            unit: goal.unit,
            personName: goalPersonName,
          };
        })
      );

      return {
        success: true as const,
        goals: goalsWithPeople,
        total: goalsWithPeople.length,
      };
    },
  }),

  bookMeeting: tool({
    description:
      "Book a meeting after user confirms the details. Always confirm with the user before calling this tool. Requires participant names, event, external attendee info, and time.",
    inputSchema: z.object({
      title: z.string().describe("Meeting title"),
      eventName: z.string().describe("Name of the event/conference"),
      participantNames: z
        .array(z.string())
        .describe("Names of internal participants (execs/AEs)"),
      externalAttendeeName: z
        .string()
        .describe("Name of the external attendee"),
      externalAttendeeEmail: z
        .string()
        .email()
        .describe("Email of the external attendee"),
      externalAttendeeCompany: z
        .string()
        .optional()
        .describe("Company of the external attendee"),
      startTime: z.string().describe("Meeting start time in ISO 8601 format"),
      endTime: z.string().describe("Meeting end time in ISO 8601 format"),
      timezone: z
        .string()
        .default("America/Los_Angeles")
        .describe("Timezone for the meeting"),
      roomName: z.string().optional().describe("Optional room name"),
    }),
    execute: async (params: {
      title: string;
      eventName: string;
      participantNames: string[];
      externalAttendeeName: string;
      externalAttendeeEmail: string;
      externalAttendeeCompany?: string;
      startTime: string;
      endTime: string;
      timezone: string;
      roomName?: string;
    }) => {
      // 1. Look up event by name
      const [event] = await db
        .select()
        .from(events)
        .where(
          and(
            ilike(events.name, `%${params.eventName}%`),
            eq(events.isActive, true)
          )
        )
        .limit(1);

      if (!event) {
        return {
          success: false as const,
          message: `Could not find event matching "${params.eventName}"`,
        };
      }

      // 2. Look up participants by name
      const participantRows: (typeof people.$inferSelect)[] = [];
      for (const name of params.participantNames) {
        const results = await db
          .select()
          .from(people)
          .where(ilike(people.name, `%${name}%`))
          .limit(1);
        if (results.length > 0) {
          participantRows.push(results[0]);
        }
      }

      if (participantRows.length === 0) {
        return {
          success: false as const,
          message: `Could not find any participants matching: ${params.participantNames.join(", ")}`,
        };
      }

      // 3. Look up room if specified
      let roomId: string | undefined;
      if (params.roomName) {
        const [room] = await db
          .select()
          .from(rooms)
          .where(
            and(
              ilike(rooms.name, `%${params.roomName}%`),
              eq(rooms.eventId, event.id)
            )
          )
          .limit(1);

        if (room) {
          roomId = room.id;
        } else {
          return {
            success: false as const,
            message: `Could not find room matching "${params.roomName}" in event "${event.name}"`,
          };
        }
      }

      // 4. Calculate duration from start/end times
      const startDate = new Date(params.startTime);
      const endDate = new Date(params.endTime);
      const durationMinutes = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60)
      );

      // 5. Book the meeting
      try {
        const meeting = await bookMeeting({
          title: params.title,
          eventId: event.id,
          startTime: params.startTime,
          endTime: params.endTime,
          timezone: params.timezone,
          durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
          roomId,
          participantIds: participantRows.map((p) => p.id),
          externalAttendeeName: params.externalAttendeeName,
          externalAttendeeEmail: params.externalAttendeeEmail,
          externalAttendeeCompany: params.externalAttendeeCompany,
          createdById: null,
        });

        return {
          success: true as const,
          message: "Meeting booked successfully!",
          meeting: {
            id: meeting.id,
            title: meeting.title,
            startTime: meeting.startTime.toISOString(),
            endTime: meeting.endTime.toISOString(),
            status: meeting.status,
            participants: participantRows.map((p) => ({
              name: p.name,
              type: p.type,
            })),
            externalAttendee: {
              name: params.externalAttendeeName,
              email: params.externalAttendeeEmail,
              company: params.externalAttendeeCompany,
            },
          },
        };
      } catch (error) {
        return {
          success: false as const,
          message: `Failed to book meeting: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  }),
};
