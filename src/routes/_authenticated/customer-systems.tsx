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
import { getCatalogData } from "@/lib/phase1.functions";
import {
  getPhase2References,
  listAttachments,
  listCustomerSystems,
  listSystemAssets,
  listTickets,
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
  const catalogFn = useServerFn(getCatalogData);
  const systemsFn = useServerFn(listCustomerSystems);
  const assetsFn = useServerFn(listSystemAssets);
  const ticketsFn = useServerFn(listTickets);
  const attachmentsFn = useServerFn(listAttachments);
  const saveSystemFn = useServerFn(saveCustomerSystem);
  const saveAssetFn = useServerFn(saveSystemAsset);

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["customer_systems.manage"]);

  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });
  const { data: catalog } = useQuery({ queryKey: ["catalog-ref"], queryFn: () => catalogFn() });
  const { data: systems = [] } = useQuery({ queryKey: ["customer-systems"], queryFn: () => systemsFn() });
  const { data: assets = [] } = useQuery({ queryKey: ["system-assets"], queryFn: () => assetsFn() });
  const { data: tickets = [] } = useQuery({ queryKey: ["system-tickets"], queryFn: () => ticketsFn() });
  const { data: attachments = [] } = useQuery({ queryKey: ["system-attachments"], queryFn: () => attachmentsFn() });

  const [search, setSearch] = useState("");
  const [systemOpen, setSystemOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string>("");

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
  const [pendingAssets, setPendingAssets] = useState<Array<{ product_id: string; quantity: number; serial_number: string; warranty_status: "valid" | "expired" | "unknown"; notes: string }>>([]);

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
  const selectedAttachments = attachments.filter((item) => {
    if (!selectedSystem?.id) return false;
    if (item.attachable_type === "ticket") return selectedTickets.some((ticket) => ticket.id === item.attachable_id);
    if (item.attachable_type === "assignment") return (refs?.assignments ?? []).some((a) => a.id === item.attachable_id && a.ticket_id && selectedTickets.some((t) => t.id === a.ticket_id));
    return false;
  });

  const brandOptions = (catalog?.brands ?? []).filter((item) => !assetBuilder.category_id || item.category_id === assetBuilder.category_id);
  const modelOptions = (catalog?.products ?? []).filter((item) => (!assetBuilder.category_id || item.category_id === assetBuilder.category_id) && (!assetBuilder.brand_id || item.brand_id === assetBuilder.brand_id));

  const submitSystem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await saveSystemFn({
        data: {
          id: systemForm.id || undefined,
          customer_id: systemForm.customer_id,
          system_name: systemForm.system_name,
          installation_date: systemForm.installation_date || null,
          status: systemForm.status as "active" | "inactive",
          notes: systemForm.notes || null,
        },
      });
      const systemId = systemForm.id || result.id;

      if (systemId && pendingAssets.length > 0) {
        await Promise.all(
          pendingAssets.map((asset) =>
            saveAssetFn({
              data: {
                customer_system_id: systemId,
                product_id: asset.product_id,
                quantity: asset.quantity,
                serial_number: asset.serial_number || null,
                warranty_status: asset.warranty_status,
                notes: asset.notes || null,
              },
            }),
          ),
        );
      }

      toast.success("تم حفظ النظام ومكوناته");
      setSystemOpen(false);
      setSystemForm({ id: "", customer_id: "", system_name: "", installation_date: "", status: "active", notes: "" });
      setPendingAssets([]);
      queryClient.invalidateQueries({ queryKey: ["customer-systems"] });
      queryClient.invalidateQueries({ queryKey: ["system-assets"] });
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
                    <TableRow key={item.id} onClick={() => setSelectedSystemId(item.id)} className="cursor-pointer">
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
          <CardHeader>
            <CardTitle className="text-base">تفاصيل النظام المحدد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedSystem ? (
              <p className="text-sm text-muted-foreground">اختر نظامًا لعرض التفاصيل.</p>
            ) : (
              <>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{selectedSystem.system_name}</p>
                  <p className="text-muted-foreground">الحالة: {selectedSystem.status === "active" ? "نشط" : "غير نشط"}</p>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b p-3 text-sm font-medium">المكونات المركبة</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
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
                          <TableCell>{asset.warranty_status}</TableCell>
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

                <div className="rounded-lg border">
                  <div className="border-b p-3 text-sm font-medium">التذاكر السابقة</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم التذكرة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الأولوية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell>{ticket.id.slice(0, 8)}</TableCell>
                          <TableCell>{ticket.status}</TableCell>
                          <TableCell>{ticket.priority}</TableCell>
                        </TableRow>
                      ))}
                      {selectedTickets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-5 text-center text-muted-foreground">لا توجد تذاكر مرتبطة.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b p-3 text-sm font-medium">المرفقات المرتبطة</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نوع الملف</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الوصف</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedAttachments.map((attachment) => (
                        <TableRow key={attachment.id}>
                          <TableCell>{attachment.file_type}</TableCell>
                          <TableCell>{attachment.original_name ?? attachment.file_path}</TableCell>
                          <TableCell>{attachment.description ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {selectedAttachments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-5 text-center text-muted-foreground">لا توجد مرفقات مرتبطة.</TableCell>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{systemForm.id ? "تعديل نظام" : "إضافة نظام"}</DialogTitle>
            <DialogDescription>يجب ربط كل نظام بعميل موجود، ويمكن إضافة المكونات قبل الحفظ النهائي.</DialogDescription>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>اسم النظام</Label><Input value={systemForm.system_name} onChange={(e) => setSystemForm((p) => ({ ...p, system_name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>تاريخ التركيب</Label><Input type="date" value={systemForm.installation_date} onChange={(e) => setSystemForm((p) => ({ ...p, installation_date: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={systemForm.status} onValueChange={(value) => setSystemForm((p) => ({ ...p, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="inactive">غير نشط</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={systemForm.notes} onChange={(e) => setSystemForm((p) => ({ ...p, notes: e.target.value }))} /></div>

            {canManage && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">إضافة مكونات النظام (جدول ديناميكي)</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select value={assetBuilder.category_id || "none"} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, category_id: value === "none" ? "" : value, brand_id: "", product_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر الفئة</SelectItem>
                      {(catalog?.categories ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name_ar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={assetBuilder.brand_id || "none"} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, brand_id: value === "none" ? "" : value, product_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="العلامة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر العلامة</SelectItem>
                      {brandOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={assetBuilder.product_id || "none"} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, product_id: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="الموديل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر الموديل</SelectItem>
                      {modelOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.model}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <Input type="number" min={1} value={String(assetBuilder.quantity)} onChange={(e) => setAssetBuilder((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))} placeholder="الكمية" />
                  <Input value={assetBuilder.serial_number} onChange={(e) => setAssetBuilder((p) => ({ ...p, serial_number: e.target.value }))} placeholder="رقم تسلسلي" />
                  <Select value={assetBuilder.warranty_status} onValueChange={(value) => setAssetBuilder((p) => ({ ...p, warranty_status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="valid">ساري</SelectItem><SelectItem value="expired">منتهي</SelectItem><SelectItem value="unknown">غير معروف</SelectItem></SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!assetBuilder.product_id) return;
                      setPendingAssets((prev) => [
                        ...prev,
                        {
                          product_id: assetBuilder.product_id,
                          quantity: assetBuilder.quantity,
                          serial_number: assetBuilder.serial_number,
                          warranty_status: assetBuilder.warranty_status as "valid" | "expired" | "unknown",
                          notes: assetBuilder.notes,
                        },
                      ]);
                      setAssetBuilder({ category_id: "", brand_id: "", product_id: "", quantity: 1, serial_number: "", warranty_status: "unknown", notes: "" });
                    }}
                  >
                    إضافة للجدول
                  </Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>الموديل</TableHead><TableHead>الكمية</TableHead><TableHead>الضمان</TableHead><TableHead className="text-left">حذف</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendingAssets.map((asset, index) => (
                      <TableRow key={`${asset.product_id}-${index}`}>
                        <TableCell>{catalog?.products.find((p) => p.id === asset.product_id)?.model ?? "—"}</TableCell>
                        <TableCell>{asset.quantity}</TableCell>
                        <TableCell>{asset.warranty_status}</TableCell>
                        <TableCell className="text-left"><Button type="button" variant="outline" size="sm" onClick={() => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}>حذف</Button></TableCell>
                      </TableRow>
                    ))}
                    {pendingAssets.length === 0 && <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">لا توجد مكونات مضافة بعد.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-start gap-2"><Button type="submit">حفظ نهائي</Button><Button type="button" variant="outline" onClick={() => setSystemOpen(false)}>إلغاء</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}