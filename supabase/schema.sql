-- South Operation — full database schema
-- Generated from server/drizzle/0000_nifty_grim_reaper.sql + 0001_empty_queen_noir.sql
-- (the project's Drizzle ORM migrations, in order). Paste this whole file into the
-- Supabase SQL editor and run it once against a fresh database.

CREATE TYPE "public"."membership_role" AS ENUM('manager', 'commander', 'operator');
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'completed', 'failed');
CREATE TYPE "public"."report_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE "public"."room_status" AS ENUM('unstarted', 'in_progress', 'completed', 'archived');
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'commander', 'operator');
CREATE TYPE "public"."packing_unit_status" AS ENUM('awaiting_packing', 'packing_in_progress', 'closed');
CREATE TYPE "public"."packing_unit_type" AS ENUM('professional_carton', 'personal_carton', 'pallet', 'dolav', 'bulk');
CREATE TYPE "public"."room_packing_status" AS ENUM('not_started', 'in_packing', 'paused', 'closed');

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_subject" varchar(128) NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "group_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"description" varchar(160) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"contact_name" varchar(160),
	"contact_phone" varchar(32),
	"created_by" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "memberships_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);

CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"location_id" uuid,
	"name" varchar(160) NOT NULL,
	"description" text,
	"manager_name" varchar(160),
	"status" "room_status" DEFAULT 'unstarted' NOT NULL,
	"packing_status" "room_packing_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_status_timestamps_check" CHECK (("rooms"."status" = 'unstarted' AND "rooms"."started_at" IS NULL AND "rooms"."completed_at" IS NULL) OR ("rooms"."status" = 'in_progress' AND "rooms"."started_at" IS NOT NULL AND "rooms"."completed_at" IS NULL) OR ("rooms"."status" IN ('completed', 'archived') AND "rooms"."started_at" IS NOT NULL AND "rooms"."completed_at" IS NOT NULL))
);

CREATE TABLE "item_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"archived_at" timestamp with time zone
);

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_type_id" uuid,
	"name" varchar(160) NOT NULL,
	"is_special" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone
);

CREATE TABLE "subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"archived_at" timestamp with time zone
);

CREATE TABLE "mapping_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"subcategory_id" uuid NOT NULL,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"serial_number" varchar(160),
	"notes" text,
	"purpose" text,
	"target" text,
	"expires_at" timestamp with time zone,
	"reported_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mapping_reports_quantity_check" CHECK ("mapping_reports"."quantity" >= 0),
	CONSTRAINT "mapping_reports_serial_quantity_check" CHECK ("mapping_reports"."serial_number" IS NULL OR "mapping_reports"."quantity" = 1)
);

CREATE TABLE "sequence_counters" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "packing_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"unit_type" "packing_unit_type" NOT NULL,
	"status" "packing_unit_status" DEFAULT 'awaiting_packing' NOT NULL,
	"unit_number" varchar(5),
	"destination_building" varchar(160),
	"destination_floor" varchar(60),
	"destination_room" varchar(160),
	"created_by" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packing_units_status_check" CHECK (("packing_units"."status" IN ('awaiting_packing', 'packing_in_progress') AND "packing_units"."unit_number" IS NULL AND "packing_units"."closed_at" IS NULL) OR ("packing_units"."status" = 'closed' AND "packing_units"."unit_number" IS NOT NULL AND "packing_units"."closed_at" IS NOT NULL AND "packing_units"."destination_building" IS NOT NULL AND "packing_units"."destination_room" IS NOT NULL))
);

CREATE TABLE "packing_unit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packing_unit_id" uuid NOT NULL,
	"mapping_report_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packing_unit_items_quantity_check" CHECK ("packing_unit_items"."quantity" > 0)
);

CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"group_id" uuid,
	"request_id" varchar(80) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "export_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid NOT NULL,
	"group_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "export_outbox_attempts_check" CHECK ("export_outbox"."attempts" >= 0)
);

-- audit_events is append-only: block UPDATE/DELETE at the database level
CREATE OR REPLACE FUNCTION "prevent_audit_event_mutation"()
RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();

