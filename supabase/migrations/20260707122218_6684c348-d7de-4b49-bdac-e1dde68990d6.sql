DROP POLICY "authenticated can insert signals" ON public.global_signals;
DROP POLICY "authenticated can update signal counts" ON public.global_signals;
REVOKE INSERT, UPDATE ON public.global_signals FROM authenticated;
-- SELECT for anon/authenticated remains; INSERT/UPDATE are now service_role only.
