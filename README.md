# Energie Connect — نظام إدارة الصيانة والخدمة الميدانية

منصة تشغيلية لإدارة فرق الصيانة الميدانية في شركات الطاقة الشمسية (مهندسون، منتجات، أعطال، عملاء، تذاكر، تكليفات، تقارير).

## 1) متطلبات التشغيل المحلي

- **Bun** (مستحسن) أو Node.js حديث
- مشروع مرتبط بـ **Lovable Cloud** ومفعل فيه قاعدة البيانات
- متغيرات البيئة الأساسية (انظر قسم البيئة)

## 2) تثبيت وتشغيل التطبيق

```bash
bun install
bun run dev
```

سيعمل التطبيق محليًا عادة على:

`http://localhost:8080`

## 3) متغيرات البيئة (Environment Variables)

ضع المتغيرات التالية في `.env` أثناء التطوير المحلي:

```env
SUPABASE_PROJECT_ID=your_project_id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

> ملاحظات مهمة:
>
> - مفاتيح **publishable** آمنة للعميل ويمكن وجودها في الكود/البيئة الأمامية.
> - مفتاح **SUPABASE_SERVICE_ROLE_KEY** يجب أن يكون **سريًا** ويوضع في Secrets الخاصة بالمشروع (وليس داخل الكود).
> - وظائف Admin/Seed في الخادم تعتمد على وجود مفاتيح الخادم داخل بيئة Lovable Cloud.

## 4) قاعدة البيانات والهجرات (Migrations)

ملفات الهجرات موجودة في:

`supabase/migrations/`

أهم ما تم إنشاؤه:

- جداول الأساس: `engineers`, `profiles`, `user_roles`, `product_categories`, `brands`, `products`, `error_codes`
- جداول التشغيل: `customers`, `customer_systems`, `system_assets`, `tickets`, `assignments`, `attachments`, `knowledge_base`, `knowledge_feedback`, `notifications`, `notification_reads`
- تفعيل RLS وسياسات صلاحيات حسب الأدوار (`support_engineer`, `field_engineer`, `manager`)

### طريقة تطبيق الهجرات

1. من لوحة المشروع، افتح قسم قاعدة البيانات/الهجرات.
2. شغّل كل ملفات الهجرات بالترتيب الزمني.
3. تأكد أن كل الجداول المذكورة بالأعلى موجودة.

## 5) تجهيز بيانات تجريبية (Seed)

تم إضافة Seeder آمن داخل الخادم لتعبئة بيانات تجريبية مباشرة.

### من داخل التطبيق

1. سجّل الدخول بحساب يمتلك دور `support_engineer`.
2. افتح صفحة: **لوحة التحكم**.
3. اضغط زر: **"تأكيد الهجرات وإدخال بيانات تجريبية"**.

سيتم:

- فحص الجداول الأساسية
- إدخال/تحديث بيانات تجريبية (فئات، منتجات، أعطال، مهندسون، عملاء، أنظمة، تذاكر، تكليفات، إشعارات)
- إظهار مقارنة أعداد السجلات قبل/بعد التنفيذ

> التنفيذ Idempotent قدر الإمكان (لا يكرر نفس seed بسهولة عند إعادة التشغيل).

## 6) أدوار المستخدمين

- `support_engineer`: إدارة وتشغيل كامل
- `field_engineer`: متابعة المهام المسندة وتحديث التقارير
- `manager`: قراءة المؤشرات والتقارير التنفيذية

## 7) بنية المشروع المختصرة

- `src/routes/` صفحات التطبيق
- `src/routes/_authenticated/` الصفحات المحمية بعد تسجيل الدخول
- `src/lib/phase1.functions.ts` وظائف المرحلة 1 (المهندسون/الكتالوج/أكواد الأعطال/لوحة البداية)
- `src/lib/phase2.functions.ts` وظائف المرحلة 2 (العملاء/التذاكر/التكليفات/التقارير/الإشعارات)
- `src/lib/demo-seed.server.ts` Seeder وتجميع حالة الجداول
- `supabase/migrations/` سكربتات إنشاء/تعديل بنية قاعدة البيانات

## 8) استكشاف الأعطال السريع

- إذا ظهرت رسالة Missing env vars: راجع `.env` وSecrets.
- إذا الصفحات المحمية تعيدك إلى تسجيل الدخول: تحقق من الجلسة وصحة مفاتيح البيئة.
- إذا البيانات فارغة: نفّذ زر الـ Seed من لوحة التحكم بحساب دعم.

---

إذا رغبت، أضيف لك في الخطوة التالية **حسابات تجريبية جاهزة** (Support/Manager/Field) مع سكربت إنشاء مستخدمين وربط أدوارهم تلقائيًا.