-- Foreign keys
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "categories" ADD CONSTRAINT "categories_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "export_outbox" ADD CONSTRAINT "export_outbox_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "groups" ADD CONSTRAINT "groups_group_code_id_group_codes_id_fk" FOREIGN KEY ("group_code_id") REFERENCES "public"."group_codes"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mapping_reports" ADD CONSTRAINT "mapping_reports_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mapping_reports" ADD CONSTRAINT "mapping_reports_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mapping_reports" ADD CONSTRAINT "mapping_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mapping_reports" ADD CONSTRAINT "mapping_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "packing_unit_items" ADD CONSTRAINT "packing_unit_items_packing_unit_id_packing_units_id_fk" FOREIGN KEY ("packing_unit_id") REFERENCES "public"."packing_units"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "packing_unit_items" ADD CONSTRAINT "packing_unit_items_mapping_report_id_mapping_reports_id_fk" FOREIGN KEY ("mapping_report_id") REFERENCES "public"."mapping_reports"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;

-- Indexes
CREATE INDEX "audit_events_group_time_idx" ON "audit_events" USING btree ("group_id","occurred_at");
CREATE INDEX "audit_events_actor_time_idx" ON "audit_events" USING btree ("actor_user_id","occurred_at");
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");
CREATE UNIQUE INDEX "categories_item_type_name_uidx" ON "categories" USING btree ("item_type_id","name");
CREATE INDEX "categories_archive_idx" ON "categories" USING btree ("archived_at");
CREATE INDEX "export_outbox_dispatch_idx" ON "export_outbox" USING btree ("status","available_at");
CREATE INDEX "export_outbox_group_idx" ON "export_outbox" USING btree ("group_id");
CREATE UNIQUE INDEX "group_codes_code_uidx" ON "group_codes" USING btree ("code");
CREATE INDEX "group_codes_archive_idx" ON "group_codes" USING btree ("archived_at");
CREATE UNIQUE INDEX "groups_code_name_uidx" ON "groups" USING btree ("group_code_id","name");
CREATE INDEX "groups_code_archive_idx" ON "groups" USING btree ("group_code_id","archived_at");
CREATE UNIQUE INDEX "item_types_name_uidx" ON "item_types" USING btree ("name");
CREATE UNIQUE INDEX "locations_name_uidx" ON "locations" USING btree ("name");
CREATE INDEX "locations_archive_idx" ON "locations" USING btree ("archived_at");
CREATE UNIQUE INDEX "mapping_reports_serial_uidx" ON "mapping_reports" USING btree ("serial_number") WHERE "mapping_reports"."serial_number" IS NOT NULL;
CREATE INDEX "mapping_reports_room_archive_idx" ON "mapping_reports" USING btree ("room_id","archived_at");
CREATE INDEX "mapping_reports_subcategory_idx" ON "mapping_reports" USING btree ("subcategory_id");
CREATE INDEX "mapping_reports_status_idx" ON "mapping_reports" USING btree ("status");
CREATE INDEX "memberships_group_archive_idx" ON "memberships" USING btree ("group_id","archived_at");
CREATE INDEX "memberships_user_archive_idx" ON "memberships" USING btree ("user_id","archived_at");
CREATE UNIQUE INDEX "rooms_group_name_uidx" ON "rooms" USING btree ("group_id","name");
CREATE INDEX "rooms_group_archive_idx" ON "rooms" USING btree ("group_id","archived_at");
CREATE INDEX "rooms_location_idx" ON "rooms" USING btree ("location_id");
CREATE UNIQUE INDEX "subcategories_category_name_uidx" ON "subcategories" USING btree ("category_id","name");
CREATE INDEX "subcategories_category_archive_idx" ON "subcategories" USING btree ("category_id","archived_at");
CREATE UNIQUE INDEX "users_external_subject_uidx" ON "users" USING btree ("external_subject");
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");
CREATE INDEX "users_active_role_idx" ON "users" USING btree ("is_active","role");
CREATE UNIQUE INDEX "packing_unit_items_unit_report_uidx" ON "packing_unit_items" USING btree ("packing_unit_id","mapping_report_id");
CREATE INDEX "packing_unit_items_report_idx" ON "packing_unit_items" USING btree ("mapping_report_id");
CREATE UNIQUE INDEX "packing_units_unit_number_uidx" ON "packing_units" USING btree ("unit_number") WHERE "packing_units"."unit_number" IS NOT NULL;
CREATE INDEX "packing_units_room_archive_idx" ON "packing_units" USING btree ("room_id","archived_at");
CREATE INDEX "packing_units_status_idx" ON "packing_units" USING btree ("status");
