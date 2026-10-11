# Activate email verification and private enquiries

The Vercel code is ready, but accounts, a verified sending domain and server secrets must be connected before real email delivery and storage work. No production database or account is created by publishing these files. Previous Cloudflare D1 records are not migrated.

1. Create a Supabase project. Run `supabase/setup.sql` in its SQL editor. All Rups tables have RLS enabled, no public policies and no anon/authenticated grants. Only server-side service_role can use them.
2. In Resend, add `rups.io` and add the DNS records Resend provides at your domain provider. Wait for Verified. Create an API key allowed to send from that domain.
3. In Vercel → rups → Settings → Environment Variables, add these for Production, as server-only values:
   - `APP_ORIGIN`: `https://rupsio.vercel.app` (change when moving to a custom domain).
   - `SUPABASE_URL`: your project's https URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: your project's service_role key. Never use a NEXT_PUBLIC/VITE prefix or put it in HTML.
   - `RESEND_API_KEY`: your sending key.
   - `RESEND_FROM`: `Rups <verification@rups.io>` after the domain is verified.
   - `OTP_SECRET`: a random secret, at least 32 characters.
   - `ADMIN_SETUP_HASH`: SHA-256 hex digest of a random 32-byte setup token (token encoded as 64 hex characters).
   - `ADMIN_SETUP_EXPIRES`: future expiry as Unix milliseconds; use a short window, such as one hour.
4. Redeploy. Open `https://rupsio.vercel.app/admin.html#setup=YOUR_TOKEN` privately and choose a password of at least 8 characters. The URL fragment is removed by the admin page. Setup works once. Remove ADMIN_SETUP_HASH and ADMIN_SETUP_EXPIRES after successful setup.
5. Sign in later at `https://rupsio.vercel.app/admin.html`. Only confirmed enquiries appear. Password changes invalidate other sessions.
6. Submit your own email through the demo form, enter its code, and confirm the entry appears in admin. Check incorrect/expired codes and logout. Delivery and database integration cannot be fully verified until the accounts are connected.

Never commit real secrets, passwords or setup links. `pavle123` is not installed as a default password. Passwords are salted and hashed with scrypt; session tokens and verification codes are hashed. Codes expire in 10 minutes with five attempts. Send requests are limited per IP and per email; login attempts are limited per IP. Pending records are cleaned during subsequent API activity; for strict periodic cleanup, schedule deletion of expired pending rows in Supabase.

Vercel Root Directory remains `rups-github`; the included config serves `public` and discovers `api/[...path].js`. The legacy Cloudflare Worker files are retained but are not used by the Vercel backend. Do not publish the new frontend with that legacy backend.

Tests: `node --test scripts/vercel-api.test.mjs`. They mock provider HTTP calls; they are not evidence of a live Supabase or Resend connection.
