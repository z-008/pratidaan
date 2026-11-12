# Pratidaan: technical implementation

How the prototype on `main` is built (16 Oct 2026, commit `c547232`). What it does for the donor is in [02-product.md](02-product.md).

## Design rules

1. **Rules decide; the AI helps.** Anything that affects safety, money or privacy is deterministic code: eligibility, findings, the health score, Goals and their steps, which Cards are sent and when, the cover ladder, Badges, recipient privacy and slot ranking. The same history always gives the same result, and it is unit-tested.
2. **AI only where rules can't do the job:**
   - open questions that span the whole app (Drop's chat, an agent with tools);
   - reading any lab's report (multimodal extraction);
   - speaking the donor's language (Intro translation).

   Every AI output is checked by code before it is used.
3. **Every AI feature degrades to rules.** With no Google Cloud project, an exhausted budget or a failed call, the app still works and says when an answer came from rules.
4. **The donor's privacy is enforced on the server**, before anything leaves it.

## System overview

```
 Browser (React 19 SPA)                                Google
 ──────────────────────                                ──────
 Home · Donate · My impact · My health                 Sign-In (ID token)
 Health cover · Community · Ecosystem · Your data      Calendar + Gmail (token stays in the page)
 Drop: Cards, chat, side sheet, Intro, Stories
        │  /api  (session cookie)
        ▼
 Express API (Node 22) ─ one container on Cloud Run (asia-south1), also serves the built SPA
 ├─ routes/        auth · donors · drop · intro · demo · platform
 ├─ domain/        deterministic engines (no AI)
 │    health · cover · impact · community · donation · goals · goalWriteup
 │    drop (Cards) · screenLines · intro · story · badges · concerns · bookingChat · bookingRank
 ├─ ai/            llm (Vertex gateway) · agent (tool loop) · tools · copilot
 │                 labReader · introWriter · dropWriter · insights
 ├─ auth/          Google ID token check · HMAC session cookie · guest · Firestore records · Your data
 ├─ booking/ calendar/  slot booking · Calendar event · Gmail confirmation
 └─ data/store.js  in-memory store + demo clock
        │                     │                        │
        ▼                     ▼                        ▼
 data/synthetic + data/demo   Firestore                Vertex AI
 data/ontology (read at boot) users · accessEvents ·   gemini-3.1-flash-lite
                              appointments             (global endpoint)
```

## Repository layout

| Path | What it holds |
|---|---|
| `frontend/src/App.tsx` | Shell: sidebar, **Viewing as**, demo bar, screens (hash routes `#home`, `#donate`, `#impact`, `#health`, `#cover`, `#community`, `#ecosystem`, `#data`, `#ai`), mobile bottom nav, the chat side sheet |
| `frontend/src/pages/` | One file per screen |
| `frontend/src/components/drop/` | Cards, the feed, the chat side sheet, Story viewer, lab report upload, BP reading, Drop's line, What Drop knows, Health sections |
| `frontend/src/components/Copilot.tsx` | Drop's chat (inline on Home, inside the side sheet elsewhere) |
| `frontend/src/components/intro/` | The Intro thread, its pictures, tile highlight |
| `frontend/src/components/impact/`, `share/` | Badge shelf and Home preview, donation calendar, concerns; share images (canvas) and share buttons |
| `frontend/src/components/BookingFlow.tsx`, `AppointmentPass.tsx` | Guided booking and the pass |
| `frontend/src/AuthGate.tsx`, `Login.tsx`, `Legal.tsx`, `calendarAuth.ts` | Sign-in, guest, privacy/terms, Calendar consent |
| `backend/src/` | See the overview above |
| `backend/test/` | 18 test files, 152 tests (`node --test`) |
| `data/generate.py` | Reproducible synthetic world (seed 42, as of 10 Oct 2026) |
| `data/synthetic/` | Donors, donations, observations, components, communities, institutions, policies, centre schedule, ground truth |
| `data/demo/` | `overlay.json` (the New donor; Arjun's 3 Oct donation, its results released on 11 Oct, and its parts) and `drop-seed.json` (each Persona's starting Drop state) |
| `data/ontology/` | Clinical protocols and lifestyle guidance, read by Goals and the chat |
| `frontend/public/demo/` | Meera's sample lab report image |

## Data

### The synthetic world

`python3 data/generate.py [--seed 42] [--as-of 2026-10-10]` (or `./run.sh --data`) writes `data/synthetic/`:

| File | Contents |
|---|---|
| `donors.json` | 300 donors, including 6 scripted Personas (D-001 Arjun, D-002 Meera, D-003 Ananya, D-017 Vikram, D-033 Rohan, D-050 Karthik): age, sex, blood group, language, district, height, smoking, family history, consent, Circles, policy |
| `donations.json` | 657 visits (completed or deferred) with vitals: systolic, diastolic, pulse, haemoglobin, weight |
| `observations.json` | 8,541 LOINC-coded lab results from each visit's sample |
| `components.json` | 1,627 components (PRBC, PLT, FFP, CRYO, PLASMA), each with dated events (collected → separated → tested → stored → issued → transfused → outcome, or expired, or fractionation → products released), and the recipient as age, sex, clinical context and hospital ID only |
| `institutions.json` | 3 blood centres, 10 hospitals (type and district only), labs, and `asOf` |
| `communities.json` | 6 Circles: 2 workplaces, 2 families, 2 friend groups |
| `policies.json` | 2 employer group policies and 1 retail policy, base ₹5 lakh |
| `centre-schedule.json` | Centre opening hours, closed days, downtime, coordinates, public holidays, and places for booking |
| `ground-truth.json` | Seed, counts and Persona names |
| `fhir-bundles.jsonl` | The same data as FHIR R5 bundles (git-ignored, regenerated) |

### The demo overlay and the demo clock

`backend/src/data/store.js` loads everything into memory at start-up and indexes it by donor. `data/demo/overlay.json` adds the New donor (`D-NEW`) and Arjun's 3 Oct donation on top, without changing the synthetic files. Records with `availableOn` stay hidden until the demo clock reaches that date, which is how Arjun's results "arrive" on 11 Oct.

The **demo clock** is a date plus a part of the day: 8 am, 2 pm, 7 pm, or 9 pm (the start of quiet hours). It starts at `institutions.asOf` (10 Oct 2026). `POST /api/demo/advance` steps it, `POST /api/demo/next` steps until the viewed donor gets a new Card (up to two months), and `POST /api/demo/reset` reloads the donor records and clears every demo-session write. Each step runs Drop's delivery for every donor. `DEMO_MODE=false` turns the demo routes off.

### Clinical knowledge

`data/ontology/protocols.json` holds 11 protocols (`BP-G1`, `BP-G2`, `BP-URGENCY`, `HB-DEF`, `HB-SEV`, `DM-PREDIAB`, `DM-DIAB`, `CARDIAC-MON`, `RENAL-MON`, `EYE-SCREEN`, `STROKE-EMERG`), each with a recommended action, follow-up days and an escalation threshold. `lifestyle-recommendations.json` holds 5 guidance topics with effect sizes. Both are read by the Goal write-up and by the chat's `get_protocol` and `get_lifestyle_guidance` tools. The other ontology files (concepts, relationships, embeddings, medical coding, reference ranges, a Neo4j script) are reference material that the running app doesn't load.

### What is persisted

| Where | What | Lifetime |
|---|---|---|
| **Firestore** `users/{sub}` | Name, email, photo, first and last seen, sign-in count, booking preferences | Until the person deletes it |
| **Firestore** `accessEvents` | One record per Google sign-in (time, user agent) | Until deleted |
| **Firestore** `appointments/{id}` | Bookings, including cancelled ones | Until deleted |
| **Server memory** | Drop's state per donor (Cards, events, memory, readings, Goals, bookings, Badges seen), Intro state, concerns, donor Choices and language, uploaded results, demo donations | Until Reset or restart |
| **Browser** | Which donor was viewed, hidden Drop lines, Chat conversations for the visit | Until cleared |

Guest and local (sign-in off) sessions never touch Firestore. Their preferences and bookings stay in server memory.

## The deterministic engines

### Health: findings, score and eligibility

`domain/health.js` reads the latest visit's vitals and the latest lab values.

| Finding | Rule | Severity | Protocol |
|---|---|---|---|
| Very high BP | ≥ 180 systolic or ≥ 120 diastolic | urgent | BP-URGENCY |
| High BP stage 2 | ≥ 160 / ≥ 100 | high | BP-G2 |
| High BP stage 1 | ≥ 140 / ≥ 90 | moderate | BP-G1 |
| BP above ideal | ≥ 130 / ≥ 80 | watch | |
| BP rising | ≥ 3 visits, up ≥ 8 mmHg and now ≥ 125 | watch | |
| Severe anaemia | Hb < 7 | urgent | HB-SEV |
| Hb below donation level | Hb < 12.5 (women) / 13.0 (men); the newest uploaded report counts | moderate | HB-DEF |
| Iron stores depleted | ferritin < 15 | moderate | HB-DEF |
| Diabetes-range HbA1c | ≥ 6.5% | high | DM-DIAB |
| Prediabetes-range HbA1c | ≥ 5.7% | moderate | DM-PREDIAB |
| Cholesterol high | LDL ≥ 160 or TG ≥ 200 | moderate | |
| Cholesterol borderline | LDL ≥ 130, TG ≥ 150 or HDL < 40 | watch | |
| Liver enzyme raised | ALT > 45 | watch | |
| Weight above healthy range | BMI ≥ 27.5 (Asian cut-off) | watch | |

- **Health score (0–100):** a weighted average.

  | Factor | Weight |
  |---|---|
  | Blood pressure | 25 |
  | Haemoglobin | 15 |
  | HbA1c | 20 |
  | Cholesterol (LDL, less for high TG) | 15 |
  | BMI | 15 |
  | Smoking | 10 |

  A factor with no value is left out, and the weights are renormalised. There is one historical score per visit, and the current score uses the newest results, including uploaded ones.
- **Eligibility:**
  - Whole blood every 90 days for men and 120 days for women.
  - A visit is blocked by any urgent or high finding, low Hb, or stage 1 BP.
  - The demo check-in defers if Hb is below the minimum, BP is above 140/90 or weight is under 45 kg.

### Drop: Events to Cards

`domain/drop.js` keeps one state per donor, seeded from `drop-seed.json`.

- **Detecting events.** On every clock step it detects new Events:
  - results arriving;
  - urgent findings;
  - a donation's first transfused part (later parts fold into the report);
  - three weeks before the next eligible date;
  - Check-ins due on the Plan;
  - follow-ups the donor caused (a booked check-up, a goal reached).
- **Delivering.** Delivery applies, in order:
  - urgent Cards (any time);
  - the donor's Reminders, at their chosen part of day;
  - quiet hours at 9 pm;
  - folding Cards unanswered for 7 days;
  - Sunday's report (weekly with a Goal, otherwise monthly on the first Sunday);
  - prompted follow-ups (outside the budget);
  - one budgeted Card by priority (urgent → results → donate → check-in → goal → impact). The budget is 1 a day, plus 2 a week with a Goal or 1 a week otherwise.
- **What a Card is made of.** Each Card's wording, buttons, chips and form come from `words()`, which are rules. Answers update the state (bookings, readings, reminders, memory, Plan Check-in dates), can add observations (an Hb report), and can raise new Events.
- **Undo** restores a snapshot and removes anything the answer saved. It keeps Badges seen.
- **Ids** never repeat across resets or restarts.
- `view()` returns everything the app needs:
  - Cards: open, receipts, earlier;
  - memory, the Plan, Goals and readings;
  - bookings and the donation countdown;
  - the budget, what's waiting, what's later and what's coming;
  - a log.

  The **What Drop knows** panel shows this view raw.

### Goals

`domain/goals.js` groups findings into at most two Goals (lifestyle, iron), names them, sets one target from a fixed table, orders them, and tracks active, Up next, done and stopped. Records are kept in Drop's state, so a Goal keeps its identity as results change. `facts()` writes the trend in words with real numbers, the other markers in the Goal ("Also in this Goal"), urgency, the doctor note and the next check (from the protocol's follow-up days).

