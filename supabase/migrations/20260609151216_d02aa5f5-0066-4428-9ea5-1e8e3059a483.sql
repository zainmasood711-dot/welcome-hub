DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'error_intelligence_classification'
  ) THEN
    CREATE TYPE public.error_intelligence_classification AS ENUM (
      'application_error',
      'validation_error',
      'workflow_error',
      'sync_error',
      'upload_error',
      'data_consistency_issue',
      'repeated_operational_issue',
      'low_effectiveness_knowledge_issue'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'error_intelligence_source'
  ) THEN
    CREATE TYPE public.error_intelligence_source AS ENUM (
      'runtime',
      'ticket_workflow',
      'assignment_workflow',
      'attachment_workflow',
      'offline_sync',
      'knowledge_workflow',
      'reporting'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'error_intelligence_alert_rule'
  ) THEN
    CREATE TYPE public.error_intelligence_alert_rule AS ENUM (
      'repeated_same_issue_customer_system',
      'repeated_error_code_same_model',
      'growing_failure_frequency',
      'knowledge_failure_spike',
      'attachment_upload_spike',
      'unresolved_ticket_aging_symptoms'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'error_intelligence_status'
  ) THEN
    CREATE TYPE public.error_intelligence_status AS ENUM ('open', 'acknowledged', 'resolved', 'ignored');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'error_intelligence_severity'
  ) THEN
    CREATE TYPE public.error_intelligence_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.error_intelligence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification public.error_intelligence_classification NOT NULL,
  severity public.error_intelligence_severity NOT NULL DEFAULT 'medium',
  source public.error_intelligence_source NOT NULL,
  status public.error_intelligence_status NOT NULL DEFAULT 'open',
  message text NOT NULL,
  normalized_error_signature text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_hint text,
  source_ref_id uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_system_id uuid REFERENCES public.customer_systems(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  attachment_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
  knowledge_base_id uuid REFERENCES public.knowledge_base(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  error_code_id uuid REFERENCES public.error_codes(id) ON DELETE SET NULL,
  error_code_text text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_intelligence_events_message_len CHECK (length(trim(message)) >= 3),
  CONSTRAINT error_intelligence_events_signature_len CHECK (length(trim(normalized_error_signature)) >= 3)
);

GRANT SELECT, INSERT, UPDATE ON public.error_intelligence_events TO authenticated;
GRANT ALL ON public.error_intelligence_events TO service_role;

ALTER TABLE public.error_intelligence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Error events support full"
ON public.error_intelligence_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "Error events manager read"
ON public.error_intelligence_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Error events field read own"
ON public.error_intelligence_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND created_by = auth.uid()
);

CREATE POLICY "Error events insert own"
ON public.error_intelligence_events
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.error_intelligence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type public.error_intelligence_alert_rule NOT NULL,
  severity public.error_intelligence_severity NOT NULL DEFAULT 'medium',
  status public.error_intelligence_status NOT NULL DEFAULT 'open',
  title text NOT NULL,
  summary text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  trigger_count integer NOT NULL DEFAULT 1,
  recommendation_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_event_id uuid REFERENCES public.error_intelligence_events(id) ON DELETE SET NULL,
  related_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  related_assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  related_knowledge_base_id uuid REFERENCES public.knowledge_base(id) ON DELETE SET NULL,
  related_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  related_customer_system_id uuid REFERENCES public.customer_systems(id) ON DELETE SET NULL,
  related_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  related_error_code_text text,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_intelligence_alerts_title_len CHECK (length(trim(title)) >= 3),
  CONSTRAINT error_intelligence_alerts_summary_len CHECK (length(trim(summary)) >= 3)
);

GRANT SELECT, INSERT, UPDATE ON public.error_intelligence_alerts TO authenticated;
GRANT ALL ON public.error_intelligence_alerts TO service_role;

