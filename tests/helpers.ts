import fs from "node:fs";
import path from "node:path";

import { runWithRequestContext } from "@agent-native/core/server";
import { sql } from "drizzle-orm";

import { getDb } from "../server/db.js";
import { upsertUserProfile } from "../server/services/master.js";

const dir = path.resolve(__dirname, "../drizzle/migrations");

/** Terapkan seluruh migrasi SCM (urut journal) ke database uji PGlite. */
export async function applyMigrations() {
  const db = getDb();
  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) {
    const text = fs.readFileSync(path.join(dir, `${entry.tag}.sql`), "utf8");
    for (const stmt of text.split("--> statement-breakpoint")) {
      if (!stmt.trim()) continue;
      const client = (db as any).$client;
      if (client?.exec) await client.exec(stmt); // PGlite: izinkan beberapa perintah per potongan
      else await db.execute(sql.raw(stmt));
    }
  }
}

export const USERS = {
  admin: { id: "00000000-0000-4000-8000-000000000001", email: "admin@ctrl.test", name: "Admin Uji" },
  purchasing: { id: "00000000-0000-4000-8000-000000000002", email: "purchasing@ctrl.test", name: "Purchasing Uji" },
  finance: { id: "00000000-0000-4000-8000-000000000003", email: "finance@ctrl.test", name: "Keuangan Uji" },
  owner: { id: "00000000-0000-4000-8000-000000000004", email: "owner@ctrl.test", name: "Owner Uji" },
} as const;

export async function seedUsers() {
  const db = getDb();
  for (const [role, u] of Object.entries(USERS)) {
    await db.transaction((tx) => upsertUserProfile(tx, null, { idUsers: u.id, email: u.email, fullName: u.name, roleCode: role }));
  }
}

/** Jalankan fungsi sebagai pengguna tertentu (identitas dari konteks sesi server, seperti produksi). */
export function as<T>(role: keyof typeof USERS | null, fn: () => Promise<T>): Promise<T> {
  return Promise.resolve(runWithRequestContext({ userEmail: role ? USERS[role].email : undefined }, fn)) as Promise<T>;
}
