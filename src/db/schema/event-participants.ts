import {
  pgTable,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { people } from "./people";

export const eventParticipants = pgTable(
  "event_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.eventId, table.personId)]
);
