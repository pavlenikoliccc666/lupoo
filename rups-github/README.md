# Rups website

Complete source for the Rups dental-clinic AI website, including the enquiry form, password-protected admin area, server API, database schema, migrations, tests, images and video.

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Open /admin for the admin screen.
Local preview uses an isolated, temporary database that resets each time the preview restarts. It does not connect to the live site's enquiries or accounts.
For local testing only, open http://127.0.0.1:4173/admin#setup=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa and choose a test password. This fixed token exists only in the local test runtime; never use it as a production setup token.

Run `npm test` after building to test enquiry storage, authentication and access controls. Run `npm run db:generate` after changing `db/schema.ts`. Existing applied migrations must remain unchanged.

## Project layout

- `public/` — website pages, CSS, browser scripts, images and video.
- `server/index.js` — Worker-compatible API and asset serving.
- `db/schema.ts` and `drizzle/` — D1 schema and generated SQL migrations.
- `scripts/` — build, local preview and integration checks.
- `.openai/hosting.json` — logical DB binding; no account-specific project ID is included.

## Upload to GitHub

Extract the ZIP and upload the contents of this folder to a new repository, including hidden files such as `.gitignore` and `.openai/hosting.json`. No Git history, passwords, production database records, sessions or private setup links are included.

Alternatively, from this folder:

```sh
git init
git add .
git commit -m "Add Rups website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

## Hosting and database

GitHub stores the source. GitHub Pages alone cannot run this server API, database or password login.
Production needs a Cloudflare Worker-compatible host with a D1 binding named `DB`. Build output is `dist/server/index.js`. Apply the SQL files in `drizzle/` once, in order, before serving requests. A new host requires a separate database and new admin setup; the existing live database is not transferred by this archive.

For initial production admin setup, generate a random 32-byte token represented as 64 hexadecimal characters. Store only its SHA-256 hex digest as the server secret `ADMIN_SETUP_HASH`, and a future Unix timestamp in milliseconds as `ADMIN_SETUP_EXPIRES`. Open your site's `/admin#setup=TOKEN` once to choose a password. Never put the token or password in public source or commits. An existing admin account prevents this setup link from being reused.

The enquiry form stores submissions in D1. It does not send email notifications or book meetings. The administrator reads submissions at `/admin`. Email links use enquiries@rups.io and privacy@rups.io; publishing the code does not create these mailboxes.

Legal pages have no animations. The supplied Rups logo and blue palette are integrated. Social links point to Instagram rups.io and X tryrups. FAQs describe WhatsApp, Instagram, Viber and clinic-number messaging, with voice calling marked as coming soon. These are descriptions of the business service; the website itself does not implement those messaging integrations.

## Asset credits

- Rups logo supplied by the owner.
- Clinic photograph by Andrea Piacquadio: https://www.pexels.com/photo/cheerful-young-female-dentist-talking-with-patient-during-therapy-in-modern-hospital-3884103/
- Video by Cedric Fauntleroy: https://www.pexels.com/video/woman-talking-to-the-dentist-4489266/
- Pexels licence: https://www.pexels.com/license/
- People shown do not imply an endorsement. Conversation examples are illustrative.
- 8× source: https://www.insidesales.com/response-time-matters/
