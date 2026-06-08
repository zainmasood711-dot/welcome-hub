import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { listCustomerSystems, listCustomers, listTickets, saveCustomer } from "@/lib/phase2.functions";
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

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["customers.manage"]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listFn(),
  });
  const { data: systems = [] } = useQuery({ queryKey: ["customers-systems"], queryFn: () => systemsFn() });
  const { data: tickets = [] } = useQuery({ queryKey: ["customers-tickets"], queryFn: () => ticketsFn() });

  const [search, setSearch] = useState("");
  const [governorateFilter, setGovernorateFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quickForm, setQuickForm] = useState({
    name: "",
    phone: "",
    governorate: "",
    city: "",
    address: "",
    notes: "",
  });

  const governorates = useMemo(() => Array.from(new Set(customers.map((c) => c.governorate).filter((v): v is string => Boolean(v)))).sort(), [customers]);
  const cities = useMemo(() => {
    const scoped = governorateFilter === "all" ? customers : customers.filter((item) => item.governorate === governorateFilter);
    return Array.from(new Set(scoped.map((c) => c.city).filter((v): v is string => Boolean(v)))).sort();
  }, [customers, governorateFilter]);

  const byCustomer = useMemo(() => {
    const systemsCount = new Map<string, number>();
    const openTicketsCount = new Map<string, number>();
    for (const item of systems) systemsCount.set(item.customer_id, (systemsCount.get(item.customer_id) ?? 0) + 1);
    for (const item of tickets) {
      if (item.status === "closed" || item.status === "resolved_remote") continue;
      openTicketsCount.set(item.customer_id, (openTicketsCount.get(item.customer_id) ?? 0) + 1);
    }
    return { systemsCount, openTicketsCount };
  }, [systems, tickets]);

  const getCustomerHealth = (customerId: string) => {
    const openCount = byCustomer.openTicketsCount.get(customerId) ?? 0;
    if (openCount >= 3) return "critical" as const;
    if (openCount > 0) return "attention" as const;
    return "stable" as const;
  };

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      if (!`${c.name} ${c.phone} ${c.governorate ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q)) return false;
      if (governorateFilter !== "all" && c.governorate !== governorateFilter) return false;
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (statusFilter !== "all" && getCustomerHealth(c.id) !== statusFilter) return false;
      return true;
    });
  }, [customers, search, governorateFilter, cityFilter, statusFilter, byCustomer]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (quickForm.name.trim().length < 2) {
      toast.error("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (!/^[0-9+\-()\s]{8,25}$/.test(quickForm.phone.trim())) {
      toast.error("رقم الهاتف غير صالح");
      return;
    }

    try {
      await saveFn({
        data: {
          name: quickForm.name,
          phone: quickForm.phone,
          governorate: quickForm.governorate || null,
          city: quickForm.city || null,
          address: quickForm.address || null,
          location_coordinates: null,
          notes: quickForm.notes || null,
        },
      });
      toast.success("تم إنشاء العميل بسرعة");
      setQuickForm({ name: "", phone: "", governorate: "", city: "", address: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ العميل");
    }
  };

  const renderHealthBadge = (state: "critical" | "attention" | "stable") => {
    if (state === "critical") return <Badge variant="destructive">حرج</Badge>;
    if (state === "attention") return <Badge variant="secondary">تحتاج متابعة</Badge>;
    return <Badge variant="outline">مستقر</Badge>;
  };

  return (
    <AppShell roles={roles} title="إدارة العملاء">
      <div className="space-y-4">
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إدخال سريع - مركز الاتصالات</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid grid-cols-1 gap-2 md:grid-cols-12" onSubmit={submit}>
                <div className="md:col-span-3">
                  <Label className="mb-1 inline-block text-xs">اسم العميل *</Label>
                  <Input value={quickForm.name} onChange={(e) => setQuickForm((p) => ({ ...p, name: e.target.value }))} placeholder="الاسم" />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 inline-block text-xs">الهاتف *</Label>
                  <Input value={quickForm.phone} onChange={(e) => setQuickForm((p) => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" inputMode="tel" />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 inline-block text-xs">المحافظة</Label>
                  <Input value={quickForm.governorate} onChange={(e) => setQuickForm((p) => ({ ...p, governorate: e.target.value }))} placeholder="المحافظة" />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 inline-block text-xs">المدينة</Label>
                  <Input value={quickForm.city} onChange={(e) => setQuickForm((p) => ({ ...p, city: e.target.value }))} placeholder="المدينة" />
                </div>
                <div className="md:col-span-3">
                  <Label className="mb-1 inline-block text-xs">العنوان المختصر</Label>
                  <Input value={quickForm.address} onChange={(e) => setQuickForm((p) => ({ ...p, address: e.target.value }))} placeholder="الحي / الشارع" />
                </div>
                <div className="md:col-span-9">
                  <Label className="mb-1 inline-block text-xs">ملاحظة سريعة</Label>
                  <Input value={quickForm.notes} onChange={(e) => setQuickForm((p) => ({ ...p, notes: e.target.value }))} placeholder="تفاصيل مفيدة للاتصال القادم" />
                </div>
                <div className="md:col-span-3 flex items-end">
                  <Button type="submit" className="w-full">إضافة فورية</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">قائمة العملاء</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو المدينة" />
              <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                <SelectTrigger><SelectValue placeholder="تصفية المحافظة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المحافظات</SelectItem>
                  {governorates.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger><SelectValue placeholder="تصفية المدينة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المدن</SelectItem>
                  {cities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="حالة العميل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="attention">تحتاج متابعة</SelectItem>
                  <SelectItem value="stable">مستقر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>المحافظة/المدينة</TableHead>
                <TableHead>الأنظمة</TableHead>
                <TableHead>تذاكر مفتوحة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر تحديث</TableHead>
                <TableHead className="text-left">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">لا توجد نتائج مطابقة.</TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((item) => {
                  const systemsCount = byCustomer.systemsCount.get(item.id) ?? 0;
                  const openCount = byCustomer.openTicketsCount.get(item.id) ?? 0;
                  const health = getCustomerHealth(item.id);
                  return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>{[item.governorate, item.city].filter(Boolean).join(" - ") || "—"}</TableCell>
                    <TableCell>{systemsCount}</TableCell>
                    <TableCell>{openCount}</TableCell>
                    <TableCell>{renderHealthBadge(health)}</TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                    <TableCell className="text-left">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/_authenticated/customers/$customerId" params={{ customerId: item.id }}>فتح</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}