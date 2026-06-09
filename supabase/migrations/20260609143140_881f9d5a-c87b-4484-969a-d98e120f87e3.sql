CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('support_engineer', 'field_engineer', 'manager');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.engineers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  governorate TEXT,
  city TEXT,
  specialization TEXT,
  type TEXT NOT NULL DEFAULT 'internal' CHECK (type IN ('internal','external')),
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available','busy','inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engineers TO authenticated;
GRANT ALL ON public.engineers TO service_role;
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT 'مستخدم جديد',
  phone TEXT UNIQUE,
  email TEXT,
  engineer_id UUID NULL REFERENCES public.engineers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  model TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, model)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.error_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('software','technical')),
  description TEXT,
  common_causes TEXT,
  recommended_solution TEXT,
  occurrences_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_codes TO authenticated;
GRANT ALL ON public.error_codes TO service_role;
ALTER TABLE public.error_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE POLICY "profiles_self_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_self_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_support_full"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "profiles_manager_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "user_roles_self_read"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_roles_support_manage"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "engineers_support_full"
ON public.engineers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "engineers_manager_read"
ON public.engineers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "engineers_field_own_read"
ON public.engineers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.engineer_id = engineers.id
  )
);

CREATE POLICY "product_categories_support_manage"
ON public.product_categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "product_categories_read_roles"
ON public.product_categories
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
  OR public.has_role(auth.uid(), 'support_engineer')
);

CREATE POLICY "brands_support_manage"
ON public.brands
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "brands_read_roles"
ON public.brands
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
  OR public.has_role(auth.uid(), 'support_engineer')
);

CREATE POLICY "products_support_manage"
ON public.products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "products_read_roles"
ON public.products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
  OR public.has_role(auth.uid(), 'support_engineer')
);

