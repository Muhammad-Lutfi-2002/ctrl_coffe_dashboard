import { useState } from "react";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, NumberInput, Tabs } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatIDR, formatNumber } from "@/lib/format";

export function meta() {
  return [{ title: "Data Induk - CTRL Coffee" }];
}

export default function MasterDataRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "admin";
  const [tab, setTab] = useState("materials");
  const materials = useList<any[]>("list-materials");
  const products = useList<any[]>("list-products");
  const cats = useList<any[]>("list-categories");
  const units = useList<any[]>("list-units");
  const [dlg, setDlg] = useState<null | "material" | "product" | "category" | "unit" | "recipe">(null);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [recipe, setRecipe] = useState<{ idMaterials: string; qtyUsed: string }[]>([]);
  const cm = useRun("create-material"), um = useRun("update-material"), cp = useRun("create-product"), up = useRun("update-product"), cc = useRun("create-category"), cu = useRun("create-unit"), sr = useRun("set-recipe");
  const pending = cm.pending || um.pending || cp.pending || up.pending || cc.pending || cu.pending || sr.pending;
  const error = cm.error || um.error || cp.error || up.error || cc.error || cu.error || sr.error;
  const close = () => { setDlg(null); setEdit(null); setF({}); setRecipe([]); [cm, um, cp, up, cc, cu, sr].forEach((r) => r.clearError()); };

  const submit = async () => {
    if (dlg === "category") await cc.run({ name: f.name });
    else if (dlg === "unit") await cu.run({ name: f.name });
    else if (dlg === "material") {
      const body = { idCategories: f.idCategories, idUnits: f.idUnits, sku: f.sku, materialName: f.name, minStock: Number(f.minStock || 0), safetyStock: Number(f.safetyStock || 0) };
      edit ? await um.run({ idMaterials: edit.idMaterials, ...body }) : await cm.run(body);
    } else if (dlg === "product") {
      const body = { idCategories: f.idCategories, sku: f.sku, productName: f.name, price: Number(f.price || 0) };
      edit ? await up.run({ idProducts: edit.idProducts, ...body }) : await cp.run(body);
    } else if (dlg === "recipe") await sr.run({ idProducts: edit.idProducts, items: recipe.filter((r) => r.idMaterials && Number(r.qtyUsed) > 0).map((r) => ({ idMaterials: r.idMaterials, qtyUsed: Number(r.qtyUsed) })) });
    close();
  };
  const add = (kind: "material" | "product" | "category" | "unit") => { setF({ idCategories: cats.data?.[0]?.idCategories ?? "", idUnits: units.data?.[0]?.idUnits ?? "" }); setDlg(kind); };

  return (
    <PageBody>
      <PageHeader title="Data Induk" description="Bahan baku dipisahkan dari produk menu; resep menghubungkan keduanya (relasi M:N). Perubahan hanya oleh Admin."
        actions={canWrite ? <>
          <Button variant="outline" onClick={() => add("category")}>Kategori</Button><Button variant="outline" onClick={() => add("unit")}>Satuan</Button>
          <Button onClick={() => add(tab === "products" ? "product" : "material")}>{tab === "products" ? "Tambah produk" : "Tambah bahan baku"}</Button></> : undefined} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "materials", label: "Bahan baku" }, { id: "products", label: "Produk dan resep" }, { id: "lookups", label: "Kategori dan satuan" }]} />

      {tab === "materials" ? ((materials.data ?? []).length === 0 ? <Empty>Belum ada bahan baku.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Nama</TableHead><TableHead>Kategori</TableHead><TableHead>Satuan</TableHead><TableHead className="text-right">Minimum</TableHead><TableHead className="text-right">Pengaman</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{(materials.data ?? []).map((m) => (
            <TableRow key={m.idMaterials}><TableCell className="text-muted-foreground">{m.sku}</TableCell><TableCell className="font-medium">{m.materialName}</TableCell><TableCell>{m.categoryName}</TableCell><TableCell>{m.unitName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.minStock)}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.safetyStock)}</TableCell><TableCell><StatusBadge status={m.isActive ? "active" : "inactive"} /></TableCell>
              <TableCell className="text-right">{canWrite ? <Button size="sm" variant="ghost" onClick={() => { setEdit(m); setF({ idCategories: m.idCategories, idUnits: m.idUnits, sku: m.sku, name: m.materialName, minStock: String(m.minStock), safetyStock: String(m.safetyStock) }); setDlg("material"); }}>Ubah</Button> : null}</TableCell></TableRow>
          ))}</TableBody>
        </Table></TableShell>)) : null}

      {tab === "products" ? ((products.data ?? []).length === 0 ? <Empty>Belum ada produk menu.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Produk</TableHead><TableHead>Kategori</TableHead><TableHead className="text-right">Harga</TableHead><TableHead>Resep</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{(products.data ?? []).map((p) => (
            <TableRow key={p.idProducts}><TableCell className="text-muted-foreground">{p.sku}</TableCell><TableCell className="font-medium">{p.productName}</TableCell><TableCell>{p.categoryName}</TableCell><TableCell className="text-right tabular-nums">{formatIDR(p.price)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.recipe.length === 0 ? "Belum ada" : p.recipe.map((r: any) => `${r.materialName} ${formatNumber(r.qtyUsed)} ${r.unitName}`).join(", ")}</TableCell>
              <TableCell className="text-right">{canWrite ? <><Button size="sm" variant="ghost" onClick={() => { setEdit(p); setF({ idCategories: p.idCategories, sku: p.sku, name: p.productName, price: String(p.price) }); setDlg("product"); }}>Ubah</Button><Button size="sm" variant="ghost" onClick={() => { setEdit(p); setRecipe(p.recipe.map((r: any) => ({ idMaterials: r.idMaterials, qtyUsed: String(r.qtyUsed) }))); setDlg("recipe"); }}>Resep</Button></> : null}</TableCell></TableRow>
          ))}</TableBody>
        </Table></TableShell>)) : null}

      {tab === "lookups" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <TableShell><Table><TableHeader><TableRow><TableHead>Kategori</TableHead></TableRow></TableHeader><TableBody>{(cats.data ?? []).map((c) => <TableRow key={c.idCategories}><TableCell>{c.categoryName}</TableCell></TableRow>)}</TableBody></Table></TableShell>
          <TableShell><Table><TableHeader><TableRow><TableHead>Satuan</TableHead></TableRow></TableHeader><TableBody>{(units.data ?? []).map((u) => <TableRow key={u.idUnits}><TableCell>{u.unitName}</TableCell></TableRow>)}</TableBody></Table></TableShell>
        </div>
      ) : null}

      <FormDialog open={dlg !== null} onOpenChange={(o) => !o && close()} pending={pending} error={error} onSubmit={submit}
        title={{ material: edit ? "Ubah bahan baku" : "Tambah bahan baku", product: edit ? "Ubah produk" : "Tambah produk", category: "Tambah kategori", unit: "Tambah satuan", recipe: `Resep: ${edit?.productName ?? ""}` }[dlg ?? "category"]}>
        {dlg === "category" || dlg === "unit" ? <Field id="m-name" label="Nama"><Input id="m-name" required value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field> : null}
        {dlg === "material" || dlg === "product" ? (<>
          <Field id="m-sku" label="SKU"><Input id="m-sku" required value={f.sku ?? ""} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field id="m-name" label="Nama"><Input id="m-name" required value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field id="m-cat" label="Kategori"><select id="m-cat" required className={nativeSelectClass} value={f.idCategories ?? ""} onChange={(e) => setF({ ...f, idCategories: e.target.value })}>{(cats.data ?? []).map((c) => <option key={c.idCategories} value={c.idCategories}>{c.categoryName}</option>)}</select></Field>
        </>) : null}
        {dlg === "material" ? (<>
          <Field id="m-unit" label="Satuan"><select id="m-unit" required className={nativeSelectClass} value={f.idUnits ?? ""} onChange={(e) => setF({ ...f, idUnits: e.target.value })}>{(units.data ?? []).map((u) => <option key={u.idUnits} value={u.idUnits}>{u.unitName}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field id="m-min" label="Stok minimum"><NumberInput id="m-min" value={f.minStock ?? ""} onChange={(v) => setF({ ...f, minStock: v })} /></Field><Field id="m-ss" label="Stok pengaman"><NumberInput id="m-ss" value={f.safetyStock ?? ""} onChange={(v) => setF({ ...f, safetyStock: v })} /></Field></div>
        </>) : null}
        {dlg === "product" ? <Field id="m-price" label="Harga jual (Rp)"><NumberInput id="m-price" required value={f.price ?? ""} onChange={(v) => setF({ ...f, price: v })} /></Field> : null}
        {dlg === "recipe" ? (<div className="flex flex-col gap-2">
          {recipe.map((r, i) => (<div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2">
            <select aria-label="Bahan baku" className={nativeSelectClass} value={r.idMaterials} onChange={(e) => setRecipe(recipe.map((x, j) => (j === i ? { ...x, idMaterials: e.target.value } : x)))}><option value="">Pilih bahan…</option>{(materials.data ?? []).map((m) => <option key={m.idMaterials} value={m.idMaterials}>{m.materialName} ({m.unitName})</option>)}</select>
            <NumberInput id={`rq-${i}`} aria-label="Jumlah per porsi" value={r.qtyUsed} onChange={(v) => setRecipe(recipe.map((x, j) => (j === i ? { ...x, qtyUsed: v } : x)))} />
            <Button type="button" variant="ghost" onClick={() => setRecipe(recipe.filter((_, j) => j !== i))}>Hapus</Button></div>))}
          <Button type="button" variant="outline" onClick={() => setRecipe([...recipe, { idMaterials: "", qtyUsed: "" }])}>Tambah bahan</Button></div>) : null}
      </FormDialog>
    </PageBody>
  );
}
