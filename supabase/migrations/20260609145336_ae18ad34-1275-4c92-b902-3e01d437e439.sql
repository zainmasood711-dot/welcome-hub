ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS normalized_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS classification_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS derived_resolution_type text,
  ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS dedupe_signature text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.knowledge_base(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS freshness_score numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

ALTER TABLE public.knowledge_base
  DROP CONSTRAINT IF EXISTS knowledge_base_content_source_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_derived_resolution_type_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_verification_state_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_review_state_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_confidence_level_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_confidence_score_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_quality_score_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_freshness_score_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_duplicate_self_check;

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_content_source_check CHECK (content_source IN ('manual', 'auto_from_ticket', 'auto_from_assignment', 'hybrid')),
  ADD CONSTRAINT knowledge_base_derived_resolution_type_check CHECK (derived_resolution_type IS NULL OR derived_resolution_type IN ('remote', 'field', 'bring_to_center', 'no_fix_needed', 'unknown')),
  ADD CONSTRAINT knowledge_base_verification_state_check CHECK (verification_state IN ('verified', 'needs_review')),
  ADD CONSTRAINT knowledge_base_review_state_check CHECK (review_state IN ('pending', 'approved', 'rejected')),
  ADD CONSTRAINT knowledge_base_confidence_level_check CHECK (confidence_level IN ('low', 'medium', 'high')),
  ADD CONSTRAINT knowledge_base_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ADD CONSTRAINT knowledge_base_quality_score_check CHECK (quality_score >= 0 AND quality_score <= 1),
  ADD CONSTRAINT knowledge_base_freshness_score_check CHECK (freshness_score >= 0 AND freshness_score <= 1),
  ADD CONSTRAINT knowledge_base_duplicate_self_check CHECK (duplicate_of IS NULL OR duplicate_of <> id);

ALTER TABLE public.knowledge_feedback
  ADD COLUMN IF NOT EXISTS context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feedback_weight numeric(5,2) NOT NULL DEFAULT 1.00;

ALTER TABLE public.knowledge_feedback
  DROP CONSTRAINT IF EXISTS knowledge_feedback_feedback_weight_check;

ALTER TABLE public.knowledge_feedback
  ADD CONSTRAINT knowledge_feedback_feedback_weight_check CHECK (feedback_weight > 0 AND feedback_weight <= 2);

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS normalized_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS classification_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_source text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS dedupe_signature text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS freshness_score numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS related_resolution_type text,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_content_source_check,
  DROP CONSTRAINT IF EXISTS attachments_verification_state_check,
  DROP CONSTRAINT IF EXISTS attachments_review_state_check,
  DROP CONSTRAINT IF EXISTS attachments_confidence_level_check,
  DROP CONSTRAINT IF EXISTS attachments_confidence_score_check,
  DROP CONSTRAINT IF EXISTS attachments_quality_score_check,
  DROP CONSTRAINT IF EXISTS attachments_freshness_score_check,
  DROP CONSTRAINT IF EXISTS attachments_related_resolution_type_check,
  DROP CONSTRAINT IF EXISTS attachments_duplicate_self_check,
  DROP CONSTRAINT IF EXISTS attachments_attachable_consistency_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_content_source_check CHECK (content_source IN ('uploaded', 'ticket_report', 'assignment_report', 'knowledge_supporting')),
  ADD CONSTRAINT attachments_verification_state_check CHECK (verification_state IN ('verified', 'needs_review')),
  ADD CONSTRAINT attachments_review_state_check CHECK (review_state IN ('pending', 'approved', 'rejected')),
  ADD CONSTRAINT attachments_confidence_level_check CHECK (confidence_level IN ('low', 'medium', 'high')),
  ADD CONSTRAINT attachments_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ADD CONSTRAINT attachments_quality_score_check CHECK (quality_score >= 0 AND quality_score <= 1),
  ADD CONSTRAINT attachments_freshness_score_check CHECK (freshness_score >= 0 AND freshness_score <= 1),
  ADD CONSTRAINT attachments_related_resolution_type_check CHECK (related_resolution_type IS NULL OR related_resolution_type IN ('remote', 'field', 'bring_to_center', 'no_fix_needed', 'unknown')),
  ADD CONSTRAINT attachments_duplicate_self_check CHECK (duplicate_of IS NULL OR duplicate_of <> id),
  ADD CONSTRAINT attachments_attachable_consistency_check CHECK ((attachable_type IS NOT NULL AND attachable_id IS NOT NULL) OR assignment_id IS NOT NULL OR ticket_id IS NOT NULL);

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS archive_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS classification_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archiving_freshness_at timestamptz;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS archive_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS classification_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archiving_freshness_at timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS normalized_model text;

ALTER TABLE public.error_codes
  ADD COLUMN IF NOT EXISTS normalized_code text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS normalized_name text;

ALTER TABLE public.customer_systems
  ADD COLUMN IF NOT EXISTS normalized_system_name text;

UPDATE public.products
SET normalized_model = lower(trim(model))
WHERE normalized_model IS NULL;

UPDATE public.error_codes
SET normalized_code = lower(trim(code))
WHERE normalized_code IS NULL;

UPDATE public.customers
SET normalized_name = lower(trim(name))
WHERE normalized_name IS NULL;

UPDATE public.customer_systems
SET normalized_system_name = lower(trim(system_name))
WHERE normalized_system_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_normalized_tags_gin ON public.knowledge_base USING gin (normalized_tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_dedupe_signature ON public.knowledge_base(dedupe_signature);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_review_state ON public.knowledge_base(review_state, verification_state);
CREATE INDEX IF NOT EXISTS idx_attachments_normalized_tags_gin ON public.attachments USING gin (normalized_tags);
CREATE INDEX IF NOT EXISTS idx_attachments_dedupe_signature ON public.attachments(dedupe_signature);
CREATE INDEX IF NOT EXISTS idx_tickets_archive_tags_gin ON public.tickets USING gin (archive_tags);
CREATE INDEX IF NOT EXISTS idx_assignments_archive_tags_gin ON public.assignments USING gin (archive_tags);
CREATE INDEX IF NOT EXISTS idx_products_normalized_model ON public.products(normalized_model);
CREATE INDEX IF NOT EXISTS idx_error_codes_normalized_code ON public.error_codes(normalized_code);
CREATE INDEX IF NOT EXISTS idx_customers_normalized_name ON public.customers(normalized_name);
CREATE INDEX IF NOT EXISTS idx_customer_systems_normalized_system_name ON public.customer_systems(normalized_system_name);

CREATE OR REPLACE FUNCTION public.refresh_ticket_archive_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _product_model text;
  _error_code text;
BEGIN
  IF NEW.affected_product_id IS NOT NULL THEN
    SELECT p.normalized_model INTO _product_model
    FROM public.products p
    WHERE p.id = NEW.affected_product_id;
  END IF;

  IF NEW.error_code_id IS NOT NULL THEN
    SELECT e.normalized_code INTO _error_code
    FROM public.error_codes e
    WHERE e.id = NEW.error_code_id;
  ELSIF NEW.error_code_text IS NOT NULL THEN
    _error_code := lower(trim(NEW.error_code_text));
  END IF;

  NEW.archive_tags := array_remove(ARRAY[
    lower(trim(COALESCE(NEW.ticket_type, ''))),
    lower(trim(COALESCE(NEW.priority, ''))),
    lower(trim(COALESCE(NEW.status, ''))),
    _product_model,
    _error_code
  ]::text[], '');

  NEW.classification_metadata := jsonb_strip_nulls(jsonb_build_object(
    'ticket_type', NEW.ticket_type,
    'priority', NEW.priority,
    'status', NEW.status,
    'solution_type', NEW.solution_type,
    'affected_product_id', NEW.affected_product_id,
    'error_code_id', NEW.error_code_id,
    'error_code_text', NEW.error_code_text,
    'customer_system_id', NEW.customer_system_id
  ));

  NEW.archiving_freshness_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_assignment_archive_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _ticket_type text;
  _error_code text;
  _product_model text;
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.ticket_type,
           COALESCE(lower(trim(t.error_code_text)), e.normalized_code),
           p.normalized_model
    INTO _ticket_type, _error_code, _product_model
    FROM public.tickets t
    LEFT JOIN public.error_codes e ON e.id = t.error_code_id
    LEFT JOIN public.products p ON p.id = t.affected_product_id
    WHERE t.id = NEW.ticket_id;
  END IF;

  NEW.archive_tags := array_remove(ARRAY[
    lower(trim(COALESCE(NEW.assignment_type, ''))),
    lower(trim(COALESCE(NEW.status, ''))),
    _ticket_type,
    _error_code,
    _product_model
  ]::text[], '');

  NEW.classification_metadata := jsonb_strip_nulls(jsonb_build_object(
    'assignment_type', NEW.assignment_type,
    'status', NEW.status,
    'ticket_id', NEW.ticket_id,
    'customer_system_id', NEW.customer_system_id,
    'engineer_id', NEW.engineer_id,
    'scheduled_date', NEW.scheduled_date,
    'submitted_at', NEW.submitted_at
  ));

  NEW.archiving_freshness_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enrich_attachment_archiving_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _ticket_id uuid;
  _assignment_type text;
  _ticket_type text;
  _resolution_type text;
  _error_code text;
  _product_model text;
  _quality numeric := 0.40;
  _confidence numeric := 0.45;
  _freshness numeric := 0.60;
  _dup_id uuid;
BEGIN
  IF NEW.file_path IS NULL OR length(trim(NEW.file_path)) < 3 THEN
    RAISE EXCEPTION 'مسار الملف غير صالح للأرشفة';
  END IF;

  IF NEW.attachable_type = 'assignment' OR NEW.assignment_id IS NOT NULL THEN
    SELECT a.id, a.ticket_id, a.assignment_type
      INTO NEW.assignment_id, _ticket_id, _assignment_type
    FROM public.assignments a
    WHERE a.id = COALESCE(NEW.assignment_id, NEW.attachable_id);
  END IF;

  IF NEW.attachable_type = 'ticket' OR NEW.ticket_id IS NOT NULL THEN
    _ticket_id := COALESCE(NEW.ticket_id, NEW.attachable_id);
  END IF;

  IF _ticket_id IS NOT NULL THEN
    SELECT t.ticket_type,
           COALESCE(t.solution_type, 'unknown'),
           COALESCE(lower(trim(t.error_code_text)), e.normalized_code),
           p.normalized_model
      INTO _ticket_type, _resolution_type, _error_code, _product_model
    FROM public.tickets t
    LEFT JOIN public.error_codes e ON e.id = t.error_code_id
    LEFT JOIN public.products p ON p.id = t.affected_product_id
    WHERE t.id = _ticket_id;

    NEW.ticket_id := _ticket_id;
  END IF;

  NEW.content_source := CASE
    WHEN NEW.attachable_type = 'assignment' THEN 'assignment_report'
    WHEN NEW.attachable_type = 'ticket' THEN 'ticket_report'
    WHEN NEW.attachable_type = 'knowledge_base' THEN 'knowledge_supporting'
    ELSE 'uploaded'
  END;

  NEW.related_resolution_type := COALESCE(_resolution_type, 'unknown');

  NEW.normalized_tags := array_remove(ARRAY[
    lower(trim(COALESCE(NEW.file_type, ''))),
    lower(trim(COALESCE(NEW.attachable_type, ''))),
    lower(trim(COALESCE(_assignment_type, ''))),
    lower(trim(COALESCE(_ticket_type, ''))),
    _error_code,
    _product_model
  ]::text[], '');

  NEW.classification_metadata := jsonb_strip_nulls(jsonb_build_object(
    'attachable_type', NEW.attachable_type,
    'attachable_id', NEW.attachable_id,
    'assignment_id', NEW.assignment_id,
    'ticket_id', NEW.ticket_id,
    'file_type', NEW.file_type,
    'assignment_type', _assignment_type,
    'ticket_type', _ticket_type,
    'resolution_type', NEW.related_resolution_type,
    'error_code', _error_code,
    'product_model', _product_model
  ));

  IF NEW.file_type = 'image' THEN
    _quality := _quality + 0.15;
  ELSE
    _quality := _quality + 0.10;
  END IF;

  IF COALESCE(length(trim(NEW.description)), 0) >= 20 THEN
    _quality := _quality + 0.15;
  END IF;

  IF NEW.file_size IS NOT NULL AND NEW.file_size > 0 THEN
    _quality := _quality + 0.15;
  END IF;

  IF NEW.ticket_id IS NOT NULL OR NEW.assignment_id IS NOT NULL THEN
    _confidence := _confidence + 0.20;
  END IF;

  IF array_length(NEW.normalized_tags, 1) >= 3 THEN
    _confidence := _confidence + 0.15;
  END IF;

  _quality := LEAST(1, GREATEST(0, _quality));
  _confidence := LEAST(1, GREATEST(0, _confidence));

  NEW.quality_score := round(_quality::numeric, 2);
  NEW.confidence_score := round(_confidence::numeric, 2);
  NEW.confidence_level := CASE
    WHEN NEW.confidence_score >= 0.75 THEN 'high'
    WHEN NEW.confidence_score >= 0.45 THEN 'medium'
    ELSE 'low'
  END;

  NEW.verification_state := CASE WHEN NEW.confidence_score >= 0.70 THEN 'verified' ELSE 'needs_review' END;
  NEW.review_state := CASE WHEN NEW.confidence_score >= 0.70 THEN 'approved' ELSE 'pending' END;

  NEW.dedupe_signature := md5(
    COALESCE(lower(trim(NEW.original_name)), '') || '|' ||
    COALESCE(NEW.file_size::text, '') || '|' ||
    COALESCE(lower(trim(NEW.file_type)), '') || '|' ||
    COALESCE(lower(trim(NEW.attachable_type)), '') || '|' ||
    COALESCE(NEW.attachable_id::text, '')
  );

  SELECT a.id
  INTO _dup_id
  FROM public.attachments a
  WHERE a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND a.dedupe_signature = NEW.dedupe_signature
  ORDER BY a.created_at ASC
  LIMIT 1;

  NEW.duplicate_of := _dup_id;
  NEW.freshness_score := round(_freshness::numeric, 2);
  NEW.last_enriched_at := now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enrich_knowledge_archiving_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _ticket_id uuid;
  _ticket_type text;
  _assignment_type text;
  _resolution_type text;
  _error_code text;
  _product_model text;
  _brand_name text;
  _feedback_success int := 0;
  _feedback_fail int := 0;
  _feedback_partial int := 0;
  _feedback_total int := 0;
  _feedback_last_at timestamptz;
  _quality numeric := 0.35;
  _confidence numeric := 0.35;
  _freshness numeric := 0.40;
  _dup_id uuid;
  _normalized_issue text;
  _normalized_solution text;
BEGIN
  _normalized_issue := regexp_replace(lower(trim(COALESCE(NEW.issue_description, ''))), '\s+', ' ', 'g');
  _normalized_solution := regexp_replace(lower(trim(COALESCE(NEW.solution_steps, ''))), '\s+', ' ', 'g');

  IF NEW.source = 'auto_from_ticket' THEN
    IF length(_normalized_issue) < 20 OR length(_normalized_solution) < 30 THEN
      RAISE EXCEPTION 'لا يمكن حفظ مادة معرفية آلية ضعيفة المحتوى';
    END IF;
  END IF;

  NEW.dedupe_signature := md5(
    COALESCE(NEW.product_id::text, '') || '|' ||
    COALESCE(lower(trim(NEW.error_code_text)), '') || '|' ||
    left(_normalized_issue, 220) || '|' ||
    left(_normalized_solution, 220)
  );

  IF NEW.source = 'auto_from_ticket' THEN
    IF EXISTS (
      SELECT 1
      FROM public.knowledge_base kb
      WHERE kb.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND kb.dedupe_signature = NEW.dedupe_signature
        AND COALESCE(kb.quality_score, 0) <= 0.60
    ) THEN
      RAISE EXCEPTION 'تم منع إنشاء مادة آلية مكررة وضعيفة';
    END IF;
  END IF;

  _ticket_id := (
    SELECT t.id
    FROM public.tickets t
    WHERE t.id = ANY(COALESCE(NEW.linked_ticket_ids, '{}'::uuid[]))
    ORDER BY t.created_at DESC
    LIMIT 1
  );

  IF _ticket_id IS NOT NULL THEN
    SELECT t.ticket_type,
           COALESCE(t.solution_type, 'unknown'),
           COALESCE(lower(trim(t.error_code_text)), e.normalized_code),
           p.normalized_model,
           lower(trim(b.name))
      INTO _ticket_type, _resolution_type, _error_code, _product_model, _brand_name
    FROM public.tickets t
    LEFT JOIN public.error_codes e ON e.id = t.error_code_id
    LEFT JOIN public.products p ON p.id = t.affected_product_id
    LEFT JOIN public.brands b ON b.id = p.brand_id
    WHERE t.id = _ticket_id;
  END IF;

  IF _product_model IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT p.normalized_model, lower(trim(b.name))
    INTO _product_model, _brand_name
    FROM public.products p
    LEFT JOIN public.brands b ON b.id = p.brand_id
    WHERE p.id = NEW.product_id;
  END IF;

  IF _error_code IS NULL AND NEW.error_code_text IS NOT NULL THEN
    _error_code := lower(trim(NEW.error_code_text));
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE kf.rating = 'success'),
    COUNT(*) FILTER (WHERE kf.rating = 'failure'),
    COUNT(*) FILTER (WHERE kf.rating = 'partial'),
    COUNT(*),
    MAX(kf.created_at)
  INTO _feedback_success, _feedback_fail, _feedback_partial, _feedback_total, _feedback_last_at
  FROM public.knowledge_feedback kf
  WHERE kf.knowledge_base_id = COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  _assignment_type := CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.ticket_id = _ticket_id
        AND a.assignment_type = 'new_installation'
    ) THEN 'new_installation'
    WHEN EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.ticket_id = _ticket_id
        AND a.assignment_type = 'repair_visit'
    ) THEN 'repair_visit'
    ELSE NULL
  END;

  NEW.content_source := CASE
    WHEN NEW.source = 'manual' THEN 'manual'
    WHEN NEW.source = 'auto_from_ticket' AND _assignment_type IS NOT NULL THEN 'hybrid'
    WHEN NEW.source = 'auto_from_ticket' AND _assignment_type IS NULL THEN 'auto_from_ticket'
    WHEN NEW.source = 'auto_from_assignment' THEN 'auto_from_assignment'
    ELSE 'hybrid'
  END;

  NEW.derived_resolution_type := COALESCE(_resolution_type, 'unknown');

  NEW.normalized_tags := array_remove(ARRAY[
    lower(trim(COALESCE(NEW.source, ''))),
    lower(trim(COALESCE(NEW.content_source, ''))),
    lower(trim(COALESCE(_ticket_type, ''))),
    lower(trim(COALESCE(_assignment_type, ''))),
    lower(trim(COALESCE(NEW.derived_resolution_type, ''))),
    _error_code,
    _product_model,
    _brand_name
  ]::text[], '');

  NEW.classification_metadata := jsonb_strip_nulls(jsonb_build_object(
    'source', NEW.source,
    'content_source', NEW.content_source,
    'ticket_id', _ticket_id,
    'ticket_type', _ticket_type,
    'assignment_type', _assignment_type,
    'resolution_type', NEW.derived_resolution_type,
    'error_code', _error_code,
    'product_model', _product_model,
    'brand', _brand_name,
    'feedback_success', _feedback_success,
    'feedback_failure', _feedback_fail,
    'feedback_partial', _feedback_partial,
    'feedback_total', _feedback_total
  ));

  IF length(_normalized_issue) >= 40 THEN
    _quality := _quality + 0.20;
  ELSIF length(_normalized_issue) >= 20 THEN
    _quality := _quality + 0.10;
  END IF;

  IF length(_normalized_solution) >= 60 THEN
    _quality := _quality + 0.25;
  ELSIF length(_normalized_solution) >= 30 THEN
    _quality := _quality + 0.12;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    _quality := _quality + 0.08;
  END IF;

  IF _error_code IS NOT NULL THEN
    _quality := _quality + 0.08;
  END IF;

  IF COALESCE(length(trim(NEW.search_keywords)), 0) >= 8 THEN
    _quality := _quality + 0.08;
  END IF;

  IF _feedback_total >= 3 THEN
    _confidence := _confidence + 0.20;
  ELSIF _feedback_total > 0 THEN
    _confidence := _confidence + 0.10;
  END IF;

  IF COALESCE(NEW.effectiveness_rate, 0) >= 70 THEN
    _confidence := _confidence + 0.25;
  ELSIF COALESCE(NEW.effectiveness_rate, 0) >= 45 THEN
    _confidence := _confidence + 0.12;
  END IF;

  IF array_length(NEW.normalized_tags, 1) >= 4 THEN
    _confidence := _confidence + 0.10;
  END IF;

  _quality := LEAST(1, GREATEST(0, _quality));
  _confidence := LEAST(1, GREATEST(0, (_confidence * 0.7) + (_quality * 0.3)));

  NEW.quality_score := round(_quality::numeric, 2);
  NEW.confidence_score := round(_confidence::numeric, 2);

  NEW.confidence_level := CASE
    WHEN NEW.confidence_score >= 0.75 THEN 'high'
    WHEN NEW.confidence_score >= 0.45 THEN 'medium'
    ELSE 'low'
  END;

  SELECT kb.id
  INTO _dup_id
  FROM public.knowledge_base kb
  WHERE kb.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND kb.dedupe_signature = NEW.dedupe_signature
  ORDER BY (kb.verification_state = 'verified') DESC, kb.created_at ASC
  LIMIT 1;

  NEW.duplicate_of := _dup_id;

  IF NEW.duplicate_of IS NOT NULL OR NEW.confidence_score < 0.45 OR NEW.quality_score < 0.40 THEN
    NEW.verification_state := 'needs_review';
    NEW.review_state := 'pending';
  ELSE
    NEW.verification_state := 'verified';
    NEW.review_state := 'approved';
    NEW.last_reviewed_at := now();
  END IF;

  IF _feedback_last_at IS NOT NULL THEN
    IF _feedback_last_at > now() - interval '30 days' THEN
      _freshness := 0.95;
    ELSIF _feedback_last_at > now() - interval '90 days' THEN
      _freshness := 0.75;
    ELSIF _feedback_last_at > now() - interval '180 days' THEN
      _freshness := 0.55;
    ELSE
      _freshness := 0.35;
    END IF;
  ELSE
    IF NEW.updated_at > now() - interval '30 days' THEN
      _freshness := 0.80;
    ELSIF NEW.updated_at > now() - interval '120 days' THEN
      _freshness := 0.55;
    ELSE
      _freshness := 0.35;
    END IF;
  END IF;

  NEW.freshness_score := round(_freshness::numeric, 2);
  NEW.last_enriched_at := now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_knowledge_feedback_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _ticket_type text;
  _assignment_type text;
  _product_model text;
  _error_code text;
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.ticket_type,
           COALESCE(lower(trim(t.error_code_text)), e.normalized_code),
           p.normalized_model,
           (
             SELECT a.assignment_type
             FROM public.assignments a
             WHERE a.ticket_id = t.id
             ORDER BY a.created_at DESC
             LIMIT 1
           )
    INTO _ticket_type, _error_code, _product_model, _assignment_type
    FROM public.tickets t
    LEFT JOIN public.error_codes e ON e.id = t.error_code_id
    LEFT JOIN public.products p ON p.id = t.affected_product_id
    WHERE t.id = NEW.ticket_id;
  END IF;

  NEW.context_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'ticket_id', NEW.ticket_id,
    'ticket_type', _ticket_type,
    'assignment_type', _assignment_type,
    'product_model', _product_model,
    'error_code', _error_code,
    'rating', NEW.rating
  ));

  NEW.feedback_weight := CASE
    WHEN NEW.rating = 'success' THEN 1.20
    WHEN NEW.rating = 'partial' THEN 1.00
    WHEN NEW.rating = 'failure' THEN 0.90
    ELSE 1.00
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_refresh_archive_metadata ON public.tickets;
CREATE TRIGGER trg_tickets_refresh_archive_metadata
BEFORE INSERT OR UPDATE OF ticket_type, priority, status, solution_type, affected_product_id, error_code_id, error_code_text, customer_system_id
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.refresh_ticket_archive_metadata();

