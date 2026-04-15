import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { people } from "./people";
import { events } from "./events";

export const goalTypeEnum = pgEnum("goal_type", [
  "meeting_quota",
  "pipeline_target",
  "account_coverage",
]);

export const goalPeriodEnum = pgEnum("goal_period", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: goalTypeEnum("type"),
  period: goalPeriodEnum("period"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").default(0),
  unit: text("unit"),
  personId: uuid("person_id").references(() => people.id),
  eventId: uuid("event_id").references(() => events.id),
  targetAccountList: jsonb("target_account_list").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
