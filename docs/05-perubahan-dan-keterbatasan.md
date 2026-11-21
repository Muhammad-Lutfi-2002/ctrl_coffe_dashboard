# 5. Perubahan, fitur selesai, dan keterbatasan

## Berkas utama yang diubah/ditambah
- **Database**: `drizzle/schema.ts` (ditulis ulang), `drizzle/migrations/0001…0007` + snapshot/journal, `0000` (data demo dihapus).
- **Domain murni**: `shared/scm/{rules,saw,matching,csv}.ts` (+ spec).
- **Service server**: `server/services/{common,settings,inventory,procurement,receiving,finance,sales,master,dashboard}.ts`.
- **Auth**: `server/lib/supabase-auth.ts`, `server/plugins/auth.ts`, `actions/create-user.ts`, `app/lib/supabase-client.ts`.
- **Actions** (±60, tipis + `requireRole`): `actions/*.ts`.
- **UI**: `app/routes/*` (dashboard, inventory, master-data, suppliers, purchase-requests, procurement.$id, purchase-orders, goods-receiving, invoices, payments, finance, sales, sales-analytics, settings, audit, login), `app/components/scm/ui.tsx`, Layout/Sidebar, `app/lib/nav.ts`, hook `use-user/use-list/use-run`.
- **Dihapus**: peran di `localStorage` (`role-context`), model data lama, aksi lama.
- Tema: token CSS dan warna background **tidak diubah**.

## Selesai
Seluruh FR kecuali yang tertera di bawah (lihat matriks di dokumen 1).

## Belum selesai / keterbatasan
1. **FR-U5** notifikasi (hanya penghitung di dashboard) dan **FR-U6** ekspor PDF/Excel belum ada.
2. Lighthouse dan uji login Supabase end-to-end belum dijalankan.
3. ROP otomatis (`avgDailyUsage`) ada di service tetapi belum tampil di UI; pemakaian bahan tidak otomatis terpotong dari penjualan (skripsi: Admin mencatat barang keluar).
4. Ambang persetujuan pembayaran (Rp5.000.000) adalah nilai awal — **butuh konfirmasi Owner**.
5. Cache sesi 30 detik; `legacy_*` menyimpan PR/PO lama (jika ada) tanpa pemetaan.
6. Tes bawaan starter yang gagal (7) tidak diperbaiki karena di luar lingkup.
7. Sandbox tidak dapat menjangkau Supabase; `DATABASE_URL` (kata sandi) tidak tersedia sehingga aplikasi belum dijalankan terhadap Supabase dari sini.
