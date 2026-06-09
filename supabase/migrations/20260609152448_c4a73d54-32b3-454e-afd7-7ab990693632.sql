ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS usage_count_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_similarity_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conflict_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_score_v2 numeric(5,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS decline_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_human_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.knowledge_base
  DROP CONSTRAINT IF EXISTS knowledge_base_lifecycle_state_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_duplicate_similarity_score_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_quality_score_v2_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_decline_score_check,
  DROP CONSTRAINT IF EXISTS knowledge_base_review_priority_check;

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_lifecycle_state_check
    CHECK (lifecycle_state IN ('draft', 'verified', 'needs_review', 'low_confidence', 'archived')),
  ADD CONSTRAINT knowledge_base_duplicate_similarity_score_check
    CHECK (duplicate_similarity_score >= 0 AND duplicate_similarity_score <= 1),
  ADD CONSTRAINT knowledge_base_quality_score_v2_check
    CHECK (quality_score_v2 >= 0 AND quality_score_v2 <= 1),
  ADD CONSTRAINT knowledge_base_decline_score_check
    CHECK (decline_score >= 0 AND decline_score <= 1),
  ADD CONSTRAINT knowledge_base_review_priority_check
    CHECK (review_priority >= 0 AND review_priority <= 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_lifecycle_state ON public.knowledge_base(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_review_queue ON public.knowledge_base(needs_human_review, review_priority DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_last_success_at ON public.knowledge_base(last_success_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_quality_v2 ON public.knowledge_base(quality_score_v2 DESC);

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

CREATE OR REPLACE FUNCTION public.trigger_recompute_knowledge_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_knowledge_lifecycle(NEW.knowledge_base_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_feedback_recompute_lifecycle ON public.knowledge_feedback;
CREATE TRIGGER trg_knowledge_feedback_recompute_lifecycle
AFTER INSERT OR UPDATE OF rating ON public.knowledge_feedback
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recompute_knowledge_lifecycle();

DO $$
DECLARE
  row_record record;
BEGIN
  FOR row_record IN SELECT id FROM public.knowledge_base LOOP
    PERFORM public.recompute_knowledge_lifecycle(row_record.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_knowledge_ranked(
  p_issue_text text DEFAULT NULL,
  p_affected_product_id uuid DEFAULT NULL,
  p_error_code_id uuid DEFAULT NULL,
  p_error_code_text text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_customer_system_id uuid DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_min_effectiveness numeric DEFAULT NULL,
  p_sort_by text DEFAULT 'relevance',
  p_limit integer DEFAULT 10,
  p_exclude_knowledge_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  issue_description text,
  solution_steps text,
  product_id uuid,
  product_model text,
  brand_name text,
  category_id uuid,
  error_code_text text,
  search_keywords text,
  source text,
  effectiveness_rate numeric,
  success_count integer,
  partial_fail_count integer,
  fail_count integer,
  usage_count integer,
  updated_at timestamptz,
  freshness_score numeric,
  priority_tier integer,
  match_score numeric,
  match_reason text,
  why jsonb
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH ctx AS (
  SELECT
    p_affected_product_id AS product_id,
    COALESCE(
      p_category_id,
      (SELECT pr.category_id FROM public.products pr WHERE pr.id = p_affected_product_id)
    ) AS category_id,
    COALESCE(
      lower(trim(p_error_code_text)),
      (
        SELECT lower(trim(ec.code))
        FROM public.error_codes ec
        WHERE ec.id = p_error_code_id
      )
    ) AS error_code_norm,
    NULLIF(trim(COALESCE(p_issue_text, '')), '') AS issue_text,
    p_customer_system_id AS customer_system_id,
    GREATEST(1, LEAST(COALESCE(p_limit, 10), 50)) AS result_limit,
    COALESCE(NULLIF(trim(p_sort_by), ''), 'relevance') AS sort_by
),
base AS (
  SELECT
    kb.id,
    kb.title,
    kb.issue_description,
    kb.solution_steps,
    kb.product_id,
    pr.model AS product_model,
    lower(trim(br.name)) AS brand_name,
    pr.category_id,
    kb.error_code_text,
    kb.search_keywords,
    kb.source,
    COALESCE(kb.effectiveness_rate, 0) AS effectiveness_rate,
    COALESCE(kb.success_count, 0)::int AS success_count,
    COALESCE(kb.partial_fail_count, 0)::int AS partial_fail_count,
    COALESCE(kb.fail_count, 0)::int AS fail_count,
    (COALESCE(kb.success_count, 0) + COALESCE(kb.partial_fail_count, 0) + COALESCE(kb.fail_count, 0))::int AS usage_count,
    kb.updated_at,
    COALESCE(kb.freshness_score, 0.5) AS freshness_score,
    COALESCE(kb.lifecycle_state, 'draft') AS lifecycle_state,
    COALESCE(kb.quality_score_v2, 0.5) AS quality_score_v2,
    c.product_id AS ctx_product_id,
    c.category_id AS ctx_category_id,
    c.error_code_norm AS ctx_error_code,
    c.issue_text AS ctx_issue_text,
    c.customer_system_id AS ctx_system_id,
    c.sort_by,
    CASE
      WHEN c.issue_text IS NULL THEN NULL
      ELSE websearch_to_tsquery('simple', c.issue_text)
    END AS issue_query,
    CASE
      WHEN c.product_id IS NOT NULL AND kb.product_id = c.product_id THEN 1 ELSE 0
    END AS exact_product_match,
    CASE
      WHEN c.error_code_norm IS NOT NULL AND lower(trim(COALESCE(kb.error_code_text, ''))) = c.error_code_norm THEN 1 ELSE 0
    END AS exact_error_match,
    CASE
      WHEN c.category_id IS NOT NULL AND pr.category_id = c.category_id THEN 1 ELSE 0
    END AS same_category_match,
    CASE
      WHEN c.customer_system_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.tickets t
        WHERE t.id = ANY(COALESCE(kb.linked_ticket_ids, '{}'::uuid[]))
          AND t.customer_system_id = c.customer_system_id
      ) THEN 1 ELSE 0
    END AS same_system_history_match
  FROM public.knowledge_base kb
  LEFT JOIN public.products pr ON pr.id = kb.product_id
  LEFT JOIN public.brands br ON br.id = pr.brand_id
  CROSS JOIN ctx c
  WHERE (p_source IS NULL OR kb.source = p_source)
    AND (p_min_effectiveness IS NULL OR COALESCE(kb.effectiveness_rate, 0) >= p_min_effectiveness)
    AND (p_exclude_knowledge_id IS NULL OR kb.id <> p_exclude_knowledge_id)
    AND COALESCE(kb.lifecycle_state, 'draft') <> 'archived'
),
scored AS (
  SELECT
    b.*,
    CASE
      WHEN b.issue_query IS NULL THEN 0::numeric
      ELSE ts_rank_cd(COALESCE((SELECT kb2.search_vector FROM public.knowledge_base kb2 WHERE kb2.id = b.id), ''::tsvector), b.issue_query)::numeric
    END AS fts_rank,
    CASE
      WHEN b.ctx_issue_text IS NULL THEN 0::numeric
      ELSE GREATEST(
        similarity(lower(COALESCE(b.title, '')), lower(b.ctx_issue_text)),
        similarity(lower(COALESCE(b.search_keywords, '')), lower(b.ctx_issue_text)),
        similarity(lower(COALESCE(b.issue_description, '')), lower(b.ctx_issue_text))
      )::numeric
    END AS keyword_similarity,
    LEAST(1::numeric, (LN(1 + GREATEST(b.usage_count, 0)) / LN(50))::numeric) AS usage_norm,
    LEAST(1::numeric, GREATEST(0::numeric, b.effectiveness_rate / 100.0)) AS effectiveness_norm,
    CASE
      WHEN b.updated_at >= now() - interval '30 days' THEN 1::numeric
      WHEN b.updated_at >= now() - interval '90 days' THEN 0.75::numeric
      WHEN b.updated_at >= now() - interval '180 days' THEN 0.5::numeric
      ELSE 0.25::numeric
    END AS recency_norm,
    CASE b.lifecycle_state
      WHEN 'verified' THEN 1::numeric
      WHEN 'needs_review' THEN 0.65::numeric
      WHEN 'low_confidence' THEN 0.45::numeric
      WHEN 'draft' THEN 0.35::numeric
      ELSE 0.2::numeric
    END AS lifecycle_norm
  FROM base b
),
ranked AS (
  SELECT
    s.*,
    CASE
      WHEN s.exact_error_match = 1 AND s.exact_product_match = 1 THEN 1
      WHEN s.exact_error_match = 1 THEN 2
      WHEN s.exact_product_match = 1 THEN 3
      WHEN s.same_category_match = 1 OR s.same_system_history_match = 1 THEN 4
      ELSE 5
    END AS priority_tier,
    (
      (s.exact_product_match * 0.20)::numeric +
      (s.exact_error_match * 0.24)::numeric +
      (s.same_category_match * 0.08)::numeric +
      (s.same_system_history_match * 0.08)::numeric +
      (LEAST(1::numeric, s.fts_rank) * 0.13) +
      (LEAST(1::numeric, s.keyword_similarity) * 0.07) +
      (s.effectiveness_norm * 0.07) +
      (s.usage_norm * 0.04) +
      (LEAST(1::numeric, GREATEST(0::numeric, s.freshness_score)) * 0.02) +
      (s.recency_norm * 0.01) +
      (s.lifecycle_norm * 0.04) +
      (LEAST(1::numeric, GREATEST(0::numeric, s.quality_score_v2)) * 0.02)
    )::numeric(8,4) AS match_score,
    CONCAT_WS(' + ',
      CASE WHEN s.exact_error_match = 1 THEN 'نفس كود العطل' END,
      CASE WHEN s.exact_product_match = 1 THEN 'نفس المنتج/الموديل' END,
      CASE WHEN s.same_category_match = 1 THEN 'نفس الفئة' END,
      CASE WHEN s.same_system_history_match = 1 THEN 'سجل نفس النظام' END,
      CASE WHEN s.fts_rank > 0 THEN 'تطابق نصي' END,
      CASE WHEN s.lifecycle_state = 'verified' THEN 'مادة موثقة' END,
      CASE WHEN s.effectiveness_norm >= 0.7 THEN 'فاعلية مرتفعة' END,
      CASE WHEN s.usage_norm >= 0.4 THEN 'استخدام متكرر' END
    ) AS match_reason,
    jsonb_strip_nulls(jsonb_build_object(
      'exact_product', s.exact_product_match = 1,
      'exact_error_code', s.exact_error_match = 1,
      'same_category', s.same_category_match = 1,
      'same_system_history', s.same_system_history_match = 1,
      'lifecycle_state', s.lifecycle_state,
      'quality_score_v2', s.quality_score_v2,
      'fts_rank', round(CAST(s.fts_rank AS numeric), 4),
      'keyword_similarity', round(CAST(s.keyword_similarity AS numeric), 4),
      'effectiveness_rate', s.effectiveness_rate,
      'usage_count', s.usage_count,
      'freshness_score', s.freshness_score,
      'updated_at', s.updated_at
    )) AS why
  FROM scored s
)
SELECT
  r.id,
  r.title,
  r.issue_description,
  r.solution_steps,
  r.product_id,
  r.product_model,
  r.brand_name,
  r.category_id,
  r.error_code_text,
  r.search_keywords,
  r.source,
  r.effectiveness_rate,
  r.success_count,
  r.partial_fail_count,
  r.fail_count,
  r.usage_count,
  r.updated_at,
  r.freshness_score,
  r.priority_tier,
  r.match_score,
  COALESCE(NULLIF(r.match_reason, ''), 'تطابق عام') AS match_reason,
  r.why
FROM ranked r
CROSS JOIN ctx c
ORDER BY
  CASE WHEN c.sort_by = 'freshness' THEN r.freshness_score END DESC,
  CASE WHEN c.sort_by = 'effectiveness' THEN r.effectiveness_rate END DESC,
  CASE WHEN c.sort_by = 'usage' THEN r.usage_count END DESC,
  CASE WHEN c.sort_by = 'newest' THEN r.updated_at END DESC,
  CASE WHEN c.sort_by = 'relevance' THEN r.match_score END DESC,
  r.match_score DESC,
  r.effectiveness_rate DESC,
  r.updated_at DESC
LIMIT (SELECT result_limit FROM ctx);
$$;