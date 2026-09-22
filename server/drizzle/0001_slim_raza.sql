CREATE TYPE "public"."item_movement_status" AS ENUM('unassigned', 'packed', 'in_transit', 'received', 'missing', 'distributed');--> statement-breakpoint
CREATE TYPE "public"."packing_unit_status" AS ENUM('closed', 'in_transit', 'received', 'missing', 'surplus_review');--> statement-breakpoint
CREATE TYPE "public"."transport_unit_status" AS ENUM('loading', 'in_transit', 'released');--> statement-breakpoint
CREATE TABLE "packing_unit_items" (
	"packing_unit_id" uuid NOT NULL,
	"mapping_report_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "packing_unit_items_packing_unit_id_mapping_report_id_pk" PRIMARY KEY("packing_unit_id","mapping_report_id"),
	CONSTRAINT "packing_unit_items_quantity_check" CHECK ("packing_unit_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "packing_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"serial_number" varchar(5) NOT NULL,
	"status" "packing_unit_status" DEFAULT 'closed' NOT NULL,
	"origin_room_id" uuid,
	"destination" varchar(240),
	"item_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packing_units_serial_number_check" CHECK ("packing_units"."serial_number" ~ '^[0-9]{5}$'),
	CONSTRAINT "packing_units_item_count_check" CHECK ("packing_units"."item_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transport_packing_units" (
	"transport_unit_id" uuid NOT NULL,
	"packing_unit_id" uuid NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone,
	"received_by" uuid,
	CONSTRAINT "transport_packing_units_transport_unit_id_packing_unit_id_pk" PRIMARY KEY("transport_unit_id","packing_unit_id")
);
--> statement-breakpoint
CREATE TABLE "transport_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"license_plate" varchar(32) NOT NULL,
	"status" "transport_unit_status" DEFAULT 'loading' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"departed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_units_version_check" CHECK ("transport_units"."version" > 0),
	CONSTRAINT "transport_units_status_timestamps_check" CHECK (("transport_units"."status" = 'loading' AND "transport_units"."departed_at" IS NULL AND "transport_units"."released_at" IS NULL) OR ("transport_units"."status" = 'in_transit' AND "transport_units"."departed_at" IS NOT NULL AND "transport_units"."released_at" IS NULL) OR ("transport_units"."status" = 'released' AND "transport_units"."departed_at" IS NOT NULL AND "transport_units"."released_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "mapping_reports" ADD COLUMN "movement_status" "item_movement_status" DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "packing_unit_items" ADD CONSTRAINT "packing_unit_items_packing_unit_id_packing_units_id_fk" FOREIGN KEY ("packing_unit_id") REFERENCES "public"."packing_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_unit_items" ADD CONSTRAINT "packing_unit_items_mapping_report_id_mapping_reports_id_fk" FOREIGN KEY ("mapping_report_id") REFERENCES "public"."mapping_reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_origin_room_id_rooms_id_fk" FOREIGN KEY ("origin_room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_packing_units" ADD CONSTRAINT "transport_packing_units_transport_unit_id_transport_units_id_fk" FOREIGN KEY ("transport_unit_id") REFERENCES "public"."transport_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_packing_units" ADD CONSTRAINT "transport_packing_units_packing_unit_id_packing_units_id_fk" FOREIGN KEY ("packing_unit_id") REFERENCES "public"."packing_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_packing_units" ADD CONSTRAINT "transport_packing_units_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_units" ADD CONSTRAINT "transport_units_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_units" ADD CONSTRAINT "transport_units_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "packing_unit_items_report_idx" ON "packing_unit_items" USING btree ("mapping_report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packing_units_serial_number_uidx" ON "packing_units" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "packing_units_group_status_idx" ON "packing_units" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "transport_packing_units_packing_idx" ON "transport_packing_units" USING btree ("packing_unit_id");--> statement-breakpoint
CREATE INDEX "transport_units_group_status_idx" ON "transport_units" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "transport_units_license_plate_idx" ON "transport_units" USING btree ("license_plate");