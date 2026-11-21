# CTRL + Coffee — SCM dan Dashboard Analitik Penjualan

Implementasi sistem skripsi (Agile Scrum). Dokumentasi: `docs/01-audit-dan-traceability.md`, `02-erd-final.md`, `03-konfigurasi-dan-deployment.md`, `04-pengujian-aktual.md`, `05-perubahan-dan-keterbatasan.md`.

Stack: React Router + TypeScript + Tailwind, Drizzle ORM, Supabase (PostgreSQL, Auth, RLS).

---

# CTRL + Coffee Supply Chain Management

Internal dashboard for CTRL + Coffee to manage purchasing for a small coffee shop: suppliers, products, purchase requests, purchase orders, goods receiving, inventory, supplier payments, and reports. Built on the [Agent-Native](https://agent-native.com) framework with React Router 7, Tailwind CSS, Drizzle ORM, and Postgres.

## Purchasing flow

1. **Purchase request (PR)** is submitted by a team member and approved or rejected once.
2. **Purchase order (PO)** is created for an active supplier and active product. An approved PR can be linked to one PO.
3. **Goods receiving** records arriving quantity against a PO. Receipts can be partial; the PO becomes `received` when the full quantity has arrived. Each receipt increases product stock.
4. **Payments** are scheduled against a PO. The total scheduled plus paid amount can never exceed the PO total.
5. A PO can be cancelled only before any goods or payments are recorded.

Business rules live in `shared/scm/rules.ts` and are used by both the server actions and the UI.

## Develop locally

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

Set `AUTH_DISABLED=true` in `.env` to skip sign-in during development.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm typecheck` | Type-check the app, actions, server, and shared code |
| `pnpm test` | Run the Vitest suite |
| `pnpm build` | Production build |
| `pnpm db:generate` | Generate a migration after editing `drizzle/schema.ts` |
| `pnpm db:migrate` | Apply migrations |

## Project layout

- `app/routes/`: one route per screen (dashboard, inventory, products, suppliers, purchase requests, purchase orders, goods receiving, finance, payments, reports, settings)
- `app/components/shared/`: page header, table shell, pagination, status badge, form field, confirm dialog
- `app/components/purchase-orders/`, `app/components/goods-receiving/`: dialogs for creating POs and recording receipts
- `app/components/layout/`: responsive app shell, sidebar, and client-side role preview
- `app/hooks/use-action-list.ts`: typed wrapper around list actions
- `actions/`: all reads and writes; each action validates its input with Zod and enforces business rules on the server
- `server/lib/scm.ts`: shared input schemas
- `server/lib/scm-db.ts`: document numbering (`PO-2026-0001`) and conflict handling
- `shared/scm/rules.ts`: status transitions, payment limits, and supplier balance calculations (used on client and server)
- `drizzle/schema.ts`, `drizzle/migrations/`: database schema and migrations

## Data integrity

- Goods receiving and payment creation lock the PO row (`SELECT ... FOR UPDATE`) inside a transaction before checking remaining quantity or unallocated amount.
- Products and suppliers that are referenced by POs, receipts, or payments cannot be deleted; deactivate them instead.
- Purchase request approval only succeeds from `submitted`, so a decision cannot be changed later.
- Paid payments cannot be deleted.
- Document numbers are derived from the latest number for the current year, not from row counts, so deleting a record does not cause the next number to collide.

## Tests

- `shared/scm/rules.spec.ts`: unit tests for the business rules.
- `actions/scm-workflow.spec.ts`: integration tests that run the actions against an in-memory PGlite database, covering receiving, cancellation, payment caps, request approval, and reference checks.

## Known limitations

- **Authentication and roles are not enforced on the server.** The role selector on the login page is a client-side preview stored in local storage. Every action currently accepts any caller. Server-side role-based access control needs organization membership and app-role setup in the framework before it can be enforced.
- Login form submission is a preview flow; it does not create a session.

Framework docs: [agent-native.com/docs](https://agent-native.com/docs).
