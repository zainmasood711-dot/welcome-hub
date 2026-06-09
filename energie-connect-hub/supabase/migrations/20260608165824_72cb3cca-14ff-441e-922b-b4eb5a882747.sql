CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_attachment_path(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attachments att
    LEFT JOIN public.assignments a
      ON (
        (att.attachable_type = 'assignment' AND a.id = att.attachable_id)
        OR (att.attachable_type = 'ticket' AND a.ticket_id = att.attachable_id)
      )
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE att.file_path = _path
      AND public.has_role(auth.uid(), 'field_engineer')
      AND p.engineer_id IS NOT NULL
      AND a.engineer_id = p.engineer_id
  );
$$;