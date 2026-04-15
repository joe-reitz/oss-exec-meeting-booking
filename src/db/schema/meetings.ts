import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { events } from "./events";
import { rooms } from "./rooms";

export const meetingStatusEnum = pgEnum("meeting_status", [
  "draft",
  "pending",
  "confirmed",
  "cancelled",
  "rescheduled",
  "completed",
]);

export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "needsAction",
  "declined",
  "tentative",
  "accepted",
]);

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  eventId: uuid("event_id").references(() => events.id),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  timezone: text("timezone").default("America/Los_Angeles"),
  durationMinutes: integer("duration_minutes").notNull(),
  status: meetingStatusEnum("status").default("draft"),
  roomId: uuid("room_id").references(() => rooms.id),
  noRoomRequired: boolean("no_room_required").default(false),

  // Cal.com integration
  calcomBookingId: integer("calcom_booking_id"),
  calcomBookingUid: text("calcom_booking_uid"),

  // Google Calendar integration
  googleEventId: text("google_event_id"),
  googleCalendarId: text("google_calendar_id"),

  // Salesforce integration
  sfdcOpportunityId: text("sfdc_opportunity_id"),

  // External attendee details
  externalAttendeeName: text("external_attendee_name"),
  externalAttendeeEmail: text("external_attendee_email"),
  externalAttendeeCompany: text("external_attendee_company"),
  externalAttendeeTitle: text("external_attendee_title"),
  externalRsvpStatus: rsvpStatusEnum("external_rsvp_status").default(
    "needsAction"
  ),
  externalRsvpLastChecked: timestamp("external_rsvp_last_checked", {
    withTimezone: true,
  }),

  // Prep notes
  prepNotes: text("prep_notes"),
  prepReminderSentAt: timestamp("prep_reminder_sent_at", {
    withTimezone: true,
  }),

  // Segment (populated from SFDC via mOperator at booking time)
  segment: text("segment"),

  // Rescheduling
  rescheduledFromId: uuid("rescheduled_from_id"),
  rescheduledToId: uuid("rescheduled_to_id"),

  // Silent modification tracking
  silentlyModified: boolean("silently_modified").default(false),
  lastSilentModificationAt: timestamp("last_silent_modification_at", {
    withTimezone: true,
  }),

  // Ownership
  createdById: text("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
