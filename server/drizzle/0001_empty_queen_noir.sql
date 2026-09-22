CREATE TYPE "public"."packing_unit_status" AS ENUM('awaiting_packing', 'packing_in_progress', 'closed');--> statement-breakpoint
CREATE TYPE "public"."packing_unit_type" AS ENUM('professional_carton', 'personal_carton', 'pallet', 'dolav', 'bulk');--> statement-breakpoint
CREATE TYPE "public"."room_packing_status" AS ENUM('not_started', 'in_packing', 'paused', 'closed');--> statement-breakpoint
CREATE TABLE "packing_unit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packing_unit_id" uuid NOT NULL,
	"mapping_report_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packing_unit_items_quantity_check" CHECK ("packing_unit_items"."quantity" > 0)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "sequence_counters" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "packing_status" "room_packing_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "packing_unit_items" ADD CONSTRAINT "packing_unit_items_packing_unit_id_packing_units_id_fk" FOREIGN KEY ("packing_unit_id") REFERENCES "public"."packing_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_unit_items" ADD CONSTRAINT "packing_unit_items_mapping_report_id_mapping_reports_id_fk" FOREIGN KEY ("mapping_report_id") REFERENCES "public"."mapping_reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "packing_unit_items_unit_report_uidx" ON "packing_unit_items" USING btree ("packing_unit_id","mapping_report_id");--> statement-breakpoint
CREATE INDEX "packing_unit_items_report_idx" ON "packing_unit_items" USING btree ("mapping_report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packing_units_unit_number_uidx" ON "packing_units" USING btree ("unit_number") WHERE "packing_units"."unit_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "packing_units_room_archive_idx" ON "packing_units" USING btree ("room_id","archived_at");--> statement-breakpoint
CREATE INDEX "packing_units_status_idx" ON "packing_units" USING btree ("status");