# 4. Pengujian — hasil aktual

Dijalankan di lingkungan pengembangan (PGlite in-memory untuk logika/DB, Supabase asli untuk RLS). **Tidak ada hasil UAT atau Lighthouse** yang dibuat-buat.

| Lapisan | Berkas | Hasil |
|---|---|---|
| Unit: SAW, three-way matching, ROP/status stok, ambang pembayaran, pertumbuhan, parser/validasi CSV | `shared/scm/rules.spec.ts` | 13/13 lulus (termasuk contoh skripsi 78,33 / 80,00 / 80,55) |
| Integrasi alur end-to-end lewat action (RBAC, stok, PR→SAW→PO→penerimaan parsial→invoice→three-way→pembayaran→laporan, impor CSV, dashboard, audit) | `tests/scm-workflow.spec.ts` | 23/23 lulus |
| Seluruh suite | `pnpm test` | 55 lulus, 7 gagal — **7 gagal sudah ada sebelum perubahan** (`tests/use-navigation-state.spec.ts`, `mcp-provider`; tes bawaan starter, tidak terkait SCM) |
| Typecheck | `pnpm typecheck` | lulus |
| Production build | `pnpm build` | lulus |
| Smoke server produksi | `/login`, `/`, `/sales-analytics` = 200; action tanpa sesi = 401 | lulus |
| RLS di Supabase asli (peran purchasing, finance, owner, anon) | skrip SQL transaksi-rollback | sesuai harapan (lihat 3.4) |

## Belum diuji / keterbatasan pengujian

- Login Supabase end-to-end di browser dan `create-user` (butuh akun nyata dan service-role key).
- Lighthouse desktop/mobile sesuai BAB III: **belum dijalankan** (aplikasi belum ter-deploy di sini; sandbox tidak dapat menjangkau Supabase).
- Uji beban, uji penetrasi, dan uji lintas browser tidak dilakukan.
- Migrasi data legacy dibuktikan pada data demo starter (terpetakan), bukan data produksi CTRL + Coffee.
