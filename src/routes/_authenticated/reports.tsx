import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessContext } from "@/hooks/use-access-context";
import { requireRole } from "@/lib/auth-client";
import { getOperationsReport } from "@/lib/phase2.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: async () => {
    await requireRole(["support_engineer", "manager"]);
  },
  component: ReportsPage,
});

function ReportsPage() {
  const reportFn = useServerFn(getOperationsReport);
  const { data: accessData } = useAccessContext();
  const roles = accessData?.roles ?? [];

  const { data } = useQuery({ queryKey: ["operations-report"], queryFn: () => reportFn() });

  return (
    <AppShell roles={roles} title="التقارير التشغيلية">
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-sm">إجمالي التذاكر</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.totalTickets ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">التذاكر غير المحلولة</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.unresolved ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">المهام المتأخرة</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.delayed ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">إجمالي المهام</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.totalAssignments ?? 0}</CardContent></Card>
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
              <TableHeader><TableRow><TableHead>المهندس</TableHead><TableHead>إجمالي المهام</TableHead><TableHead>مكتملة</TableHead><TableHead>قيد التنفيذ</TableHead></TableRow></TableHeader>
              <TableBody>{(data?.engineerPerformance ?? []).map((item) => <TableRow key={item.engineer_id}><TableCell>{item.engineer_name}</TableCell><TableCell>{item.total}</TableCell><TableCell>{item.completed}</TableCell><TableCell>{item.in_progress}</TableCell></TableRow>)}</TableBody>
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
      </div>
    </AppShell>
  );
}