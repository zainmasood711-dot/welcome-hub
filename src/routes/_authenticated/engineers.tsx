import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { linkEngineerToProfile, listEngineers, listProfilesForLink, saveEngineer } from "@/lib/phase1.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/engineers")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: EngineersPage,
});

function EngineersPage() {
  const queryClient = useQueryClient();
  const engineersFn = useServerFn(listEngineers);
  const saveEngineerFn = useServerFn(saveEngineer);
  const profilesFn = useServerFn(listProfilesForLink);
  const linkFn = useServerFn(linkEngineerToProfile);

  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["engineers.manage"]);

  const { data: engineers = [], isLoading } = useQuery({
    queryKey: ["engineers"],
    queryFn: () => engineersFn(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-link"],
    queryFn: () => profilesFn(),
    enabled: canManage,
  });

  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [profileId, setProfileId] = useState("");
  const [engineerId, setEngineerId] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
    governorate: "",
    city: "",
    specialization: "",
    type: "internal",
    availability_status: "available",
    notes: "",
  });

  const filtered = useMemo(() => {
    return engineers.filter((item) => {
      if (availabilityFilter !== "all" && item.availability_status !== availabilityFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      const bucket = `${item.name} ${item.phone ?? ""} ${item.governorate ?? ""} ${item.city ?? ""}`.toLowerCase();
      return bucket.includes(search.toLowerCase());
    });
  }, [engineers, availabilityFilter, typeFilter, search]);

  const startCreate = () => {
    setCurrentId(undefined);
    setForm({
      name: "",
      phone: "",
      whatsapp: "",
      email: "",
      governorate: "",
      city: "",
      specialization: "",
      type: "internal",
      availability_status: "available",
      notes: "",
    });
    setEditorOpen(true);
  };

  const startEdit = (id: string) => {
    const selected = engineers.find((item) => item.id === id);
    if (!selected) return;
    setCurrentId(selected.id);
    setForm({
      name: selected.name,
      phone: selected.phone ?? "",
      whatsapp: selected.whatsapp ?? "",
      email: selected.email ?? "",
      governorate: selected.governorate ?? "",
      city: selected.city ?? "",
      specialization: selected.specialization ?? "",
      type: selected.type,
      availability_status: selected.availability_status,
      notes: selected.notes ?? "",
    });
    setEditorOpen(true);
  };

  const submitEngineer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveEngineerFn({
        data: {
          id: currentId,
          name: form.name,
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          email: form.email || null,
          governorate: form.governorate || null,
          city: form.city || null,
          specialization: form.specialization || null,
          type: form.type as "internal" | "external",
          availability_status: form.availability_status as "available" | "busy" | "inactive",
          notes: form.notes || null,
        },
      });
      toast.success(currentId ? "تم تحديث بيانات المهندس" : "تمت إضافة المهندس");
      setEditorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["engineers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ البيانات");
    }
  };

  const submitLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileId || !engineerId) {
      toast.error("يرجى اختيار المستخدم والمهندس");
      return;
    }
    try {
      await linkFn({ data: { profileId, engineerId } });
      toast.success("تم ربط المهندس بالمستخدم");
      setLinkOpen(false);
      setProfileId("");
      setEngineerId("");
      queryClient.invalidateQueries({ queryKey: ["profiles-for-link"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تنفيذ الربط");
    }
  };

  return (
    <AppShell roles={roles} title="إدارة المهندسين">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <Input placeholder="بحث بالاسم أو الهاتف أو الموقع" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة التوفر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="available">متاح</SelectItem>
                <SelectItem value="busy">مشغول</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="internal">داخلي</SelectItem>
                <SelectItem value="external">خارجي</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setLinkOpen(true)}>
                ربط مهندس بمستخدم
              </Button>
              <Button onClick={startCreate}>إضافة مهندس</Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الموقع</TableHead>
                <TableHead>التخصص</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التاريخ</TableHead>
                {canManage && <TableHead className="text-left">إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    جاري تحميل البيانات...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    لا توجد نتائج مطابقة.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.phone ?? "—"}</TableCell>
                    <TableCell>{[item.governorate, item.city].filter(Boolean).join(" - ") || "—"}</TableCell>
                    <TableCell>{item.specialization ?? "—"}</TableCell>
                    <TableCell>{item.type === "internal" ? "داخلي" : "خارجي"}</TableCell>
                    <TableCell>
                      {item.availability_status === "available"
                        ? "متاح"
                        : item.availability_status === "busy"
                          ? "مشغول"
                          : "غير نشط"}
                    </TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                    {canManage && (
                      <TableCell className="text-left">
                        <Button variant="outline" size="sm" onClick={() => startEdit(item.id)}>
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
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentId ? "تعديل بيانات مهندس" : "إضافة مهندس جديد"}</DialogTitle>
            <DialogDescription>تأكد من إدخال بيانات دقيقة لتسهيل توزيع المهام لاحقًا.</DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={submitEngineer}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eng-name">الاسم</Label>
                <Input id="eng-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eng-phone">الهاتف</Label>
                <Input id="eng-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eng-whatsapp">واتساب</Label>
                <Input id="eng-whatsapp" value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eng-email">البريد الإلكتروني</Label>
                <Input id="eng-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eng-gov">المحافظة</Label>
                <Input id="eng-gov" value={form.governorate} onChange={(e) => setForm((p) => ({ ...p, governorate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eng-city">المدينة</Label>
                <Input id="eng-city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eng-special">التخصص</Label>
                <Input
                  id="eng-special"
                  value={form.specialization}
                  onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(value) => setForm((p) => ({ ...p, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">داخلي</SelectItem>
                    <SelectItem value="external">خارجي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>حالة التوفر</Label>
                <Select
                  value={form.availability_status}
                  onValueChange={(value) => setForm((p) => ({ ...p, availability_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">متاح</SelectItem>
                    <SelectItem value="busy">مشغول</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eng-notes">ملاحظات</Label>
              <Textarea id="eng-notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ</Button>
              <DialogTrigger asChild>
                <Button variant="outline">إلغاء</Button>
              </DialogTrigger>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ربط مهندس بحساب مستخدم</DialogTitle>
            <DialogDescription>اختر المستخدم ثم اختر المهندس المرتبط به.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitLink}>
            <div className="space-y-2">
              <Label>المستخدم</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستخدمًا" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name} {profile.phone ? `- ${profile.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المهندس</Label>
              <Select value={engineerId} onValueChange={setEngineerId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مهندسًا" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit">تأكيد الربط</Button>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}