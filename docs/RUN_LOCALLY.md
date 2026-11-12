# Run Pratidaan locally

The app runs on your laptop, with or without Gemini.

- **Without Gemini:** every AI feature uses its rule-based fallback and says so.
- **With Gemini:** calls go to the same Vertex AI model and Google Cloud project as Cloud Run. There is no Gemini API key. Your laptop uses Application Default Credentials from `gcloud`, a short-lived token stored outside this repo.

Sign-in is normally off locally (`AUTH_DISABLED=true`), so the app opens without the Google login page. That flag is ignored when `NODE_ENV=production`, which the container sets.

## What you need

- Node.js 20 or newer (the container and CI use 22)
- For Gemini: the `gcloud` CLI and access to project `project-6055aa98-bf59-48b5-a50`
- To regenerate data: Python 3

## 1. Start it

```sh
./run.sh
```

- **First run:** it installs dependencies and copies `.env.example` to `.env`.
- **What starts:** the API on http://localhost:8080 (restarting when backend code changes) and the web app on http://localhost:5173. Vite proxies `/api` to the API.
- **When it's ready:** it checks both and prints the URL to open.
- **Stopping:** Ctrl+C stops both.

Options:
- `./run.sh --install` reinstalls dependencies from the lockfiles.
- `./run.sh --data` regenerates `data/synthetic/` with `data/generate.py`.

With Docker instead, `docker compose up --build` serves everything on http://localhost:8080. It reads the same `.env` if one exists.

The backend reads **only the project-root `.env`**, and its values override your shell. If `run.sh` stops with "Local authentication is not configured", set these in `.env`:

```sh
AUTH_DISABLED=true
NODE_ENV=development
```

Then open the app, pick a donor in **Viewing as**, and use the demo bar on Home. The team guide in [drop/](drop/README.md) has test scripts.

**Good to know:** Drop's state, the demo clock, Choices and the Intro live in the backend's memory. Restarting the backend, which any backend code change does under `run.sh`, puts the demo back to Sat 10 Oct, 8 am. Use **Reset** on the demo bar to start a test cleanly.

## 2. Turn on Gemini (optional)

Sign in once with your Google account:

```sh
gcloud config configurations activate tracedrop     # or create it
gcloud auth login <your Google email>
gcloud config set project project-6055aa98-bf59-48b5-a50
gcloud auth application-default login
gcloud auth application-default set-quota-project project-6055aa98-bf59-48b5-a50
```

`application-default login` opens a browser once. The quota-project command tells Vertex which project to bill. These credentials live under your home directory, not in the repo.

These `.env` values turn Gemini on (`.env.example` has them):

```sh
GOOGLE_CLOUD_PROJECT=project-6055aa98-bf59-48b5-a50
VERTEX_LOCATION=global
LLM_MODEL=gemini-3.1-flash-lite
LLM_RATE_LIMIT_RPS=2
LLM_RATE_LIMIT_TOKENS_PER_DAY=50000
LLM_MAX_CALLS_PER_DAY=200
```

Leave `GOOGLE_CLOUD_PROJECT` empty to test with the AI off. Don't add an API key. (`.env.example` still has an unused `ANTHROPIC_API_KEY` line and Neo4j settings from the first design; the app ignores them.)

At start-up the backend logs:

- `AI offline: Set GOOGLE_CLOUD_PROJECT to enable Vertex AI`: no project set, so rule-based fallbacks are used.
- `AI offline: Vertex access not yet verified`, then `AI configured: aiplatform.googleapis.com; access checked on first request`: a project is set, and access is proven on the first model call.

## 3. Check that Gemini answered

As Arjun, ask Drop "How is my BP doing?". Then open the AI console at http://localhost:5173/#ai: it shows "Verified · gemini-3.1-flash-lite", the call, its latency and tokens.

**AI guardrails:** `backend/src/ai/guardrails.js` applies (1) regex pre-checks on chat input, (2) the same safety rules appended to every Gemini system prompt via `llm.js` (`guardrailKind`: `chat`, `donor_copy`, `translation`, `extraction`), and (3) post-check on Drop replies. Details: [03-architecture.md](03-architecture.md) and [05-submission/judge-instructions.html](05-submission/judge-instructions.html) (for judges via email, not in-app).

A credentials problem shows up on that first call, in the backend log, as `[llm]`. The usual fixes:

- If the message says credentials are unavailable, run `gcloud auth application-default login` again.
- If Vertex says a quota project is required, run the quota-project command again.
- Check that `gcloud config get-value project` prints `project-6055aa98-bf59-48b5-a50`.
- A long test session can use up the 50,000-token day. Then Drop answers from rules; raise `LLM_RATE_LIMIT_TOKENS_PER_DAY` locally if you need more.

## What this spends

Local Gemini calls bill the same project as the deployed app. The limits stop the process after 50,000 tokens or 200 calls in a day. Firestore isn't used while `AUTH_DISABLED=true`.

## Optional: Google sign-in, guest mode and Calendar on localhost

Skip this for normal work. To try the login page against the real project:

1. Set `AUTH_DISABLED=false` in `.env`.
2. Set `GOOGLE_CLIENT_ID` to the OAuth web client ID, and `SESSION_SECRET` to any long random string.
3. In Google Auth Platform, add `http://localhost:5173` as an authorized JavaScript origin on that client.
4. Restart `./run.sh`.

A Google sign-in writes to the same Firestore `users`, `accessEvents` and `appointments` collections as production, so your `gcloud` login must be able to write to Firestore. **Continue as guest** on the login page gives the same demo with no Google account: preferences and bookings stay in server memory, nothing goes to Firestore, and the session lasts a day.

**Booking with Google Calendar:**
- Connecting Calendar is a separate consent from sign-in. Pratidaan asks only to read free/busy time, create events on calendars you own, and send the confirmation through Gmail.
- The access token stays in the page until you reload it, and is never stored.
- Until Google verifies the app, only accounts listed as test users can grant these scopes.
- Enable the APIs once:

  ```sh
  gcloud services enable calendar-json.googleapis.com gmail.googleapis.com --project project-6055aa98-bf59-48b5-a50
  ```

## Tests

```sh
cd backend && npm test            # 158 tests, no network or Google Cloud needed
cd frontend && npm run type-check
```
