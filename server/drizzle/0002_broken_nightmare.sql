CREATE TYPE "public"."transport_status" AS ENUM('waiting', 'transit', 'arrived');--> statement-breakpoint
CREATE TABLE "transports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"transport_number" varchar(10) NOT NULL,
	"status" "transport_status" DEFAULT 'waiting' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_by_name" varchar(160) NOT NULL,
	"source_city" varchar(160) NOT NULL,
	"source_unit" varchar(160) NOT NULL,
	"source_building" varchar(160) NOT NULL,
	"source_room" varchar(160) NOT NULL,
	"destination_city" varchar(160) NOT NULL,
	"destination_unit" varchar(160) NOT NULL,
	"destination_building" varchar(160) NOT NULL,
	"destination_room" varchar(160) NOT NULL,
	"package_count" integer DEFAULT 0 NOT NULL,
	"package_summary" text,
	"vehicle_type" varchar(60),
	"vehicle_number" varchar(60),
	"scheduled_at" timestamp with time zone,
	"transit_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transports_status_check" CHECK (("transports"."status" = 'waiting' AND "transports"."transit_at" IS NULL AND "transports"."arrived_at" IS NULL) OR ("transports"."status" = 'transit' AND "transports"."transit_at" IS NOT NULL AND "transports"."vehicle_type" IS NOT NULL AND "transports"."vehicle_number" IS NOT NULL AND "transports"."arrived_at" IS NULL) OR ("transports"."status" = 'arrived' AND "transports"."transit_at" IS NOT NULL AND "transports"."arrived_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "packing_units" ADD COLUMN "transport_id" uuid;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transports_transport_number_uidx" ON "transports" USING btree ("transport_number");--> statement-breakpoint
CREATE INDEX "transports_group_status_idx" ON "transports" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "transports_group_archive_idx" ON "transports" USING btree ("group_id","archived_at");--> statement-breakpoint
ALTER TABLE "packing_units" ADD CONSTRAINT "packing_units_transport_id_transports_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "packing_units_transport_idx" ON "packing_units" USING btree ("transport_id");