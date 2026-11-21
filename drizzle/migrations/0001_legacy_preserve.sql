-- Mengamankan data skema lama (starter 6 tabel). Tabel lama TIDAK dihapus: diganti nama menjadi legacy_*
-- supaya data dapat dipetakan/dirujuk dan dapat di-rollback. Aman dijalankan pada database kosong (tidak melakukan apa pun).
DO $$
DECLARE t text; r record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_on_hand') THEN
    FOREACH t IN ARRAY ARRAY['products','suppliers','purchase_requests','purchase_orders','goods_receipts','payments'] LOOP
      IF to_regclass('public.' || t) IS NOT NULL THEN
        FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = t LOOP
          EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.indexname, 'legacy_' || r.indexname);
        END LOOP;
        EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, 'legacy_' || t);
      END IF;
    END LOOP;
  END IF;
END $$;
