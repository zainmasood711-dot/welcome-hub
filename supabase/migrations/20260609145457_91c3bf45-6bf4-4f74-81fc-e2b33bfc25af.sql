ALTER TABLE public.knowledge_base
  DROP CONSTRAINT IF EXISTS knowledge_base_source_check;

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_source_check
  CHECK (source IN ('manual', 'auto_from_ticket', 'auto_from_assignment'));

UPDATE public.knowledge_base
SET source = 'auto_from_ticket'
WHERE source = 'ticket';