`domain/goalWriteup.js` writes each Goal's "why it matters" and 2–3 tagged steps (movement, food, mind, doctor, reading), each with evidence strings from the ontology. It is written when the Goal is made or its findings change, never on a view. An AI version is planned but not wired.

The rules table is in [02-product.md](02-product.md#how-findings-become-goals).

### Health cover

`domain/cover.js` models health-linked cover like a credit limit:

- The base premium is priced for expected claims C₀.
- Relative risk from the score: RR = e^(−0.0115 × (score − 70)), so RR = 1 at 70 and falls about 11% per 10 points.
- Expected claims grow sub-linearly with cover: C(SI) = C₀ × RR × (SI / SI₀)^0.6.
- The largest cover with C(SI) ≤ C₀ is SI₀ × (1/RR)^(1/0.6). It is capped at 1.6 × base and rounded down to the ladder ₹5, 6, 7 or 8 lakh.
- The increase applies only with two monitored visits in 12 months and consent to share the score.

The engine also returns:

- the points needed for the next step, and what is blocking it (monitoring or consent);
- the insurer switch's on/off effect and a `simulate(score)` what-if;
- cover history per past score;
- a policy stack (from a fixed per-donor pattern);
- discount rows (regular donor 5%, wellness 5 or 10%, non-smoker 5%, capped at 20%) and the base policy's terms.

A partner insurer would swap in its filed rating factors; the mechanism stays the same.

### Impact and recipient privacy

`domain/impact.js` builds each part's public journey on the demo clock.

- **Recipient fields** are released only in combinations shared by at least **K = 5** currently transfused, non-withheld units, searched across all donors:
  1. age band and sex, context, hospital type and district, outcome;
  2. without outcome;
  3. without place;
  4. context only;
  5. nothing ("Patient (age and sex not shared)", "A hospital in Karnataka").

  A generalised outcome also removes the outcome event from the timeline.
- **Dates:** transfusion, issue and outcome dates are rounded to the month.
- **Withheld units:** a unit from a donation with a confidential follow-up shows only collected, separated, tested and "Withheld from use for safety", with no recipient and no reason.
- **Expired units** get a reason built from the data: shelf life, other units of the same group issued meanwhile, and other expiries.
- **Summaries:** `summarise()` counts patients helped (transfused units), children, plasma medicine share and treatments. `stakeholders()` gives the per-institution view behind **Who benefited**; monetary values are estimates.

### Stories, Badges and sharing

- **Stories.** `domain/story.js` builds one Story per transfused unit or released plasma from the public journey only. A generalised field is left out of the sentence, and a privacy line is added.
- **Badges.** `domain/badges.js` computes the 8 Badges fresh from journeys and donations. The app receives only the earned month and a progress ratio; exact dates stay on the server for Drop's "New" rules. "New" and "shown" live in Drop's state.
- **Share images.** `frontend/src/components/share/shareImage.ts` draws the 1080×1920 postcard and Badge images on a canvas in the browser.

The design record is [wayfinder/story-and-badge/spec.md](wayfinder/story-and-badge/spec.md).

### Circles

`domain/community.js` totals each Circle over members whose "count me in totals" Choice is on. A leaderboard shows a member to others only if both their leaderboard and totals Choices are on; the viewer always sees themselves unless they left the totals. No health data is ever included.

### Booking

- `domain/bookingChat.js` normalises preferences: days, time windows, distance 5/15/30 km, avoid holidays, and location (rounded to 0.01°).
- `domain/bookingRank.js` generates slots for 21 days from the eligible date across the centres' opening hours. It hides downtime, chosen holidays, Calendar clashes and centres beyond the distance, then scores the rest by preferred day, preferred time and closeness (haversine).
- `booking/service.js`:
  - re-validates the chosen slot on the server;
  - saves the appointment;
  - with a Calendar token, checks that the Calendar account matches the signed-in email, re-checks free/busy, creates the event (`sendUpdates=all`, with reminders) and sends the Gmail confirmation;
  - the check-in code is an HMAC of the appointment id.
- `domain/donation.js` runs the demo check-in: it validates the vitals, applies the deferral rules, and on completion adds the visit, a lab panel (Hb measured, others carried forward and marked) and three new components.

### The other rule engines

- `domain/intro.js`: the eight-step Intro, its state, answers (language → Drop's language; Choices → the donor's consent; donation preferences → the Google account), skip, replay and finish.
- `domain/screenLines.js`: Drop's line per screen, first matching rule wins.
- `domain/concerns.js`: the simulated concern ladder with example owners and deadlines on the demo clock.

## The AI layer

All model calls go through one gateway.

### Gateway: `ai/llm.js`

- **Endpoint and auth:**
  - Vertex AI `generateContent` over REST on the `global` endpoint (`VERTEX_LOCATION`), model `LLM_MODEL` (default `gemini-3.1-flash-lite`).
  - Auth via `google-auth-library`: the Cloud Run service account in production, Application Default Credentials on a laptop. No API key.
- **Limits** (per process; they reset on restart):
  - a token bucket at `LLM_RATE_LIMIT_RPS` (2/s);
  - daily caps of `LLM_RATE_LIMIT_TOKENS_PER_DAY` and `LLM_MAX_CALLS_PER_DAY` (production deploy sets 500,000 and 2,000 for judging).
- **Message format:** converts the app's message blocks (text, image, tool use, tool result) to Gemini parts. It sends Gemini's function-call `id` and thought signatures back, wraps list results as objects, and drops thought parts from replies.
- **Structured output:**
  - without tools, `responseMimeType: application/json` plus `responseSchema`;
  - with tools, a `submit_result` function.
  - Either way, the result is re-validated locally against the app's schema (`validate()`). Provider-side constraints aren't trusted.
- **Visible text:** `visibleReply()` strips planning notes ("Plan:", "Final Answer:") from text meant for the donor.
- **Traces:** every call is recorded with feature, latency, tokens, cache reads and stop reason or error (last 200; `/api/ai/traces`). Failures raise `LLMUnavailable`, which every caller turns into its rule-based fallback.
- **Safety prompts:** before each request, `guardrails.augmentSystem(system, guardrailKind)` appends shared scope and safety rules. Callers pass `guardrailKind` on `llm.call` / `llm.json` (`chat`, `donor_copy`, `translation`, `extraction`, or `none` to skip). Default is `donor_copy`.

### Safety guardrails: `ai/guardrails.js`

Donor-facing safety is enforced in three layers, with one module owning both the static checks and the prompt text so they stay consistent.

1. **Pre-LLM (Drop chat):** `check(message)` runs regex only for **emergency** wording and **diagnosis/prescription** asks, returning a fixed reply (and often a check-up Card) without calling Gemini. Other off-scope asks (essays, homework, unrelated topics) are **not** regex-filtered.
2. **In prompt (every Gemini call):** `augmentSystem()` appends a `guardrailKind`-specific block: stay on scope, refuse homework/essays and general writing (including donation-themed school work), never diagnose or prescribe, redirect emergencies to emergency services, use only given facts. Copilot uses `chat`; intro translation uses `translation`; lab extraction uses `extraction`; home insight and Card wording use `donor_copy` (same as the gateway default).
3. **Post-LLM (Drop chat):** `sanitizeReply()` rewrites assistant text that looks like medicine advice. Copilot still applies its own system rules (two sentences, tools for facts, at most one Card, no invented labs).

Tests live in `backend/test/guardrails.test.js`.

### Agent loop: `ai/agent.js`

A manual tool-use loop of up to 8 steps:

- The model is called with a donor-scoped tool set, and the tools it asks for run in parallel.
- Each step is recorded for the trace (tool, input, latency, a one-line summary).
- A tool can return `_ui` (a Card, a chart, a memory line or a receipt). The UI gets it; the model sees only the facts.
- Recoveries:
  - one retry on `MALFORMED_FUNCTION_CALL`;
  - one nudge if the model goes silent after a tool call;
  - if steps succeeded but no text came, a partial result that the caller completes from rules.

### Tools: `ai/tools.js`

19 tool definitions. Every one reads the deterministic domain for the signed-in donor only, and no tool exposes another donor's data or a recipient's identity.

| Kind | Tools |
|---|---|
| Read | `get_profile` (including the exact "when can I donate" sentence), `get_health_findings`, `get_trend`, `get_health_score`, `get_protocol`, `get_lifestyle_guidance`, `get_insurance_cover`, `simulate_cover`, `get_donation_impact`, `get_stakeholder_impact`, `get_communities`, `find_care_slots` (not offered to the chat) |
| Show or offer | `show_chart` (a chart Card), `offer_care_slots` (a check-up slots Card, also on Home), `offer_reminder` |
| Act | `remember` (only enumerated schedule or language preferences), `log_reading` (BP, range-checked), `set_language`, `navigate` |

### Drop's chat: `ai/copilot.js`

- **What the model gets:**
  - Drop's rules: two short sentences, facts only from tools, at most one Card, no diagnosis or medicine, urgent means a doctor today, recipients stay anonymous, cover and slots are illustrative, never "the user";
  - per-turn context: the date, who the donor is (the New donor has no records), language, what Drop remembers, the Plan, Reminders, the latest reading, open Cards, each live Goal's target, why and steps (with "these come from rules, not a doctor", and no exercise for an urgent Goal), which Chat this is (`general`, `goal:<id>` or `habit:<name>`), and the Intro step if one is running.
- **History:** the last 20 turns, kept in the browser and sent back each time. Each turn is also stored server-side in `domain/chatCycles.js` (current cycle); demo **Reset** archives into **Past Cycles** (`GET …/chat/cycles`). Not durable across restart or multiple Cloud Run instances.
- **Leaked notes:** a reply that reads as the model's own notes ("The user wants…", "I should…", tool code) gets one retry with no tools. If it still fails, rules answer.
- **Fallback:** `fallback()` answers common questions from rules when the AI is unavailable.
- **Guardrails:** `check()` on the user message before the agent runs; `sanitizeReply()` on the final text; agent calls use `guardrailKind: 'chat'` on the gateway (see `ai/guardrails.js`).

### Lab-report reader: `ai/labReader.js`

- **Input:** an image (base64 PNG, JPEG, WebP or GIF, up to 8 MB per request) or pasted text.
- **Extraction:** Gemini maps the report to 16 markers (Hb, HbA1c, LDL, HDL, TG, total cholesterol, ferritin, ALT, creatinine, TSH, WBC, platelets, MCV, fasting glucose, vitamin D, B12) with LOINC codes, converts units (cholesterol mmol/L × 38.67, HbA1c mmol/mol → %, …), and returns a confidence and the text as printed, against a strict schema.
- **Checks:** code range-checks every value and attaches the donor's previous value.
- **Saving:** the server ignores the browser's labels and re-checks the marker, the value range and the date (a real date, not after today). The photo isn't kept.

There is no rule-based fallback for reading an arbitrary report. The demo sample has a known value the Hb Check-in uses offline.

### Intro translation: `ai/introWriter.js`

Translates the Intro's lines the first time each one is shown in a language, cached per language. A translation is kept only if every number and every `{placeholder}` survives; otherwise that line stays in English and the Intro says so.

### Not shown in the current interface

- **Card wording** (`ai/dropWriter.js`) asks Gemini to rephrase up to three open Cards in Drop's voice and language when the feed loads. Card wording carries triage and eligibility, so a rewrite is accepted only when it matches the rule wording word for word, and buttons and chips may not change. In practice Cards keep their rule wording; the call is made, and a rewrite is rejected.
- **Home insight** (`ai/insights.js`, `GET /api/donors/:id/insights`) lets the model pick one of several rule-computed candidate facts. Its title and message always come from rules. The route works, but no screen calls it.

## API

Every route except `/api/health` and `/api/auth/*` needs a session. Responses are `{ success, data }` or `{ success: false, error }`.

| Area | Routes |
|---|---|
| Health check | `GET /api/health` (status, version, AI status) |
| Auth | `GET /api/auth/config` · `POST /api/auth/google` · `POST /api/auth/guest` · `GET /api/auth/me` · `POST /api/auth/logout` · `GET/PUT/DELETE /api/auth/preferences` · `POST /api/auth/booking/turn` |
| Your data | `GET /api/auth/data` · `DELETE /api/auth/signins` · `DELETE /api/auth/bookings/:id` · `DELETE /api/auth/account` |
| Donor | `GET /api/donors` (Personas) · `GET …/:id/overview` · `/donations` · `/impact` · `/impact/:componentId/story` · `/stakeholders` · `/health` · `/cover` · `/cover/simulate?score=` · `/communities` · `GET/PATCH /consent` (Choices) |
| Donation | `GET …/:id/slots` · `POST /booking/recommend` · `GET/POST /appointments` · `POST /appointments/:id/cancel` · `POST /appointments/:id/checkin` |
| AI | `POST …/:id/copilot` · `POST /labs/extract` · `POST /labs/save` · `GET /labs/uploaded` · `DELETE /labs/:observationId` · `GET /insights` |
| Concerns | `GET/POST …/:id/concerns` · `POST /concerns/:id/escalate` · `POST /concerns/:id/resolve` |
| Drop | `GET/POST …/:id/drop` (view; `/reopen`) · `/language` · `/line/:screen` · `/cards/:cardId/answer` · `/snooze` · `/hide` · `/undo` · `/badges/seen` · `/offer` · `/bookings/:id/cancel` · `/memory` (delete, undo) · `/readings` · `/goals/:id/stop` · `/goals/:id/start-again` · `/results/:observationId/hide` |
| Intro | `GET …/:id/intro` · `POST /answer` · `/skip` · `/replay` · `/finish` |
| Demo | `GET /api/demo` · `POST /advance` · `/next` · `/reset` |
| Platform | `GET /api/network` (aggregates) · `GET /api/ai/status` · `GET /api/ai/traces` |

## Security and privacy

- **Sign-in:**
  - Google ID tokens are verified against `GOOGLE_CLIENT_ID`; only `accounts.google.com` and a verified email are accepted.
  - The session is an HMAC-SHA256-signed, HttpOnly, SameSite=Lax cookie, Secure in production. It lasts 24 hours and is not renewed.
  - `SESSION_SECRET` is required in production.
  - Guests get a random `guest-…` subject and never reach Firestore.
  - `AUTH_DISABLED` works only when `NODE_ENV` isn't `production`.
- **Calendar and Gmail:**
  - consent is separate from sign-in, with minimal scopes: `calendar.events.freebusy`, `calendar.events.owned`, `gmail.send`;
  - the access token stays in page memory and is sent per request, never stored;
  - every call checks that the Calendar account is the signed-in account.
- **Web hardening:** Helmet headers (COOP `same-origin-allow-popups` for the Google popup), an 8 MB JSON limit for report photos, and a JSON 404 for unknown API routes.
- **Recipient privacy:** k = 5 generalisation, month-rounded dates, withheld units with no reason, and share images that carry less than the app.
- **AI guardrails:** see **Safety guardrails** above (`guardrails.js`: pre-check, prompt appendix on every call, post-check on chat); plus donor-scoped tools with schema-validated arguments; structured output re-validated locally; memory limited to enumerated preferences; Card text that must match the rules; Intro translations that must keep every number; `visibleReply()` for leaked reasoning; rule fallback on every feature that needs it.

The deterministic decisions are covered by tests.
- **Demo honesty:** cover, slots, check-ups, the QR pass, concerns and activity are labelled simulated or illustrative in the UI, the Calendar event and the email.

Known limits: demo donors are shared by everyone using the prototype, and their Drop state lives in server memory. The AI budgets are per process, not a project-wide spending cap.

## Deployment

- **Container:** `Dockerfile` (multi-stage, `node:22-alpine`) builds the frontend, installs production backend dependencies, and copies `backend/src`, `data/synthetic`, `data/ontology`, `data/demo` and `frontend/dist`. It runs as `node` under `dumb-init` on port 8080, with a health check on `/api/health`.
- **CI/CD:** `.github/workflows/deploy-cloud-run.yml`, on every push to `main` except docs-only changes:
  1. Run the backend tests.
  2. Type-check and build the frontend.
  3. Authenticate to Google Cloud with Workload Identity Federation (no key file).
  4. Build and push the image to Artifact Registry (`asia-south1`).
  5. Deploy that exact image to Cloud Run service **`pratidaan`**: 1 vCPU, 512 MiB, 1–4 instances, concurrency 20, 180 s timeout, runtime service account `tracedrop-run` (Vertex AI and Cloud Firestore access). The Gemini settings, `GOOGLE_CLIENT_ID` and `SESSION_SECRET` go in as environment variables. Limits are raised for parallel judging (see below).
  6. Curl `/api/health`.

  Setup steps are in [CLOUD_RUN_VERTEX_SETUP.md](CLOUD_RUN_VERTEX_SETUP.md).
- **Live URL:** https://pratidaan-533106233193.asia-south1.run.app (judge briefing: [05-submission/judge-instructions.html](05-submission/judge-instructions.html), emailed to judges)
- **Firebase:** this project does **not** use Firebase (Auth, Hosting, Realtime DB, etc.). Persistence is **Cloud Firestore** via `@google-cloud/firestore` only.
- **Local:**
  - `./run.sh`: the API with `node --watch` on 8080 and Vite on 5173, which proxies `/api`.
  - `docker compose up --build`: everything on 8080.

  Configuration is read only from the root `.env`, which overrides the shell. See [RUN_LOCALLY.md](RUN_LOCALLY.md).

### Configuration

| Variable | Default | Use |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | (empty) | Turns on Vertex AI; empty means rule-based fallbacks |
| `VERTEX_LOCATION` | `global` | Vertex endpoint |
| `LLM_MODEL` | `gemini-3.1-flash-lite` | Model for every AI feature |
| `LLM_RATE_LIMIT_RPS` / `LLM_RATE_LIMIT_TOKENS_PER_DAY` / `LLM_MAX_CALLS_PER_DAY` | 10 / 500,000 / 2,000 on Cloud Run (lower in `.env.example` for local dev) | Per-process limits |
| `GOOGLE_CLIENT_ID` | (empty) | Google Sign-In and Calendar consent |
| `SESSION_SECRET` | dev-only value outside production | Signs session cookies and check-in codes |
| `AUTH_DISABLED` | false | Skip sign-in locally (ignored in production) |
| `NODE_ENV` | | `production` on Cloud Run |
| `DEMO_MODE` | true | Demo clock routes |
| `DATA_DIR` | `data/` | Where the data lives |
| `PORT` | 8080 | |

## Tests

`cd backend && npm test` runs 156 tests with `node --test`, against the real modules and, where needed, the real routes on a local port.

| File | Covers |
|---|---|
| `domain.test.js` | Findings, score, eligibility, cover ladder and conditions, k-anonymity, lab save checks |
| `impact-correctness.test.js` | Journeys, generalisation across all recipient fields, withheld units, Stories |
| `drop.test.js` | The Message budget, priority, quiet hours, snooze, fold, urgent rules, memory, undo, report contents, impact folding, new Badges |
| `goals.test.js` | Grouping, names, targets, order, Up next, states, the write-up, Health's Goal view, stop and Start again |
| `badges.test.js` | The 8 Badges and their progress |
| `intro.test.js` | Who gets the Intro, where answers land, skip, replay, Reset |
| `choices.test.js` | What each Choice changes, and Reset |
| `emptystates.test.js`, `newdonor.test.js` | Every route for the New donor; the overlay and id reuse |
| `booking.test.js` | Preference turns, distance, holidays, downtime and Calendar clashes, chosen days, the Calendar event and email, a Calendar token from another account, cancelling without Calendar access |
| `auth.test.js`, `guest-auth.test.js`, `yourdata.test.js` | One-day sessions, tampered cookies, verified Google accounts only, no local bypass in production, guest sessions, Your data reads and deletes |
| `ai-correctness.test.js`, `llm.test.js`, `reply.test.js` | Structured-output validation, malformed tool arguments, rule answers when offline, safety Cards never rewritten, insight candidate checks, Vertex request shape and call ids, reasoning notes stripped |
| `accountability.test.js`, `donor-simulation.test.js` | Expiry explanations, concern ownership and escalation, cover terms, date windows; demo replies never claim a real clinic, insurer or authority was contacted |

CI also runs `npm run type-check` and the production build for the frontend.
