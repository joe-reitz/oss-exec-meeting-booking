CREATE TYPE "public"."goal_period" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('meeting_quota', 'pipeline_target', 'account_coverage');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('marketing', 'ae', 'exec', 'admin');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('exec', 'ae');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('draft', 'pending', 'confirmed', 'cancelled', 'rescheduled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('needsAction', 'declined', 'tentative', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('exec', 'ae', 'host');--> statement-breakpoint
CREATE TYPE "public"."meeting_request_status" AS ENUM('pending', 'approved', 'rejected', 'info_requested', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('prospect', 'customer');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'marketing',
	"calcom_username" text,
	"calcom_user_id" integer,
	"google_calendar_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"type" "person_type" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"title" text,
	"calcom_username" text,
	"calcom_event_type_id" integer,
	"google_calendar_id" text,
	"sfdc_owner_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"timezone" text DEFAULT 'America/Los_Angeles',
	"calcom_event_type_id" integer,
	"color" text,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"capacity" integer,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_id" uuid,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles',
	"duration_minutes" integer NOT NULL,
	"status" "meeting_status" DEFAULT 'draft',
	"room_id" uuid,
	"calcom_booking_id" integer,
	"calcom_booking_uid" text,
	"google_event_id" text,
	"google_calendar_id" text,
	"sfdc_opportunity_id" text,
	"external_attendee_name" text,
	"external_attendee_email" text,
	"external_attendee_company" text,
	"external_attendee_title" text,
	"external_rsvp_status" "rsvp_status" DEFAULT 'needsAction',
	"external_rsvp_last_checked" timestamp with time zone,
	"rescheduled_from_id" uuid,
	"rescheduled_to_id" uuid,
	"silently_modified" boolean DEFAULT false,
	"last_silent_modification_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "participant_role",
	"google_rsvp_status" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "goal_type",
	"period" "goal_period",
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0,
	"unit" text,
	"person_id" uuid,
	"event_id" uuid,
	"target_account_list" jsonb,
	"is_active" boolean DEFAULT true,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_id" text,
	"account_name" text,
	"owner_id" text,
	"owner_name" text,
	"stage_name" text,
	"amount" integer,
	"close_date" timestamp with time zone,
	"probability" integer,
	"type" text,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "meeting_request_status" DEFAULT 'pending' NOT NULL,
	"meeting_type" "meeting_type",
	"account_name" text NOT NULL,
	"estimated_deal_size" text,
	"business_impact" text,
	"guest_name" text NOT NULL,
	"guest_email" text NOT NULL,
	"guest_title" text,
	"guest_company" text,
	"goal_outcome" text,
	"requires_exec" boolean DEFAULT false,
	"requested_exec_ids" jsonb,
	"needs_se" boolean DEFAULT false,
	"preferred_date_window" text,
	"notes" text,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"source" text DEFAULT 'in_app' NOT NULL,
	"rejection_reason" text,
	"info_request_message" text,
	"meeting_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD CONSTRAINT "meeting_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_requests" ADD CONSTRAINT "meeting_requests_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;
