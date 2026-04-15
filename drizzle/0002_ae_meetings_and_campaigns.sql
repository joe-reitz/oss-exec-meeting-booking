-- Add SFDC Campaign ID fields to events
ALTER TABLE "events" ADD COLUMN "sfdc_exec_campaign_id" text;
ALTER TABLE "events" ADD COLUMN "sfdc_ae_campaign_id" text;

-- Add no_room_required to meetings
ALTER TABLE "meetings" ADD COLUMN "no_room_required" boolean DEFAULT false;

-- Add no_room_required to meeting_requests
ALTER TABLE "meeting_requests" ADD COLUMN "no_room_required" boolean NOT NULL DEFAULT false;

-- Backfill nullable fields before making them NOT NULL
UPDATE "meeting_requests" SET "meeting_type" = 'prospect' WHERE "meeting_type" IS NULL;
UPDATE "meeting_requests" SET "estimated_deal_size" = 'Unknown' WHERE "estimated_deal_size" IS NULL;
UPDATE "meeting_requests" SET "business_impact" = 'Not specified' WHERE "business_impact" IS NULL;
UPDATE "meeting_requests" SET "guest_title" = 'Not specified' WHERE "guest_title" IS NULL;
UPDATE "meeting_requests" SET "guest_company" = 'Not specified' WHERE "guest_company" IS NULL;
UPDATE "meeting_requests" SET "goal_outcome" = 'Not specified' WHERE "goal_outcome" IS NULL;
UPDATE "meeting_requests" SET "preferred_date_window" = 'Flexible' WHERE "preferred_date_window" IS NULL;
UPDATE "meeting_requests" SET "notes" = '' WHERE "notes" IS NULL;

-- Make fields NOT NULL
ALTER TABLE "meeting_requests" ALTER COLUMN "meeting_type" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "estimated_deal_size" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "business_impact" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "guest_title" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "guest_company" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "goal_outcome" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "preferred_date_window" SET NOT NULL;
ALTER TABLE "meeting_requests" ALTER COLUMN "notes" SET NOT NULL;
