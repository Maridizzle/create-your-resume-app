# Create Your Resume, intake pipeline

Internal tool. Single admin account (Maride), public URL, client PII, so auth is real: bcrypt-hashed password plus TOTP two-factor, not a simple gate.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env`, fill in real values
3. `npm run migrate` to create the schema (also creates the session table on first server start)
4. `node src/scripts/create-admin.js <username> <password>` to bootstrap the one admin account
5. `npm run dev`
6. Log in, then call `POST /api/auth/setup-2fa` once to get a QR code, scan it into an authenticator app, then `POST /api/auth/confirm-2fa-setup` with the code it gives you to finish enabling it

## Pipeline stages

Input -> Chat -> Checklist -> Link -> Results -> Output, tracked per client in `pipeline_state`.

## What's built vs stubbed

Built: full auth flow (password + 2FA + sessions), client CRUD, chat streaming scaffold, Postgres schema, Google Sheets pull scaffold.

Stubbed, marked `TODO` in the route files, needs porting from your existing scripts:
- `src/routes/chat.js` - paste the full Intake Builder system prompt from Project 2
- `src/routes/intake.js` - the JSON generation logic itself, and the actual admin.html link-generation flow
- `src/routes/output.js` - the docx generation script you're already running in Node
- Google Sheet range/columns in `src/routes/results.js` once the real sheet layout is confirmed

## Security notes

- No signup route exists on purpose, `create-admin.js` is the only way to make an account
- Session cookies are httpOnly, secure in production, sameSite strict, 4 hour expiry
- Login and 2FA endpoints are rate limited separately from the rest of the app
- All secrets live in environment variables, Railway's dashboard, never in git
- Run `npm audit` before each deploy
