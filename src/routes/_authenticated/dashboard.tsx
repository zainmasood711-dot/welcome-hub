import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Boxes, LayoutGrid, Users, Wrench } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardOverview } from "@/lib/phase1.functions";
import { requireAuthenticatedUser } from "@/lib/auth-client";
import { useAccessContext } from "@/hooks/use-access-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    await requireAuthenticatedUser();
  },
  component: DashboardPage,
});

function DashboardPage() {
  const overviewFn = useServerFn(getDashboardOverview);
  const { data: accessData } = useAccessContext();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => overviewFn(),
  });

  const roles = accessData?.roles ?? [];

  if (isLoading) {
    return (
      <AppShell roles={roles} title="لوحة التحكم">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">جاري تحميل لوحة التحكم...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell roles={roles} title="لوحة التحكم">
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">
          تعذر تحميل بيانات لوحة التحكم.
        </div>
      </AppShell>
    );
  }

  const summaryCards = [
    { title: "المهندسون", value: data.summary.engineers, icon: Users },
    { title: "الفئات", value: data.summary.categories, icon: LayoutGrid },
    { title: "العلامات", value: data.summary.brands, icon: Boxes },
    { title: "المنتجات", value: data.summary.products, icon: Wrench },
    { title: "رموز الأعطال", value: data.summary.errorCodes, icon: AlertTriangle },
  ];

  const engineersState = [
    { label: "متاح", value: data.engineersByAvailability.available },
    { label: "مشغول", value: data.engineersByAvailability.busy },
    { label: "غير نشط", value: data.engineersByAvailability.inactive },
  ];

  const codeCategories = [
    { name: "تقني", value: data.errorCodeByCategory.technical },
    { name: "برمجي", value: data.errorCodeByCategory.software },
  ];

  return (
    <AppShell roles={roles} title="لوحة التحكم">
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    {card.title}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزيع حالة المهندسين</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engineersState}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">أنواع رموز الأعطال</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={codeCategories} dataKey="value" nameKey="name" outerRadius={100} fill="var(--color-secondary)" />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">أكثر رموز الأعطال تكرارًا</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.topErrorCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات كافية بعد.</p>
              ) : (
                data.topErrorCodes.map((item) => (
                  <Badge key={item.code} variant="secondary">
                    {item.code} · {item.count}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}