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