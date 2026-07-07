# Chrome Web Store — ANVIX submission checklist

Only a human can complete Chrome Web Store submission (developer account +
one-time $5 fee). Everything the review will ask for is already in this
repo; follow the steps below.

## 0. One-time setup
1. Create a Chrome developer account at
   <https://chrome.google.com/webstore/devconsole>.
2. Pay the one-time **$5** registration fee.
3. Verify your publisher contact email.

## 1. Build the package
```
bash scripts/build-extension.sh
# writes public/anvix-scanner-v1.0.0.zip
```

## 2. Create a new item
- **Package**: upload `public/anvix-scanner-v1.0.0.zip`.
- **Item name**: `ANVIX — Job Scam Investigator`
- **Summary (132 chars max)**: see `extension/store-listing.md`
- **Description**: paste the long description from `extension/store-listing.md`
- **Category**: `Productivity`
- **Language**: English

## 3. Assets
Upload from `extension/store-assets/`:
- 1 × store icon 128×128 (`icon-128.png`)
- 3-5 × screenshots 1280×800 (take these against the live app once)
- 1 × small promo tile 440×280 (optional but recommended)

## 4. Privacy tab
- **Single purpose**: "Let the user select suspicious job-offer text on
  LinkedIn/Gmail/WhatsApp/Outlook and send it to the ANVIX web app for a
  fraud investigation."
- **Permission justifications** (paste verbatim):
  - `contextMenus` — adds the right-click "Investigate with ANVIX" entry
    that is the only way the extension is triggered.
  - `activeTab` — reads the URL and title of the current tab only when the
    user clicks the context menu, so the report can reference the source.
  - `scripting` — reserved for future in-page verdict badge; not used to
    inject arbitrary scripts.
  - `storage` — stores the last 5 investigations locally so the popup can
    show recent history. Nothing is transmitted.
  - `host_permissions` — restricted to LinkedIn, Gmail, WhatsApp Web,
    Outlook. Only these hosts show the context menu.
- **Privacy policy URL**: `https://anvix-trust-scan.lovable.app/privacy`
- **Data handling disclosures**:
  - Personally identifiable information: *No*
  - Authentication information: *No*
  - Web history: *No*
  - User activity: *No*
  - Website content: *Yes — only text explicitly selected by the user*
- Certify: "I do not sell user data to third parties."

## 5. Distribution
- Visibility: **Public**
- Regions: All regions
- Pricing: Free

## 6. Submit
- Click **Submit for review**. Reviews usually take 1-3 business days.
- On approval, update `CHROME_STORE_URL` in `src/lib/constants.ts` with the
  live listing URL and redeploy. The "Add to Chrome" button in the app will
  point at the store instead of the ZIP download.

## Rejection recovery
If Google rejects, they always cite the specific policy violated. The
common ones for this extension:
- **Single purpose** — reply pointing to `manifest.json` (5 permissions,
  all used for the single "investigate selected text" flow).
- **Privacy policy** — confirm the URL is public and mentions every
  permission you declared.
- **Excessive permissions** — the manifest here already uses
  `host_permissions` for only 4 hosts, not `<all_urls>`.
