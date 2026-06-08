ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS error_code_id UUID REFERENCES public.error_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_error_code_id ON public.tickets(error_code_id);