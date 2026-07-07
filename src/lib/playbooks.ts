// Curated library of known recruitment scam playbooks. Each entry is a scam
// family with its telltale signals and the ordered steps scammers typically
// run. The narrative LLM matches evidence against this library and predicts
// what the scammer will ask for next.

export type Playbook = {
  id: string;
  name: string;
  summary: string;
  signals: string[];
  steps: string[]; // ordered attacker moves
  advice: string;
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: "equipment_advance",
    name: "Equipment / Laptop Advance",
    summary: "Fake employer 'ships' a laptop and asks you to pay for it upfront, promising first-paycheck reimbursement.",
    signals: ["mentions company laptop", "asks for advance payment", "'reimbursed in first salary'", "courier delay"],
    steps: [
      "Fast offer with minimal or no interview",
      "Onboarding email with fake HR portal",
      "Courier 'attempts delivery' of equipment",
      "You are asked to pay ₹8k–₹45k / $150–$600 for laptop insurance or customs",
      "After payment, contact goes silent",
    ],
    advice: "No legitimate employer ever charges you for equipment. Stop, do not pay, and report to the platform where you found the recruiter.",
  },
  {
    id: "training_fee",
    name: "Training / Certification Fee",
    summary: "Job is contingent on paying for a 'mandatory training', 'certification', or 'portal activation'.",
    signals: ["training fee", "certification fee", "activation fee", "portal login purchase", "refundable deposit"],
    steps: [
      "Offer arrives without a real interview",
      "You are told training is mandatory before joining",
      "Payment link for ₹499–₹4,999 (India) or $49–$299 (US) is sent",
      "After payment, either silence or upsell to a bigger 'premium' training",
    ],
    advice: "Real employers pay for your training. Any recruitment step that requires you to pay is a scam.",
  },
  {
    id: "check_overpayment",
    name: "Check Overpayment / Fake Deposit",
    summary: "Employer sends a check or wire transfer for more than needed and asks you to refund the difference.",
    signals: ["overpayment", "refund the difference", "buy equipment on our behalf", "gift cards", "money order"],
    steps: [
      "You are hired instantly and 'sent funds' for a home-office setup",
      "The check or ACH clears provisionally in your bank",
      "You are asked to wire the surplus to a vendor",
      "Days later the original deposit bounces, leaving you liable",
    ],
    advice: "Never accept a payment and forward part of it elsewhere. Wait 10 business days for full clearance before touching any funds an 'employer' sends.",
  },
  {
    id: "crypto_payroll",
    name: "Crypto / USDT Payroll",
    summary: "Legit-sounding role that insists on payroll in cryptocurrency, or asks you to hold funds in a crypto wallet.",
    signals: ["payroll in USDT", "bitcoin wallet", "we pay in crypto", "hold funds for us", "crypto onboarding bonus"],
    steps: [
      "Recruiter contacts on Telegram or WhatsApp only",
      "Role is remote, unusually high salary in USDT",
      "You are asked to install a wallet and receive a 'signing bonus'",
      "Then asked to forward funds, invest a deposit, or share the seed phrase",
    ],
    advice: "No legitimate employer requires crypto onboarding. Any request for a wallet, private key, or seed phrase is a scam.",
  },
  {
    id: "task_pyramid",
    name: "Task-Scam Pyramid",
    summary: "'Simple daily tasks' (like/rate/review) with commissions that require you to top up your account to unlock higher tiers.",
    signals: ["daily tasks", "commission per task", "recharge to unlock", "VIP tier", "combination tasks"],
    steps: [
      "Recruiter offers ₹300–₹5,000 per day for 'app rating' or 'YouTube liking'",
      "You do a few tasks, small commissions arrive",
      "A 'combination task' requires you to deposit money to unlock",
      "The deposit and all earnings vanish",
    ],
    advice: "Any job that requires you to deposit your own money to earn more is a pyramid scam. Withdraw whatever you can immediately and cut contact.",
  },
  {
    id: "visa_processing",
    name: "Visa / Relocation Fee",
    summary: "Foreign 'employer' offers a role abroad and asks you to pay visa, relocation, or immigration processing fees.",
    signals: ["visa processing fee", "relocation deposit", "immigration lawyer fee", "work permit fee"],
    steps: [
      "Offer for a role in UK, Canada, Germany, or the Gulf, well above local rate",
      "HR emails from a free provider or a lookalike domain",
      "You are asked to pay a visa consultant they recommend",
      "Consultant collects the fee then disappears",
    ],
    advice: "Legitimate international employers use their own immigration lawyers and never route fees through the candidate.",
  },
  {
    id: "fake_hr_portal",
    name: "Fake HR Onboarding Portal",
    summary: "Slick-looking onboarding portal that harvests government ID, bank details, and passwords.",
    signals: ["onboarding portal", "verify Aadhaar", "upload PAN", "bank passbook", "salary account setup"],
    steps: [
      "You are pushed to a portal on a lookalike domain",
      "Portal asks for full ID, bank credentials, and sometimes an OTP",
      "Identity is resold, bank account drained, or your identity is used to open mule accounts",
    ],
    advice: "Real employers verify ID after you sign the offer, on official domains, and never ask for OTP or bank login.",
  },
  {
    id: "reshipper_mule",
    name: "Package Reshipper / Money Mule",
    summary: "'Logistics coordinator' or 'quality inspector' role where you receive parcels or payments and forward them.",
    signals: ["reship packages", "quality inspect items", "receive payment on our behalf", "forward transactions"],
    steps: [
      "You are hired as a remote logistics or QA agent",
      "Packages arrive at your address; you ship them internationally",
      "OR: money arrives in your account; you transfer it onward",
      "You are unknowingly laundering stolen goods or funds and may be prosecuted",
    ],
    advice: "This is a money-mule scheme. Stop receiving and forwarding anything, keep records, and consider filing a police report.",
  },
  {
    id: "whatsapp_only_recruiter",
    name: "WhatsApp / Telegram-Only Recruiter",
    summary: "Recruiter refuses any verifiable channel and pushes the entire hiring flow through personal chat apps.",
    signals: ["WhatsApp only", "Telegram interview", "no video call", "no LinkedIn message"],
    steps: [
      "Introduction on WhatsApp / Telegram from an unknown number",
      "Text-only 'interview' with copy-pasted questions",
      "Instant offer, urgency, one of the payment/deposit playbooks follows",
    ],
    advice: "Insist on a company email and a video call on the company's official platform. A recruiter who refuses is not a recruiter.",
  },
  {
    id: "brand_impersonation",
    name: "Brand Impersonation",
    summary: "Scammer uses a famous employer's name (Google, Amazon, Microsoft, TCS, Infosys) with an unofficial email domain.",
    signals: ["mentions Fortune-500 company", "recruiter uses gmail/outlook", "lookalike domain", "logo copied"],
    steps: [
      "Message name-drops a well-known company",
      "Reply-to is a personal or lookalike domain",
      "Offer letter uses copied logos and letterhead",
      "One of the other playbooks follows",
    ],
    advice: "Look up the company's careers page directly and confirm the recruiter through a verified employee on LinkedIn before proceeding.",
  },
  {
    id: "data_entry_advance",
    name: "Data Entry Advance Fee",
    summary: "'Home-based data entry' role that requires paying for software, keyboard, or a starter kit.",
    signals: ["data entry work", "starter kit fee", "software license fee", "typing test fee"],
    steps: [
      "Ad promises high pay for basic typing",
      "You must buy software, a login kit, or specific hardware",
      "Payment is via UPI / gift card / crypto",
      "No real work materialises",
    ],
    advice: "There is no legitimate data-entry role that charges you for a starter kit.",
  },
  {
    id: "job_interview_gc",
    name: "Interview Gift-Card Scam",
    summary: "During or after 'interview', the 'manager' urgently asks you to buy gift cards for a client / off-site meeting.",
    signals: ["gift cards", "Amazon voucher", "client meeting emergency", "reimbursed later"],
    steps: [
      "Manager pretends to be in a meeting and messages you privately",
      "Urgently needs you to buy gift cards and share the codes",
      "Promises reimbursement in your first cheque",
    ],
    advice: "No manager will ever ask you to buy gift cards. Verify the request on a different channel with the real person.",
  },
];

export type PlaybookMatch = {
  playbook_id: string | null;
  playbook_name: string | null;
  confidence: number; // 0..1
  matched_signals: string[];
  current_step_index: number | null;
  next_move: string | null;
  what_to_do: string;
};
