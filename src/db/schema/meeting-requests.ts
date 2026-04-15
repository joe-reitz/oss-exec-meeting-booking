import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { meetings } from "./meetings";

export const meetingRequestStatusEnum = pgEnum("meeting_request_status", [
  "pending",
  "approved",
  "rejected",
  "info_requested",
  "cancelled",
]);

export const meetingTypeEnum = pgEnum("meeting_type", [
  "prospect",
  "customer",
]);

export const meetingRequests = pgTable("meeting_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .references(() => events.id)
    .notNull(),
  status: meetingRequestStatusEnum("status").default("pending").notNull(),
  meetingType: meetingTypeEnum("meeting_type").notNull(),
  noRoomRequired: boolean("no_room_required").default(false).notNull(),

  // Account info
  accountName: text("account_name").notNull(),
  estimatedDealSize: text("estimated_deal_size").notNull(),
  businessImpact: text("business_impact").notNull(),

  // Guest info
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email").notNull(),
  guestTitle: text("guest_title").notNull(),
  guestCompany: text("guest_company").notNull(),

  // Additional guests (beyond primary guest above)
  additionalGuests: jsonb("additional_guests").$type<
    Array<{ name: string; email: string; company?: string; title?: string }>
  >(),

  // Request details
  goalOutcome: text("goal_outcome").notNull(),
  requiresExec: boolean("requires_exec").default(false),
  requestedExecIds: jsonb("requested_exec_ids").$type<string[]>(),
  needsSe: boolean("needs_se").default(false),
  preferredDateWindow: text("preferred_date_window").notNull(),
  notes: text("notes").notNull(),

  // Requester
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),

  // Workflow
  source: text("source").notNull().default("in_app"), // "in_app" | "moperator"
  rejectionReason: text("rejection_reason"),
  infoRequestMessage: text("info_request_message"),
  meetingId: uuid("meeting_id").references(() => meetings.id),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
