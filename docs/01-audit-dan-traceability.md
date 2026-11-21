# 1. Audit awal dan traceability matrix

Acuan kebutuhan: dokumen skripsi BAB I–III revisi. Kode sebelumnya adalah turunan *starter* Agent-Native.

## 1.1 Temuan audit awal (kondisi repo `ctrl-coffee-supply-chain-d16`)

| # | Temuan | Dampak terhadap skripsi | Tindakan |
|---|---|---|---|
| 1 | Hanya 6 tabel (products, suppliers, purchase_requests, purchase_orders, goods_receipts, payments); PK teks, uang integer, waktu teks | Tidak sesuai ERD BAB III (33 entitas) | Skema ditulis ulang (UUID, NUMERIC, TIMESTAMPTZ, constraint) |
| 2 | Bahan baku dan produk menu digabung pada satu tabel `products`; stok disimpan sebagai kolom `stock_on_hand` | Melanggar aturan "saldo dari mutasi" | `materials` dan `products` dipisah; saldo = Σ `stock_movements` |
| 3 | PR dan PO hanya satu item; tanpa penawaran, tanpa SAW | FR-P3 s.d. FR-P6 tidak ada | Modul penawaran, SAW, pemilihan supplier, PO multi-item |
| 4 | Tidak ada invoice, three-way matching, pembayaran bertahap, anggaran, pengeluaran | FR-K1..K5 tidak ada | Modul keuangan lengkap |
| 5 | Tidak ada data penjualan dan dashboard analitik; `reports` berisi angka tidak dari transaksi | FR-U4, FR-O5 tidak ada | `sales_*`, impor CSV, dashboard dari transaksi |
| 6 | **Peran disimpan di `localStorage`** dan halaman masuk hanya "pratinjau"; tidak ada otorisasi server | Celah keamanan serius | Supabase Auth + peran dari tabel `users`/`roles` + `requireRole()` di setiap action |
| 7 | Migrasi awal menyisipkan **data demo** ke tabel produksi | Data demo bercampur data nyata | Seed demo dihapus dari migrasi; dipindah ke `scripts/seed-dev.ts` (berlabel `[DEV]`) |
| 8 | Tidak ada audit trail, RLS, atau constraint bisnis | Tidak memenuhi tahap 4 dan 7 | `audit_logs` append-only, RLS, CHECK/trigger |
| 9 | Baseline: 7 tes starter gagal (`use-navigation-state`, `mcp-provider`) — tidak terkait SCM | — | Dibiarkan; didokumentasikan |

## 1.2 Traceability matrix (FR → halaman → action → tabel → pengujian)

Status: **Selesai** = backend + UI + tes otomatis lulus; **Selesai (belum diuji otomatis)** = kode ada, butuh layanan eksternal untuk diuji; **Parsial/Belum** = lihat catatan.

