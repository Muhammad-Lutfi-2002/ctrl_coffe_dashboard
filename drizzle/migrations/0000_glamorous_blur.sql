CREATE TABLE "goods_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"condition" text DEFAULT 'good' NOT NULL,
	"received_by" text NOT NULL,
	"received_at" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text DEFAULT 'transfer' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"due_date" text NOT NULL,
	"paid_at" text,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "payments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"unit_cost" integer DEFAULT 0 NOT NULL,
	"stock_on_hand" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"supplier_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"product_id" text NOT NULL,
	"request_id" text,
	"quantity" integer NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"unit_cost" integer NOT NULL,
	"total" integer NOT NULL,
	"order_date" text NOT NULL,
	"expected_date" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"requested_by" text NOT NULL,
	"department" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"estimated_cost" integer DEFAULT 0 NOT NULL,
	"needed_by" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_requests_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"payment_terms" text DEFAULT 'NET 14' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
