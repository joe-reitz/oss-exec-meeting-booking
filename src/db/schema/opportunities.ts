import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const opportunities = pgTable("opportunities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  accountId: text("account_id"),
  accountName: text("account_name"),
  ownerId: text("owner_id"),
  ownerName: text("owner_name"),
  stageName: text("stage_name"),
  amount: integer("amount"),
  closeDate: timestamp("close_date", { withTimezone: true }),
  probability: integer("probability"),
  type: text("type"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});
