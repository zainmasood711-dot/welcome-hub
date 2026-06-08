import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
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
import {
  getPhase2References,
  listCustomerSystems,
  listSystemAssets,
  saveCustomerSystem,
  saveSystemAsset,
} from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/customer-systems")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: CustomerSystemsPage,
});

function CustomerSystemsPage() {
  const queryClient = useQueryClient();
  const refsFn = useServerFn(getPhase2References);
  const systemsFn = useServerFn(listCustomerSystems);
  const assetsFn = useServerFn(listSystemAssets);
  const saveSystemFn = useServerFn(saveCustomerSystem);
  const saveAssetFn = useServerFn(saveSystemAsset);

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["customer_systems.manage"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: systems = [] } = useQuery({ queryKey: ["customer-systems"], queryFn: () => systemsFn() });
  const { data: assets = [] } = useQuery({ queryKey: ["system-assets"], queryFn: () => assetsFn() });

  const [search, setSearch] = useState("");
  const [systemOpen, setSystemOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);

  const [systemForm, setSystemForm] = useState({
    id: "",
    customer_id: "",
    system_name: "",
    installation_date: "",
    status: "active",
    notes: "",
  });
  const [assetForm, setAssetForm] = useState({
    id: "",
    customer_system_id: "",
    product_id: "",
    quantity: 1,
    serial_number: "",
    warranty_status: "unknown",
    notes: "",
  });

  const filteredSystems = useMemo(() => {
    const q = search.toLowerCase();
    return systems.filter((s) => {
      const customerName = refs?.customers.find((c) => c.id === s.customer_id)?.name ?? "";
      return `${s.system_name} ${customerName}`.toLowerCase().includes(q);
    });
  }, [systems, refs?.customers, search]);

  const submitSystem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveSystemFn({
        data: {
          id: systemForm.id || undefined,
          customer_id: systemForm.customer_id,
          system_name: systemForm.system_name,
          installation_date: systemForm.installation_date || null,
          status: systemForm.status as "active" | "inactive",
          notes: systemForm.notes || null,
        },
      });
      toast.success("تم حفظ النظام");
      setSystemOpen(false);
      setSystemForm({ id: "", customer_id: "", system_name: "", installation_date: "", status: "active", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["customer-systems"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ النظام");
    }
  };

  const submitAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveAssetFn({
        data: {
          id: assetForm.id || undefined,
          customer_system_id: assetForm.customer_system_id,
          product_id: assetForm.product_id,
          quantity: Number(assetForm.quantity) || 1,
          serial_number: assetForm.serial_number || null,
          warranty_status: assetForm.warranty_status as "valid" | "expired" | "unknown",
          notes: assetForm.notes || null,
        },
      });
      toast.success("تم حفظ المكون");
      setAssetOpen(false);
      setAssetForm({ id: "", customer_system_id: "", product_id: "", quantity: 1, serial_number: "", warranty_status: "unknown", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["system-assets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المكون");
    }
  };

  return (
    <AppShell roles={roles} title="أنظمة العملاء ومكوناتها">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">أنظمة العملاء</CardTitle>
            {canManage && <Button onClick={() => setSystemOpen(true)}>إضافة نظام</Button>}
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
                    <TableHead>تاريخ التركيب</TableHead>
                    {canManage && <TableHead className="text-left">إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSystems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.system_name}</TableCell>
                      <TableCell>{refs?.customers.find((c) => c.id === item.customer_id)?.name ?? "—"}</TableCell>
                      <TableCell>{item.status === "active" ? "نشط" : "غير نشط"}</TableCell>
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
                              setSystemOpen(true);
                            }}
                          >
                            تعديل
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">مكونات الأنظمة</CardTitle>
            {canManage && <Button onClick={() => setAssetOpen(true)}>إضافة مكون</Button>}
          </CardHeader>
          <CardContent className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النظام</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الرقم التسلسلي</TableHead>
                  <TableHead>الضمان</TableHead>
                  {canManage && <TableHead className="text-left">إجراء</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>{systems.find((s) => s.id === asset.customer_system_id)?.system_name ?? "—"}</TableCell>
                    <TableCell>{refs?.products.find((p) => p.id === asset.product_id)?.model ?? "—"}</TableCell>
                    <TableCell>{asset.quantity}</TableCell>
                    <TableCell>{asset.serial_number ?? "—"}</TableCell>
                    <TableCell>{asset.warranty_status}</TableCell>
                    {canManage && (
                      <TableCell className="text-left">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAssetForm({
                              id: asset.id,
                              customer_system_id: asset.customer_system_id,
                              product_id: asset.product_id,
                              quantity: asset.quantity,
                              serial_number: asset.serial_number ?? "",
                              warranty_status: asset.warranty_status,
                              notes: asset.notes ?? "",
                            });
                            setAssetOpen(true);
                          }}
                        >
                          تعديل
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={systemOpen} onOpenChange={setSystemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{systemForm.id ? "تعديل نظام" : "إضافة نظام"}</DialogTitle>
            <DialogDescription>يجب ربط كل نظام بعميل موجود.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitSystem}>
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select value={systemForm.customer_id} onValueChange={(value) => setSystemForm((p) => ({ ...p, customer_id: value }))}>
                <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                <SelectContent>
                  {(refs?.customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>اسم النظام</Label><Input value={systemForm.system_name} onChange={(e) => setSystemForm((p) => ({ ...p, system_name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>تاريخ التركيب</Label><Input type="date" value={systemForm.installation_date} onChange={(e) => setSystemForm((p) => ({ ...p, installation_date: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={systemForm.status} onValueChange={(value) => setSystemForm((p) => ({ ...p, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="inactive">غير نشط</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={systemForm.notes} onChange={(e) => setSystemForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-start gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setSystemOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{assetForm.id ? "تعديل مكون" : "إضافة مكون"}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={submitAsset}>
            <div className="space-y-2">
              <Label>النظام</Label>
              <Select value={assetForm.customer_system_id} onValueChange={(value) => setAssetForm((p) => ({ ...p, customer_system_id: value }))}>
                <SelectTrigger><SelectValue placeholder="اختر نظام" /></SelectTrigger>
                <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المنتج</Label>
              <Select value={assetForm.product_id} onValueChange={(value) => setAssetForm((p) => ({ ...p, product_id: value }))}>
                <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                <SelectContent>{(refs?.products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>الكمية</Label><Input type="number" min={1} value={String(assetForm.quantity)} onChange={(e) => setAssetForm((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))} /></div>
            <div className="space-y-2"><Label>الرقم التسلسلي</Label><Input value={assetForm.serial_number} onChange={(e) => setAssetForm((p) => ({ ...p, serial_number: e.target.value }))} /></div>
            <div className="space-y-2"><Label>الضمان</Label><Select value={assetForm.warranty_status} onValueChange={(value) => setAssetForm((p) => ({ ...p, warranty_status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="valid">ساري</SelectItem><SelectItem value="expired">منتهي</SelectItem><SelectItem value="unknown">غير معروف</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={assetForm.notes} onChange={(e) => setAssetForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-start gap-2"><Button type="submit">حفظ</Button><Button type="button" variant="outline" onClick={() => setAssetOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}