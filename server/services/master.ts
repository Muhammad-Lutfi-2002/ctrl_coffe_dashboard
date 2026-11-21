import { fail } from "@agent-native/core/action";
import { asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { schema } from "../db.js";
import { audit, num, type Actor, type Exec, type Tx } from "./common.js";
import { stockBalances } from "./inventory.js";
import { supplierPerformance } from "./procurement.js";

const S = schema;

async function uniqueGuard<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try { return await fn(); } catch (e) {
    const msg = String((e as any)?.cause?.message ?? (e as Error).message);
    if (/unique|duplicate/i.test(msg)) fail(message, { statusCode: 409 });
    throw e;
  }
}

export const listCategories = (db: Exec) => db.select().from(S.categories).orderBy(asc(S.categories.categoryName));
export const listUnits = (db: Exec) => db.select().from(S.units).orderBy(asc(S.units.unitName));

export async function createCategory(tx: Tx, actor: Actor, name: string) {
  const [r] = await uniqueGuard(() => tx.insert(S.categories).values({ categoryName: name.trim() }).returning(), "Kategori sudah ada");
  await audit(tx, actor, "category_created", "categories", r.idCategories, { name }); return r;
}
export async function createUnit(tx: Tx, actor: Actor, name: string) {
  const [r] = await uniqueGuard(() => tx.insert(S.units).values({ unitName: name.trim() }).returning(), "Satuan sudah ada");
  await audit(tx, actor, "unit_created", "units", r.idUnits, { name }); return r;
}

export async function listMaterials(db: Exec) {
  const bal = await stockBalances(db);
  const [cats, units] = await Promise.all([listCategories(db), listUnits(db)]);
  return bal.map((b) => ({ ...b, categoryName: cats.find((c) => c.idCategories === b.idCategories)?.categoryName ?? "", unitName: units.find((u) => u.idUnits === b.idUnits)?.unitName ?? "" }));
}

export type MaterialInput = { idCategories: string; idUnits: string; sku: string; materialName: string; minStock: number; safetyStock: number; isActive?: boolean };
export async function createMaterial(tx: Tx, actor: Actor, input: MaterialInput) {
  const [r] = await uniqueGuard(() => tx.insert(S.materials).values({ ...input, sku: input.sku.trim() }).returning(), "SKU bahan baku sudah digunakan");
  await audit(tx, actor, "material_created", "materials", r.idMaterials, { sku: r.sku }); return r;
}
export async function updateMaterial(tx: Tx, actor: Actor, id: string, input: Partial<MaterialInput>) {
  const [r] = await uniqueGuard(() => tx.update(S.materials).set(input).where(eq(S.materials.idMaterials, id)).returning(), "SKU bahan baku sudah digunakan");
  if (!r) fail("Bahan baku tidak ditemukan", { statusCode: 404 });
  await audit(tx, actor, "material_updated", "materials", id, input as Record<string, unknown>); return r;
}

export async function listProducts(db: Exec) {
  const prods = await db.select({ ...getTableColumns(S.products), categoryName: S.categories.categoryName }).from(S.products).innerJoin(S.categories, eq(S.categories.idCategories, S.products.idCategories)).orderBy(asc(S.products.productName));
  const rec = await db.select({ idRecipes: S.recipes.idRecipes, idProducts: S.recipes.idProducts, idMaterials: S.recipes.idMaterials, qtyUsed: S.recipes.qtyUsed, materialName: S.materials.materialName, unitName: S.units.unitName })
    .from(S.recipes).innerJoin(S.materials, eq(S.materials.idMaterials, S.recipes.idMaterials)).innerJoin(S.units, eq(S.units.idUnits, S.materials.idUnits));
  return prods.map((p) => ({ ...p, recipe: rec.filter((r) => r.idProducts === p.idProducts) }));
}
export type ProductInput = { idCategories: string; sku: string; productName: string; price: number; isActive?: boolean };
export async function createProduct(tx: Tx, actor: Actor, input: ProductInput) {
  const [r] = await uniqueGuard(() => tx.insert(S.products).values({ ...input, sku: input.sku.trim() }).returning(), "SKU produk sudah digunakan");
  await audit(tx, actor, "product_created", "products", r.idProducts, { sku: r.sku }); return r;
}
export async function updateProduct(tx: Tx, actor: Actor, id: string, input: Partial<ProductInput>) {
  const [r] = await uniqueGuard(() => tx.update(S.products).set(input).where(eq(S.products.idProducts, id)).returning(), "SKU produk sudah digunakan");
  if (!r) fail("Produk tidak ditemukan", { statusCode: 404 });
  await audit(tx, actor, "product_updated", "products", id, input as Record<string, unknown>); return r;
}
/** Resep produk: relasi M:N produk–bahan baku melalui tabel recipes (ganti seluruh resep). */
export async function setRecipe(tx: Tx, actor: Actor, idProducts: string, items: { idMaterials: string; qtyUsed: number }[]) {
  if (new Set(items.map((i) => i.idMaterials)).size !== items.length) fail("Bahan baku duplikat pada resep", { statusCode: 400 });
  await tx.delete(S.recipes).where(eq(S.recipes.idProducts, idProducts));
  if (items.length) await tx.insert(S.recipes).values(items.map((i) => ({ idProducts, idMaterials: i.idMaterials, qtyUsed: i.qtyUsed })));
  await audit(tx, actor, "recipe_set", "recipes", idProducts, { items: items.length });
  return { idProducts, items: items.length };
}

