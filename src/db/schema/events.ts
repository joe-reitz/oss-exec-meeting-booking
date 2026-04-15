import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  timezone: text("timezone").default("America/Los_Angeles"),
  calcomEventTypeId: integer("calcom_event_type_id"),
  sfdcExecCampaignId: text("sfdc_exec_campaign_id"),
  sfdcAeCampaignId: text("sfdc_ae_campaign_id"),
  color: text("color"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