| FR | Kebutuhan | Halaman | Action | Tabel | Pengujian | Status |
|---|---|---|---|---|---|---|
| FR-U1 | Login, logout, RBAC | `/login`, Sidebar | `get-current-user`, `requireRole` | users, roles | `RBAC di server` (403/401) | Selesai (login Supabase belum diuji end-to-end di browser) |
| FR-U2 | Kelola akun | `/settings` | `create-user`, `update-user-access`, `list-users` | users | — (butuh service-role key) | Selesai (belum diuji otomatis) |
| FR-U3 | Jejak audit | `/audit` | `list-audit-logs` | audit_logs | `audit trail…`, `append-only` | Selesai |
| FR-U4 | Data penjualan manual + CSV | `/sales` | `create-sale`, `import-sales-csv`, `list-sales` | sales_transactions, sales_items, sales_import_batches | 5 tes penjualan + 3 tes CSV | Selesai |
| FR-U5 | Notifikasi status dokumen | Dashboard, lencana status | — | — | — | **Parsial**: penghitung tugas menunggu di dashboard; belum ada notifikasi push/email |
| FR-U6 | Ekspor PDF/Excel | — | — | — | — | **Belum** (prioritas *Could*) |
| FR-A1 | Master produk/bahan | `/master-data` | `create/update-material`, `create/update-product`, `set-recipe` | materials, products, recipes, categories, units | dipakai di seluruh tes | Selesai |
| FR-A2 | Stok minimum/pengaman | `/master-data` | `create/update-material` | materials | `stockStatus` | Selesai (ROP otomatis `avgDailyUsage` ada di service, belum ditampilkan di UI) |
| FR-A3 | Barang masuk dari PO | `/goods-receiving` | `receive-goods` | goods_receipts, gr_items, stock_movements | penerimaan parsial | Selesai |
| FR-A4 | Barang keluar | `/inventory` | `record-stock-movement` | stock_movements | stok tidak cukup ditolak | Selesai |
| FR-A5 | Stock opname | `/inventory` | `create/finalize-stock-opname` | stock_opnames, stock_opname_items | selisih jadi mutasi | Selesai |
| FR-A6 | Kartu stok | `/inventory` | `list-stock`, `list-stock-movements` | stock_movements | saldo dari mutasi | Selesai |
| FR-A7 | Peringatan stok minimum | Dashboard, `/inventory`, PR | `list-low-stock` | stock_movements, materials | `rules.spec` | Selesai |
| FR-P1 | Supplier | `/suppliers` | `create/update-supplier`, `set-supplier-materials` | suppliers, supplier_materials | dipakai di tes | Selesai |
| FR-P2 | PR multi-item | `/purchase-requests` | `create-purchase-request` | purchase_requests, pr_items | PR multi-item | Selesai |
| FR-P3 | Catat ≥2 penawaran | `/procurement/:id` | `add-quotation` | supplier_quotations, quotation_items | 3 penawaran, duplikat ditolak | Selesai |
| FR-P4 | Bandingkan + SAW | `/procurement/:id` | `compare-quotations` | + scoring_parameters | contoh skripsi 78,33/80,00/80,55 | Selesai |
| FR-P5 | Pilih supplier + alasan | `/procurement/:id` | `select-supplier` | supplier_quotations | alasan wajib | Selesai |
| FR-P6 | PO dari penawaran terpilih | `/procurement/:id` | `create-purchase-order` | purchase_orders, po_items | PO + total turunan | Selesai |
| FR-P7 | Pantau PO | `/purchase-orders`, `/goods-receiving` | `list-purchase-orders`, `cancel-purchase-order` | purchase_orders | status partial/received | Selesai |
| FR-K1 | Verifikasi invoice (3-way) | `/invoices` | `record-invoice`, `verify-invoice` | supplier_invoices, invoice_items | held vs matched | Selesai |
| FR-K2 | Pengeluaran operasional | `/finance` | `record-expense` | expenses | laporan keuangan | Selesai |
| FR-K3 | Pembayaran bertahap | `/payments` | `create-payment`, `mark-payment-paid` | payments | pembayaran bertahap | Selesai |
| FR-K4 | Anggaran | `/finance` | `set-budget` | budgets | laporan keuangan | Selesai |
| FR-K5 | Laporan keuangan | `/finance` | `get-finance-report` | agregat | `budgetRemaining` | Selesai |
| FR-O1 | Dashboard operasional | `/` | `get-operational-summary` | agregat | irisan per peran | Selesai |
| FR-O2 | Setujui/tolak PR | `/purchase-requests` | `decide-purchase-request` | approvals | catatan wajib | Selesai |
| FR-O3 | Setujui pembayaran > ambang | `/payments` | `decide-payment` | approvals, payments | Keuangan tidak bisa setuju sendiri | Selesai |
| FR-O4 | Pantau persediaan, pembelian, kinerja supplier | `/`, `/suppliers` | `list-supplier-performance` | agregat | kinerja dari penerimaan | Selesai |
| FR-O5 | Analitik penjualan | `/sales-analytics` | `get-sales-dashboard` | sales_* | total/rata-rata/tren/top | Selesai |

## 1.3 Ketidaksesuaian dokumen skripsi ↔ implementasi (butuh keputusan/pembaruan)

| # | Ketidaksesuaian | Rekomendasi |
|---|---|---|
| D1 | ERD BAB III belum memuat: `invoice_items`, `supplier_materials`, `sales_import_batches`, `scoring_parameter_history`, `app_settings`; kolom `sales_transactions.source/external_ref`, `gr_items.qty_rejected`, `stock_movements.id_gr_items/id_stock_opnames`, `approvals.id_payments` | Perbarui Gambar ERD dan Tabel "Entitas dan relasi utama" di BAB III (lihat `02-erd-final.md`) |
| D2 | Rumus lead time BAB III membagi dengan lead time; bila 0 hari terjadi pembagian nol | Implementasi memakai minimal 1 hari; tambahkan kalimat ini di BAB III |
| D3 | Prompt meminta Black Box Testing, sedangkan revisi dosen menghapus BBT/UAT dan menetapkan uji Lighthouse | Tes otomatis diperlakukan sebagai QA pengembangan, bukan metode uji skripsi. Lighthouse **belum dijalankan** (perlu aplikasi ter-deploy) |
| D4 | Ambang persetujuan pembayaran belum ditetapkan Owner | Default Rp5.000.000 hanyalah nilai awal; **konfirmasi Owner**, ubah di `/settings` |
| D5 | Nilai awal kinerja supplier baru (70) dan bobot SAW awal | Sesuai BAB III; ubah hanya oleh Owner |
| D6 | BAB III menyebut notifikasi status (FR-U5) dan ekspor (FR-U6) | Belum diimplementasikan; revisi cakupan atau lanjutkan di Sprint berikutnya |
| D7 | Dashboard Owner di BAB III memuat "kinerja supplier" dan "keuangan" | Sudah ada di `/` dan `/finance` |
