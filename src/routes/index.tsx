import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نظام إدارة الصيانة والخدمة الميدانية" },
      {
        name: "description",
        content: "منصة عربية لإدارة مهندسي الصيانة والمنتجات ورموز الأعطال لشركات الطاقة الشمسية.",
      },
      { property: "og:title", content: "نظام إدارة الصيانة والخدمة الميدانية" },
      {
        property: "og:description",
        content: "منصة عربية لإدارة مهندسي الصيانة والمنتجات ورموز الأعطال لشركات الطاقة الشمسية.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Solar Maintenance &amp; Field Service Management System
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          نظام تشغيلي عربي لإدارة فرق الدعم والصيانة الميدانية، الفئات والعلامات والمنتجات، ورموز الأعطال في
          شركات الطاقة الشمسية.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/auth">تسجيل الدخول</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/dashboard">الدخول إلى لوحة التحكم</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