CREATE POLICY "error_codes_support_manage"
ON public.error_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "error_codes_read_roles"
ON public.error_codes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
  OR public.has_role(auth.uid(), 'support_engineer')
);

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'مستخدم جديد'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_engineers_updated_at
BEFORE UPDATE ON public.engineers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_error_codes_updated_at
BEFORE UPDATE ON public.error_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_profiles_engineer_id ON public.profiles(engineer_id);
CREATE INDEX idx_engineers_availability_status ON public.engineers(availability_status);
CREATE INDEX idx_engineers_governorate ON public.engineers(governorate);
CREATE INDEX idx_brands_category_id ON public.brands(category_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_brand_id ON public.products(brand_id);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_error_codes_product_id ON public.error_codes(product_id);
CREATE INDEX idx_error_codes_code ON public.error_codes(code);
CREATE INDEX idx_error_codes_category ON public.error_codes(category);
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_override public.app_role;

UPDATE public.profiles p
SET role_override = ur.role
FROM public.user_roles ur
WHERE ur.user_id = p.id
  AND p.role_override IS NULL;

DROP POLICY IF EXISTS "user_roles_support_manage" ON public.user_roles;

CREATE POLICY "user_roles_support_manage"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer') OR public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.user_primary_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.role_override
      FROM public.profiles p
      WHERE p.id = _user_id
    ),
    (
      SELECT ur.role
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
      ORDER BY CASE ur.role
        WHEN 'support_engineer' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'field_engineer' THEN 3
        ELSE 99
      END
      LIMIT 1
    ),
    'field_engineer'::public.app_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_primary_role(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_primary_role(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_primary_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_primary_role(UUID) TO service_role;

CREATE OR REPLACE VIEW public.v_profiles_with_role AS
SELECT
  p.id,
  p.full_name,
  p.phone,
  p.email,
  p.engineer_id,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.role_override,
  public.user_primary_role(p.id) AS primary_role
FROM public.profiles p;

GRANT SELECT ON public.v_profiles_with_role TO authenticated;
GRANT SELECT ON public.v_profiles_with_role TO service_role;

CREATE POLICY "profiles_self_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  governorate TEXT,
  city TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.customer_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  system_name TEXT NOT NULL,
  installation_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, system_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_systems TO authenticated;
GRANT ALL ON public.customer_systems TO service_role;
ALTER TABLE public.customer_systems ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.system_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_system_id UUID NOT NULL REFERENCES public.customer_systems(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  serial_number TEXT,
  warranty_status TEXT CHECK (warranty_status IN ('valid','expired','unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_assets TO authenticated;
GRANT ALL ON public.system_assets TO service_role;
ALTER TABLE public.system_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  issue_description TEXT,
  solution_steps TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  error_code_text TEXT,
  search_keywords TEXT,
  source TEXT NOT NULL DEFAULT 'ticket' CHECK (source IN ('manual','ticket')),
  linked_ticket_ids UUID[] NOT NULL DEFAULT '{}',
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  effectiveness_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN (success_count + fail_count) = 0 THEN 0
    ELSE ROUND((success_count::NUMERIC * 100.0) / (success_count + fail_count), 2)
    END
  ) STORED,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_system_id UUID REFERENCES public.customer_systems(id) ON DELETE SET NULL,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('fault','preventive_maintenance')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved_remote','assigned_field','resolved_field','closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  description TEXT NOT NULL,
  affected_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  error_code_text TEXT,
  remote_solution TEXT,
  knowledge_base_id UUID REFERENCES public.knowledge_base(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  customer_system_id UUID REFERENCES public.customer_systems(id) ON DELETE SET NULL,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE RESTRICT,
  assigned_by UUID,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('repair_visit','installation')),
  scheduled_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  work_done TEXT,
  difficulties TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.knowledge_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  user_id UUID,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_feedback TO authenticated;
GRANT ALL ON public.knowledge_feedback TO service_role;
ALTER TABLE public.knowledge_feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL CHECK (type IN ('assignment','status_change','system')),
  target_role public.app_role,
  target_user_id UUID,
  related_type TEXT,
  related_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_engineer_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT engineer_id FROM public.profiles WHERE id = _user_id
$$;

CREATE POLICY customers_support_full ON public.customers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY customers_manager_read ON public.customers
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY customers_field_assigned_read ON public.customers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    JOIN public.assignments a ON a.ticket_id = t.id
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE t.customer_id = customers.id
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  )
);

CREATE POLICY customer_systems_support_full ON public.customer_systems
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY customer_systems_manager_read ON public.customer_systems
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY customer_systems_field_assigned_read ON public.customer_systems
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.customer_system_id = customer_systems.id
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  )
);

CREATE POLICY system_assets_support_full ON public.system_assets
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY system_assets_manager_read ON public.system_assets
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY system_assets_field_assigned_read ON public.system_assets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.customer_system_id = system_assets.customer_system_id
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  )
);

CREATE POLICY tickets_support_full ON public.tickets
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY tickets_manager_read ON public.tickets
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY tickets_field_assigned_read ON public.tickets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.ticket_id = tickets.id
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  )
);

CREATE POLICY knowledge_base_support_full ON public.knowledge_base
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY knowledge_base_manager_read ON public.knowledge_base
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY knowledge_base_field_read ON public.knowledge_base
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'field_engineer'));

CREATE POLICY assignments_support_full ON public.assignments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY assignments_manager_read ON public.assignments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY assignments_field_own_read ON public.assignments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.engineer_id IS NOT NULL
      AND assignments.engineer_id = p.engineer_id
  )
);

CREATE POLICY assignments_field_own_update ON public.assignments
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.engineer_id IS NOT NULL
      AND assignments.engineer_id = p.engineer_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.engineer_id IS NOT NULL
      AND assignments.engineer_id = p.engineer_id
  )
);

CREATE POLICY attachments_support_full ON public.attachments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY attachments_manager_read ON public.attachments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY attachments_field_assigned_read ON public.attachments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE (
      (attachments.assignment_id IS NOT NULL AND a.id = attachments.assignment_id)
      OR (attachments.ticket_id IS NOT NULL AND a.ticket_id = attachments.ticket_id)
    )
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  )
);

