import { fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { desc, eq, like, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { getDb, schema } from "../db.js";
import type { RoleCode } from "../../shared/scm/rules.js";

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Exec = Pick<Db, "select" | "insert" | "update" | "delete" | "execute">;

export type Actor = { idUsers: string; email: string; fullName: string; roleCode: RoleCode };

/** Identitas pengguna berasal dari sesi server (bukan dari klien); peran dibaca dari tabel users+roles. */
const ACTOR_TTL_MS = 15_000;
const actorCache = new Map<string, { at: number; actor: Actor }>();

export async function currentActor(db: Exec = getDb()): Promise<Actor> {
  const email = getRequestUserEmail();
  if (!email) fail("Sesi tidak valid. Silakan masuk kembali.", { statusCode: 401 });
  // Satu halaman memanggil belasan action; tanpa cache tiap action menambah satu round-trip ke basis data.
  // TTL pendek (15 dtk) agar perubahan peran atau penonaktifan akun tetap segera berlaku.
  const hit = actorCache.get(email.toLowerCase());
  if (hit && Date.now() - hit.at < ACTOR_TTL_MS) return hit.actor;
  const [row] = await db
    .select({ idUsers: schema.users.idUsers, email: schema.users.email, fullName: schema.users.fullName, isActive: schema.users.isActive, roleCode: schema.roles.roleCode })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.roles.idRoles, schema.users.idRoles))
    .where(eq(sql`lower(${schema.users.email})`, email.toLowerCase()));
  if (!row) fail("Akun belum terdaftar sebagai pengguna CTRL + Coffee.", { statusCode: 403 });
  if (!row.isActive) fail("Akun dinonaktifkan.", { statusCode: 403 });
  const actor: Actor = { idUsers: row.idUsers, email: row.email, fullName: row.fullName, roleCode: row.roleCode as RoleCode };
  if (actorCache.size > 200) actorCache.clear();
  actorCache.set(email.toLowerCase(), { at: Date.now(), actor });
  return actor;
}

/** Otorisasi di server untuk setiap action (RBAC) — tidak bergantung pada menu frontend. */
export async function requireRole(...allowed: RoleCode[]): Promise<Actor> {
  const actor = await currentActor();
  if (!allowed.includes(actor.roleCode)) fail("Peran Anda tidak berwenang untuk tindakan ini.", { statusCode: 403 });
  return actor;
}

export async function audit(tx: Exec, actor: Pick<Actor, "idUsers"> | null, action: string, entityType: string, entityId?: string | null, detail?: Record<string, unknown>) {
  await tx.insert(schema.auditLogs).values({ idUsers: actor?.idUsers ?? null, action, entityType, entityId: entityId ?? null, detail: detail ?? null });
}

/** Nomor dokumen berurutan per tahun (PR-2026-0001). Advisory lock mencegah nomor ganda pada transaksi bersamaan. */
export async function nextNumber(tx: Exec, column: PgColumn, prefix: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${prefix}))`);
  const year = new Date().getFullYear();
  const [latest] = await tx.select({ n: column }).from(column.table).where(like(column, `${prefix}-${year}-%`)).orderBy(desc(column)).limit(1);
  const prev = latest ? Number(String(latest.n).split("-").pop()) : 0;
  return `${prefix}-${year}-${String(prev + 1).padStart(4, "0")}`;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
