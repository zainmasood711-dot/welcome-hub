-- Remove direct manager read access from operational tables
DROP POLICY IF EXISTS assignments_manager_read ON public.assignments;
DROP POLICY IF EXISTS attachments_manager_read ON public.attachments;
DROP POLICY IF EXISTS customer_systems_manager_read ON public.customer_systems;
DROP POLICY IF EXISTS customers_manager_read ON public.customers;
DROP POLICY IF EXISTS engineers_manager_read ON public.engineers;
DROP POLICY IF EXISTS knowledge_base_manager_read ON public.knowledge_base;
DROP POLICY IF EXISTS knowledge_feedback_manager_read ON public.knowledge_feedback;
DROP POLICY IF EXISTS notifications_manager_read ON public.notifications;
DROP POLICY IF EXISTS profiles_manager_read ON public.profiles;
DROP POLICY IF EXISTS system_assets_manager_read ON public.system_assets;
DROP POLICY IF EXISTS tickets_manager_read ON public.tickets;
DROP POLICY IF EXISTS audit_logs_manager_read ON public.audit_logs;

-- Re-scope read policies to support + field only where manager was included in shared role policy
DROP POLICY IF EXISTS product_categories_read_roles ON public.product_categories;
CREATE POLICY product_categories_read_roles
ON public.product_categories
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'field_engineer')
);

DROP POLICY IF EXISTS brands_read_roles ON public.brands;
CREATE POLICY brands_read_roles
ON public.brands
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'field_engineer')
);

DROP POLICY IF EXISTS products_read_roles ON public.products;
CREATE POLICY products_read_roles
ON public.products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'field_engineer')
);

DROP POLICY IF EXISTS error_codes_read_roles ON public.error_codes;
CREATE POLICY error_codes_read_roles
ON public.error_codes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'field_engineer')
);