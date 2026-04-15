import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { rsvpStatusEnum } from "./meetings";

export const externalAttendees = pgTable("external_attendees", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  title: text("title"),
  rsvpStatus: rsvpStatusEnum("rsvp_status").default("needsAction"),
  rsvpLastChecked: timestamp("rsvp_last_checked", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
