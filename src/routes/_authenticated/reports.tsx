import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getOperationsReport, listErrorIntelligenceAlerts, updateErrorIntelligenceAlertStatus } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager"]);
  },
  component: ReportsPage,
});

function ReportsPage() {
  const reportFn = useServerFn(getOperationsReport);
  const listAlertsFn = useServerFn(listErrorIntelligenceAlerts);
  const updateAlertStatusFn = useServerFn(updateErrorIntelligenceAlertStatus);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const { data, isLoading, error } = useQuery({ queryKey: ["operations-report"], queryFn: () => reportFn() });
  const { data: alerts = [], refetch: refetchAlerts } = useQuery({ queryKey: ["error-intelligence-alerts"], queryFn: () => listAlertsFn() });

  const handleUpdateAlertStatus = async (alertId: string, status: "acknowledged" | "resolved") => {
    try {
      await updateAlertStatusFn({ data: { alert_id: alertId, status } });
      await refetchAlerts();
      toast.success(status === "resolved" ? "تم إغلاق التنبيه" : "تم تأكيد التنبيه");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تحديث حالة التنبيه");
    }
  };

  if (isLoading) {
    return (
      <AppShell roles={roles} title="التقارير التشغيلية">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل بيانات التقارير...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="التقارير التشغيلية">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">تعذر تحميل بيانات التقارير.</div>
      </AppShell>
    );
  }

  return (
    <AppShell roles={roles} title="التقارير التشغيلية">
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          <Button asChild variant="outline"><Link to="/reports/recurring-issues">الأعطال المتكررة</Link></Button>
          <Button asChild variant="outline"><Link to="/reports/open-ticket-status">حالات التذاكر المفتوحة</Link></Button>
          <Button asChild variant="outline"><Link to="/reports/engineer-performance">أداء المهندسين</Link></Button>
          <Button asChild variant="outline"><Link to="/reports/average-resolution-time">متوسط زمن الحل</Link></Button>
          <Button asChild variant="outline"><Link to="/reports/problematic-models">المنتجات/الموديلات الإشكالية</Link></Button>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-sm">إجمالي التذاكر</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.totalTickets ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">التذاكر غير المحلولة</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.unresolved ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">المهام المتأخرة</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.delayed ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">إجمالي المهام</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.totalAssignments ?? 0}</CardContent></Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">تنبيهات ذكاء الأخطاء (قابلة للتنفيذ)</CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>القاعدة</TableHead>
                  <TableHead>الشدة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الملخص</TableHead>
                  <TableHead>التكرار</TableHead>
                  <TableHead>آخر رصد</TableHead>
                  <TableHead className="text-left">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">لا توجد تنبيهات حالية.</TableCell></TableRow>
                ) : (
                  alerts.slice(0, 12).map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{alert.rule_type}</TableCell>
                      <TableCell>{alert.severity}</TableCell>
                      <TableCell>{alert.status}</TableCell>
                      <TableCell className="max-w-[340px] truncate">{alert.summary}</TableCell>
                      <TableCell>{alert.trigger_count}</TableCell>
                      <TableCell>{new Date(alert.last_detected_at).toLocaleDateString("ar-EG")}</TableCell>
                      <TableCell className="text-left">
                        <div className="flex gap-2">
                          {alert.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => void handleUpdateAlertStatus(alert.id, "acknowledged")}>تأكيد</Button>
                          )}
                          {alert.status !== "resolved" && (
                            <Button size="sm" onClick={() => void handleUpdateAlertStatus(alert.id, "resolved")}>حل</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">ملخص التذاكر</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">مفتوحة: <span className="font-semibold">{data?.ticketSummary?.open ?? 0}</span></div>
              <div className="rounded border p-2">قيد التنفيذ: <span className="font-semibold">{data?.ticketSummary?.in_progress ?? 0}</span></div>
              <div className="rounded border p-2">عن بُعد: <span className="font-semibold">{data?.ticketSummary?.resolved_remote ?? 0}</span></div>
              <div className="rounded border p-2">مُسندة: <span className="font-semibold">{data?.ticketSummary?.assigned ?? 0}</span></div>
              <div className="rounded border p-2 col-span-2">مغلقة: <span className="font-semibold">{data?.ticketSummary?.closed ?? 0}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">ملخص المهام</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">قيد الانتظار: <span className="font-semibold">{data.assignmentSummary?.pending ?? 0}</span></div>
              <div className="rounded border p-2">قيد التنفيذ: <span className="font-semibold">{data.assignmentSummary?.in_progress ?? 0}</span></div>
              <div className="rounded border p-2">مكتملة: <span className="font-semibold">{data.assignmentSummary?.completed ?? 0}</span></div>
              <div className="rounded border p-2">متأخرة: <span className="font-semibold">{data.assignmentSummary?.overdue ?? 0}</span></div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader><CardTitle className="text-base">تحليل الأعطال المتكررة</CardTitle></CardHeader>
          <CardContent className="rounded-lg border">
            <Table><TableHeader><TableRow><TableHead>رمز الخطأ</TableHead><TableHead>عدد التكرار</TableHead></TableRow></TableHeader><TableBody>{(data?.recurringProblems ?? []).map((item) => <TableRow key={item.code}><TableCell>{item.code}</TableCell><TableCell>{item.count}</TableCell></TableRow>)}</TableBody></Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">أداء المهندسين</CardTitle></CardHeader>
          <CardContent className="rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>المهندس</TableHead><TableHead>إجمالي المهام</TableHead><TableHead>مكتملة</TableHead><TableHead>متأخرة</TableHead><TableHead>معدل الإنجاز</TableHead></TableRow></TableHeader>
              <TableBody>{(data?.engineerPerformance ?? []).map((item) => <TableRow key={item.engineer_id}><TableCell>{item.engineer_name}</TableCell><TableCell>{item.total}</TableCell><TableCell>{item.completed}</TableCell><TableCell>{item.delayed ?? 0}</TableCell><TableCell>{item.completion_rate ?? 0}%</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">الاتجاه الشهري</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="newTickets" stroke="var(--color-primary)" name="تذاكر جديدة" />
                <Line type="monotone" dataKey="closedTickets" stroke="var(--color-secondary)" name="تذاكر مغلقة" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">ملخص موثوقية المنتجات</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.productReliability ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="totalIssues" fill="var(--color-primary)" name="إجمالي الأعطال" />
                <Bar dataKey="unresolvedCount" fill="var(--color-destructive)" name="غير المحلول" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">الأكثر استخدامًا من قاعدة المعرفة</CardTitle></CardHeader>
            <CardContent className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>المادة</TableHead><TableHead>عدد الاستخدام</TableHead><TableHead>الفاعلية</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.knowledgeBaseUsage?.mostUsedArticles ?? []).map((item) => (
                    <TableRow key={item.id}><TableCell>{item.title}</TableCell><TableCell>{item.usage_count}</TableCell><TableCell>{item.effectiveness_rate}%</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">الأعلى نجاحًا من قاعدة المعرفة</CardTitle></CardHeader>
            <CardContent className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>المادة</TableHead><TableHead>الفاعلية</TableHead><TableHead>عدد الاستخدام</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.knowledgeBaseUsage?.highestSuccessArticles ?? []).map((item) => (
                    <TableRow key={`${item.id}-best`}><TableCell>{item.title}</TableCell><TableCell>{item.effectiveness_rate}%</TableCell><TableCell>{item.usage_count}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">مقالات متراجعة / منخفضة الجودة</CardTitle></CardHeader>
            <CardContent className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>المادة</TableHead><TableHead>الحالة</TableHead><TableHead>التدهور</TableHead><TableHead>الفاعلية</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.knowledgeBaseUsage?.decliningArticles ?? []).map((item) => (
                    <TableRow key={`${item.id}-decline`}>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{item.lifecycle_state}</TableCell>
                      <TableCell>{Math.round((item.decline_score ?? 0) * 100)}%</TableCell>
                      <TableCell>{item.effectiveness_rate}%</TableCell>
                    </TableRow>
                  ))}
                  {(data?.knowledgeBaseUsage?.decliningArticles ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">لا توجد مواد متراجعة حالياً.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">المعرفة التي تحتاج مراجعة</CardTitle></CardHeader>
            <CardContent className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>المادة</TableHead><TableHead>الحالة</TableHead><TableHead>أولوية المراجعة</TableHead><TableHead>الجودة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.knowledgeBaseUsage?.staleNeedingReview ?? []).map((item) => (
                    <TableRow key={`${item.id}-review`}>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{item.lifecycle_state}</TableCell>
                      <TableCell>{item.review_priority}</TableCell>
                      <TableCell>{Math.round((item.quality_score_v2 ?? 0) * 100)}%</TableCell>
                    </TableRow>
                  ))}
                  {(data?.knowledgeBaseUsage?.staleNeedingReview ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">لا توجد مواد عالقة بالمراجعة.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">أنماط غير محلولة بدون تغطية معرفية جيدة</CardTitle></CardHeader>
            <CardContent className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>رمز الخطأ</TableHead><TableHead>عدد غير المحلول</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.unresolvedWithoutKnowledgeCoverage ?? []).map((item) => (
                    <TableRow key={item.error_code_text}><TableCell>{item.error_code_text}</TableCell><TableCell>{item.unresolved_count}</TableCell></TableRow>
                  ))}
                  {(data?.unresolvedWithoutKnowledgeCoverage ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">لا توجد فجوات تغطية حرجة حاليًا.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">موديلات بضعف تغطية المعرفة</CardTitle></CardHeader>
            <CardContent className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>الموديل</TableHead><TableHead>غير المحلول</TableHead><TableHead>تغطية موثقة</TableHead><TableHead>فجوة التغطية</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.poorCoverageByProduct ?? []).map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.model}</TableCell>
                      <TableCell>{item.unresolved_count}</TableCell>
                      <TableCell>{item.verified_coverage_count}</TableCell>
                      <TableCell>{item.coverage_gap_score}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.poorCoverageByProduct ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">لا توجد فجوات تغطية ظاهرة.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}