CREATE POLICY knowledge_feedback_support_full ON public.knowledge_feedback
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY knowledge_feedback_field_insert ON public.knowledge_feedback
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'field_engineer') AND user_id = auth.uid());

CREATE POLICY knowledge_feedback_manager_read ON public.knowledge_feedback
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY notifications_support_full ON public.notifications
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY notifications_read_scoped ON public.notifications
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR target_user_id = auth.uid()
  OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role))
  OR target_role IS NULL
);

CREATE POLICY notification_reads_self_manage ON public.notification_reads
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_systems_updated_at
BEFORE UPDATE ON public.customer_systems
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_assets_updated_at
BEFORE UPDATE ON public.system_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attachments_updated_at
BEFORE UPDATE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customer_systems_customer_id ON public.customer_systems(customer_id);
CREATE INDEX idx_system_assets_customer_system_id ON public.system_assets(customer_system_id);
CREATE INDEX idx_system_assets_product_id ON public.system_assets(product_id);
CREATE INDEX idx_knowledge_base_product_id ON public.knowledge_base(product_id);
CREATE INDEX idx_knowledge_base_error_code_text ON public.knowledge_base(error_code_text);
CREATE INDEX idx_knowledge_base_search_keywords ON public.knowledge_base USING gin(to_tsvector('simple', coalesce(search_keywords,'')));
CREATE INDEX idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX idx_tickets_affected_product_id ON public.tickets(affected_product_id);
CREATE INDEX idx_assignments_ticket_id ON public.assignments(ticket_id);
CREATE INDEX idx_assignments_engineer_id ON public.assignments(engineer_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_scheduled_date ON public.assignments(scheduled_date);
CREATE INDEX idx_attachments_ticket_id ON public.attachments(ticket_id);
CREATE INDEX idx_attachments_assignment_id ON public.attachments(assignment_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_target_user_id ON public.notifications(target_user_id);
CREATE INDEX idx_notification_reads_user_id ON public.notification_reads(user_id);
CREATE INDEX idx_notification_reads_notification_id ON public.notification_reads(notification_id);
CREATE INDEX idx_knowledge_feedback_knowledge_base_id ON public.knowledge_feedback(knowledge_base_id);

-- Trigger to enforce allowed transitions for tickets.status
CREATE OR REPLACE FUNCTION public.enforce_ticket_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'open' AND NEW.status IN ('in_progress', 'assigned_field', 'closed') THEN
    RETURN NEW;
  ELSIF OLD.status = 'in_progress' AND NEW.status IN ('resolved_remote', 'assigned_field', 'closed') THEN
    RETURN NEW;
  ELSIF OLD.status = 'assigned_field' AND NEW.status IN ('resolved_field', 'closed') THEN
    RETURN NEW;
  ELSIF OLD.status = 'resolved_remote' AND NEW.status IN ('closed', 'assigned_field') THEN
    RETURN NEW;
  ELSIF OLD.status = 'resolved_field' AND NEW.status IN ('closed') THEN
    RETURN NEW;
  ELSIF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'لا يمكن تغيير حالة تذكرة مغلقة';
  END IF;

  RAISE EXCEPTION 'انتقال حالة غير مسموح من % إلى %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_status_transition ON public.tickets;
CREATE TRIGGER trg_ticket_status_transition
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ticket_status_transition();

-- Ensure assignment closure writes completed_at
CREATE OR REPLACE FUNCTION public.set_assignment_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  IF NEW.status <> 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_completed_at ON public.assignments;
CREATE TRIGGER trg_assignments_completed_at
BEFORE INSERT OR UPDATE OF status ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_assignment_completed_at();

-- Trigger to validate attachments relation
CREATE OR REPLACE FUNCTION public.validate_attachment_relation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_id IS NULL AND NEW.assignment_id IS NULL THEN
    RAISE EXCEPTION 'يجب ربط المرفق بتذكرة أو تكليف على الأقل';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_attachment_relation ON public.attachments;
CREATE TRIGGER trg_validate_attachment_relation
BEFORE INSERT OR UPDATE ON public.attachments
FOR EACH ROW
EXECUTE FUNCTION public.validate_attachment_relation();

-- Seed default roles for existing profiles without roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'support_engineer'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Notification trigger when assignment inserted
CREATE OR REPLACE FUNCTION public.notify_assignment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  SELECT public.user_primary_role(p.id)
  INTO _role
  FROM public.profiles p
  WHERE p.engineer_id = NEW.engineer_id
  LIMIT 1;

  INSERT INTO public.notifications(title, body, type, target_role, target_user_id, related_type, related_id, created_by)
  VALUES (
    'تكليف جديد',
    'تم إسناد تكليف جديد لك.',
    'assignment',
    _role,
    NULL,
    'assignment',
    NEW.id,
    NEW.assigned_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_assignment_created ON public.assignments;
CREATE TRIGGER trg_notify_assignment_created
AFTER INSERT ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.notify_assignment_created();

-- Notification trigger when ticket status changes
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(title, body, type, target_role, target_user_id, related_type, related_id, created_by)
    VALUES (
      'تحديث حالة تذكرة',
      format('تم تغيير حالة التذكرة إلى %s', NEW.status),
      'status_change',
      NULL,
      NEW.created_by,
      'ticket',
      NEW.id,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_status_change ON public.tickets;
CREATE TRIGGER trg_notify_ticket_status_change
AFTER UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_status_change();

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.enrich_ticket_status_meta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();

    IF NEW.status_updated_by IS NULL THEN
      NEW.status_updated_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_status_meta ON public.tickets;
CREATE TRIGGER trg_tickets_status_meta
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.enrich_ticket_status_meta();

-- Ensure support engineers and managers can read full catalog tables for pickers
DROP POLICY IF EXISTS product_categories_read_roles ON public.product_categories;
CREATE POLICY product_categories_read_roles
ON public.product_categories
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
);

DROP POLICY IF EXISTS brands_read_roles ON public.brands;
CREATE POLICY brands_read_roles
ON public.brands
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
);

DROP POLICY IF EXISTS products_read_roles ON public.products;
CREATE POLICY products_read_roles
ON public.products
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
);

DROP POLICY IF EXISTS error_codes_read_roles ON public.error_codes;
CREATE POLICY error_codes_read_roles
ON public.error_codes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'field_engineer')
);
-- Trigger to backfill user_roles from profile role_override
CREATE OR REPLACE FUNCTION public.sync_user_roles_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role_override IS NULL THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = NEW.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, NEW.role_override)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_roles_from_profile ON public.profiles;
CREATE TRIGGER trg_sync_user_roles_from_profile
AFTER INSERT OR UPDATE OF role_override ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_roles_from_profile();

-- Grant support engineer and manager read on all profiles
DROP POLICY IF EXISTS profiles_manager_read ON public.profiles;
CREATE POLICY profiles_manager_read
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'support_engineer')
);

-- Ensure support engineer can insert user roles
DROP POLICY IF EXISTS user_roles_support_manage ON public.user_roles;
CREATE POLICY user_roles_support_manage
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'support_engineer')
  OR public.has_role(auth.uid(), 'manager')
);
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS partial_fail_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.knowledge_base
  DROP COLUMN IF EXISTS effectiveness_rate;

ALTER TABLE public.knowledge_base
  ADD COLUMN effectiveness_rate NUMERIC(5,2)
  GENERATED ALWAYS AS (
    CASE
      WHEN (success_count + fail_count + partial_fail_count) = 0 THEN 0
      ELSE ROUND((success_count::NUMERIC * 100.0) / (success_count + fail_count + partial_fail_count), 2)
    END
  ) STORED;
