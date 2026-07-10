## Update `.env` with missing secret placeholders

I checked the current `.env` file and it only contains the six Supabase connection variables. It is missing the two server-only secrets that AI and threat-intel features need:

- `LOVABLE_API_KEY`
- `ANVIX_SIGNAL_PEPPER`

Both are already stored as Lovable Cloud secrets, but the local `.env` file needs placeholder lines with clear instructions so the user knows exactly what to paste.

### What will be changed

1. **Edit `.env`** to add:
   - `LOVABLE_API_KEY=""` with a comment explaining to copy the rotated key from Cloud → Settings → Secrets.
   - `ANVIX_SIGNAL_PEPPER=""` with a comment explaining to generate a random 32+ char string (e.g., `openssl rand -hex 32`).
2. **Leave existing Supabase variables untouched** — they are already correct.
3. **Do not write real secret values** — the actual values live in Lovable Cloud and are not exposed here.

### Result

The `.env` file will be a complete, ready-to-fill template. The user just needs to paste the two secret values and run `bun dev`.

No other files will be changed.