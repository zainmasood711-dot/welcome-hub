import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getCatalogData, saveBrand, saveCategory, saveProduct } from "@/lib/phase1.functions";
import { hasAnyPermission } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/catalog")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: CatalogPage,
});

function CatalogPage() {
  const queryClient = useQueryClient();
  const catalogFn = useServerFn(getCatalogData);
  const saveCategoryFn = useServerFn(saveCategory);
  const saveBrandFn = useServerFn(saveBrand);
  const saveProductFn = useServerFn(saveProduct);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];
  const canManage = hasAnyPermission(roles, ["products.manage"]);

  const { data, isLoading } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => catalogFn(),
  });

  const categories = data?.categories ?? [];
  const brands = data?.brands ?? [];
  const products = data?.products ?? [];

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ id: "", name_ar: "", slug: "" });
  const [brandForm, setBrandForm] = useState({ id: "", name: "", category_id: "" });
  const [productForm, setProductForm] = useState({
    id: "",
    category_id: "",
    brand_id: "",
    model: "",
    description: "",
    is_active: true,
  });

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      if (brandFilter !== "all" && item.brand_id !== brandFilter) return false;
      if (activeFilter === "active" && !item.is_active) return false;
      if (activeFilter === "inactive" && item.is_active) return false;

      const brand = brands.find((b) => b.id === item.brand_id)?.name ?? "";
      const category = categories.find((c) => c.id === item.category_id)?.name_ar ?? "";
      const text = `${item.model} ${brand} ${category}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [products, brands, categories, search, categoryFilter, brandFilter, activeFilter]);

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveCategoryFn({ data: { id: categoryForm.id || undefined, name_ar: categoryForm.name_ar, slug: categoryForm.slug } });
      toast.success("تم حفظ الفئة");
      setCategoryOpen(false);
      setCategoryForm({ id: "", name_ar: "", slug: "" });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الفئة");
    }
  };

  const submitBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveBrandFn({ data: { id: brandForm.id || undefined, name: brandForm.name, category_id: brandForm.category_id } });
      toast.success("تم حفظ العلامة التجارية");
      setBrandOpen(false);
      setBrandForm({ id: "", name: "", category_id: "" });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ العلامة التجارية");
    }
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!productForm.category_id || !productForm.brand_id) {
      toast.error("اختر الفئة والعلامة قبل الحفظ");
      return;
    }
    if (productForm.model.trim().length < 2) {
      toast.error("الموديل قصير جدًا");
      return;
    }

    try {
      await saveProductFn({
        data: {
          id: productForm.id || undefined,
          category_id: productForm.category_id,
          brand_id: productForm.brand_id,
          model: productForm.model,
          description: productForm.description || null,
          is_active: productForm.is_active,
        },
      });
      toast.success("تم حفظ المنتج");
      setProductOpen(false);
      setProductForm({ id: "", category_id: "", brand_id: "", model: "", description: "", is_active: true });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المنتج");
    }
  };

  return (
    <AppShell roles={roles} title="إدارة الفئات والعلامات والمنتجات">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">المنتجات</CardTitle>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input placeholder="بحث بالموديل أو العلامة أو الفئة" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="تصفية الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger>
                <SelectValue placeholder="تصفية العلامة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العلامات</SelectItem>
                {brands
                  .filter((item) => categoryFilter === "all" || item.category_id === categoryFilter)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">{filteredProducts.length} منتج مطابق</div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCategoryOpen(true)}>
                  إضافة فئة
                </Button>
                <Button variant="secondary" onClick={() => setBrandOpen(true)}>
                  إضافة علامة
                </Button>
                <Button onClick={() => setProductOpen(true)}>إضافة منتج</Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">المنتجات</TabsTrigger>
              <TabsTrigger value="brands">العلامات</TabsTrigger>
              <TabsTrigger value="categories">الفئات</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموديل</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>العلامة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الحالة</TableHead>
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
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        لا توجد منتجات مطابقة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((item) => {
                      const category = categories.find((c) => c.id === item.category_id)?.name_ar ?? "—";
                      const brand = brands.find((b) => b.id === item.brand_id)?.name ?? "—";
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.model}</TableCell>
                          <TableCell>{category}</TableCell>
                          <TableCell>{brand}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{item.description ?? "—"}</TableCell>
                          <TableCell>{item.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">غير نشط</Badge>}</TableCell>
                          {canManage && (
                            <TableCell className="text-left">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setProductForm({
                                    id: item.id,
                                    category_id: item.category_id,
                                    brand_id: item.brand_id,
                                    model: item.model,
                                    description: item.description ?? "",
                                    is_active: item.is_active,
                                  });
                                  setProductOpen(true);
                                }}
                              >
                                تعديل
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="brands">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العلامة التجارية</TableHead>
                    <TableHead>الفئة</TableHead>
                    {canManage && <TableHead className="text-left">إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{categories.find((c) => c.id === item.category_id)?.name_ar ?? "—"}</TableCell>
                      {canManage && (
                        <TableCell className="text-left">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBrandForm({ id: item.id, name: item.name, category_id: item.category_id });
                              setBrandOpen(true);
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
            </TabsContent>

            <TabsContent value="categories">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الفئة</TableHead>
                    <TableHead>Slug</TableHead>
                    {canManage && <TableHead className="text-left">إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name_ar}</TableCell>
                      <TableCell>{item.slug}</TableCell>
                      {canManage && (
                        <TableCell className="text-left">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCategoryForm({ id: item.id, name_ar: item.name_ar, slug: item.slug });
                              setCategoryOpen(true);
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryForm.id ? "تعديل فئة" : "إضافة فئة"}</DialogTitle>
            <DialogDescription>أدخل اسم الفئة العربي وslug بالإنجليزية الصغيرة.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitCategory}>
            <div className="space-y-2">
              <Label htmlFor="cat-name">اسم الفئة</Label>
              <Input id="cat-name" value={categoryForm.name_ar} onChange={(e) => setCategoryForm((p) => ({ ...p, name_ar: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input id="cat-slug" value={categoryForm.slug} onChange={(e) => setCategoryForm((p) => ({ ...p, slug: e.target.value }))} required dir="ltr" />
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ</Button>
              <Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{brandForm.id ? "تعديل علامة" : "إضافة علامة"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitBrand}>
            <div className="space-y-2">
              <Label htmlFor="brand-name">اسم العلامة</Label>
              <Input id="brand-name" value={brandForm.name} onChange={(e) => setBrandForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select value={brandForm.category_id} onValueChange={(value) => setBrandForm((p) => ({ ...p, category_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ</Button>
              <Button type="button" variant="outline" onClick={() => setBrandOpen(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productForm.id ? "تعديل منتج" : "إضافة منتج"}</DialogTitle>
            <DialogDescription>نموذج احترافي سريع: اختر الفئة والعلامة والموديل، مع حالة النشاط.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitProduct}>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select value={productForm.category_id} onValueChange={(value) => setProductForm((p) => ({ ...p, category_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>العلامة</Label>
              <Select value={productForm.brand_id} onValueChange={(value) => setProductForm((p) => ({ ...p, brand_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العلامة" />
                </SelectTrigger>
                <SelectContent>
                  {brands
                    .filter((item) => !productForm.category_id || item.category_id === productForm.category_id)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-model">الموديل</Label>
              <Input id="product-model" value={productForm.model} onChange={(e) => setProductForm((p) => ({ ...p, model: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-desc">الوصف</Label>
              <Textarea id="product-desc" value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>حالة المنتج</Label>
              <Select
                value={productForm.is_active ? "active" : "inactive"}
                onValueChange={(value) => setProductForm((p) => ({ ...p, is_active: value === "active" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit">حفظ</Button>
              <Button type="button" variant="outline" onClick={() => setProductOpen(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}