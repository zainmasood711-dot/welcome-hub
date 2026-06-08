import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
import { getCatalogData, listErrorCodes, saveErrorCode } from "@/lib/phase1.functions";
import { hasAnyRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/error-codes")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager", "field_engineer"]);
  },
  component: ErrorCodesPage,
});

function ErrorCodesPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listErrorCodes);
  const saveFn = useServerFn(saveErrorCode);
  const catalogFn = useServerFn(getCatalogData);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyRole(roles, ["support_engineer"]);

  const { data: errorCodes = [], isLoading } = useQuery({
    queryKey: ["error-codes"],
    queryFn: () => listFn(),
  });

  const { data: catalog } = useQuery({
    queryKey: ["catalog-ref"],
    queryFn: () => catalogFn(),
  });

  const products = catalog?.products ?? [];

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: "",
    product_id: "",
    code: "",
    category: "technical",
    description: "",
    common_causes: "",
    recommended_solution: "",
    occurrences_count: 0,
  });

  const filtered = useMemo(() => {
    return errorCodes.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      const productModel = products.find((p) => p.id === item.product_id)?.model ?? "";
      const text = `${item.code} ${item.description ?? ""} ${productModel}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [errorCodes, products, search, categoryFilter]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveFn({
        data: {
          id: form.id || undefined,
          product_id: form.product_id || null,
          code: form.code,
          category: form.category as "software" | "technical",
          description: form.description || null,
          common_causes: form.common_causes || null,
          recommended_solution: form.recommended_solution || null,
          occurrences_count: Number(form.occurrences_count) || 0,
        },
      });
      toast.success("تم حفظ رمز الخطأ");
      setOpen(false);
      setForm({
        id: "",
        product_id: "",
        code: "",
        category: "technical",
        description: "",
        common_causes: "",
        recommended_solution: "",
        occurrences_count: 0,
      });
      queryClient.invalidateQueries({ queryKey: ["error-codes"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ البيانات");
    }
  };

  return (
    <AppShell roles={roles} title="إدارة رموز الأخطاء">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <Input placeholder="بحث بالكود أو الوصف أو الموديل" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="تصنيف الخطأ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                <SelectItem value="technical">تقني</SelectItem>
                <SelectItem value="software">برمجي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canManage && <Button onClick={() => setOpen(true)}>إضافة رمز خطأ</Button>}
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>عدد التكرار</TableHead>
                {canManage && <TableHead className="text-left">إجراء</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    جاري تحميل البيانات...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    لا توجد رموز أخطاء مطابقة.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    <TableCell>{item.category === "technical" ? "تقني" : "برمجي"}</TableCell>
                    <TableCell>{products.find((product) => product.id === item.product_id)?.model ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{item.description ?? "—"}</TableCell>
                    <TableCell>{item.occurrences_count}</TableCell>
                    {canManage && (
                      <TableCell className="text-left">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setForm({
                              id: item.id,
                              product_id: item.product_id ?? "",
                              code: item.code,
                              category: item.category,
                              description: item.description ?? "",
                              common_causes: item.common_causes ?? "",
                              recommended_solution: item.recommended_solution ?? "",
                              occurrences_count: item.occurrences_count,
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل رمز خطأ" : "إضافة رمز خطأ"}</DialogTitle>
            <DialogDescription>أدخل الكود والتصنيف مع السبب والحل المقترح لسهولة الاستخدام لاحقًا.</DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={submit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">الكود</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={(value) => setForm((p) => ({ ...p, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">تقني</SelectItem>
                    <SelectItem value="software">برمجي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>المنتج المرتبط (اختياري)</Label>
              <Select value={form.product_id || "none"} onValueChange={(value) => setForm((p) => ({ ...p, product_id: value === "none" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر منتجًا" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ربط</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">الوصف</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="causes">الأسباب الشائعة</Label>
              <Textarea id="causes" value={form.common_causes} onChange={(e) => setForm((p) => ({ ...p, common_causes: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution">الحل المقترح</Label>
              <Textarea id="solution" value={form.recommended_solution} onChange={(e) => setForm((p) => ({ ...p, recommended_solution: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">عدد التكرار</Label>
              <Input
                id="count"
                type="number"
                min={0}
                value={String(form.occurrences_count)}
                onChange={(e) => setForm((p) => ({ ...p, occurrences_count: Number(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ</Button>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  إلغاء
                </Button>
              </DialogTrigger>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}