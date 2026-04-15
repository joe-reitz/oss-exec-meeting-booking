import { pgTable, pgEnum, text, integer, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "marketing",
  "ae",
  "exec",
  "admin",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").default("marketing"),
  calcomUsername: text("calcom_username"),
  calcomUserId: integer("calcom_user_id"),
  googleCalendarId: text("google_calendar_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
