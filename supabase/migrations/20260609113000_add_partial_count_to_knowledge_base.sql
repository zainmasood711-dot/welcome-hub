ALTER TABLE public.knowledge_base
ADD COLUMN IF NOT EXISTS partial_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.knowledge_base kb
SET partial_count = src.partial_count
FROM (
  SELECT knowledge_base_id, COUNT(*)::INTEGER AS partial_count
  FROM public.knowledge_feedback
  WHERE rating = 'partial'
  GROUP BY knowledge_base_id
) AS src
WHERE kb.id = src.knowledge_base_id;
