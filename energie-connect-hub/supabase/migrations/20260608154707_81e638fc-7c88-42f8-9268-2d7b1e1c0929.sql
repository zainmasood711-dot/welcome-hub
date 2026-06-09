REVOKE ALL ON FUNCTION public.log_sensitive_action() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_sensitive_action() FROM anon;
REVOKE ALL ON FUNCTION public.log_sensitive_action() FROM authenticated;
REVOKE ALL ON FUNCTION public.log_sensitive_action() FROM service_role;

REVOKE ALL ON FUNCTION public.can_access_attachment_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_attachment_path(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_path(TEXT) TO service_role;