REVOKE EXECUTE ON FUNCTION public.demo_consume() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.demo_release() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_consume() TO service_role;
GRANT EXECUTE ON FUNCTION public.demo_release() TO service_role;