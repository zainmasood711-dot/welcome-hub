CREATE OR REPLACE FUNCTION public.recompute_knowledge_lifecycle(_knowledge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kb public.knowledge_base%ROWTYPE;
  _success_count integer := 0;
  _fail_count integer := 0;
  _partial_count integer := 0;
  _usage_total integer := 0;
  _last_feedback_at timestamptz;
  _last_success_at timestamptz;
  _last_failure_at timestamptz;
  _recent_success_30 integer := 0;
  _recent_fail_30 integer := 0;
  _recent_partial_30 integer := 0;
  _effectiveness numeric := 0;
  _quality numeric := 0.35;
  _decline numeric := 0;
  _duplicate_penalty numeric := 0;
  _conflict boolean := false;
  _lifecycle text := 'draft';
  _needs_review boolean := false;
  _priority integer := 0;
BEGIN
  SELECT * INTO kb
  FROM public.knowledge_base
  WHERE id = _knowledge_id;

  IF kb.id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE rating = 'success')::int,
    COUNT(*) FILTER (WHERE rating = 'failure')::int,
    COUNT(*) FILTER (WHERE rating = 'partial')::int,
    MAX(created_at),
    MAX(created_at) FILTER (WHERE rating = 'success'),
    MAX(created_at) FILTER (WHERE rating = 'failure'),
    COUNT(*) FILTER (WHERE rating = 'success' AND created_at >= now() - interval '30 days')::int,
    COUNT(*) FILTER (WHERE rating = 'failure' AND created_at >= now() - interval '30 days')::int,
    COUNT(*) FILTER (WHERE rating = 'partial' AND created_at >= now() - interval '30 days')::int
  INTO
    _success_count,
    _fail_count,
    _partial_count,
    _last_feedback_at,
    _last_success_at,
    _last_failure_at,
    _recent_success_30,
    _recent_fail_30,
    _recent_partial_30
  FROM public.knowledge_feedback
  WHERE knowledge_base_id = kb.id;

  _usage_total := _success_count + _fail_count + _partial_count;

  IF (_success_count + _fail_count) > 0 THEN
    _effectiveness := round(((_success_count::numeric / (_success_count + _fail_count)::numeric) * 100)::numeric, 2);
  ELSE
    _effectiveness := COALESCE(kb.effectiveness_rate, 0);
  END IF;

  IF kb.duplicate_of IS NOT NULL THEN
    _duplicate_penalty := 0.25;
  ELSIF COALESCE(kb.duplicate_similarity_score, 0) >= 0.70 THEN
    _duplicate_penalty := 0.15;
  END IF;

  IF kb.product_id IS NOT NULL
     AND COALESCE(NULLIF(trim(kb.error_code_text), ''), '') <> ''
     AND EXISTS (
       SELECT 1
       FROM public.knowledge_base other
       WHERE other.id <> kb.id
         AND other.product_id = kb.product_id
         AND lower(trim(COALESCE(other.error_code_text, ''))) = lower(trim(COALESCE(kb.error_code_text, '')))
         AND other.lifecycle_state = 'verified'
         AND ABS(COALESCE(other.effectiveness_rate, 0) - _effectiveness) >= 35
     ) THEN
    _conflict := true;
  END IF;

  _quality := 0.25
    + (LEAST(1, GREATEST(0, _effectiveness / 100.0)) * 0.40)
    + (CASE WHEN _usage_total >= 10 THEN 0.12 WHEN _usage_total >= 4 THEN 0.07 WHEN _usage_total > 0 THEN 0.03 ELSE 0 END)
    + (CASE
        WHEN _last_success_at IS NULL THEN 0
        WHEN _last_success_at >= now() - interval '14 days' THEN 0.14
        WHEN _last_success_at >= now() - interval '45 days' THEN 0.10
        WHEN _last_success_at >= now() - interval '90 days' THEN 0.05
        ELSE 0
      END)
    + (CASE WHEN COALESCE(kb.confidence_score, 0) >= 0.75 THEN 0.08 WHEN COALESCE(kb.confidence_score, 0) >= 0.45 THEN 0.04 ELSE 0 END)
    - _duplicate_penalty
    - (CASE WHEN _recent_fail_30 >= GREATEST(2, _recent_success_30 + 1) THEN 0.12 ELSE 0 END)
    - (CASE WHEN _conflict THEN 0.10 ELSE 0 END);

  _quality := LEAST(1, GREATEST(0, _quality));

  IF _usage_total = 0 THEN
    _decline := 0;
  ELSE
    _decline := LEAST(1, GREATEST(0,
      (CASE WHEN _recent_fail_30 > _recent_success_30 THEN 0.45 ELSE 0.10 END)
      + (CASE
          WHEN _last_success_at IS NULL THEN 0.35
          WHEN _last_success_at < now() - interval '120 days' THEN 0.30
          WHEN _last_success_at < now() - interval '60 days' THEN 0.18
          ELSE 0
        END)
      + (CASE WHEN _effectiveness < 45 THEN 0.28 WHEN _effectiveness < 60 THEN 0.12 ELSE 0 END)
    ));
  END IF;

  IF kb.archived_at IS NOT NULL THEN
    _lifecycle := 'archived';
  ELSIF _usage_total = 0 AND kb.source IN ('auto_from_ticket', 'auto_from_assignment') THEN
    _lifecycle := 'draft';
  ELSIF _quality < 0.40 OR COALESCE(kb.confidence_score, 0) < 0.40 THEN
    _lifecycle := 'low_confidence';
  ELSIF _conflict OR kb.duplicate_of IS NOT NULL OR _recent_fail_30 >= 3 OR _decline >= 0.60 THEN
    _lifecycle := 'needs_review';
  ELSE
    _lifecycle := 'verified';
  END IF;

  _needs_review := _lifecycle IN ('needs_review', 'low_confidence');

  _priority :=
    CASE _lifecycle
      WHEN 'low_confidence' THEN 80
      WHEN 'needs_review' THEN 65
      WHEN 'draft' THEN 25
      ELSE 5
    END
    + CASE WHEN _recent_fail_30 >= 3 THEN 12 ELSE 0 END
    + CASE WHEN _conflict THEN 10 ELSE 0 END
    + CASE WHEN _duplicate_penalty > 0 THEN 8 ELSE 0 END;

  _priority := LEAST(100, GREATEST(0, _priority));

  UPDATE public.knowledge_base
  SET
    success_count = _success_count,
    fail_count = _fail_count,
    partial_fail_count = _partial_count,
    partial_count = _partial_count,
    effectiveness_rate = _effectiveness,
    usage_count_total = _usage_total,
    last_used_at = COALESCE(_last_feedback_at, kb.last_used_at),
    last_success_at = _last_success_at,
    last_failure_at = _last_failure_at,
    conflict_flag = _conflict,
    quality_score_v2 = round(_quality::numeric, 2),
    decline_score = round(_decline::numeric, 2),
    lifecycle_state = _lifecycle,
    needs_human_review = _needs_review,
    review_priority = _priority,
    verification_state = CASE WHEN _lifecycle = 'verified' THEN 'verified' ELSE 'needs_review' END,
    review_state = CASE WHEN _lifecycle = 'verified' THEN 'approved' ELSE 'pending' END,
    last_reviewed_at = CASE WHEN _lifecycle = 'verified' THEN now() ELSE kb.last_reviewed_at END,
    archived_at = CASE WHEN _lifecycle = 'archived' THEN COALESCE(kb.archived_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = kb.id;
END;
$$;