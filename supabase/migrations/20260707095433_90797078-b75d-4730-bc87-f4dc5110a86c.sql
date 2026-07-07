
-- Enums
CREATE TYPE public.investigation_status AS ENUM ('draft','collecting','verifying','scoring','explaining','completed','failed');
CREATE TYPE public.risk_category AS ENUM ('trusted','likely_safe','caution','high_risk','fraudulent');
CREATE TYPE public.evidence_kind AS ENUM ('url','file','text');
CREATE TYPE public.verification_status AS ENUM ('pending','running','pass','fail','warning','skipped');

-- Investigations
CREATE TABLE public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.investigation_status NOT NULL DEFAULT 'draft',
  trust_score numeric,
  risk_category public.risk_category,
  best_model text,
  progress int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigations TO authenticated;
GRANT ALL ON public.investigations TO service_role;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investigations" ON public.investigations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Evidence
CREATE TABLE public.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.evidence_kind NOT NULL,
  label text,
  content text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence TO authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own evidence" ON public.evidence FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.evidence(investigation_id);

-- Verifications
CREATE TABLE public.verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  check_name text NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 1,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verifications TO authenticated;
GRANT ALL ON public.verifications TO service_role;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own verifications" ON public.verifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.verifications(investigation_id);

-- ML predictions
CREATE TABLE public.ml_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_used text NOT NULL,
  prediction_score numeric NOT NULL,
  confidence numeric NOT NULL,
  risk_category public.risk_category NOT NULL,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_importance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_predictions TO authenticated;
GRANT ALL ON public.ml_predictions TO service_role;
ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own predictions" ON public.ml_predictions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.ml_predictions(investigation_id);

-- Trust reports
CREATE TABLE public.trust_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text NOT NULL,
  positive_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL,
  full_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_reports TO authenticated;
GRANT ALL ON public.trust_reports TO service_role;
ALTER TABLE public.trust_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports" ON public.trust_reports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Activities (live log)
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.activities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.activities(investigation_id, created_at);

-- Realtime for live progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.investigations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.verifications;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER investigations_touch BEFORE UPDATE ON public.investigations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage RLS policies for the evidence bucket (per-user folder)
CREATE POLICY "evidence read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "evidence insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "evidence delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
