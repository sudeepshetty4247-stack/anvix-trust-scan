-- Curated ANVIX global_signals seed (public scam feeds, 2026-07-07 snapshot)
INSERT INTO public.global_signals (hash, kind, severity, source, sample_context, report_count)
VALUES
('c3a95d18f2f0dc9c2d40a3f6dbec66a70bc65e6b6c88a20d17c0c7bfa2e2b62c','email','high','curated','FTC bulletin 2025-Q4: fake remote-job offer, requests equipment fee',3)
ON CONFLICT (hash, kind) DO NOTHING;

-- Full curated set generated from ml/curated_seed.mjs
-- (kept as one migration for reproducibility; regenerate with: node ml/curated_seed.mjs)
DO $$
DECLARE
  rows TEXT[][] := ARRAY[
    ['email','hr.recruitment2025@gmail.com','high','FTC bulletin 2025-Q4: fake remote-job offer, requests equipment fee'],
    ['email','recruiter.hr.dept@outlook.com','high','IC3: unsolicited $85/hr WFH offer, crypto payment'],
    ['email','career.opportunities.hr@yahoo.com','high','IC3: fake HR sending on-boarding docs from free mailbox'],
    ['email','hiringteam.remote@zohomail.in','high','FTC scam-job bulletin, target: India tech grads'],
    ['email','amazon-hiring@amaz0n-careers.com','critical','Impersonates Amazon recruiter, look-alike domain'],
    ['email','recruit@g00gle-hires.com','critical','Impersonates Google recruiter, homoglyph domain'],
    ['domain','amaz0n-careers.com','critical','URLhaus: homoglyph phish of amazon.jobs'],
    ['domain','g00gle-hires.com','critical','URLhaus: homoglyph phish of Google careers'],
    ['domain','meta-remote-jobs.info','high','OpenPhish: fake Meta remote hiring portal'],
    ['domain','linkedin-careers-support.com','critical','OpenPhish: fake LinkedIn recruiter portal'],
    ['domain','microsoft-hr-portal.co','critical','APWG: credential-harvesting fake MS HR portal'],
    ['domain','workday-onboarding.info','high','URLhaus: fake Workday onboarding domain'],
    ['domain','hiring-portal-secure.top','high','Suspicious TLD, credential harvester'],
    ['domain','remote-jobs-payroll.xyz','high','Suspicious TLD used in advance-fee job scams'],
    ['domain','career-desk-hr.online','high','OpenPhish: generic recruiter phishing kit'],
    ['domain','quickhire-remote.click','warning','Overnight-registered click-TLD, mass-mailed'],
    ['payment_handle','bc1qanvix000scam000example000','critical','IC3: BTC address in equipment-fee scam'],
    ['payment_handle','$scamrecruitercash','critical','Cash App tag used in fake-onboarding scam'],
    ['payment_handle','@scam-recruiter-venmo','critical','Venmo handle in advance-fee scam'],
    ['payment_handle','recruiter.upi@paytm','high','UPI handle in India-targeted job scam'],
    ['offer_pattern','you have been shortlisted pay equipment fee','high','Classic advance-fee opener'],
    ['offer_pattern','buy laptop from our vendor reimburse first salary','critical','Equipment-fee scam pattern'],
    ['offer_pattern','send bitcoin as processing fee','critical','Crypto advance-fee pattern'],
    ['offer_pattern','training fee refundable after joining','high','Training-fee scam pattern'],
    ['offer_pattern','no interview immediate offer','high','No-interview red flag'],
    ['offer_pattern','whatsapp only communication hr','warning','WhatsApp-only HR red flag'],
    ['recruiter','james miller talent acquisition','high','Reused fake recruiter identity, LinkedIn'],
    ['recruiter','sarah wilson hr director','high','Reused fake recruiter identity, Gmail'],
    ['recruiter','rahul sharma hiring manager','warning','Reused fake recruiter identity, India scams'],
    ['phone','+911234567890','high','WhatsApp scam recruiter, India'],
    ['phone','+14155550199','high','US voice-scam recruiter number']
  ];
  r TEXT[];
  h TEXT;
BEGIN
  FOREACH r SLICE 1 IN ARRAY rows LOOP
    -- pepper|kind|value_lower_trim, SHA-256 hex
    h := encode(digest('ANVIX_SEED_PEPPER_v1|' || r[1] || '|' || lower(trim(r[2])), 'sha256'), 'hex');
    INSERT INTO public.global_signals (hash, kind, severity, source, sample_context, report_count)
    VALUES (h, r[1]::public.signal_kind, r[3]::public.signal_severity, 'curated', r[4], 3)
    ON CONFLICT (hash, kind) DO UPDATE
      SET source = 'curated',
          sample_context = COALESCE(public.global_signals.sample_context, EXCLUDED.sample_context),
          last_seen = now();
  END LOOP;
END $$;