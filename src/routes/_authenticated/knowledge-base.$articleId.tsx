import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getKnowledgeArticleDetails, getPhase2References, saveKnowledgeFeedbackFromContext } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/knowledge-base/$articleId")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "field_engineer"]);
  },
  component: KnowledgeArticleDetailsPage,
});

function KnowledgeArticleDetailsPage() {
  const { articleId } = Route.useParams();
  const queryClient = useQueryClient();
  const detailsFn = useServerFn(getKnowledgeArticleDetails);
  const refsFn = useServerFn(getPhase2References);
  const saveFeedbackFn = useServerFn(saveKnowledgeFeedbackFromContext);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const [feedbackDraft, setFeedbackDraft] = useState({ rating: "success", notes: "", ticket_id: "" });

  const { data: details, isLoading } = useQuery({
    queryKey: ["knowledge-article-details", articleId],
    queryFn: () => detailsFn({ data: { article_id: articleId } }),
  });
  const { data: refs } = useQuery({ queryKey: ["phase2-refs"], queryFn: () => refsFn() });

  const article = details?.article;

  const submitFeedback = async () => {
    if (!article) return;
    try {
      await saveFeedbackFn({
        data: {
          knowledge_base_id: article.id,
          rating: feedbackDraft.rating as "success" | "failure" | "partial",
          notes: feedbackDraft.notes || null,
          ticket_id: feedbackDraft.ticket_id || null,
          assignment_id: null,
        },
      });
      toast.success("تم تسجيل التقييم وتحديث مؤشرات الفاعلية");
      setFeedbackDraft({ rating: "success", notes: "", ticket_id: "" });
      queryClient.invalidateQueries({ queryKey: ["knowledge-article-details", articleId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تسجيل التقييم");
    }
  };

  return (
    <AppShell roles={roles} title="تفاصيل مادة المعرفة">
      <div className="space-y-4" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isLoading ? "جاري التحميل..." : article?.title ?? "مادة معرفية"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">المصدر: {article?.source === "auto_from_ticket" ? "من تذكرة/مهمة" : "يدوي"}</Badge>
              <Badge variant="outline">النجاح: {details?.metrics.success_count ?? 0}</Badge>
              <Badge variant="outline">الإخفاق: {details?.metrics.fail_count ?? 0}</Badge>
              <Badge>الفاعلية: {details?.metrics.effectiveness_rate ?? 0}%</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList>
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="tickets">التذاكر المرتبطة</TabsTrigger>
            <TabsTrigger value="feedback">التقييمات</TabsTrigger>
            <TabsTrigger value="attachments">المرفقات</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="rounded border p-3 text-sm">
                  <p className="font-medium">وصف المشكلة</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{article?.issue_description ?? "—"}</p>
                </div>
                <div className="rounded border p-3 text-sm">
                  <p className="font-medium">خطوات الحل</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{article?.solution_steps ?? "—"}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                  <div className="rounded border p-2">المنتج: {refs?.products.find((x) => x.id === article?.product_id)?.model ?? "—"}</div>
                  <div className="rounded border p-2">رمز الخطأ: {article?.error_code_text ?? "—"}</div>
                  <div className="rounded border p-2">الكلمات المفتاحية: {article?.search_keywords ?? "—"}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow><TableHead>رقم التذكرة</TableHead><TableHead>الحالة</TableHead><TableHead>الأولوية</TableHead><TableHead>الوصف</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(details?.linked_tickets ?? []).map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>{ticket.id.slice(0, 8)}</TableCell>
                        <TableCell>{ticket.status}</TableCell>
                        <TableCell>{ticket.priority}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{ticket.description}</TableCell>
                      </TableRow>
                    ))}
                    {(details?.linked_tickets ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">لا توجد تذاكر مرتبطة.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback">
            <Card>
              <CardHeader><CardTitle className="text-sm">تسجيل تقييم جديد</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Select value={feedbackDraft.rating} onValueChange={(value) => setFeedbackDraft((prev) => ({ ...prev, rating: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="success">ناجح</SelectItem><SelectItem value="partial">جزئي</SelectItem><SelectItem value="failure">فاشل</SelectItem></SelectContent></Select>
                  <Select value={feedbackDraft.ticket_id || "none"} onValueChange={(value) => setFeedbackDraft((prev) => ({ ...prev, ticket_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="تذكرة مرتبطة (اختياري)" /></SelectTrigger><SelectContent><SelectItem value="none">بدون تذكرة</SelectItem>{(details?.linked_tickets ?? []).map((ticket) => <SelectItem key={ticket.id} value={ticket.id}>{ticket.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select>
                  <Button type="button" onClick={submitFeedback}>حفظ التقييم</Button>
                </div>
                <Textarea value={feedbackDraft.notes} onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="ملاحظات التقييم" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">سجل التقييمات</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>التقييم</TableHead><TableHead>التذكرة</TableHead><TableHead>الملاحظات</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(details?.feedback ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.rating}</TableCell>
                        <TableCell>{row.ticket_id ? row.ticket_id.slice(0, 8) : "—"}</TableCell>
                        <TableCell className="max-w-[320px] truncate">{row.notes ?? "—"}</TableCell>
                        <TableCell>{new Date(row.created_at).toLocaleDateString("ar-EG")}</TableCell>
                      </TableRow>
                    ))}
                    {(details?.feedback ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">لا توجد تقييمات بعد.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>الوصف</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(details?.attachments ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.original_name ?? item.file_path}</TableCell>
                        <TableCell>{item.file_type}</TableCell>
                        <TableCell>{item.description ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {(details?.attachments ?? []).length === 0 && <TableRow><TableCell colSpan={3} className="py-4 text-center text-muted-foreground">لا توجد مرفقات.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}