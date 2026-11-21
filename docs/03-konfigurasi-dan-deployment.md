# 3. Konfigurasi, migrasi, dan deployment

## 3.1 Variabel lingkungan (lihat `.env.example`)

| Variabel | Sisi | Keterangan |
|---|---|---|
| `DATABASE_URL` | server | Runtime serverless: **transaction pooler** Supavisor (port 6543). Driver `postgres` dikonfigurasi framework dengan prepared statement nonaktif untuk pooler. |
| `DATABASE_URL_UNPOOLED` | server | Migrasi: koneksi langsung (5432) atau session pooler. **Jangan** transaction pooler. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server | Validasi sesi (`auth.getUser`) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Publik by design; dipakai halaman masuk |
| `SUPABASE_SERVICE_ROLE_KEY` | **server saja** | Hanya untuk `create-user`. Jangan pernah diawali `VITE_`. |

Tidak ada kata sandi database atau service key di repo. Kata sandi DB tidak dapat dibaca melalui MCP; isi sendiri di `.env`/Netlify.

## 3.2 Migrasi — satu sumber: Drizzle Kit

- Sumber tunggal DDL: `drizzle/schema.ts` → `pnpm db:generate`; berkas di `drizzle/migrations/` (0000–0007).
- SQL kustom (trigger, view, RLS, seed referensi) ditulis sebagai migrasi SQL biasa dan tercatat pada journal yang sama. **Supabase CLI tidak dipakai untuk skema** agar tidak ada dua sumber kebenaran.
- Proyek Supabase `ctrl+coffe` (ref `fiebkbsvhmzbazsldpkc`) sudah diterapkan: 0002, 0003, 0004, 0006, 0007 dijalankan lewat MCP; 0000, 0001, 0005 tidak perlu pada database kosong. Seluruh 8 entri sudah dicatat pada `drizzle.__drizzle_migrations`, sehingga `pnpm db:migrate` berikutnya tidak mengulang.
- Migrasi aman: 0001 mengganti nama tabel lama menjadi `legacy_*` (tidak menghapus data); 0003 memetakan supplier dan produk lama ke struktur baru (+ saldo awal); 0005 hanya membuang tabel `legacy_*` yang **kosong**. Tidak ada reset database. PR/PO/penerimaan/pembayaran lama tidak dipetakan otomatis (tidak punya penawaran/invoice) dan tetap utuh di `legacy_*`.
- Backup sebelum menerapkan ke database berisi data: gunakan backup Supabase / `pg_dump` terlebih dulu.

## 3.3 Bootstrap Owner pertama

1. Supabase Dashboard → Authentication → Users → *Add user* (email + password, centang auto-confirm).
2. SQL Editor: 
   ```sql
   insert into public.users (id_users, id_roles, full_name, email)
   select u.id, r.id_roles, 'Nama Owner', u.email
   from auth.users u, public.roles r
   where u.email = 'owner@contoh.id' and r.role_code = 'owner';
   ```
3. Masuk ke aplikasi sebagai Owner → `/settings` → *Tambah pengguna* untuk Admin, Purchasing, Keuangan (butuh `SUPABASE_SERVICE_ROLE_KEY`).

## 3.4 Keamanan

- Identitas hanya dari cookie sesi Supabase yang divalidasi server (`getUser`); peran dari tabel `users`+`roles`; **tiap action memanggil `requireRole()`** — menu yang disembunyikan hanyalah UX.
- Koneksi PostgreSQL server berhak istimewa → **mem-bypass RLS**. RLS melindungi akses lewat Supabase Data API: semua tabel RLS aktif, `anon` dicabut, `authenticated` hanya `SELECT` sesuai peran (helper di skema `private`). Mutasi hanya lewat server.
- Diuji langsung di Supabase (transaksi di-rollback): Purchasing tidak dapat membaca penjualan/keuangan, tidak dapat INSERT/UPDATE; Keuangan tidak dapat membaca audit; `anon` ditolak; Owner membaca seluruh pengguna.
- Cache sesi 30 detik per token; sesi dicabut efektif maksimal 30 detik setelah logout/penonaktifan token.
- Advisor keamanan Supabase: temuan `current_role_code` dan `rls_auto_enable` ditangani (migrasi 0006). Aktifkan *Leaked password protection* di Dashboard Auth (pengaturan, bukan skema).

## 3.5 Menjalankan

```bash
pnpm install
cp .env.example .env   # lengkapi DATABASE_URL & SUPABASE_SERVICE_ROLE_KEY
pnpm db:migrate        # memakai DATABASE_URL_UNPOOLED
pnpm dev
pnpm typecheck && pnpm test && pnpm build
```
Seed pengembangan (opsional, bertanda `[DEV]`): `ALLOW_DEV_SEED=1 pnpm tsx scripts/seed-dev.ts`.
