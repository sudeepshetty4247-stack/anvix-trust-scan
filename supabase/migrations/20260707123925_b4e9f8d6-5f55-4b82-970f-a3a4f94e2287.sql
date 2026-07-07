ALTER TABLE public.investigations ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

CREATE TABLE public.public_reports (
  slug TEXT PRIMARY KEY,
  investigation_id UUID REFERENCES public.investigations(id) ON DELETE SET NULL,
  case_name TEXT NOT NULL,
  verdict TEXT NOT NULL,
  trust_score INTEGER NOT NULL,
  confidence_low INTEGER NOT NULL,
  confidence_high INTEGER NOT NULL,
  band_reason TEXT NOT NULL DEFAULT '',
  top_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_fingerprints JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'guest',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '90 days'
);

CREATE INDEX public_reports_created_idx ON public.public_reports (created_at DESC);
CREATE INDEX public_reports_expires_idx ON public.public_reports (expires_at);

GRANT SELECT ON public.public_reports TO anon;
GRANT SELECT, INSERT, UPDATE ON public.public_reports TO authenticated;
GRANT ALL ON public.public_reports TO service_role;

ALTER TABLE public.public_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reports readable while valid"
  ON public.public_reports FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "authenticated can insert public reports"
  ON public.public_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated can update public reports"
  ON public.public_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);