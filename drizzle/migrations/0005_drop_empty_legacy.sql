-- Bersihkan tabel legacy_* HANYA bila kosong (database baru). Tabel legacy yang berisi data lama tetap dipertahankan untuk rujukan/rollback.
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['legacy_payments','legacy_goods_receipts','legacy_purchase_orders','legacy_purchase_requests','legacy_products','legacy_suppliers'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n = 0 THEN EXECUTE format('DROP TABLE public.%I CASCADE', t); END IF;
    END IF;
  END LOOP;
END $$;
