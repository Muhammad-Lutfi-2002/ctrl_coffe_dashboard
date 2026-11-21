/**
 * SEED KHUSUS DEVELOPMENT — bukan data CTRL + Coffee. Seluruh nama diawali "[DEV]".
 * Jangan dijalankan di produksi. Syarat: ALLOW_DEV_SEED=1 dan sudah ada minimal satu pengguna berperan admin.
 *   ALLOW_DEV_SEED=1 DATABASE_URL=... pnpm tsx scripts/seed-dev.ts
 */
import { eq } from "drizzle-orm";

import { getDb, schema } from "../server/db.js";

if (process.env.ALLOW_DEV_SEED !== "1" || process.env.NODE_ENV === "production") {
  console.error("Seed dibatalkan: set ALLOW_DEV_SEED=1 (dan bukan NODE_ENV=production).");
  process.exit(1);
}

const db = getDb();
const [admin] = await db.select({ id: schema.users.idUsers }).from(schema.users).innerJoin(schema.roles, eq(schema.roles.idRoles, schema.users.idRoles)).where(eq(schema.roles.roleCode, "admin")).limit(1);
if (!admin) { console.error("Belum ada pengguna Admin. Buat akun lebih dulu."); process.exit(1); }

await db.transaction(async (tx) => {
  const [cat] = await tx.insert(schema.categories).values({ categoryName: "[DEV] Bahan Kopi" }).onConflictDoNothing().returning();
  const [pcat] = await tx.insert(schema.categories).values({ categoryName: "[DEV] Minuman" }).onConflictDoNothing().returning();
  const [kg] = await tx.insert(schema.units).values({ unitName: "[DEV] kg" }).onConflictDoNothing().returning();
  if (!cat || !pcat || !kg) { console.log("Seed DEV sudah pernah dijalankan; dilewati."); return; }
  const [beans] = await tx.insert(schema.materials).values({ idCategories: cat.idCategories, idUnits: kg.idUnits, sku: "DEV-BJ", materialName: "[DEV] Biji Kopi", minStock: 5, safetyStock: 2 }).returning();
  const [latte] = await tx.insert(schema.products).values({ idCategories: pcat.idCategories, sku: "DEV-LATTE", productName: "[DEV] Latte", price: 30000 }).returning();
  await tx.insert(schema.recipes).values({ idProducts: latte.idProducts, idMaterials: beans.idMaterials, qtyUsed: 0.018 });
  await tx.insert(schema.suppliers).values([{ supplierName: "[DEV] Supplier A" }, { supplierName: "[DEV] Supplier B" }]);
  await tx.insert(schema.stockMovements).values({ idMaterials: beans.idMaterials, movementType: "opening_balance", qtyDelta: 20, idUsers: admin.id, note: "[DEV] saldo awal" });
  const [trx] = await tx.insert(schema.salesTransactions).values({ trxDate: new Date(), source: "manual", idUsers: admin.id }).returning();
  await tx.insert(schema.salesItems).values({ idSalesTransactions: trx.idSalesTransactions, idProducts: latte.idProducts, qty: 2, unitPrice: 30000 });
  console.log("Seed DEV selesai (data bertanda [DEV]).");
});
process.exit(0);
