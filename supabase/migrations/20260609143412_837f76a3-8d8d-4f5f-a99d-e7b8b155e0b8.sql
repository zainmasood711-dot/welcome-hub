ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_code_id UUID REFERENCES public.error_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS solution_type TEXT CHECK (solution_type IN ('remote', 'field', 'bring_to_center', 'no_fix_needed')),
  ADD COLUMN IF NOT EXISTS remote_solution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_error_code_id ON public.tickets(error_code_id);

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS attachable_type TEXT CHECK (attachable_type IN ('ticket', 'assignment', 'knowledge_base')),
  ADD COLUMN IF NOT EXISTS attachable_id UUID,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS original_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.attachments
  ALTER COLUMN file_url DROP NOT NULL;

UPDATE public.attachments
SET attachable_type = CASE
      WHEN assignment_id IS NOT NULL THEN 'assignment'
      WHEN ticket_id IS NOT NULL THEN 'ticket'
      ELSE attachable_type
    END,
    attachable_id = CASE
      WHEN assignment_id IS NOT NULL THEN assignment_id
      WHEN ticket_id IS NOT NULL THEN ticket_id
      ELSE attachable_id
    END
WHERE attachable_type IS NULL OR attachable_id IS NULL;

UPDATE public.attachments
SET file_path = COALESCE(file_path, file_url),
    file_url = COALESCE(file_url, file_path)
WHERE file_path IS NULL OR file_url IS NULL;

CREATE OR REPLACE FUNCTION public.sync_attachment_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.attachable_type IS NULL THEN
    IF NEW.assignment_id IS NOT NULL THEN
      NEW.attachable_type := 'assignment';
    ELSIF NEW.ticket_id IS NOT NULL THEN
      NEW.attachable_type := 'ticket';
    END IF;
  END IF;

  IF NEW.attachable_id IS NULL THEN
    IF NEW.assignment_id IS NOT NULL THEN
      NEW.attachable_id := NEW.assignment_id;
    ELSIF NEW.ticket_id IS NOT NULL THEN
      NEW.attachable_id := NEW.ticket_id;
    END IF;
  END IF;

  IF NEW.assignment_id IS NULL AND NEW.attachable_type = 'assignment' THEN
    NEW.assignment_id := NEW.attachable_id;
  END IF;

  IF NEW.ticket_id IS NULL AND NEW.attachable_type = 'ticket' THEN
    NEW.ticket_id := NEW.attachable_id;
  END IF;

  IF NEW.file_path IS NULL THEN
    NEW.file_path := NEW.file_url;
  END IF;

  IF NEW.file_url IS NULL THEN
    NEW.file_url := NEW.file_path;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attachment_columns ON public.attachments;
CREATE TRIGGER trg_sync_attachment_columns
BEFORE INSERT OR UPDATE ON public.attachments
FOR EACH ROW
EXECUTE FUNCTION public.sync_attachment_columns();

ALTER TABLE public.knowledge_feedback
  ADD COLUMN IF NOT EXISTS engineer_id UUID REFERENCES public.engineers(id),
  ADD COLUMN IF NOT EXISTS rating TEXT CHECK (rating IN ('success', 'failure', 'partial')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.knowledge_feedback
SET rating = CASE WHEN is_helpful THEN 'success' ELSE 'failure' END
WHERE rating IS NULL;

ALTER TABLE public.knowledge_base
  DROP CONSTRAINT IF EXISTS knowledge_base_source_check;

ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_source_check
  CHECK (source IN ('manual', 'ticket', 'auto_from_ticket'));