export async function listSuppliers(db: Exec) {
  const sups = await db.select().from(S.suppliers).orderBy(asc(S.suppliers.supplierName));
  const perf = await supplierPerformance(db);
  const sm = await db.select({ idSuppliers: S.supplierMaterials.idSuppliers, idMaterials: S.supplierMaterials.idMaterials }).from(S.supplierMaterials);
  return sups.map((s) => ({ ...s, performance: perf.find((p) => p.idSuppliers === s.idSuppliers), materialIds: sm.filter((m) => m.idSuppliers === s.idSuppliers).map((m) => m.idMaterials) }));
}
export type SupplierInput = { supplierName: string; contactName?: string; phone?: string; email?: string; address?: string; isActive?: boolean };
export async function createSupplier(tx: Tx, actor: Actor, input: SupplierInput) {
  const [r] = await uniqueGuard(() => tx.insert(S.suppliers).values({ ...input, supplierName: input.supplierName.trim() }).returning(), "Nama supplier sudah ada");
  await audit(tx, actor, "supplier_created", "suppliers", r.idSuppliers, { name: r.supplierName }); return r;
}
export async function updateSupplier(tx: Tx, actor: Actor, id: string, input: Partial<SupplierInput>) {
  const [r] = await uniqueGuard(() => tx.update(S.suppliers).set(input).where(eq(S.suppliers.idSuppliers, id)).returning(), "Nama supplier sudah ada");
  if (!r) fail("Supplier tidak ditemukan", { statusCode: 404 });
  await audit(tx, actor, "supplier_updated", "suppliers", id, input as Record<string, unknown>); return r;
}
export async function setSupplierMaterials(tx: Tx, actor: Actor, idSuppliers: string, materialIds: string[]) {
  await tx.delete(S.supplierMaterials).where(eq(S.supplierMaterials.idSuppliers, idSuppliers));
  if (materialIds.length) await tx.insert(S.supplierMaterials).values([...new Set(materialIds)].map((m) => ({ idSuppliers, idMaterials: m })));
  await audit(tx, actor, "supplier_materials_set", "supplier_materials", idSuppliers, { count: materialIds.length });
  return { idSuppliers, count: materialIds.length };
}

// ───────── Pengguna ─────────
export async function listUsers(db: Exec) {
  return db.select({ idUsers: S.users.idUsers, fullName: S.users.fullName, email: S.users.email, isActive: S.users.isActive, roleCode: S.roles.roleCode, roleName: S.roles.roleName, createdAt: S.users.createdAt })
    .from(S.users).innerJoin(S.roles, eq(S.roles.idRoles, S.users.idRoles)).orderBy(asc(S.users.fullName));
}
export async function upsertUserProfile(tx: Tx, actor: Actor | null, input: { idUsers: string; email: string; fullName: string; roleCode: string }) {
  const [role] = await tx.select().from(S.roles).where(eq(S.roles.roleCode, input.roleCode));
  if (!role) fail("Peran tidak valid", { statusCode: 400 });
  const [r] = await tx.insert(S.users).values({ idUsers: input.idUsers, idRoles: role.idRoles, fullName: input.fullName, email: input.email.toLowerCase() })
    .onConflictDoUpdate({ target: S.users.idUsers, set: { idRoles: role.idRoles, fullName: input.fullName, email: input.email.toLowerCase() } }).returning();
  await audit(tx, actor, "user_profile_saved", "users", r.idUsers, { role: input.roleCode }); return r;
}
export async function updateUserAccess(tx: Tx, actor: Actor, idUsers: string, patch: { roleCode?: string; isActive?: boolean }) {
  const [u] = await tx.select().from(S.users).where(eq(S.users.idUsers, idUsers));
  if (!u) fail("Pengguna tidak ditemukan", { statusCode: 404 });
  if (idUsers === actor.idUsers && (patch.isActive === false || (patch.roleCode && patch.roleCode !== actor.roleCode))) fail("Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri", { statusCode: 400 });
  const set: Record<string, unknown> = {};
  if (patch.roleCode) { const [role] = await tx.select().from(S.roles).where(eq(S.roles.roleCode, patch.roleCode)); if (!role) fail("Peran tidak valid", { statusCode: 400 }); set.idRoles = role.idRoles; }
  if (patch.isActive !== undefined) set.isActive = patch.isActive;
  await tx.update(S.users).set(set).where(eq(S.users.idUsers, idUsers));
  await audit(tx, actor, "user_access_changed", "users", idUsers, patch as Record<string, unknown>);
  return { idUsers };
}

export async function listAuditLogs(db: Exec, limit = 200) {
  return db.select({ ...getTableColumns(S.auditLogs), actorName: S.users.fullName }).from(S.auditLogs).leftJoin(S.users, eq(S.users.idUsers, S.auditLogs.idUsers)).orderBy(sql`${S.auditLogs.loggedAt} desc`).limit(limit);
}

export { inArray, num };
