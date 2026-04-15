import { relations } from "drizzle-orm";
import {
  users,
  people,
  events,
  rooms,
  meetings,
  meetingParticipants,
  goals,
  goalSegments,
  auditLog,
  meetingRequests,
  eventParticipants,
  externalAttendees,
} from "./schema";

// ── Users relations ──────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  people: many(people),
  createdEvents: many(events),
  createdMeetings: many(meetings),
  createdGoals: many(goals),
  auditLogs: many(auditLog),
}));

// ── People relations ─────────────────────────────────────────────────
export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(users, {
    fields: [people.userId],
    references: [users.id],
  }),
  meetingParticipants: many(meetingParticipants),
  eventParticipants: many(eventParticipants),
  goals: many(goals),
}));

// ── Events relations ─────────────────────────────────────────────────
export const eventsRelations = relations(events, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [events.createdById],
    references: [users.id],
  }),
  rooms: many(rooms),
  meetings: many(meetings),
  goals: many(goals),
  meetingRequests: many(meetingRequests),
  eventParticipants: many(eventParticipants),
}));

// ── Rooms relations ──────────────────────────────────────────────────
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  event: one(events, {
    fields: [rooms.eventId],
    references: [events.id],
  }),
  meetings: many(meetings),
}));

// ── Meetings relations ───────────────────────────────────────────────
export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  event: one(events, {
    fields: [meetings.eventId],
    references: [events.id],
  }),
  room: one(rooms, {
    fields: [meetings.roomId],
    references: [rooms.id],
  }),
  createdBy: one(users, {
    fields: [meetings.createdById],
    references: [users.id],
  }),
  rescheduledFrom: one(meetings, {
    fields: [meetings.rescheduledFromId],
    references: [meetings.id],
    relationName: "rescheduledFrom",
  }),
  rescheduledTo: one(meetings, {
    fields: [meetings.rescheduledToId],
    references: [meetings.id],
    relationName: "rescheduledTo",
  }),
  participants: many(meetingParticipants),
  externalAttendees: many(externalAttendees),
}));

// ── Meeting participants relations ───────────────────────────────────
export const meetingParticipantsRelations = relations(
  meetingParticipants,
  ({ one }) => ({
    meeting: one(meetings, {
      fields: [meetingParticipants.meetingId],
      references: [meetings.id],
    }),
    person: one(people, {
      fields: [meetingParticipants.personId],
      references: [people.id],
    }),
  })
);

// ── Event participants relations ─────────────────────────────────────
export const eventParticipantsRelations = relations(
  eventParticipants,
  ({ one }) => ({
    event: one(events, {
      fields: [eventParticipants.eventId],
      references: [events.id],
    }),
    person: one(people, {
      fields: [eventParticipants.personId],
      references: [people.id],
    }),
  })
);

// ── Goals relations ──────────────────────────────────────────────────
export const goalsRelations = relations(goals, ({ one, many }) => ({
  person: one(people, {
    fields: [goals.personId],
    references: [people.id],
  }),
  event: one(events, {
    fields: [goals.eventId],
    references: [events.id],
  }),
  createdBy: one(users, {
    fields: [goals.createdById],
    references: [users.id],
  }),
  segments: many(goalSegments),
}));

// ── Goal segments relations ─────────────────────────────────────────
export const goalSegmentsRelations = relations(goalSegments, ({ one }) => ({
  goal: one(goals, {
    fields: [goalSegments.goalId],
    references: [goals.id],
  }),
}));

// ── Meeting requests relations ───────────────────────────────────────
export const meetingRequestsRelations = relations(
  meetingRequests,
  ({ one }) => ({
    event: one(events, {
      fields: [meetingRequests.eventId],
      references: [events.id],
    }),
    meeting: one(meetings, {
      fields: [meetingRequests.meetingId],
      references: [meetings.id],
    }),
  })
);

// ── External attendees relations ────────────────────────────────────
export const externalAttendeesRelations = relations(
  externalAttendees,
  ({ one }) => ({
    meeting: one(meetings, {
      fields: [externalAttendees.meetingId],
      references: [meetings.id],
    }),
  })
);

// ── Audit log relations ──────────────────────────────────────────────
export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));
