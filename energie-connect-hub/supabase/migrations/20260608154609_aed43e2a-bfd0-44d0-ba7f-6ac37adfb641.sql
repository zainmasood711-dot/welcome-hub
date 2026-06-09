-- 1) Audit table for sensitive actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_support_read_all"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "audit_logs_manager_read"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "audit_logs_insert_self"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2) Attachment constraints and validation function
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_file_size_limit_check
  CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 20971520));

CREATE OR REPLACE FUNCTION public.validate_attachment_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ext TEXT;
  allowed_exts TEXT[] := ARRAY['jpg','jpeg','png','webp','gif','pdf','doc','docx','xls','xlsx','csv','txt','bin'];
BEGIN
  IF NEW.file_path IS NULL OR length(trim(NEW.file_path)) = 0 THEN
    RAISE EXCEPTION 'file_path is required';
  END IF;

  IF NEW.file_size IS NOT NULL AND (NEW.file_size < 0 OR NEW.file_size > 20971520) THEN
    RAISE EXCEPTION 'file_size exceeds 20MB limit';
  END IF;

  ext := lower(split_part(NEW.file_path, '.', array_length(string_to_array(NEW.file_path, '.'), 1)));
  IF ext IS NULL OR ext = '' OR NOT (ext = ANY (allowed_exts)) THEN
    RAISE EXCEPTION 'unsupported file extension';
  END IF;

  IF NEW.file_type = 'image' AND NOT (ext = ANY (ARRAY['jpg','jpeg','png','webp','gif'])) THEN
    RAISE EXCEPTION 'file_type image requires image extension';
  ELSIF NEW.file_type = 'document' AND NOT (ext = ANY (ARRAY['pdf','doc','docx','xls','xlsx','csv','txt'])) THEN
    RAISE EXCEPTION 'file_type document requires document extension';
  ELSIF NEW.file_type = 'battery_file' AND NOT (ext = ANY (ARRAY['csv','xlsx','txt','bin'])) THEN
    RAISE EXCEPTION 'file_type battery_file requires battery extension';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_attachment_metadata_trigger ON public.attachments;
CREATE TRIGGER validate_attachment_metadata_trigger
BEFORE INSERT OR UPDATE ON public.attachments
FOR EACH ROW
EXECUTE FUNCTION public.validate_attachment_metadata();

-- 3) Role-aware storage access helper for assignment/ticket-linked attachments
CREATE OR REPLACE FUNCTION public.can_access_attachment_path(_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attachments att
    LEFT JOIN public.assignments a
      ON (
        (att.attachable_type = 'assignment' AND a.id = att.attachable_id)
        OR (att.attachable_type = 'ticket' AND a.ticket_id = att.attachable_id)
      )
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE att.file_path = _path
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_attachment_path(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_path(TEXT) TO service_role;

-- 4) Tighten storage policies for field-attachments bucket
DROP POLICY IF EXISTS storage_field_attachments_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS storage_field_attachments_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS storage_field_attachments_authenticated_delete ON storage.objects;

CREATE POLICY storage_field_attachments_authenticated_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'field-attachments'
  AND (
    public.has_role(auth.uid(), 'support_engineer')
    OR owner = auth.uid()
    OR public.can_access_attachment_path(name)
  )
);

CREATE POLICY storage_field_attachments_authenticated_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'field-attachments'
  AND (
    public.has_role(auth.uid(), 'support_engineer')
    OR owner = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'field-attachments'
  AND (
    public.has_role(auth.uid(), 'support_engineer')
    OR owner = auth.uid()
  )
);

CREATE POLICY storage_field_attachments_authenticated_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'field-attachments'
  AND (
    public.has_role(auth.uid(), 'support_engineer')
    OR owner = auth.uid()
  )
);

-- 5) Ensure manager policies are read-only on operational tables (drop/write manager if any existed)
DROP POLICY IF EXISTS customers_manager_write ON public.customers;
DROP POLICY IF EXISTS customer_systems_manager_write ON public.customer_systems;
DROP POLICY IF EXISTS tickets_manager_write ON public.tickets;
DROP POLICY IF EXISTS assignments_manager_write ON public.assignments;
DROP POLICY IF EXISTS attachments_manager_write ON public.attachments;
DROP POLICY IF EXISTS engineers_manager_write ON public.engineers;
DROP POLICY IF EXISTS knowledge_base_manager_write ON public.knowledge_base;
DROP POLICY IF EXISTS system_assets_manager_write ON public.system_assets;
DROP POLICY IF EXISTS knowledge_feedback_manager_write ON public.knowledge_feedback;

-- 6) Audit helper and triggers for sensitive operational tables
CREATE OR REPLACE FUNCTION public.log_sensitive_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_user UUID := auth.uid();
  entity UUID;
BEGIN
  entity := COALESCE(NEW.id, OLD.id);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    effective_user,
    TG_OP,
    TG_TABLE_NAME,
    entity,
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_customers_sensitive ON public.customers;
CREATE TRIGGER audit_customers_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_customer_systems_sensitive ON public.customer_systems;
CREATE TRIGGER audit_customer_systems_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.customer_systems
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_tickets_sensitive ON public.tickets;
CREATE TRIGGER audit_tickets_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_assignments_sensitive ON public.assignments;
CREATE TRIGGER audit_assignments_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_attachments_sensitive ON public.attachments;
CREATE TRIGGER audit_attachments_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_knowledge_base_sensitive ON public.knowledge_base;
CREATE TRIGGER audit_knowledge_base_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_products_sensitive ON public.products;
CREATE TRIGGER audit_products_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

DROP TRIGGER IF EXISTS audit_error_codes_sensitive ON public.error_codes;
CREATE TRIGGER audit_error_codes_sensitive
AFTER INSERT OR UPDATE OR DELETE ON public.error_codes
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();