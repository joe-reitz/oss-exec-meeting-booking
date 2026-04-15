import { pgTable, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { people } from "./people";

export const participantRoleEnum = pgEnum("participant_role", [
  "exec",
  "ae",
  "host",
]);

export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id),
  role: participantRoleEnum("role"),
  googleRsvpStatus: text("google_rsvp_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
