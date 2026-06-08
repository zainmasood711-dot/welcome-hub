CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  governorate TEXT,
  city TEXT,
  address TEXT,
  location_coordinates TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.customer_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  system_name TEXT NOT NULL,
  installation_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_systems TO authenticated;
GRANT ALL ON public.customer_systems TO service_role;
ALTER TABLE public.customer_systems ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.system_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_system_id UUID NOT NULL REFERENCES public.customer_systems(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  serial_number TEXT,
  warranty_status TEXT NOT NULL DEFAULT 'unknown' CHECK (warranty_status IN ('valid', 'expired', 'unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_assets TO authenticated;
GRANT ALL ON public.system_assets TO service_role;
ALTER TABLE public.system_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  solution_steps TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  error_code_text TEXT,
  search_keywords TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_from_ticket')),
  linked_ticket_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  effectiveness_rate NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  customer_system_id UUID REFERENCES public.customer_systems(id),
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('fault', 'inquiry', 'preventive_maintenance', 'new_installation')),
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'resolved_remote', 'assigned_field', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  affected_product_id UUID REFERENCES public.products(id),
  error_code_text TEXT,
  solution_type TEXT CHECK (solution_type IN ('remote', 'field', 'bring_to_center', 'no_fix_needed')),
  remote_solution_notes TEXT,
  knowledge_base_id UUID REFERENCES public.knowledge_base(id),
  created_by UUID REFERENCES public.profiles(id),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  customer_system_id UUID REFERENCES public.customer_systems(id) ON DELETE SET NULL,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id),
  assigned_by UUID REFERENCES public.profiles(id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('repair_visit', 'new_installation')),
  scheduled_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  work_done TEXT,
  difficulties TEXT,
  recommendations TEXT,
  submitted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignments_target_check CHECK (ticket_id IS NOT NULL OR customer_system_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachable_type TEXT NOT NULL CHECK (attachable_type IN ('ticket', 'assignment', 'knowledge_base')),
  attachable_id UUID NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'battery_file', 'document')),
  file_path TEXT NOT NULL,
  original_name TEXT,
  file_size INTEGER,
  description TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.knowledge_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id),
  rating TEXT NOT NULL CHECK (rating IN ('success', 'failure', 'partial')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_feedback TO authenticated;
GRANT ALL ON public.knowledge_feedback TO service_role;
ALTER TABLE public.knowledge_feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  target_role public.app_role,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  related_type TEXT,
  related_id UUID,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_error_code_text ON public.tickets(error_code_text);
CREATE INDEX idx_assignments_engineer_id ON public.assignments(engineer_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_knowledge_base_product_id ON public.knowledge_base(product_id);
CREATE INDEX idx_knowledge_base_error_code_text ON public.knowledge_base(error_code_text);

CREATE POLICY customers_support_full ON public.customers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY customers_manager_read ON public.customers
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY customers_field_assigned_read ON public.customers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE p.engineer_id = a.engineer_id
      AND (
        a.ticket_id IN (
          SELECT t.id FROM public.tickets t WHERE t.customer_id = customers.id
        )
        OR a.customer_system_id IN (
          SELECT cs.id FROM public.customer_systems cs WHERE cs.customer_id = customers.id
        )
      )
  )
);

CREATE POLICY customer_systems_support_full ON public.customer_systems
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY customer_systems_manager_read ON public.customer_systems
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY customer_systems_field_assigned_read ON public.customer_systems
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE p.engineer_id = a.engineer_id
      AND (a.customer_system_id = customer_systems.id OR a.ticket_id IN (
        SELECT t.id FROM public.tickets t WHERE t.customer_system_id = customer_systems.id
      ))
  )
);

CREATE POLICY system_assets_support_full ON public.system_assets
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY system_assets_manager_read ON public.system_assets
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY system_assets_field_assigned_read ON public.system_assets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE p.engineer_id = a.engineer_id
      AND a.customer_system_id = system_assets.customer_system_id
  )
);

CREATE POLICY tickets_support_full ON public.tickets
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY tickets_manager_read ON public.tickets
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY tickets_field_assigned_read ON public.tickets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE p.engineer_id = a.engineer_id
      AND a.ticket_id = tickets.id
  )
);

CREATE POLICY knowledge_base_support_full ON public.knowledge_base
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY knowledge_base_manager_read ON public.knowledge_base
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY knowledge_base_field_read ON public.knowledge_base
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'field_engineer'));

CREATE POLICY assignments_support_full ON public.assignments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY assignments_manager_read ON public.assignments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY assignments_field_own_read ON public.assignments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.engineer_id = assignments.engineer_id
  )
);

CREATE POLICY assignments_field_own_update ON public.assignments
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.engineer_id = assignments.engineer_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.engineer_id = assignments.engineer_id
  )
);

CREATE POLICY attachments_support_full ON public.attachments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY attachments_manager_read ON public.attachments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY attachments_field_assigned_read ON public.attachments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND (
    (attachable_type = 'assignment' AND EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE a.id = attachments.attachable_id AND p.engineer_id = a.engineer_id
    ))
    OR
    (attachable_type = 'ticket' AND EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE a.ticket_id = attachments.attachable_id AND p.engineer_id = a.engineer_id
    ))
  )
);

CREATE POLICY attachments_field_insert ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'field_engineer')
  AND uploaded_by = auth.uid()
);

CREATE POLICY knowledge_feedback_support_full ON public.knowledge_feedback
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY knowledge_feedback_manager_read ON public.knowledge_feedback
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY knowledge_feedback_field_insert_select ON public.knowledge_feedback
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.engineer_id = knowledge_feedback.engineer_id
  )
);

CREATE POLICY knowledge_feedback_field_insert ON public.knowledge_feedback
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'field_engineer')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.engineer_id = knowledge_feedback.engineer_id
  )
);

CREATE POLICY notifications_support_full ON public.notifications
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'support_engineer'))
WITH CHECK (public.has_role(auth.uid(), 'support_engineer'));

CREATE POLICY notifications_manager_read ON public.notifications
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY notifications_field_target_read ON public.notifications
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'field_engineer')
  AND (
    target_user_id = auth.uid()
    OR target_role = 'field_engineer'
    OR target_role IS NULL
  )
);

CREATE POLICY notification_reads_self_manage ON public.notification_reads
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_systems_updated_at
BEFORE UPDATE ON public.customer_systems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_assets_updated_at
BEFORE UPDATE ON public.system_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();