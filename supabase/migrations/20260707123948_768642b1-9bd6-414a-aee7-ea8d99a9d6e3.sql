DROP POLICY IF EXISTS "authenticated can insert public reports" ON public.public_reports;
DROP POLICY IF EXISTS "authenticated can update public reports" ON public.public_reports;

CREATE POLICY "owners can insert their public reports"
  ON public.public_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    investigation_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.investigations i
      WHERE i.id = investigation_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can update their public reports"
  ON public.public_reports FOR UPDATE
  TO authenticated
  USING (
    investigation_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.investigations i
      WHERE i.id = investigation_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    investigation_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.investigations i
      WHERE i.id = investigation_id AND i.user_id = auth.uid()
    )
  );