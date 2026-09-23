CREATE TYPE "public"."receipt_issue_type" AS ENUM('damaged', 'missing');--> statement-breakpoint
CREATE TABLE "receipt_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transport_id" uuid NOT NULL,
	"packing_unit_item_id" uuid NOT NULL,
	"issue_type" "receipt_issue_type" NOT NULL,
	"quantity" integer NOT NULL,
	"note" text,
	"reported_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_issues_quantity_check" CHECK ("receipt_issues"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "receipt_issues" ADD CONSTRAINT "receipt_issues_transport_id_transports_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_issues" ADD CONSTRAINT "receipt_issues_packing_unit_item_id_packing_unit_items_id_fk" FOREIGN KEY ("packing_unit_item_id") REFERENCES "public"."packing_unit_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_issues" ADD CONSTRAINT "receipt_issues_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_issues_item_type_uidx" ON "receipt_issues" USING btree ("packing_unit_item_id","issue_type");--> statement-breakpoint
CREATE INDEX "receipt_issues_transport_idx" ON "receipt_issues" USING btree ("transport_id");