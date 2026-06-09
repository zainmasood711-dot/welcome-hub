REVOKE EXECUTE ON FUNCTION public.upsert_error_intelligence_alert(
  public.error_intelligence_alert_rule,
  public.error_intelligence_severity,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_error_intelligence_alert(
  public.error_intelligence_alert_rule,
  public.error_intelligence_severity,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_error_intelligence_alerts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_error_intelligence_alerts(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.trigger_evaluate_error_intelligence_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_evaluate_error_intelligence_alerts() TO service_role;