ALTER TABLE public.error_intelligence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Error alerts support full"
ON public.error_intelligence_alerts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY "Error alerts manager read"
ON public.error_intelligence_alerts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.normalize_error_signature(
  p_message text,
  p_classification public.error_intelligence_classification,
  p_error_code text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(
    lower(
      coalesce(p_classification::text, '') || '-' ||
      coalesce(nullif(trim(p_error_code), ''), 'no-code') || '-' ||
      coalesce(nullif(trim(p_message), ''), 'empty-message')
    ),
    '\s+',
    '-',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.upsert_error_intelligence_alert(
  p_rule_type public.error_intelligence_alert_rule,
  p_severity public.error_intelligence_severity,
  p_title text,
  p_summary text,
  p_dedupe_key text,
  p_recommendation_context jsonb,
  p_related_event_id uuid,
  p_related_ticket_id uuid,
  p_related_assignment_id uuid,
  p_related_knowledge_base_id uuid,
  p_related_customer_id uuid,
  p_related_customer_system_id uuid,
  p_related_product_id uuid,
  p_related_error_code_text text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.error_intelligence_alerts (
    rule_type,
    severity,
    status,
    title,
    summary,
    dedupe_key,
    trigger_count,
    recommendation_context,
    related_event_id,
    related_ticket_id,
    related_assignment_id,
    related_knowledge_base_id,
    related_customer_id,
    related_customer_system_id,
    related_product_id,
    related_error_code_text,
    first_detected_at,
    last_detected_at,
    created_by
  )
  VALUES (
    p_rule_type,
    p_severity,
    'open',
    p_title,
    p_summary,
    p_dedupe_key,
    1,
    COALESCE(p_recommendation_context, '{}'::jsonb),
    p_related_event_id,
    p_related_ticket_id,
    p_related_assignment_id,
    p_related_knowledge_base_id,
    p_related_customer_id,
    p_related_customer_system_id,
    p_related_product_id,
    p_related_error_code_text,
    now(),
    now(),
    p_created_by
  )
  ON CONFLICT (dedupe_key)
  DO UPDATE
  SET
    trigger_count = public.error_intelligence_alerts.trigger_count + 1,
    last_detected_at = now(),
    status = CASE WHEN public.error_intelligence_alerts.status = 'resolved' THEN 'open'::public.error_intelligence_status ELSE public.error_intelligence_alerts.status END,
    recommendation_context = COALESCE(p_recommendation_context, public.error_intelligence_alerts.recommendation_context),
    related_event_id = COALESCE(EXCLUDED.related_event_id, public.error_intelligence_alerts.related_event_id),
    related_ticket_id = COALESCE(EXCLUDED.related_ticket_id, public.error_intelligence_alerts.related_ticket_id),
    related_assignment_id = COALESCE(EXCLUDED.related_assignment_id, public.error_intelligence_alerts.related_assignment_id),
    related_knowledge_base_id = COALESCE(EXCLUDED.related_knowledge_base_id, public.error_intelligence_alerts.related_knowledge_base_id),
    related_customer_id = COALESCE(EXCLUDED.related_customer_id, public.error_intelligence_alerts.related_customer_id),
    related_customer_system_id = COALESCE(EXCLUDED.related_customer_system_id, public.error_intelligence_alerts.related_customer_system_id),
    related_product_id = COALESCE(EXCLUDED.related_product_id, public.error_intelligence_alerts.related_product_id),
    related_error_code_text = COALESCE(EXCLUDED.related_error_code_text, public.error_intelligence_alerts.related_error_code_text),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_error_intelligence_alerts(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.error_intelligence_events%ROWTYPE;
  created_count integer := 0;
  repeated_count integer := 0;
  model_code_count integer := 0;
  current_window integer := 0;
  previous_window integer := 0;
  knowledge_failures integer := 0;
  upload_spikes integer := 0;
  ticket_symptom_count integer := 0;
  ticket_created_at timestamptz;
  ticket_status text;
  product_model text;
BEGIN
  SELECT * INTO ev
  FROM public.error_intelligence_events
  WHERE id = p_event_id;

  IF ev.id IS NULL THEN
    RETURN 0;
  END IF;

  IF ev.customer_system_id IS NOT NULL THEN
    SELECT COUNT(*) INTO repeated_count
    FROM public.error_intelligence_events e
    WHERE e.customer_system_id = ev.customer_system_id
      AND e.normalized_error_signature = ev.normalized_error_signature
      AND e.occurred_at >= now() - interval '7 days';

    IF repeated_count >= 3 THEN
      PERFORM public.upsert_error_intelligence_alert(
        'repeated_same_issue_customer_system',
        'high',
        'تكرار نفس المشكلة في نفس نظام العميل',
        format('تم رصد %s حالات متشابهة خلال 7 أيام.', repeated_count),
        md5('repeated_same_issue_customer_system|' || ev.customer_system_id::text || '|' || ev.normalized_error_signature),
        jsonb_build_object('repeat_count', repeated_count, 'window_days', 7),
        ev.id,
        ev.ticket_id,
        ev.assignment_id,
        ev.knowledge_base_id,
        ev.customer_id,
        ev.customer_system_id,
        ev.product_id,
        ev.error_code_text,
        ev.created_by
      );
      created_count := created_count + 1;
    END IF;
  END IF;

  IF ev.product_id IS NOT NULL AND COALESCE(trim(ev.error_code_text), '') <> '' THEN
    SELECT p.model INTO product_model FROM public.products p WHERE p.id = ev.product_id;

    SELECT COUNT(*) INTO model_code_count
    FROM public.error_intelligence_events e
    WHERE e.product_id = ev.product_id
      AND lower(trim(COALESCE(e.error_code_text, ''))) = lower(trim(ev.error_code_text))
      AND e.occurred_at >= now() - interval '14 days';

    IF model_code_count >= 3 THEN
      PERFORM public.upsert_error_intelligence_alert(
        'repeated_error_code_same_model',
        'high',
        'تكرار نفس كود العطل لنفس الموديل',
        format('الموديل %s لديه %s حالات لنفس الكود خلال 14 يومًا.', COALESCE(product_model, 'غير معروف'), model_code_count),
        md5('repeated_error_code_same_model|' || ev.product_id::text || '|' || lower(trim(ev.error_code_text))),
        jsonb_build_object('count', model_code_count, 'window_days', 14, 'product_model', product_model),
        ev.id,
        ev.ticket_id,
        ev.assignment_id,
        ev.knowledge_base_id,
        ev.customer_id,
        ev.customer_system_id,
        ev.product_id,
        ev.error_code_text,
        ev.created_by
      );
      created_count := created_count + 1;
    END IF;
  END IF;

  SELECT COUNT(*) INTO current_window
  FROM public.error_intelligence_events e
  WHERE e.classification = ev.classification
    AND e.occurred_at >= now() - interval '3 days';

  SELECT COUNT(*) INTO previous_window
  FROM public.error_intelligence_events e
  WHERE e.classification = ev.classification
    AND e.occurred_at >= now() - interval '6 days'
    AND e.occurred_at < now() - interval '3 days';

  IF current_window >= 5 AND current_window >= GREATEST(previous_window * 2, 5) THEN
    PERFORM public.upsert_error_intelligence_alert(
      'growing_failure_frequency',
      'medium',
      'تصاعد في وتيرة نوع فشل',
      format('نوع الفشل %s ارتفع إلى %s خلال آخر 3 أيام.', ev.classification::text, current_window),
      md5('growing_failure_frequency|' || ev.classification::text),
      jsonb_build_object('classification', ev.classification::text, 'current_window_count', current_window, 'previous_window_count', previous_window),
      ev.id,
      ev.ticket_id,
      ev.assignment_id,
      ev.knowledge_base_id,
      ev.customer_id,
      ev.customer_system_id,
      ev.product_id,
      ev.error_code_text,
      ev.created_by
    );
    created_count := created_count + 1;
  END IF;

  IF ev.knowledge_base_id IS NOT NULL THEN
    SELECT COUNT(*) INTO knowledge_failures
    FROM public.knowledge_feedback kf
    WHERE kf.knowledge_base_id = ev.knowledge_base_id
      AND kf.rating = 'failure'
      AND kf.created_at >= now() - interval '30 days';

    IF knowledge_failures >= 4 THEN
      PERFORM public.upsert_error_intelligence_alert(
        'knowledge_failure_spike',
        'high',
        'انخفاض فاعلية مادة معرفية',
        format('تم تسجيل %s تقييمات فشل للمادة خلال 30 يومًا.', knowledge_failures),
        md5('knowledge_failure_spike|' || ev.knowledge_base_id::text),
        jsonb_build_object('failure_feedback_count', knowledge_failures, 'window_days', 30),
        ev.id,
        ev.ticket_id,
        ev.assignment_id,
        ev.knowledge_base_id,
        ev.customer_id,
        ev.customer_system_id,
        ev.product_id,
        ev.error_code_text,
        ev.created_by
      );
      created_count := created_count + 1;
    END IF;
  END IF;

  IF ev.classification = 'upload_error' THEN
    SELECT COUNT(*) INTO upload_spikes
    FROM public.error_intelligence_events e
    WHERE e.classification = 'upload_error'
      AND e.occurred_at >= now() - interval '24 hours';

    IF upload_spikes >= 5 THEN
      PERFORM public.upsert_error_intelligence_alert(
        'attachment_upload_spike',
        'high',
        'ارتفاع في فشل رفع المرفقات',
        format('تم رصد %s حالات فشل رفع خلال 24 ساعة.', upload_spikes),
        md5('attachment_upload_spike|global'),
        jsonb_build_object('upload_failures_24h', upload_spikes),
        ev.id,
        ev.ticket_id,
        ev.assignment_id,
        ev.knowledge_base_id,
        ev.customer_id,
        ev.customer_system_id,
        ev.product_id,
        ev.error_code_text,
        ev.created_by
      );
      created_count := created_count + 1;
    END IF;
  END IF;

  IF ev.ticket_id IS NOT NULL THEN
    SELECT t.created_at, t.status INTO ticket_created_at, ticket_status
    FROM public.tickets t
    WHERE t.id = ev.ticket_id;

    SELECT COUNT(*) INTO ticket_symptom_count
    FROM public.error_intelligence_events e
    WHERE e.ticket_id = ev.ticket_id
      AND e.normalized_error_signature = ev.normalized_error_signature
      AND e.occurred_at >= now() - interval '7 days';

    IF ticket_created_at <= now() - interval '72 hours'
      AND ticket_status IN ('new', 'in_progress', 'assigned_field')
      AND ticket_symptom_count >= 3 THEN
      PERFORM public.upsert_error_intelligence_alert(
        'unresolved_ticket_aging_symptoms',
        'critical',
        'تذكرة متقادمة مع أعراض متكررة',
        format('التذكرة ما زالت غير محلولة مع %s أعراض متشابهة متكررة.', ticket_symptom_count),
        md5('unresolved_ticket_aging_symptoms|' || ev.ticket_id::text || '|' || ev.normalized_error_signature),
        jsonb_build_object('ticket_symptom_count', ticket_symptom_count, 'ticket_created_at', ticket_created_at),
        ev.id,
        ev.ticket_id,
        ev.assignment_id,
        ev.knowledge_base_id,
        ev.customer_id,
        ev.customer_system_id,
        ev.product_id,
        ev.error_code_text,
        ev.created_by
      );
      created_count := created_count + 1;
    END IF;
  END IF;

  RETURN created_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_evaluate_error_intelligence_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.evaluate_error_intelligence_alerts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_error_intelligence_events_evaluate_alerts ON public.error_intelligence_events;
CREATE TRIGGER trg_error_intelligence_events_evaluate_alerts
AFTER INSERT ON public.error_intelligence_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_evaluate_error_intelligence_alerts();

DROP TRIGGER IF EXISTS trg_error_intelligence_events_updated_at ON public.error_intelligence_events;
CREATE TRIGGER trg_error_intelligence_events_updated_at
BEFORE UPDATE ON public.error_intelligence_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_error_intelligence_alerts_updated_at ON public.error_intelligence_alerts;
CREATE TRIGGER trg_error_intelligence_alerts_updated_at
BEFORE UPDATE ON public.error_intelligence_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_error_intelligence_events_occurred_at
  ON public.error_intelligence_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_intelligence_events_classification_occurred
  ON public.error_intelligence_events (classification, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_intelligence_events_signature_system_occurred
  ON public.error_intelligence_events (customer_system_id, normalized_error_signature, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_intelligence_events_product_error_occurred
  ON public.error_intelligence_events (product_id, error_code_text, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_intelligence_events_ticket_signature_occurred
  ON public.error_intelligence_events (ticket_id, normalized_error_signature, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_intelligence_alerts_status_severity_detected
  ON public.error_intelligence_alerts (status, severity, last_detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_intelligence_alerts_rule_detected
  ON public.error_intelligence_alerts (rule_type, last_detected_at DESC);