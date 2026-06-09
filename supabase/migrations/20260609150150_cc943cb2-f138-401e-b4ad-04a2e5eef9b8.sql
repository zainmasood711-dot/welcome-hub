CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.refresh_knowledge_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.error_code_text, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.search_keywords, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.issue_description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.solution_steps, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_base_refresh_search_vector ON public.knowledge_base;
CREATE TRIGGER trg_knowledge_base_refresh_search_vector
BEFORE INSERT OR UPDATE OF title, error_code_text, search_keywords, issue_description, solution_steps
ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.refresh_knowledge_search_vector();

UPDATE public.knowledge_base
SET search_vector =
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(error_code_text, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(search_keywords, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(issue_description, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(solution_steps, '')), 'C')
WHERE id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_search_vector_gin ON public.knowledge_base USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_product_error_updated ON public.knowledge_base(product_id, error_code_text, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_effective_updated ON public.knowledge_base(effectiveness_rate DESC, updated_at DESC);

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
    END AS recency_norm
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
      (s.exact_product_match * 0.22)::numeric +
      (s.exact_error_match * 0.26)::numeric +
      (s.same_category_match * 0.08)::numeric +
      (s.same_system_history_match * 0.08)::numeric +
      (LEAST(1::numeric, s.fts_rank) * 0.14) +
      (LEAST(1::numeric, s.keyword_similarity) * 0.08) +
      (s.effectiveness_norm * 0.07) +
      (s.usage_norm * 0.04) +
      (LEAST(1::numeric, GREATEST(0::numeric, s.freshness_score)) * 0.02) +
      (s.recency_norm * 0.01)
    )::numeric(8,4) AS match_score,
    CONCAT_WS(' + ',
      CASE WHEN s.exact_error_match = 1 THEN 'نفس كود العطل' END,
      CASE WHEN s.exact_product_match = 1 THEN 'نفس المنتج/الموديل' END,
      CASE WHEN s.same_category_match = 1 THEN 'نفس الفئة' END,
      CASE WHEN s.same_system_history_match = 1 THEN 'سجل نفس النظام' END,
      CASE WHEN s.fts_rank > 0 THEN 'تطابق نصي' END,
      CASE WHEN s.effectiveness_norm >= 0.7 THEN 'فاعلية مرتفعة' END,
      CASE WHEN s.usage_norm >= 0.4 THEN 'استخدام متكرر' END,
      CASE WHEN s.recency_norm >= 0.75 THEN 'تحديث حديث' END
    ) AS match_reason,
    jsonb_strip_nulls(jsonb_build_object(
      'exact_product', s.exact_product_match = 1,
      'exact_error_code', s.exact_error_match = 1,
      'same_category', s.same_category_match = 1,
      'same_system_history', s.same_system_history_match = 1,
      'fts_rank', round(CAST(s.fts_rank AS numeric), 4),
      'keyword_similarity', round(CAST(s.keyword_similarity AS numeric), 4),
      'effectiveness_rate', s.effectiveness_rate,
      'usage_count', s.usage_count,
      'freshness_score', s.freshness_score,
      'updated_at', s.updated_at,
      'score', round(CAST((
        (s.exact_product_match * 0.22)::numeric +
        (s.exact_error_match * 0.26)::numeric +
        (s.same_category_match * 0.08)::numeric +
        (s.same_system_history_match * 0.08)::numeric +
        (LEAST(1::numeric, s.fts_rank) * 0.14) +
        (LEAST(1::numeric, s.keyword_similarity) * 0.08) +
        (s.effectiveness_norm * 0.07) +
        (s.usage_norm * 0.04) +
        (LEAST(1::numeric, GREATEST(0::numeric, s.freshness_score)) * 0.02) +
        (s.recency_norm * 0.01)
      ) AS numeric), 4)
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