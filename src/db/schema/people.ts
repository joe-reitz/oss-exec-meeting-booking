import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const personTypeEnum = pgEnum("person_type", ["exec", "ae"]);

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  type: personTypeEnum("type").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  title: text("title"),
  calcomUsername: text("calcom_username"),
  calcomEventTypeId: integer("calcom_event_type_id"),
  googleCalendarId: text("google_calendar_id"),
  sfdcOwnerId: text("sfdc_owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
