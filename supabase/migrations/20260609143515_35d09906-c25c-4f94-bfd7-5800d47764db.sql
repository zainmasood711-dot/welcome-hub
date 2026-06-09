ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS location_coordinates TEXT;

ALTER TABLE public.assignments
  ALTER COLUMN ticket_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

ALTER TABLE public.knowledge_feedback
  ALTER COLUMN is_helpful DROP NOT NULL;