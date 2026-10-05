DROP POLICY IF EXISTS "Solicitações storage: autor não apaga" ON storage.objects;
DROP POLICY IF EXISTS "Ver setores" ON public.sectors;
CREATE POLICY "Ver setores" ON public.sectors FOR SELECT TO authenticated
USING (public.is_active_authorized_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));