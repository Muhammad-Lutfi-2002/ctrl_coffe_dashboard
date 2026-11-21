ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_id_gr_items_gr_items_id_gr_items_fk" FOREIGN KEY ("id_gr_items") REFERENCES "public"."gr_items"("id_gr_items") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE public.users ADD CONSTRAINT users_id_users_auth_users_fk FOREIGN KEY (id_users) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;--> statement-breakpoint
CREATE VIEW "stock_balances" WITH (security_invoker = true) AS
  SELECT m.id_materials, m.sku, m.material_name, m.min_stock, m.safety_stock,
         COALESCE(SUM(sm.qty_delta), 0)::numeric(14,3) AS balance
  FROM materials m LEFT JOIN stock_movements sm ON sm.id_materials = m.id_materials
  GROUP BY m.id_materials;--> statement-breakpoint
CREATE FUNCTION "prevent_mutation"() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION '% bersifat append-only; % tidak diizinkan', TG_TABLE_NAME, TG_OP; END $$;--> statement-breakpoint
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION "prevent_mutation"();--> statement-breakpoint
CREATE TRIGGER "stock_movements_append_only" BEFORE UPDATE OR DELETE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION "prevent_mutation"();--> statement-breakpoint
CREATE FUNCTION "check_gr_item_limit"() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ordered numeric; received numeric;
BEGIN
  SELECT qty_ordered INTO ordered FROM po_items WHERE id_po_items = NEW.id_po_items FOR UPDATE;
  SELECT COALESCE(SUM(qty_accepted), 0) INTO received FROM gr_items WHERE id_po_items = NEW.id_po_items;
  IF received + NEW.qty_accepted > ordered THEN
    RAISE EXCEPTION 'Jumlah diterima (%) melebihi jumlah dipesan (%)', received + NEW.qty_accepted, ordered;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER "gr_items_limit" BEFORE INSERT ON "gr_items" FOR EACH ROW EXECUTE FUNCTION "check_gr_item_limit"();--> statement-breakpoint
INSERT INTO "roles" ("role_code","role_name") VALUES ('admin','Admin'),('purchasing','Purchasing'),('finance','Keuangan'),('owner','Owner');--> statement-breakpoint
INSERT INTO "scoring_parameters" ("criterion","weight") VALUES ('price',40),('performance',25),('lead_time',20),('payment_term',15);--> statement-breakpoint
INSERT INTO "app_settings" ("setting_key","setting_value") VALUES ('payment_approval_threshold','5000000'),('new_supplier_performance_score','70');--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.legacy_suppliers') IS NOT NULL THEN
    INSERT INTO suppliers (supplier_name, contact_name, phone, email, address, is_active)
      SELECT name, contact_name, phone, email, city, status = 'active' FROM legacy_suppliers ON CONFLICT (supplier_name) DO NOTHING;
  END IF;
  IF to_regclass('public.legacy_products') IS NOT NULL THEN
    INSERT INTO categories (category_name) SELECT DISTINCT category FROM legacy_products ON CONFLICT DO NOTHING;
    INSERT INTO units (unit_name) SELECT DISTINCT unit FROM legacy_products ON CONFLICT DO NOTHING;
    INSERT INTO materials (id_categories, id_units, sku, material_name, min_stock, safety_stock, is_active)
      SELECT c.id_categories, u.id_units, p.sku, p.name, p.reorder_level, 0, p.status = 'active'
      FROM legacy_products p JOIN categories c ON c.category_name = p.category JOIN units u ON u.unit_name = p.unit
      ON CONFLICT (sku) DO NOTHING;
    INSERT INTO stock_movements (id_materials, movement_type, qty_delta, note)
      SELECT m.id_materials, 'opening_balance', p.stock_on_hand, 'Saldo awal hasil migrasi dari legacy_products'
      FROM legacy_products p JOIN materials m ON m.sku = p.sku WHERE p.stock_on_hand > 0;
  END IF;
END $$;
