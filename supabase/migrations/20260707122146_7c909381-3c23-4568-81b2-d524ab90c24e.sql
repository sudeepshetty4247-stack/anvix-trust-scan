-- Enum for signal categories
CREATE TYPE public.signal_kind AS ENUM ('email','phone','domain','recruiter','payment_handle','offer_pattern');
CREATE TYPE public.signal_severity AS ENUM ('info','warning','high','critical');

CREATE TABLE public.global_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hash TEXT NOT NULL,
  kind public.signal_kind NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 1,
  severity public.signal_severity NOT NULL DEFAULT 'warning',
  sample_context TEXT,
  source TEXT NOT NULL DEFAULT 'user_report',
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (hash, kind)
);

CREATE INDEX global_signals_hash_kind_idx ON public.global_signals (hash, kind);
CREATE INDEX global_signals_last_seen_idx ON public.global_signals (last_seen DESC);

GRANT SELECT ON public.global_signals TO anon;
GRANT SELECT, INSERT, UPDATE ON public.global_signals TO authenticated;
GRANT ALL ON public.global_signals TO service_role;

ALTER TABLE public.global_signals ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can read the aggregate rows (no PII stored)
CREATE POLICY "global_signals readable to all"
  ON public.global_signals FOR SELECT
  TO anon, authenticated
  USING (true);

-- Signed-in users can insert new signals (upsert flow from server fn)
CREATE POLICY "authenticated can insert signals"
  ON public.global_signals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Signed-in users can bump report_count / last_seen on existing rows
CREATE POLICY "authenticated can update signal counts"
  ON public.global_signals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Per-investigation match record (which signals fired for which investigation)
CREATE TABLE public.investigation_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  signal_id UUID NOT NULL REFERENCES public.global_signals(id) ON DELETE CASCADE,
  matched_value_preview TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, signal_id)
);

CREATE INDEX investigation_signals_investigation_idx ON public.investigation_signals (investigation_id);

GRANT SELECT, INSERT, DELETE ON public.investigation_signals TO authenticated;
GRANT ALL ON public.investigation_signals TO service_role;

ALTER TABLE public.investigation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own investigation signals"
  ON public.investigation_signals FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
