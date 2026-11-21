import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Skema CTRL + Coffee SCM — mengikuti ERD BAB III skripsi.
 * Aturan: PK per tabel = id_<nama tabel> (UUID), uang NUMERIC(14,2), kuantitas NUMERIC(14,3),
 * waktu TIMESTAMPTZ, data turunan (saldo stok, total PO/invoice, status bayar) TIDAK disimpan.
 */
const pk = (name: string) => uuid(name).primaryKey().defaultRandom();
const fk = (name: string) => uuid(name);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const qty = (name: string) => numeric(name, { precision: 14, scale: 3, mode: "number" });

// ───────────── A. Pengguna dan keamanan ─────────────
export const roles = pgTable(
  "roles",
  {
    idRoles: pk("id_roles"),
    roleCode: text("role_code").notNull().unique(),
    roleName: text("role_name").notNull(),
  },
  (t) => [check("roles_code_chk", sql`${t.roleCode} in ('admin','purchasing','finance','owner')`)],
);

/** Profil aplikasi untuk auth.users Supabase (id_users = auth.users.id). */
export const users = pgTable(
  "users",
  {
    idUsers: uuid("id_users").primaryKey(),
    idRoles: fk("id_roles").notNull().references(() => roles.idRoles),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("users_role_idx").on(t.idRoles)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    idAuditLogs: pk("id_audit_logs"),
    idUsers: fk("id_users").references(() => users.idUsers),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_logged_idx").on(t.loggedAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

// ───────────── B. Master data ─────────────
export const categories = pgTable("categories", {
  idCategories: pk("id_categories"),
  categoryName: text("category_name").notNull().unique(),
});

export const units = pgTable("units", {
  idUnits: pk("id_units"),
  unitName: text("unit_name").notNull().unique(),
});

export const materials = pgTable(
  "materials",
  {
    idMaterials: pk("id_materials"),
    idCategories: fk("id_categories").notNull().references(() => categories.idCategories),
    idUnits: fk("id_units").notNull().references(() => units.idUnits),
    sku: text("sku").notNull().unique(),
    materialName: text("material_name").notNull(),
    minStock: qty("min_stock").notNull().default(0),
    safetyStock: qty("safety_stock").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [check("materials_stock_chk", sql`${t.minStock} >= 0 and ${t.safetyStock} >= 0`)],
);

export const products = pgTable(
  "products",
  {
    idProducts: pk("id_products"),
    idCategories: fk("id_categories").notNull().references(() => categories.idCategories),
    sku: text("sku").notNull().unique(),
    productName: text("product_name").notNull(),
    price: money("price").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [check("products_price_chk", sql`${t.price} >= 0`)],
);

export const recipes = pgTable(
  "recipes",
  {
    idRecipes: pk("id_recipes"),
    idProducts: fk("id_products").notNull().references(() => products.idProducts, { onDelete: "cascade" }),
    idMaterials: fk("id_materials").notNull().references(() => materials.idMaterials),
    qtyUsed: qty("qty_used").notNull(),
  },
  (t) => [unique("recipes_product_material_uq").on(t.idProducts, t.idMaterials), check("recipes_qty_chk", sql`${t.qtyUsed} > 0`)],
);

export const suppliers = pgTable("suppliers", {
  idSuppliers: pk("id_suppliers"),
  supplierName: text("supplier_name").notNull().unique(),
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const supplierMaterials = pgTable(
  "supplier_materials",
  {
    idSupplierMaterials: pk("id_supplier_materials"),
    idSuppliers: fk("id_suppliers").notNull().references(() => suppliers.idSuppliers, { onDelete: "cascade" }),
    idMaterials: fk("id_materials").notNull().references(() => materials.idMaterials, { onDelete: "cascade" }),
  },
  (t) => [unique("supplier_materials_uq").on(t.idSuppliers, t.idMaterials)],
);

// ───────────── C. Persediaan ─────────────
export const MOVEMENT_TYPES = ["opening_balance", "receipt", "usage", "damaged", "expired", "adjustment", "opname_adjustment"] as const;

export const stockOpnames = pgTable(
  "stock_opnames",
  {
    idStockOpnames: pk("id_stock_opnames"),
    opnameNumber: text("opname_number").notNull().unique(),
    opnameDate: date("opname_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("draft"),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    note: text("note").notNull().default(""),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check("stock_opnames_status_chk", sql`${t.status} in ('draft','finalized')`)],
);

export const stockOpnameItems = pgTable(
  "stock_opname_items",
  {
    idStockOpnameItems: pk("id_stock_opname_items"),
    idStockOpnames: fk("id_stock_opnames").notNull().references(() => stockOpnames.idStockOpnames, { onDelete: "cascade" }),
    idMaterials: fk("id_materials").notNull().references(() => materials.idMaterials),
    countedQty: qty("counted_qty").notNull(),
  },
  (t) => [unique("stock_opname_items_uq").on(t.idStockOpnames, t.idMaterials), check("stock_opname_items_qty_chk", sql`${t.countedQty} >= 0`)],
);


export const stockMovements = pgTable(
  "stock_movements",
  {
    idStockMovements: pk("id_stock_movements"),
    idMaterials: fk("id_materials").notNull().references(() => materials.idMaterials),
    movementType: text("movement_type").notNull(),
    qtyDelta: qty("qty_delta").notNull(),
    movedAt: timestamp("moved_at", { withTimezone: true }).notNull().defaultNow(),
    idUsers: fk("id_users").references(() => users.idUsers),
    idGrItems: fk("id_gr_items").unique(),
    idStockOpnames: fk("id_stock_opnames").references(() => stockOpnames.idStockOpnames),
    note: text("note").notNull().default(""),
  },
  (t) => [
    check(
      "stock_movements_type_chk",
      sql`${t.qtyDelta} <> 0 and (
        (${t.movementType} in ('opening_balance','receipt') and ${t.qtyDelta} > 0) or
        (${t.movementType} in ('usage','damaged','expired') and ${t.qtyDelta} < 0) or
        ${t.movementType} in ('adjustment','opname_adjustment'))`,
    ),
    index("stock_movements_material_idx").on(t.idMaterials, t.movedAt),
  ],
);

// ───────────── D. Pengadaan ─────────────
export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    idPurchaseRequests: pk("id_purchase_requests"),
    prNumber: text("pr_number").notNull().unique(),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    neededBy: date("needed_by", { mode: "string" }).notNull(),
    status: text("status").notNull().default("submitted"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("purchase_requests_status_chk", sql`${t.status} in ('submitted','approved','rejected','ordered','cancelled')`),
    index("purchase_requests_status_idx").on(t.status),
  ],
);

export const prItems = pgTable(
  "pr_items",
  {
    idPrItems: pk("id_pr_items"),
    idPurchaseRequests: fk("id_purchase_requests").notNull().references(() => purchaseRequests.idPurchaseRequests, { onDelete: "cascade" }),
    idMaterials: fk("id_materials").notNull().references(() => materials.idMaterials),
    qty: qty("qty").notNull(),
  },
  (t) => [unique("pr_items_uq").on(t.idPurchaseRequests, t.idMaterials), check("pr_items_qty_chk", sql`${t.qty} > 0`)],
);

export const supplierQuotations = pgTable(
  "supplier_quotations",
  {
    idSupplierQuotations: pk("id_supplier_quotations"),
    idPurchaseRequests: fk("id_purchase_requests").notNull().references(() => purchaseRequests.idPurchaseRequests, { onDelete: "cascade" }),
    idSuppliers: fk("id_suppliers").notNull().references(() => suppliers.idSuppliers),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    quotationDate: date("quotation_date", { mode: "string" }).notNull(),
    validUntil: date("valid_until", { mode: "string" }).notNull(),
    leadTimeDays: integer("lead_time_days").notNull(),
    paymentTermDays: integer("payment_term_days").notNull().default(0),
    isSelected: boolean("is_selected").notNull().default(false),
    selectionReason: text("selection_reason").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    unique("supplier_quotations_pr_supplier_uq").on(t.idPurchaseRequests, t.idSuppliers),
    uniqueIndex("supplier_quotations_one_selected_uq").on(t.idPurchaseRequests).where(sql`${t.isSelected}`),
    check("supplier_quotations_days_chk", sql`${t.leadTimeDays} >= 0 and ${t.paymentTermDays} >= 0 and ${t.validUntil} >= ${t.quotationDate}`),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    idQuotationItems: pk("id_quotation_items"),
    idSupplierQuotations: fk("id_supplier_quotations").notNull().references(() => supplierQuotations.idSupplierQuotations, { onDelete: "cascade" }),
    idMaterials: fk("id_materials").notNull().references(() => materials.idMaterials),
    unitPrice: money("unit_price").notNull(),
    minOrderQty: qty("min_order_qty").notNull().default(0),
  },
  (t) => [unique("quotation_items_uq").on(t.idSupplierQuotations, t.idMaterials), check("quotation_items_price_chk", sql`${t.unitPrice} >= 0 and ${t.minOrderQty} >= 0`)],
);

export const SCORING_CRITERIA = ["price", "performance", "lead_time", "payment_term"] as const;

export const scoringParameters = pgTable(
  "scoring_parameters",
  {
    idScoringParameters: pk("id_scoring_parameters"),
    criterion: text("criterion").notNull().unique(),
    weight: numeric("weight", { precision: 5, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [
    check("scoring_parameters_criterion_chk", sql`${t.criterion} in ('price','performance','lead_time','payment_term')`),
    check("scoring_parameters_weight_chk", sql`${t.weight} between 0 and 100`),
  ],
);

export const scoringParameterHistory = pgTable("scoring_parameter_history", {
  idScoringParameterHistory: pk("id_scoring_parameter_history"),
  criterion: text("criterion").notNull(),
  oldWeight: numeric("old_weight", { precision: 5, scale: 2, mode: "number" }),
  newWeight: numeric("new_weight", { precision: 5, scale: 2, mode: "number" }).notNull(),
  idUsers: fk("id_users").notNull().references(() => users.idUsers),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  idAppSettings: pk("id_app_settings"),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  idUsers: fk("id_users").references(() => users.idUsers),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    idPurchaseOrders: pk("id_purchase_orders"),
    poNumber: text("po_number").notNull().unique(),
    idSupplierQuotations: fk("id_supplier_quotations").notNull().unique().references(() => supplierQuotations.idSupplierQuotations),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    status: text("status").notNull().default("sent"),
    orderDate: date("order_date", { mode: "string" }).notNull(),
    expectedDate: date("expected_date", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("purchase_orders_status_chk", sql`${t.status} in ('sent','partial','received','cancelled')`),
    check("purchase_orders_date_chk", sql`${t.expectedDate} >= ${t.orderDate}`),
  ],
);

export const poItems = pgTable(
  "po_items",
  {
    idPoItems: pk("id_po_items"),
    idPurchaseOrders: fk("id_purchase_orders").notNull().references(() => purchaseOrders.idPurchaseOrders, { onDelete: "cascade" }),
    idQuotationItems: fk("id_quotation_items").notNull().references(() => quotationItems.idQuotationItems),
    qtyOrdered: qty("qty_ordered").notNull(),
  },
  (t) => [unique("po_items_uq").on(t.idPurchaseOrders, t.idQuotationItems), check("po_items_qty_chk", sql`${t.qtyOrdered} > 0`)],
);

// ───────────── E. Penerimaan dan keuangan ─────────────
export const goodsReceipts = pgTable("goods_receipts", {
  idGoodsReceipts: pk("id_goods_receipts"),
  grNumber: text("gr_number").notNull().unique(),
  idPurchaseOrders: fk("id_purchase_orders").notNull().references(() => purchaseOrders.idPurchaseOrders),
  idUsers: fk("id_users").notNull().references(() => users.idUsers),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note").notNull().default(""),
});

export const grItems = pgTable(
  "gr_items",
  {
    idGrItems: pk("id_gr_items"),
    idGoodsReceipts: fk("id_goods_receipts").notNull().references(() => goodsReceipts.idGoodsReceipts, { onDelete: "cascade" }),
    idPoItems: fk("id_po_items").notNull().references(() => poItems.idPoItems),
    qtyAccepted: qty("qty_accepted").notNull().default(0),
    qtyRejected: qty("qty_rejected").notNull().default(0),
  },
  (t) => [
    unique("gr_items_uq").on(t.idGoodsReceipts, t.idPoItems),
    check("gr_items_qty_chk", sql`${t.qtyAccepted} >= 0 and ${t.qtyRejected} >= 0 and (${t.qtyAccepted} + ${t.qtyRejected}) > 0`),
  ],
);

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    idSupplierInvoices: pk("id_supplier_invoices"),
    idPurchaseOrders: fk("id_purchase_orders").notNull().references(() => purchaseOrders.idPurchaseOrders),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("recorded"),
    verifiedBy: fk("verified_by").references(() => users.idUsers),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationNote: text("verification_note").notNull().default(""),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    createdAt: createdAt(),
  },
  (t) => [
    unique("supplier_invoices_po_number_uq").on(t.idPurchaseOrders, t.invoiceNumber),
    check("supplier_invoices_status_chk", sql`${t.status} in ('recorded','matched','held')`),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    idInvoiceItems: pk("id_invoice_items"),
    idSupplierInvoices: fk("id_supplier_invoices").notNull().references(() => supplierInvoices.idSupplierInvoices, { onDelete: "cascade" }),
    idPoItems: fk("id_po_items").notNull().references(() => poItems.idPoItems),
    qtyInvoiced: qty("qty_invoiced").notNull(),
    unitPrice: money("unit_price").notNull(),
  },
  (t) => [unique("invoice_items_uq").on(t.idSupplierInvoices, t.idPoItems), check("invoice_items_chk", sql`${t.qtyInvoiced} > 0 and ${t.unitPrice} >= 0`)],
);

export const payments = pgTable(
  "payments",
  {
    idPayments: pk("id_payments"),
    paymentNumber: text("payment_number").notNull().unique(),
    idSupplierInvoices: fk("id_supplier_invoices").notNull().references(() => supplierInvoices.idSupplierInvoices),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    amount: money("amount").notNull(),
    method: text("method").notNull().default("transfer"),
    status: text("status").notNull().default("pending_approval"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("payments_amount_chk", sql`${t.amount} > 0`),
    check("payments_method_chk", sql`${t.method} in ('transfer','cash','giro')`),
    check("payments_status_chk", sql`${t.status} in ('pending_approval','approved','paid','rejected')`),
    index("payments_invoice_idx").on(t.idSupplierInvoices),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    idApprovals: pk("id_approvals"),
    idPurchaseRequests: fk("id_purchase_requests").references(() => purchaseRequests.idPurchaseRequests, { onDelete: "cascade" }),
    idPayments: fk("id_payments").references(() => payments.idPayments, { onDelete: "cascade" }),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    decision: text("decision").notNull(),
    note: text("note").notNull().default(""),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("approvals_decision_chk", sql`${t.decision} in ('approved','rejected')`),
    check("approvals_target_chk", sql`(${t.idPurchaseRequests} is not null)::int + (${t.idPayments} is not null)::int = 1`),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    idBudgets: pk("id_budgets"),
    period: text("period").notNull().unique(),
    budgetAmount: money("budget_amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("budgets_chk", sql`${t.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and ${t.budgetAmount} >= 0`)],
);

export const expenses = pgTable(
  "expenses",
  {
    idExpenses: pk("id_expenses"),
    idBudgets: fk("id_budgets").references(() => budgets.idBudgets),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    amount: money("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("expenses_amount_chk", sql`${t.amount} > 0`), index("expenses_date_idx").on(t.expenseDate)],
);

// ───────────── F. Penjualan ─────────────
export const salesImportBatches = pgTable("sales_import_batches", {
  idSalesImportBatches: pk("id_sales_import_batches"),
  fileName: text("file_name").notNull(),
  fileHash: text("file_hash").notNull().unique(),
  rowCount: integer("row_count").notNull(),
  importedCount: integer("imported_count").notNull(),
  skippedCount: integer("skipped_count").notNull(),
  idUsers: fk("id_users").notNull().references(() => users.idUsers),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesTransactions = pgTable(
  "sales_transactions",
  {
    idSalesTransactions: pk("id_sales_transactions"),
    trxDate: timestamp("trx_date", { withTimezone: true }).notNull(),
    source: text("source").notNull(),
    externalRef: text("external_ref"),
    idSalesImportBatches: fk("id_sales_import_batches").references(() => salesImportBatches.idSalesImportBatches),
    idUsers: fk("id_users").notNull().references(() => users.idUsers),
    createdAt: createdAt(),
  },
  (t) => [
    check("sales_transactions_source_chk", sql`${t.source} in ('manual','csv_import')`),
    uniqueIndex("sales_transactions_external_uq").on(t.source, t.externalRef).where(sql`${t.externalRef} is not null`),
    index("sales_transactions_date_idx").on(t.trxDate),
  ],
);

export const salesItems = pgTable(
  "sales_items",
  {
    idSalesItems: pk("id_sales_items"),
    idSalesTransactions: fk("id_sales_transactions").notNull().references(() => salesTransactions.idSalesTransactions, { onDelete: "cascade" }),
    idProducts: fk("id_products").notNull().references(() => products.idProducts),
    qty: qty("qty").notNull(),
    unitPrice: money("unit_price").notNull(),
  },
  (t) => [check("sales_items_chk", sql`${t.qty} > 0 and ${t.unitPrice} >= 0`), index("sales_items_trx_idx").on(t.idSalesTransactions)],
);