DROP TRIGGER IF EXISTS trg_assignments_refresh_archive_metadata ON public.assignments;
CREATE TRIGGER trg_assignments_refresh_archive_metadata
BEFORE INSERT OR UPDATE OF assignment_type, status, ticket_id, customer_system_id, engineer_id, scheduled_date, submitted_at
ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.refresh_assignment_archive_metadata();

DROP TRIGGER IF EXISTS trg_attachments_enrich_archiving ON public.attachments;
CREATE TRIGGER trg_attachments_enrich_archiving
BEFORE INSERT OR UPDATE OF attachable_type, attachable_id, assignment_id, ticket_id, file_type, file_path, original_name, file_size, description
ON public.attachments
FOR EACH ROW
EXECUTE FUNCTION public.enrich_attachment_archiving_metadata();

DROP TRIGGER IF EXISTS trg_knowledge_base_enrich_archiving ON public.knowledge_base;
CREATE TRIGGER trg_knowledge_base_enrich_archiving
BEFORE INSERT OR UPDATE OF title, issue_description, solution_steps, product_id, error_code_text, source, linked_ticket_ids, effectiveness_rate, updated_at
ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.enrich_knowledge_archiving_metadata();

DROP TRIGGER IF EXISTS trg_knowledge_feedback_propagate_context ON public.knowledge_feedback;
CREATE TRIGGER trg_knowledge_feedback_propagate_context
BEFORE INSERT OR UPDATE OF ticket_id, rating, notes
ON public.knowledge_feedback
FOR EACH ROW
EXECUTE FUNCTION public.propagate_knowledge_feedback_context();

UPDATE public.knowledge_base kb
SET updated_at = now()
WHERE kb.id IS NOT NULL;

UPDATE public.attachments a
SET updated_at = now()
WHERE a.id IS NOT NULL;

UPDATE public.tickets t
SET updated_at = now()
WHERE t.id IS NOT NULL;

UPDATE public.assignments a
SET updated_at = now()
WHERE a.id IS NOT NULL;