import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { listAttachments, listCustomerSystems, listCustomers, listTickets, saveCustomer } from "@/lib/phase2.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/customers")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: CustomersPage,
});

function CustomersPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCustomers);
  const saveFn = useServerFn(saveCustomer);
  const systemsFn = useServerFn(listCustomerSystems);
  const ticketsFn = useServerFn(listTickets);
  const attachmentsFn = useServerFn(listAttachments);

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["customers.manage"]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listFn(),
  });
  const { data: systems = [] } = useQuery({ queryKey: ["customers-systems"], queryFn: () => systemsFn() });
  const { data: tickets = [] } = useQuery({ queryKey: ["customers-tickets"], queryFn: () => ticketsFn() });
  const { data: attachments = [] } = useQuery({ queryKey: ["customers-attachments"], queryFn: () => attachmentsFn() });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    phone: "",
    governorate: "",
    city: "",
    address: "",
    location_coordinates: "",
    notes: "",
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => `${c.name} ${c.phone} ${c.governorate ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q));
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectedCustomer = customers.find((item) => item.id === selectedCustomerId) ?? filtered[0] ?? null;
  const customerSystems = systems.filter((item) => item.customer_id === selectedCustomer?.id);
  const customerSystemIds = new Set(customerSystems.map((item) => item.id));
  const customerTickets = tickets.filter((item) => item.customer_id === selectedCustomer?.id || (item.customer_system_id && customerSystemIds.has(item.customer_system_id)));
  const customerTicketIds = new Set(customerTickets.map((item) => item.id));
  const customerAttachments = attachments.filter((item) => (item.attachable_type === "ticket" && customerTicketIds.has(item.attachable_id)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveFn({
        data: {
          id: form.id || undefined,
          name: form.name,
          phone: form.phone,
          governorate: form.governorate || null,
          city: form.city || null,
          address: form.address || null,
          location_coordinates: form.location_coordinates || null,
          notes: form.notes || null,
        },
      });
      toast.success("تم حفظ بيانات العميل");
      setOpen(false);
      setForm({ id: "", name: "", phone: "", governorate: "", city: "", address: "", location_coordinates: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ العميل");
    }
  };

  return (
    <AppShell roles={roles} title="إدارة العملاء">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو المدينة" className="md:max-w-sm" />
          {canManage && <Button onClick={() => setOpen(true)}>إضافة عميل</Button>}
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>المحافظة/المدينة</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                {canManage && <TableHead className="text-left">إجراء</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : paginatedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد بيانات.</TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((item) => (
                  <TableRow key={item.id} onClick={() => setSelectedCustomerId(item.id)} className="cursor-pointer">
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>{[item.governorate, item.city].filter(Boolean).join(" - ") || "—"}</TableCell>
                    <TableCell>{item.address ?? "—"}</TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                    {canManage && (
                      <TableCell className="text-left">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setForm({
                              id: item.id,
                              name: item.name,
                              phone: item.phone,
                              governorate: item.governorate ?? "",
                              city: item.city ?? "",
                              address: item.address ?? "",
                              location_coordinates: item.location_coordinates ?? "",
                              notes: item.notes ?? "",
                            });
                            setOpen(true);
                          }}
                        >
                          تعديل
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>التالي</Button>
          </div>
        </div>

        {selectedCustomer && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">ملف العميل: {selectedCustomer.name}</h3>
            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                <TabsTrigger value="systems">الأنظمة</TabsTrigger>
                <TabsTrigger value="tickets">سجل التذاكر</TabsTrigger>
                <TabsTrigger value="attachments">المرفقات</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="mt-3 text-sm text-muted-foreground">
                <p>الهاتف: {selectedCustomer.phone}</p>
                <p>العنوان: {selectedCustomer.address ?? "—"}</p>
                <p>الموقع: {[selectedCustomer.governorate, selectedCustomer.city].filter(Boolean).join(" - ") || "—"}</p>
                <p>ملاحظات: {selectedCustomer.notes ?? "—"}</p>
              </TabsContent>
              <TabsContent value="systems" className="mt-3">
                <div className="space-y-2 text-sm">
                  {customerSystems.map((item) => <div key={item.id} className="rounded border p-2">{item.system_name} · {item.status}</div>)}
                  {customerSystems.length === 0 && <p className="text-muted-foreground">لا توجد أنظمة مرتبطة.</p>}
                </div>
              </TabsContent>
              <TabsContent value="tickets" className="mt-3">
                <div className="space-y-2 text-sm">
                  {customerTickets.map((item) => <div key={item.id} className="rounded border p-2">{item.id.slice(0, 8)} · {item.status} · {item.priority}</div>)}
                  {customerTickets.length === 0 && <p className="text-muted-foreground">لا توجد تذاكر مرتبطة.</p>}
                </div>
              </TabsContent>
              <TabsContent value="attachments" className="mt-3">
                <div className="space-y-2 text-sm">
                  {customerAttachments.map((item) => <div key={item.id} className="rounded border p-2">{item.original_name ?? item.file_path}</div>)}
                  {customerAttachments.length === 0 && <p className="text-muted-foreground">لا توجد مرفقات مرتبطة.</p>}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل عميل" : "إضافة عميل"}</DialogTitle>
            <DialogDescription>أدخل بيانات العميل كما تظهر في السجل التشغيلي.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>المحافظة</Label>
                <Input value={form.governorate} onChange={(e) => setForm((p) => ({ ...p, governorate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>الإحداثيات</Label>
              <Input value={form.location_coordinates} onChange={(e) => setForm((p) => ({ ...p, location_coordinates: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}