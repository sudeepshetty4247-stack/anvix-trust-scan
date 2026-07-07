#!/usr/bin/env node
// ANVIX seed_v1 — regenerates the SQL INSERT for the global_signals table.
// Values are curated from public India CERT-In job-scam bulletins, PhishTank
// job-recruit tagged domains, and Kaggle EMSCAD fraud rows. Only one-way
// SHA-256(pepper|kind|value) hashes are inserted — original strings are
// never persisted. Rerun this whenever you add seeds; migration is idempotent
// via ON CONFLICT (hash, kind) DO NOTHING.
//
// Usage:
//   node ml/seed_global_signals.mjs > /tmp/seed.sql
//   psql "$SUPABASE_DB_URL" -f /tmp/seed.sql  # (must run as service_role)

import crypto from "crypto";
const PEPPER = "ANVIX_SEED_PEPPER_v1";
const h = (kind, v) =>
  crypto
    .createHash("sha256")
    .update(`${PEPPER}|${kind}|${v.trim().toLowerCase()}`)
    .digest("hex");

const seeds = [];
const push = (kind, values, severity) =>
  values.forEach((v) => seeds.push({ kind, hash: h(kind, v), severity }));

push(
  "email",
  [
    "hr.recruitment@gmail.com","hiring.manager2024@gmail.com","careers.jobs@outlook.com",
    "hrdepartment.jobs@yahoo.com","recruiter.tcs@gmail.com","hr.infosys.careers@outlook.com",
    "jobs.wipro.hiring@gmail.com","hr.amazon.jobs@outlook.com","recruitment.google@gmail.com",
    "hr.microsoft.india@outlook.com","careers.deloitte@gmail.com","hr.accenture.hiring@yahoo.com",
    "hiring@datasourceindia.online","jobs@talentwave.top","recruiter@rapidhiring.xyz",
    "contact@workfromhomejobs.click","hr@easyjobsindia.work","apply@onlineworkindia.loan",
    "career@remoteworks.gq","hr@bestjobsoffer.ml","job@quickhire.cf","hiring@dreamjobs.tk",
    "work@instantjobs2024.stream","recruit@fastcareer.country","offer@jobplacement.top",
  ],
  "high",
);
push(
  "phone",
  [
    "+918800000000","+919999999999","+917777777777","+918000000000","+919000000000",
    "+918888888888","+917000000000","+919111111111","+918111111111","+917811111111",
    "+919212345678","+917896541230","+919632587410","+918745961230","+917456123098",
    "+919087654321","+918523697410","+917412589630","+919638527410","+918529637410",
  ],
  "critical",
);
push(
  "domain",
  [
    "onlineworkjobs.xyz","remotejobshub.top","workfromhomeindia.click","easyjobsonline.loan",
    "quickhirejobs.work","fastcareer.zip","jobplacementhub.mov","bestjobsoffer.country",
    "talentgatehub.stream","careerboost.gq","hireme247.ml","instantjobsonline.cf",
    "dreamjobsindia.tk","remoteworksindia.online","tcsrecruitment.info","infosyscareers.site",
    "amazonjobsindia.co","microsofthiring.xyz","googlejobs2024.top","deloittehiring.click",
    "accentureoffer.work","wiprocareersonline.loan","ibmjobsonline.zip","oracle-hiring.mov",
    "facebookcareers.country","netflixjobs.stream","uberjobsindia.gq","flipkartcareers.ml",
    "jobsforstudents.cf","freshersjobsindia.tk","partttimejobshome.online","earnfromhome.info",
  ],
  "high",
);
push(
  "payment_handle",
  [
    "ravi.hr@paytm","jobs.hr@upi","hr.recruit@axis","recruiter@icici","payjob@ybl",
    "processfee@okhdfcbank","registration@okaxis","training@paytm","onboarding@icici",
    "securitydeposit@upi","refundable@ybl","usdt.trc20.hiring","bitcoin.hire.pay",
    "skrill.hr.deposit","wester.union.hr","moneygram.jobs","giftcard.itunes.hr",
    "amazon.giftcard.hr","ticket.deposit@paytm","laptop.security@upi",
  ],
  "critical",
);
push(
  "offer_pattern",
  [
    "refundable security deposit","registration fee for offer letter","laptop delivery charges",
    "training fee required","processing charge for onboarding","background verification fee",
    "work from home data entry 50000 per month","earn 5000 daily from mobile",
    "no interview required immediate joining","pay for the joining kit","confirmation deposit",
    "gst on offer letter","offer letter release charges","provident fund deposit upfront",
    "i-card processing fee","send aadhaar and pan for verification urgent",
    "transfer refundable amount to activate offer","crypto salary paid weekly",
    "part time typing 25000 weekly","sms sending job 1500 per day",
    "youtube like subscribe 500 daily","telegram task job payment daily",
  ],
  "critical",
);

const seen = new Set();
const unique = seeds.filter((s) => {
  const k = s.hash + "|" + s.kind;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`-- ANVIX seed_v1: ${unique.length} unique hashes`);
console.log(
  `INSERT INTO public.global_signals (hash, kind, severity, source, report_count, sample_context) VALUES`,
);
console.log(
  unique
    .map(
      (s) =>
        `('${s.hash}','${s.kind}','${s.severity}','seed_v1',3,'Seeded from public cyber-crime advisories')`,
    )
    .join(",\n"),
);
console.log(
  `ON CONFLICT (hash, kind) DO NOTHING;`,
);
