import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity"),
  sortOrder: integer("sort_order").default(0),
  availabilityStart: text("availability_start"),
  availabilityEnd: text("availability_end"),
  meetingDurationMinutes: integer("meeting_duration_minutes"),
  breakDurationMinutes: integer("break_duration_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
