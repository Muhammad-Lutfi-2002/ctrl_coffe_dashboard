CREATE TABLE "app_settings" (
	"id_app_settings" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"id_users" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id_approvals" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_purchase_requests" uuid,
	"id_payments" uuid,
	"id_users" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_decision_chk" CHECK ("approvals"."decision" in ('approved','rejected')),
	CONSTRAINT "approvals_target_chk" CHECK (("approvals"."id_purchase_requests" is not null)::int + ("approvals"."id_payments" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id_audit_logs" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_users" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"detail" jsonb,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id_budgets" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" text NOT NULL,
	"budget_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_period_unique" UNIQUE("period"),
	CONSTRAINT "budgets_chk" CHECK ("budgets"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and "budgets"."budget_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id_categories" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_name" text NOT NULL,
	CONSTRAINT "categories_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id_expenses" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_budgets" uuid,
	"id_users" uuid NOT NULL,
	"expense_date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_chk" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id_goods_receipts" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gr_number" text NOT NULL,
	"id_purchase_orders" uuid NOT NULL,
	"id_users" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "goods_receipts_gr_number_unique" UNIQUE("gr_number")
);
--> statement-breakpoint
CREATE TABLE "gr_items" (
	"id_gr_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_goods_receipts" uuid NOT NULL,
	"id_po_items" uuid NOT NULL,
	"qty_accepted" numeric(14, 3) DEFAULT 0 NOT NULL,
	"qty_rejected" numeric(14, 3) DEFAULT 0 NOT NULL,
	CONSTRAINT "gr_items_uq" UNIQUE("id_goods_receipts","id_po_items"),
	CONSTRAINT "gr_items_qty_chk" CHECK ("gr_items"."qty_accepted" >= 0 and "gr_items"."qty_rejected" >= 0 and ("gr_items"."qty_accepted" + "gr_items"."qty_rejected") > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id_invoice_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_supplier_invoices" uuid NOT NULL,
	"id_po_items" uuid NOT NULL,
	"qty_invoiced" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	CONSTRAINT "invoice_items_uq" UNIQUE("id_supplier_invoices","id_po_items"),
	CONSTRAINT "invoice_items_chk" CHECK ("invoice_items"."qty_invoiced" > 0 and "invoice_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id_materials" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_categories" uuid NOT NULL,
	"id_units" uuid NOT NULL,
	"sku" text NOT NULL,
	"material_name" text NOT NULL,
	"min_stock" numeric(14, 3) DEFAULT 0 NOT NULL,
	"safety_stock" numeric(14, 3) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_sku_unique" UNIQUE("sku"),
	CONSTRAINT "materials_stock_chk" CHECK ("materials"."min_stock" >= 0 and "materials"."safety_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id_payments" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"id_supplier_invoices" uuid NOT NULL,
	"id_users" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text DEFAULT 'transfer' NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_payment_number_unique" UNIQUE("payment_number"),
	CONSTRAINT "payments_amount_chk" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_method_chk" CHECK ("payments"."method" in ('transfer','cash','giro')),
	CONSTRAINT "payments_status_chk" CHECK ("payments"."status" in ('pending_approval','approved','paid','rejected'))
);
--> statement-breakpoint
CREATE TABLE "po_items" (
	"id_po_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_purchase_orders" uuid NOT NULL,
	"id_quotation_items" uuid NOT NULL,
	"qty_ordered" numeric(14, 3) NOT NULL,
	CONSTRAINT "po_items_uq" UNIQUE("id_purchase_orders","id_quotation_items"),
	CONSTRAINT "po_items_qty_chk" CHECK ("po_items"."qty_ordered" > 0)
);
--> statement-breakpoint
CREATE TABLE "pr_items" (
	"id_pr_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_purchase_requests" uuid NOT NULL,
	"id_materials" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	CONSTRAINT "pr_items_uq" UNIQUE("id_purchase_requests","id_materials"),
	CONSTRAINT "pr_items_qty_chk" CHECK ("pr_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id_products" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_categories" uuid NOT NULL,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_price_chk" CHECK ("products"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id_purchase_orders" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" text NOT NULL,
	"id_supplier_quotations" uuid NOT NULL,
	"id_users" uuid NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"order_date" date NOT NULL,
	"expected_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number"),
	CONSTRAINT "purchase_orders_id_supplier_quotations_unique" UNIQUE("id_supplier_quotations"),
	CONSTRAINT "purchase_orders_status_chk" CHECK ("purchase_orders"."status" in ('sent','partial','received','cancelled')),
	CONSTRAINT "purchase_orders_date_chk" CHECK ("purchase_orders"."expected_date" >= "purchase_orders"."order_date")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id_purchase_requests" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pr_number" text NOT NULL,
	"id_users" uuid NOT NULL,
	"needed_by" date NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_requests_pr_number_unique" UNIQUE("pr_number"),
	CONSTRAINT "purchase_requests_status_chk" CHECK ("purchase_requests"."status" in ('submitted','approved','rejected','ordered','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id_quotation_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_supplier_quotations" uuid NOT NULL,
	"id_materials" uuid NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"min_order_qty" numeric(14, 3) DEFAULT 0 NOT NULL,
	CONSTRAINT "quotation_items_uq" UNIQUE("id_supplier_quotations","id_materials"),
	CONSTRAINT "quotation_items_price_chk" CHECK ("quotation_items"."unit_price" >= 0 and "quotation_items"."min_order_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id_recipes" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_products" uuid NOT NULL,
	"id_materials" uuid NOT NULL,
	"qty_used" numeric(14, 3) NOT NULL,
	CONSTRAINT "recipes_product_material_uq" UNIQUE("id_products","id_materials"),
	CONSTRAINT "recipes_qty_chk" CHECK ("recipes"."qty_used" > 0)
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id_roles" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_code" text NOT NULL,
	"role_name" text NOT NULL,
	CONSTRAINT "roles_role_code_unique" UNIQUE("role_code"),
	CONSTRAINT "roles_code_chk" CHECK ("roles"."role_code" in ('admin','purchasing','finance','owner'))
);
--> statement-breakpoint
CREATE TABLE "sales_import_batches" (
	"id_sales_import_batches" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_hash" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"id_users" uuid NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_import_batches_file_hash_unique" UNIQUE("file_hash")
);
--> statement-breakpoint
CREATE TABLE "sales_items" (
	"id_sales_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_sales_transactions" uuid NOT NULL,
	"id_products" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	CONSTRAINT "sales_items_chk" CHECK ("sales_items"."qty" > 0 and "sales_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_transactions" (
	"id_sales_transactions" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trx_date" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"external_ref" text,
	"id_sales_import_batches" uuid,
	"id_users" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_transactions_source_chk" CHECK ("sales_transactions"."source" in ('manual','csv_import'))
);
--> statement-breakpoint
CREATE TABLE "scoring_parameter_history" (
	"id_scoring_parameter_history" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criterion" text NOT NULL,
	"old_weight" numeric(5, 2),
	"new_weight" numeric(5, 2) NOT NULL,
	"id_users" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_parameters" (
	"id_scoring_parameters" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criterion" text NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	CONSTRAINT "scoring_parameters_criterion_unique" UNIQUE("criterion"),
	CONSTRAINT "scoring_parameters_criterion_chk" CHECK ("scoring_parameters"."criterion" in ('price','performance','lead_time','payment_term')),
	CONSTRAINT "scoring_parameters_weight_chk" CHECK ("scoring_parameters"."weight" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id_stock_movements" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_materials" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"qty_delta" numeric(14, 3) NOT NULL,
	"moved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id_users" uuid,
	"id_gr_items" uuid,
	"id_stock_opnames" uuid,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "stock_movements_id_gr_items_unique" UNIQUE("id_gr_items"),
	CONSTRAINT "stock_movements_type_chk" CHECK ("stock_movements"."qty_delta" <> 0 and (
        ("stock_movements"."movement_type" in ('opening_balance','receipt') and "stock_movements"."qty_delta" > 0) or
        ("stock_movements"."movement_type" in ('usage','damaged','expired') and "stock_movements"."qty_delta" < 0) or
        "stock_movements"."movement_type" in ('adjustment','opname_adjustment')))
);
--> statement-breakpoint
CREATE TABLE "stock_opname_items" (
	"id_stock_opname_items" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_stock_opnames" uuid NOT NULL,
	"id_materials" uuid NOT NULL,
	"counted_qty" numeric(14, 3) NOT NULL,
	CONSTRAINT "stock_opname_items_uq" UNIQUE("id_stock_opnames","id_materials"),
	CONSTRAINT "stock_opname_items_qty_chk" CHECK ("stock_opname_items"."counted_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_opnames" (
	"id_stock_opnames" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opname_number" text NOT NULL,
	"opname_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"id_users" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_opnames_opname_number_unique" UNIQUE("opname_number"),
	CONSTRAINT "stock_opnames_status_chk" CHECK ("stock_opnames"."status" in ('draft','finalized'))
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id_supplier_invoices" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_purchase_orders" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'recorded' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"verification_note" text DEFAULT '' NOT NULL,
	"id_users" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_invoices_po_number_uq" UNIQUE("id_purchase_orders","invoice_number"),
	CONSTRAINT "supplier_invoices_status_chk" CHECK ("supplier_invoices"."status" in ('recorded','matched','held'))
);
--> statement-breakpoint
CREATE TABLE "supplier_materials" (
	"id_supplier_materials" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_suppliers" uuid NOT NULL,
	"id_materials" uuid NOT NULL,
	CONSTRAINT "supplier_materials_uq" UNIQUE("id_suppliers","id_materials")
);
--> statement-breakpoint
CREATE TABLE "supplier_quotations" (
	"id_supplier_quotations" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_purchase_requests" uuid NOT NULL,
	"id_suppliers" uuid NOT NULL,
	"id_users" uuid NOT NULL,
	"quotation_date" date NOT NULL,
	"valid_until" date NOT NULL,
	"lead_time_days" integer NOT NULL,
	"payment_term_days" integer DEFAULT 0 NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL,
	"selection_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_quotations_pr_supplier_uq" UNIQUE("id_purchase_requests","id_suppliers"),
	CONSTRAINT "supplier_quotations_days_chk" CHECK ("supplier_quotations"."lead_time_days" >= 0 and "supplier_quotations"."payment_term_days" >= 0 and "supplier_quotations"."valid_until" >= "supplier_quotations"."quotation_date")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id_suppliers" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_name" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_supplier_name_unique" UNIQUE("supplier_name")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id_units" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_name" text NOT NULL,
	CONSTRAINT "units_unit_name_unique" UNIQUE("unit_name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id_users" uuid PRIMARY KEY NOT NULL,
	"id_roles" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_id_purchase_requests_purchase_requests_id_purchase_requests_fk" FOREIGN KEY ("id_purchase_requests") REFERENCES "public"."purchase_requests"("id_purchase_requests") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_id_payments_payments_id_payments_fk" FOREIGN KEY ("id_payments") REFERENCES "public"."payments"("id_payments") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_id_budgets_budgets_id_budgets_fk" FOREIGN KEY ("id_budgets") REFERENCES "public"."budgets"("id_budgets") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_id_purchase_orders_purchase_orders_id_purchase_orders_fk" FOREIGN KEY ("id_purchase_orders") REFERENCES "public"."purchase_orders"("id_purchase_orders") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gr_items" ADD CONSTRAINT "gr_items_id_goods_receipts_goods_receipts_id_goods_receipts_fk" FOREIGN KEY ("id_goods_receipts") REFERENCES "public"."goods_receipts"("id_goods_receipts") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gr_items" ADD CONSTRAINT "gr_items_id_po_items_po_items_id_po_items_fk" FOREIGN KEY ("id_po_items") REFERENCES "public"."po_items"("id_po_items") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_id_supplier_invoices_supplier_invoices_id_supplier_invoices_fk" FOREIGN KEY ("id_supplier_invoices") REFERENCES "public"."supplier_invoices"("id_supplier_invoices") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_id_po_items_po_items_id_po_items_fk" FOREIGN KEY ("id_po_items") REFERENCES "public"."po_items"("id_po_items") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_id_categories_categories_id_categories_fk" FOREIGN KEY ("id_categories") REFERENCES "public"."categories"("id_categories") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_id_units_units_id_units_fk" FOREIGN KEY ("id_units") REFERENCES "public"."units"("id_units") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_id_supplier_invoices_supplier_invoices_id_supplier_invoices_fk" FOREIGN KEY ("id_supplier_invoices") REFERENCES "public"."supplier_invoices"("id_supplier_invoices") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_id_purchase_orders_purchase_orders_id_purchase_orders_fk" FOREIGN KEY ("id_purchase_orders") REFERENCES "public"."purchase_orders"("id_purchase_orders") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_id_quotation_items_quotation_items_id_quotation_items_fk" FOREIGN KEY ("id_quotation_items") REFERENCES "public"."quotation_items"("id_quotation_items") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_items" ADD CONSTRAINT "pr_items_id_purchase_requests_purchase_requests_id_purchase_requests_fk" FOREIGN KEY ("id_purchase_requests") REFERENCES "public"."purchase_requests"("id_purchase_requests") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_items" ADD CONSTRAINT "pr_items_id_materials_materials_id_materials_fk" FOREIGN KEY ("id_materials") REFERENCES "public"."materials"("id_materials") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_id_categories_categories_id_categories_fk" FOREIGN KEY ("id_categories") REFERENCES "public"."categories"("id_categories") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_id_supplier_quotations_supplier_quotations_id_supplier_quotations_fk" FOREIGN KEY ("id_supplier_quotations") REFERENCES "public"."supplier_quotations"("id_supplier_quotations") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_id_supplier_quotations_supplier_quotations_id_supplier_quotations_fk" FOREIGN KEY ("id_supplier_quotations") REFERENCES "public"."supplier_quotations"("id_supplier_quotations") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_id_materials_materials_id_materials_fk" FOREIGN KEY ("id_materials") REFERENCES "public"."materials"("id_materials") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_id_products_products_id_products_fk" FOREIGN KEY ("id_products") REFERENCES "public"."products"("id_products") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_id_materials_materials_id_materials_fk" FOREIGN KEY ("id_materials") REFERENCES "public"."materials"("id_materials") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_import_batches" ADD CONSTRAINT "sales_import_batches_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_id_sales_transactions_sales_transactions_id_sales_transactions_fk" FOREIGN KEY ("id_sales_transactions") REFERENCES "public"."sales_transactions"("id_sales_transactions") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_id_products_products_id_products_fk" FOREIGN KEY ("id_products") REFERENCES "public"."products"("id_products") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_id_sales_import_batches_sales_import_batches_id_sales_import_batches_fk" FOREIGN KEY ("id_sales_import_batches") REFERENCES "public"."sales_import_batches"("id_sales_import_batches") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_parameter_history" ADD CONSTRAINT "scoring_parameter_history_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_id_materials_materials_id_materials_fk" FOREIGN KEY ("id_materials") REFERENCES "public"."materials"("id_materials") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_id_stock_opnames_stock_opnames_id_stock_opnames_fk" FOREIGN KEY ("id_stock_opnames") REFERENCES "public"."stock_opnames"("id_stock_opnames") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_id_stock_opnames_stock_opnames_id_stock_opnames_fk" FOREIGN KEY ("id_stock_opnames") REFERENCES "public"."stock_opnames"("id_stock_opnames") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_id_materials_materials_id_materials_fk" FOREIGN KEY ("id_materials") REFERENCES "public"."materials"("id_materials") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_id_purchase_orders_purchase_orders_id_purchase_orders_fk" FOREIGN KEY ("id_purchase_orders") REFERENCES "public"."purchase_orders"("id_purchase_orders") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_verified_by_users_id_users_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_materials" ADD CONSTRAINT "supplier_materials_id_suppliers_suppliers_id_suppliers_fk" FOREIGN KEY ("id_suppliers") REFERENCES "public"."suppliers"("id_suppliers") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_materials" ADD CONSTRAINT "supplier_materials_id_materials_materials_id_materials_fk" FOREIGN KEY ("id_materials") REFERENCES "public"."materials"("id_materials") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_id_purchase_requests_purchase_requests_id_purchase_requests_fk" FOREIGN KEY ("id_purchase_requests") REFERENCES "public"."purchase_requests"("id_purchase_requests") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_id_suppliers_suppliers_id_suppliers_fk" FOREIGN KEY ("id_suppliers") REFERENCES "public"."suppliers"("id_suppliers") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_id_users_users_id_users_fk" FOREIGN KEY ("id_users") REFERENCES "public"."users"("id_users") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_roles_roles_id_roles_fk" FOREIGN KEY ("id_roles") REFERENCES "public"."roles"("id_roles") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_logged_idx" ON "audit_logs" USING btree ("logged_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("id_supplier_invoices");--> statement-breakpoint
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_items_trx_idx" ON "sales_items" USING btree ("id_sales_transactions");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_transactions_external_uq" ON "sales_transactions" USING btree ("source","external_ref") WHERE "sales_transactions"."external_ref" is not null;--> statement-breakpoint
CREATE INDEX "sales_transactions_date_idx" ON "sales_transactions" USING btree ("trx_date");--> statement-breakpoint
CREATE INDEX "stock_movements_material_idx" ON "stock_movements" USING btree ("id_materials","moved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_quotations_one_selected_uq" ON "supplier_quotations" USING btree ("id_purchase_requests") WHERE "supplier_quotations"."is_selected";--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("id_roles");