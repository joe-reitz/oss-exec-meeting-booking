-- Event participants (assign execs to events)
CREATE TABLE "event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "event_participants_event_id_person_id_unique" UNIQUE("event_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Goal segments (segment breakdown for goals)
CREATE TABLE "goal_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"segment_name" text NOT NULL,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "goal_segments" ADD CONSTRAINT "goal_segments_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Room availability and scheduling fields
ALTER TABLE "rooms" ADD COLUMN "availability_start" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "availability_end" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "meeting_duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "break_duration_minutes" integer;--> statement-breakpoint

-- Meeting prep notes and segment tracking
ALTER TABLE "meetings" ADD COLUMN "prep_notes" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "prep_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "segment" text;
