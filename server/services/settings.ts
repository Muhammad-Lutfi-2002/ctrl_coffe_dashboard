import { fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";

import { type SawWeights, DEFAULT_WEIGHTS, validateWeights, type SawCriterion } from "../../shared/scm/saw.js";
import { schema } from "../db.js";
import { audit, type Actor, type Exec, type Tx } from "./common.js";

export async function getWeights(db: Exec): Promise<SawWeights> {
  const rows = await db.select().from(schema.scoringParameters);
  const w = { ...DEFAULT_WEIGHTS };
  for (const r of rows) w[r.criterion as SawCriterion] = Number(r.weight);
  return w;
}

/** Hanya Owner (dicek di action). Bobot wajib berjumlah 100; setiap perubahan dicatat pada histori dan audit. */
export async function updateWeights(tx: Tx, actor: Actor, next: SawWeights) {
  const check = validateWeights(next);
  if (!check.ok) fail(`Total bobot harus 100% (saat ini ${check.sum}%)`, { statusCode: 400 });
  const current = await getWeights(tx);
  for (const c of Object.keys(next) as SawCriterion[]) {
    if (current[c] === next[c]) continue;
    await tx.update(schema.scoringParameters).set({ weight: next[c] }).where(eq(schema.scoringParameters.criterion, c));
    await tx.insert(schema.scoringParameterHistory).values({ criterion: c, oldWeight: current[c], newWeight: next[c], idUsers: actor.idUsers });
  }
  await audit(tx, actor, "scoring_weights_changed", "scoring_parameters", null, { from: current, to: next });
  return next;
}

export async function getSetting(db: Exec, key: string, fallback: string) {
  const [row] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.settingKey, key));
  return row?.settingValue ?? fallback;
}

export async function setSetting(tx: Tx, actor: Actor, key: "payment_approval_threshold" | "new_supplier_performance_score", value: number) {
  if (!Number.isFinite(value) || value < 0) fail("Nilai pengaturan tidak valid", { statusCode: 400 });
  if (key === "new_supplier_performance_score" && value > 100) fail("Nilai awal maksimal 100", { statusCode: 400 });
  const old = await getSetting(tx, key, "");
  await tx.update(schema.appSettings).set({ settingValue: String(value), idUsers: actor.idUsers, updatedAt: new Date() }).where(eq(schema.appSettings.settingKey, key));
  await audit(tx, actor, "setting_changed", "app_settings", key, { from: old, to: value });
}
