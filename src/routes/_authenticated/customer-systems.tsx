import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getCatalogData } from "@/lib/phase1.functions";
import { getPhase2References, listCustomerSystems, listSystemAssets, listTickets, saveCustomerSystemWithAssets } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/customer-systems")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: CustomerSystemsPage,
});

type DraftAsset = {
  product_id: string;
  quantity: number;
  serial_number: string;
  warranty_status: "valid" | "expired" | "unknown";
  notes: string;
};

function CustomerSystemsPage() {
  const queryClient = useQueryClient();
  const refsFn = useServerFn(getPhase2References);
  const catalogFn = useServerFn(getCatalogData);
  const systemsFn = useServerFn(listCustomerSystems);
  const assetsFn = useServerFn(listSystemAssets);
  const ticketsFn = useServerFn(listTickets);
  const saveSystemWithAssetsFn = useServerFn(saveCustomerSystemWithAssets);

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["customer_systems.manage"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: catalog } = useQuery({ queryKey: ["catalog-ref"], queryFn: () => catalogFn() });
  const { data: systems = [] } = useQuery({ queryKey: ["customer-systems"], queryFn: () => systemsFn() });
  const { data: assets = [] } = useQuery({ queryKey: ["system-assets"], queryFn: () => assetsFn() });
  const { data: tickets = [] } = useQuery({ queryKey: ["system-tickets"], queryFn: () => ticketsFn() });

  const [search, setSearch] = useState("");
  const [systemOpen, setSystemOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string>("");
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);

  const [systemForm, setSystemForm] = useState({
    id: "",
    customer_id: "",
    system_name: "",
    installation_date: "",
    status: "active",
    notes: "",
  });

  const [assetBuilder, setAssetBuilder] = useState({
    category_id: "",
    brand_id: "",
    product_id: "",
    quantity: 1,
    serial_number: "",
    warranty_status: "unknown",
    notes: "",
  });
  const [pendingAssets, setPendingAssets] = useState<DraftAsset[]>([]);

  const filteredSystems = useMemo(() => {
    const q = search.toLowerCase();
    return systems.filter((s) => {
      const customerName = refs?.customers.find((c) => c.id === s.customer_id)?.name ?? "";
      return `${s.system_name} ${customerName}`.toLowerCase().includes(q);
    });
  }, [systems, refs?.customers, search]);

  const selectedSystem = systems.find((item) => item.id === selectedSystemId) ?? filteredSystems[0] ?? null;
  const selectedAssets = assets.filter((item) => item.customer_system_id === selectedSystem?.id);
  const selectedTickets = tickets.filter((item) => item.customer_system_id === selectedSystem?.id);
  const openTicketsCount = selectedTickets.filter((item) => item.status !== "closed" && item.status !== "resolved_remote").length;

  const brandOptions = (catalog?.brands ?? []).filter((item) => !assetBuilder.category_id || item.category_id === assetBuilder.category_id);
  const modelOptions = (catalog?.products ?? []).filter((item) => (!assetBuilder.category_id || item.category_id === assetBuilder.category_id) && (!assetBuilder.brand_id || item.brand_id === assetBuilder.brand_id));

  const resetForm = () => {
    setSystemForm({ id: "", customer_id: "", system_name: "", installation_date: "", status: "active", notes: "" });
    setAssetBuilder({ category_id: "", brand_id: "", product_id: "", quantity: 1, serial_number: "", warranty_status: "unknown", notes: "" });
    setPendingAssets([]);
    setEditingAssetIndex(null);
  };

  const addOrUpdateDraftAsset = () => {
    if (!assetBuilder.product_id) {
      toast.error("اختر موديلًا قبل الإضافة");
      return;
    }
    if (assetBuilder.quantity < 1 || assetBuilder.quantity > 999) {
      toast.error("الكمية يجب أن تكون بين 1 و 999");
      return;
    }

    const row: DraftAsset = {
      product_id: assetBuilder.product_id,
      quantity: assetBuilder.quantity,
      serial_number: assetBuilder.serial_number.trim(),
      warranty_status: assetBuilder.warranty_status as "valid" | "expired" | "unknown",
      notes: assetBuilder.notes.trim(),
    };

    if (editingAssetIndex != null) {
      setPendingAssets((prev) => prev.map((item, idx) => (idx === editingAssetIndex ? row : item)));
      setEditingAssetIndex(null);
    } else {
      setPendingAssets((prev) => [...prev, row]);
    }

    setAssetBuilder({ category_id: "", brand_id: "", product_id: "", quantity: 1, serial_number: "", warranty_status: "unknown", notes: "" });
  };

  const submitSystem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!systemForm.customer_id) {
      toast.error("يرجى اختيار العميل");
      return;
    }
    if (systemForm.system_name.trim().length < 2) {
      toast.error("اسم النظام قصير جدًا");
      return;
    }

    try {
      await saveSystemWithAssetsFn({
        data: {
          system: {
            id: systemForm.id || undefined,
            customer_id: systemForm.customer_id,
            system_name: systemForm.system_name,
            installation_date: systemForm.installation_date || null,
            status: systemForm.status as "active" | "inactive",
            notes: systemForm.notes || null,
          },
          assets: pendingAssets.map((asset) => ({
            product_id: asset.product_id,
            quantity: asset.quantity,
            serial_number: asset.serial_number || null,
            warranty_status: asset.warranty_status,
            notes: asset.notes || null,
          })),
        },
      });

      toast.success("تم حفظ النظام والمكونات بنجاح");
      setSystemOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["customer-systems"] });
      queryClient.invalidateQueries({ queryKey: ["system-assets"] });
      queryClient.invalidateQueries({ queryKey: ["system-tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ النظام");
    }
  };

  return (
    <AppShell roles={roles} title="أنظمة العملاء ومكوناتها">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">أنظمة العملاء</CardTitle>
            {canManage && <Button onClick={() => { resetForm(); setSystemOpen(true); }}>إضافة نظام جديد</Button>}
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="بحث باسم النظام أو العميل" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-sm" />
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النظام</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>مكونات</TableHead>
                    <TableHead>تذاكر مفتوحة</TableHead>
                    <TableHead>تاريخ التركيب</TableHead>
                    {canManage && <TableHead className="text-left">إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSystems.map((item) => {
                    const customerName = refs?.customers.find((c) => c.id === item.customer_id)?.name ?? "—";
                    const assetCount = assets.filter((a) => a.customer_system_id === item.id).length;
                    const systemOpenTickets = tickets.filter((t) => t.customer_system_id === item.id && t.status !== "closed" && t.status !== "resolved_remote").length;

                    return (
                      <TableRow key={item.id} onClick={() => setSelectedSystemId(item.id)} className="cursor-pointer">
                        <TableCell className="font-medium">{item.system_name}</TableCell>
                        <TableCell>
                          <Link to="/_authenticated/customers/$customerId" params={{ customerId: item.customer_id }} className="hover:underline">
                            {customerName}
                          </Link>
                        </TableCell>
                        <TableCell>{item.status === "active" ? <Badge>نشط</Badge> : <Badge variant="secondary">غير نشط</Badge>}</TableCell>
                        <TableCell>{assetCount}</TableCell>
                        <TableCell>{systemOpenTickets}</TableCell>
                        <TableCell>{item.installation_date ?? "—"}</TableCell>
                        {canManage && (
                          <TableCell className="text-left">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSystemForm({
                                  id: item.id,
                                  customer_id: item.customer_id,
                                  system_name: item.system_name,
                                  installation_date: item.installation_date ?? "",
                                  status: item.status,
                                  notes: item.notes ?? "",
                                });

                                const existingRows = assets
                                  .filter((asset) => asset.customer_system_id === item.id)
                                  .map((asset) => ({
                                    product_id: asset.product_id,
                                    quantity: asset.quantity,
                                    serial_number: asset.serial_number ?? "",
                                    warranty_status: asset.warranty_status,
                                    notes: asset.notes ?? "",
                                  }));
                                setPendingAssets(existingRows);
                                setSystemOpen(true);
                              }}
                            >
                              تعديل
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ملخص النظام المحدد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedSystem ? (
              <p className="text-sm text-muted-foreground">اختر نظامًا من الجدول.</p>
            ) : (
              <>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{selectedSystem.system_name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selectedSystem.status === "active" ? <Badge>نشط</Badge> : <Badge variant="secondary">غير نشط</Badge>}
                    <Badge variant="outline">{selectedAssets.length} مكون</Badge>
                    <Badge variant={openTicketsCount > 0 ? "secondary" : "outline"}>{openTicketsCount} تذكرة مفتوحة</Badge>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b p-3 text-sm font-medium">المكونات المركبة</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الموديل</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>الرقم التسلسلي</TableHead>
                        <TableHead>الضمان</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedAssets.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell>{catalog?.products.find((p) => p.id === asset.product_id)?.model ?? "—"}</TableCell>
                          <TableCell>{asset.quantity}</TableCell>
                          <TableCell>{asset.serial_number ?? "—"}</TableCell>
                          <TableCell>{asset.warranty_status === "valid" ? "ساري" : asset.warranty_status === "expired" ? "منتهي" : "غير معروف"}</TableCell>
                        </TableRow>
                      ))}
                      {selectedAssets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-5 text-center text-muted-foreground">لا توجد مكونات.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={systemOpen} onOpenChange={setSystemOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{systemForm.id ? "تعديل نظام" : "إنشاء نظام عميل"}</DialogTitle>
            <DialogDescription>نموذج عملي سريع لإنشاء النظام وبناء مكوناته قبل الحفظ النهائي.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submitSystem}>
            <div className="space-y-2">
              <Label>العميل *</Label>
              <Select value={systemForm.customer_id} onValueChange={(value) => setSystemForm((p) => ({ ...p, customer_id: value }))}>
                <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                <SelectContent>
                  {(refs?.customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>اسم النظام *</Label>
                <Input value={systemForm.system_name} onChange={(e) => setSystemForm((p) => ({ ...p, system_name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>تاريخ التركيب</Label>
                <Input type="date" value={systemForm.installation_date} onChange={(e) => setSystemForm((p) => ({ ...p, installation_date: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={systemForm.status} onValueChange={(value) => setSystemForm((p) => ({ ...p, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={systemForm.notes} onChange={(e) => setSystemForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            {canManage && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">باني مكونات النظام</p>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select value={assetBuilder.category_id || "none"} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, category_id: value === "none" ? "" : value, brand_id: "", product_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر الفئة</SelectItem>
                      {(catalog?.categories ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name_ar}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={assetBuilder.brand_id || "none"} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, brand_id: value === "none" ? "" : value, product_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="تصفية العلامة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر العلامة</SelectItem>
                      {brandOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={assetBuilder.product_id || "none"} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, product_id: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="اختر الموديل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر الموديل</SelectItem>
                      {modelOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.model}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <Input type="number" min={1} max={999} value={String(assetBuilder.quantity)} onChange={(e) => setAssetBuilder((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))} placeholder="الكمية" />
                  <Input value={assetBuilder.serial_number} onChange={(e) => setAssetBuilder((p) => ({ ...p, serial_number: e.target.value }))} placeholder="رقم تسلسلي" />
                  <Select value={assetBuilder.warranty_status} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, warranty_status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valid">ضمان ساري</SelectItem>
                      <SelectItem value="expired">ضمان منتهي</SelectItem>
                      <SelectItem value="unknown">غير معروف</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addOrUpdateDraftAsset}>{editingAssetIndex != null ? "تحديث الصف" : "إضافة صف"}</Button>
                </div>

                <Textarea placeholder="ملاحظة على المكون (اختياري)" value={assetBuilder.notes} onChange={(e) => setAssetBuilder((p) => ({ ...p, notes: e.target.value }))} />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموديل</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>الرقم التسلسلي</TableHead>
                      <TableHead>الضمان</TableHead>
                      <TableHead className="text-left">تحرير</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAssets.map((asset, index) => (
                      <TableRow key={`${asset.product_id}-${index}`}>
                        <TableCell>{catalog?.products.find((p) => p.id === asset.product_id)?.model ?? "—"}</TableCell>
                        <TableCell>{asset.quantity}</TableCell>
                        <TableCell>{asset.serial_number || "—"}</TableCell>
                        <TableCell>{asset.warranty_status === "valid" ? "ساري" : asset.warranty_status === "expired" ? "منتهي" : "غير معروف"}</TableCell>
                        <TableCell className="text-left">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const product = catalog?.products.find((p) => p.id === asset.product_id);
                                setAssetBuilder({
                                  category_id: product?.category_id ?? "",
                                  brand_id: product?.brand_id ?? "",
                                  product_id: asset.product_id,
                                  quantity: asset.quantity,
                                  serial_number: asset.serial_number,
                                  warranty_status: asset.warranty_status,
                                  notes: asset.notes,
                                });
                                setEditingAssetIndex(index);
                              }}
                            >
                              تعديل
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}>حذف</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingAssets.length === 0 && <TableRow><TableCell colSpan={5} className="py-4 text-center text-muted-foreground">لا توجد صفوف حتى الآن.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ نهائي</Button>
              <Button type="button" variant="outline" onClick={() => setSystemOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}