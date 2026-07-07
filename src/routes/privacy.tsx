import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ANVIX Job Scam Investigator" },
      {
        name: "description",
        content:
          "How the ANVIX web app and Chrome extension collect, hash, and store data. No PII leaves your browser without your consent.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <h1 className="mb-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: 7 July 2026</p>

      <section className="space-y-4 text-sm leading-6">
        <p>
          ANVIX ("we", "the extension") is a job-scam investigation tool built as both a web
          application and a Chrome browser extension. This page explains exactly what data the
          extension and the web app touch, and what they do <em>not</em>.
        </p>

        <h2 className="mt-8 text-xl font-semibold">1. What the Chrome extension collects</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Only text you explicitly select and right-click →&nbsp;<em>Investigate with ANVIX</em>.</strong>
            The extension does not read pages in the background, does not track browsing, and does not
            inject scripts into any page you have not asked it to investigate.
          </li>
          <li>
            The URL and title of the current tab, so the investigation can show where the message came from.
          </li>
          <li>
            The last 5 pages you investigated, stored locally with <code>chrome.storage.local</code>.
            This never leaves your browser.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">2. What the web app collects</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Investigation input you paste or upload (message text, offer PDFs, screenshots). This is
            stored in your account so you can return to the report.
          </li>
          <li>
            Optional email + password if you choose to sign in. Auth is handled by Supabase Auth.
          </li>
          <li>
            <strong>Community signals are one-way hashed</strong> with SHA-256 plus a shared pepper
            before they leave your browser. The raw email, phone, or handle never reaches our
            database — only the hash does. See <code>src/lib/global-signals.functions.ts</code>.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">3. What we do NOT do</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>We do not sell or share personal data with third parties.</li>
          <li>We do not run ads or third-party trackers.</li>
          <li>We do not read pages you have not asked the extension to investigate.</li>
          <li>We do not store the raw value of any hashed signal.</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">4. Third-party services</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Supabase — database, authentication, and file storage for evidence.</li>
          <li>Cloudflare Workers — hosts the web app.</li>
          <li>Lovable AI Gateway — used to generate the investigation narrative from your input.</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">5. Deleting your data</h2>
        <p>
          Signed-in users can delete any investigation from their dashboard, which purges the
          underlying evidence, signals, and PDF. To delete your account entirely, email{" "}
          <a href="mailto:hello@anvix.app" className="underline">
            hello@anvix.app
          </a>
          .
        </p>

        <h2 className="mt-8 text-xl font-semibold">6. Contact</h2>
        <p>
          Questions? Reach us at{" "}
          <a href="mailto:hello@anvix.app" className="underline">
            hello@anvix.app
          </a>
          .
        </p>
      </section>
    </main>
  );
}
