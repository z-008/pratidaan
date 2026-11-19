# Change log: health between donations (built 18 Nov 2026)

- **Branch:** `dev-uppili` (same starting commit as `main`)
- **Baseline:** the build before these changes is tagged `v1-baseline` (local tag; push it with `git push origin v1-baseline`)
- **Plan:** [2026-11-18-review-feedback-plan.md](2026-11-18-review-feedback-plan.md)
- **How it was built:** [2026-11-18-technical-implementation-plan.md](2026-11-18-technical-implementation-plan.md)
- **Status:** built and checked locally. Not committed or deployed yet. See [Round 2](#round-2-every-persona-and-app-data-used-throughout) for the follow-up that brought the features to every persona.

## What was added

It answers the review panel's feedback:

- a daily habit planner;
- trackable wellness signals;
- a proactive, explainable comeback coach;
- wearable inputs;
- barriers;
- privacy controls.

It adds two things of our own:

- **every donation is a free health check**;
- **local, affordable food coaching** with a doctor rule.

| Area | What's new |
|---|---|
| **Connected apps** (`#apps`, account menu) | **Demo apps:** Habitify, Microsoft To Do, Fitbit, Oura and Cronometer. Each has a switch per data type, **Write back**, and **Disconnect & delete**. **Junction sandbox:** a real wearable-aggregator API with generated data; needs `JUNCTION_API_KEY`. **Your own accounts:** a Habitify API key, or Microsoft To Do via its own MSAL consent (`Tasks.ReadWrite`). The key or token stays in the tab and is never stored. |
| **Progress** (`#progress`, nav after My health) | **Cycle:** phase, day, next free health check, and the Cycle's focus with on-track targets. **Food coaching:** an "Eat for your iron" panel. **Your free health check:** each result's band, the previous donation's value, and the age-group comparison (shown from 50% only). Tapping a result opens its history across donations, with the Cycle's steps or sleep as bars and an "alongside" sentence. **Also on the screen:** the last 7 days from the donor's apps, Cycle reports (play, or download as FHIR), and How you eat. |
| **Home** | A **Between donations** tile after the Next donation tile, with **Watch my Cycle report** when a new one is ready. |
| **My health** | With a Week plan, **Habits** and **This week** show its items, days kept and their source. Without one, the existing shells show unchanged. Goal cards gain **Foods that fit you** (collapsed) and the plan items that serve the Goal. A link to Progress. |
| **Drop** | New Cards (table below). **Simplify my plan** is enabled in the ⋯ menu once a Week plan exists. Habit and Goal Chats can open a Week plan Card, find foods and explain a recommendation. With the AI offline, the Food Chat answers with rule-chosen foods. The Weekly report adds slides after its existing ones. |
| **Your data** | A **Between donations** group (each app, Week plan and Your day, Food profile), each with Delete and the existing Undo. **Download my data** (JSON). |
| **Demo bar** | **Simulate a rough week**. |
| **New persona** | **Asha Khan** (`D-175`), added last in Viewing as. She is promoted from the existing synthetic donors; no synthetic data changed. She starts set up: watch and Habitify (demo), a Week plan, Your day at 9 pm, and a Food profile (eggetarian, North Indian, tight budget). |

**New Cards** (`backend/src/domain/coaching.js`):

| Card | When | Budget |
|---|---|---|
| Week plan | The donor asks: Plan this week, the Habit Chat, or Add to my week | Outside (asked for) |
| Your day | Daily at the donor's time, while a Week plan runs; "Not today" asks once what got in the way | Outside (opt-in) |
| A lighter week | A routine slipped: steps under 70% of usual (R2), sleep under 6 h on 3 of 5 nights (R3), or a plan item or iron add-on slipped (R1/R4) | Coaching allowance |
| Step back up | A lighter step kept on 5 of 7 days | Coaching allowance |
| Food for your iron | Results with iron below the donation level or on the low side | Coaching allowance |
| See a doctor first | Iron, B12 or vitamin D too low for food (e.g. Hb under 10) | At once, like urgent |
| Before your next donation | 14 days before the donor can give again | Coaching allowance |

**The coaching allowance:**
- at most one Card a week;
- only at 7 pm;
- never on a day an existing Card was sent, or while one could still go;
- never with an urgent Card open;
- never counted in the Message budget;
- **Next event** ignores all of these Cards.

## Existing files touched

All additions, listed here for reviewers:

| File | Change |
|---|---|
| `backend/src/domain/drop.js` | Requires `coaching`. Calls `coaching.deliver` after `create()` and after each clock step. Falls back to coaching wording, label and answer for unknown Card types. Adds Weekly report slides at the end. Next event ignores coaching types. Exports `activityMinutes`, `_pushCard` and `_log`. |
| `backend/src/ai/tools.js` | `definitions(names)` also searches `wellbeingTools` (only when names are given). `run()` hands its tools to `wellbeingTools`. |
| `backend/src/ai/copilot.js` | New tools only for Habit and Goal Chats. Their chat line replaces "Week plans are coming". Between-donation context. `foodGuard` after the model. Food Chat rule answers when offline. A last-resort food intent in `fallback()`, after every existing one. |
| `backend/src/routes/donors.js` | `D-175` appended to the persona list. |
| `backend/src/routes/demo.js` | `POST /api/demo/rough-week`. |
| `backend/src/server.js` | Mounts `routes/wellbeing.js`. |
| `data/demo/drop-seed.json` | `D-175` appended (12 lines; the rest of the file is untouched). |
| `frontend/src/App.tsx` | `progress` and `apps` screens, the Progress nav item, `WhyThis`, `onApps` on the account menu. |
| `frontend/src/api.ts` | `go` and `why` on DropAction, new types and calls. |
| `frontend/src/microsoftAuth.ts` | `microsoftTodoToken` (Calendar scopes untouched). |
| `frontend/src/components/drop/DropCardView.tsx` | `why` opens Why this?; `go` opens a screen. |
| `frontend/src/components/drop/ChatSheet.tsx` | Simplify my plan and the Habit subtitle once a Week plan exists. |
| `frontend/src/components/DemoBar.tsx` | Simulate a rough week. |
| `frontend/src/components/AccountMenu.tsx` | Connected apps item (optional prop). |
| `frontend/src/pages/Home.tsx` | Between donations tile. |
| `frontend/src/pages/Health.tsx` | Week plan in Habits and This week when one exists, Foods that fit you, the Progress link. |
| `frontend/src/pages/YourData.tsx` | Between donations group, Download my data. |
| `README.md`, `CONTEXT.md`, `docs/02-product.md`, `docs/03-architecture.md`, `docs/05-review/demo-video-script.md`, `docs/05-review/pratidaan-guide.html` | New sections and rows. Only the "Not built yet" row for Week plans was reworded. |

## Checks run

| Check | Result |
|---|---|
| `cd backend && npm test` | **199 pass, 0 fail**: the 167 existing tests unchanged, plus 32 new |
| `backend/test/golden.test.js` | Pass. Every existing persona replays a scripted clock and matches `test/golden/baseline.json` from `v1-baseline` exactly: Cards, log, findings, score, eligibility, cover, Badges, impact, Drop lines, Intro, rule answers. |
| `cd frontend && npm run type-check && npm run build` | Pass |
| Local run (`AUTH_DISABLED=true`, AI offline) in headless Chrome at 1440 px and 390 px | All new screens render, with no console errors and no horizontal scroll on a phone. Checked: Asha's Home, Progress, Ferritin drawer, Why this?, Connected apps and My health. Arjun's connect → Progress BP → plan this week → save to Habitify → rough week → A lighter week → Why this? (R2) → Try this. Ananya's donation → Watch my Cycle report. Meera's food with a doctor within 3 weeks. Vikram has no movement target. The New donor sees an empty Progress and no tile. |
| Food Chat (AI offline) | Rule-chosen foods with price and the doctor's line. "Should I take an iron tablet?" gets the existing refusal to prescribe. |

## Test scripts 21–32

These go with the 20 in [docs/drop/](../drop/README.md). **Reset** before each.

| # | Steps | Expected |
|---|---|---|
| 21 | Arjun → My health; then each other persona | Habits and This week show each persona's apps against healthy targets (e.g. Arjun: 145 active minutes on target, sleep 6.6 h below target). The Goal card shows "From your apps". The New donor still shows the shells. |
| 22 | Arjun → +1 day → My health → Movement → "Help me plan this week's movement" → Save and add to Habitify | Card: "30-minute brisk walk, 3 days (for your BP…)". Habits and This week show it, tracked by Fitbit (demo). |
| 23 | Arjun (after 21) → Progress → Blood pressure | Chart of 126/78 → 148/94 with steps per Cycle as bars. Sentence: "steps … went 7,125 → 4,731 … alongside blood pressure 132/82 → 148/94 … doesn't prove one caused the other". |
| 24 | Arjun (after 22) → Home → Simulate a rough week | A lighter week at 7 pm: "Your walks slipped (you said: travelling)". Why this? shows R2 and the steps figures. No existing Card moved. |
| 25 | Arjun (after 24) → Try this → Ask Drop → ⋯ → Simplify my plan | Item marked "Lighter this week". Simplify keeps one item; the rest show Bring back. |
| 26 | Ananya → book a demo slot today → Donate → Simulate check-in (Hb 13.9) → Home | Tile shows Watch my Cycle report: "Haemoglobin: 13.5 → 13.9 g/dL. Comfortable for donating." |
| 27 | Asha → Home | Food for your iron in Hindi: halim, bajra, rajgira, about ₹9–14 a day, and a doctor's check recommended. See foods for me opens Progress on Ferritin. |
| 28 | Asha → book a slot → Simulate check-in with Hb 9.5 → +few hours | See a doctor first replaces the food Card. Progress shows no foods, only the rule and the doctor. |
| 29 | Any connected persona → Connected apps → turn off Steps → Your data → Between donations → Disconnect & delete | Steps vanish from Progress; Undo within 6 s restores them. |
| 30 | Meera → Ask Drop → Food → "Breakfast ideas for my iron on a tight budget?" | Vegetarian foods with prices, ending "See a doctor within 3 weeks to find the cause." |
| 31 | Reset, then open each existing persona without tapping anything new | Same first screen as `v1-baseline`, except the new tile, nav item and My health link. Asha is last in Viewing as. |
| 32 | Arjun after 21 → Next event ×3 | Same stops as before (Next event ignores the new Cards). |

## Real, demo and not built

- **Real:**
  - the rules;
  - the API;
  - Junction sandbox calls, when a key is set;
  - Habitify and Microsoft To Do calls with the donor's own key or token;
  - FHIR export;
  - Azure OpenAI with the new tools, when configured.
- **Demo:**
  - persona wearable, habit and food data, labelled "demo";
  - prices (curated ₹ ranges);
  - nutrient values, which are approximate and marked `verified: false` until checked against IFCT 2017 (code and page).
- **Proposed, pending clinical sign-off:**
  - care-level thresholds (`data/ontology/care-levels.json`);
  - bands (`data/ontology/bands.json`).
- **Not built (P1/P2 in the plan):**
  - Google Health API and Apple Health export;
  - Todoist;
  - shopping list;
  - the card for whoever cooks;
  - a share postcard for Cycle reports;
  - capturing anaemia red flags from chat (the rule reads `redFlags`, but nothing writes them yet);
  - ABDM.
- **Placement change from the plan:** the Watch my Cycle report button sits on the Between donations tile (and on Progress), not as a chip above the chat. This keeps Copilot.tsx untouched.
- **Not tested live:** the Junction sandbox, Habitify and Microsoft To Do connectors haven't been exercised against the real services, because no key or tenant was available here.

## How to revert

Everything new is in new files, apart from the additions listed above.
- **Back out the whole change set:** `git revert -m 1 <merge commit>` once merged, or check out `v1-baseline`.
- **Remove only the persona:** take `D-175` out of the persona list and `drop-seed.json`.

## Round 2: every persona, and app data used throughout

The first build showed the between-donation features only for Asha. Now every demo persona gets them, and app data feeds every place that is about staying healthy.

**Every demo persona starts with the apps they would already use** (demo data, labelled), and a Food profile set explicitly in `data/demo/wellbeing-seed.json` (never inferred from a name). Week plans are preset only where the persona's story already has one (Meera's walking plan, Asha). The New donor connects their own.

| Persona | Apps | Food profile | Week plan |
|---|---|---|---|
| Arjun | Fitbit, Habitify | Non-vegetarian, South Indian, canteen | — (plans in the demo) |
| Meera | Fitbit, Cronometer, Microsoft To Do | Vegetarian, South Indian, tight budget | Brisk walk 3 days, iron add-on 5 days (for her Goal) |
| Ananya | Oura, Habitify | Eggetarian, South Indian | — |
| Vikram | Fitbit | Non-vegetarian, South Indian | — (no movement while his Goal is urgent) |
| Karthik | Fitbit, Cronometer | Vegetarian, South Indian, tiffin | — |
| Rohan | Oura, Habitify | Vegetarian, North Indian | — |
| Asha | Fitbit, Habitify, Cronometer | Eggetarian, North Indian, tight budget | Iron add-on, 20-minute walk; Your day |

**Where the app data is used** (`backend/src/domain/habits.js`):

- **My health, Habits and This week:** each Habit's week from the apps against a healthy target with its source:
  - Movement: active minutes against WHO's 150 a week;
  - Food: iron from food against the ICMR-NIN need, and water against about 2 L;
  - Mind: sleep against 7 h on most nights, plus resting heart rate.

  Week plan items follow, with the days kept.
- **Each Goal card:** "From your apps": what the apps recorded in the 4 weeks before the Goal started, then since. Arjun: "145 min a week · 4,776 steps a day · 6.5 h sleep".
- **Progress:**
  - a **Getting ready for your next donation** checklist (Hb, BP, last nights' sleep, water, iron, resting heart rate against usual). It is a checklist only; the centre decides.
  - "From your apps" tiles with targets.
- **Home tile:** this week's steps and sleep or iron, and readiness when the donation is near.
- **Food coaching:** sized to what the donor eats. "Your food app shows about 11.4 mg a day; these three add about 7.1 mg."
- **Doctor timing:** the food panel's doctor advice now matches the Goal's own protocol step. Meera: "within 2 weeks, as your Goal says".
- **Weekly report:** a "From my apps this week" slide after the existing slides. Active minutes are left out when the existing slide already shows them.
- **Drop's context:** the week's app summary (aggregates only) in every Chat.
- **Cycle reports and comeback Cards:** work for every persona. A rough week brings Karthik a comeback Card too.

**Checks.**
- **Golden test, re-recorded from `v1-baseline`** (via a temporary worktree). It now records exactly the existing behaviour:
  - Cards of the existing kinds with their state, timing and words;
  - events and budget counters;
  - Drop's own log;
  - the Weekly report's existing slides;
  - Goals, findings, score, eligibility, cover, Badges, impact, Drop's lines, the Intro and rule answers.

  All seven existing personas, now with their apps connected, match it. The only normalising is the report's own slide count ("in 3 taps" / "3 slides"); its existing slides are compared one by one.
- **New Cards' log lines** go in their own list, so they never push Drop's lines out of its 40-line log. "What Drop knows" shows both.
- **Coaching Cards left unanswered** go quietly after 6 days, so they never fold into the Weekly report.
- **Results:** `npm test`: 205 pass. Frontend type-check and build pass. In the browser, every persona's Home tile, My health and Progress showed app data with no console errors.

## Round 3: a plan from each donor's results, and Drop answers it with the model (19 Nov 2026)

**A plan from the results, not just iron** (`backend/src/domain/improvements.js`, `data/nutrition/habits.json`):

- **What it covers:** every result that needs improving gets its own foods and everyday habits:
  - iron;
  - vitamin D and B12 (from lab reports the donor adds);
  - BP, blood sugar and cholesterol (including low HDL);
  - weight;
  - a raised liver enzyme.
- **How it combines:** one plan that mixes foods and habits, with first place going to whatever helps most of the donor's results at once. Each food and habit says which results it helps.
- **Examples:**
  - Asha: vitamin D gets a mid-morning sun walk, fortified oil and eggs; B12 gets curd, milk or paneer.
  - Arjun: BP, cholesterol and sugar share a brisk walk, millet swaps and less salt.
- **Doctor lines:** the doctor advice for each result always shows, grouped when the same line covers several. It matches the Goal's protocol when there is one.
- **Safety:** an urgent Goal gets no exercise; "see a doctor first" gets no food plan. Diet (vegan, Jain, vegetarian…), region and budget are respected.
- **Demo data:** Asha has an outside lab report in `data/demo/overlay.json` (vitamin D 16, B12 260), so the mix shows.
- **Where it appears:**
  - **From your results: what to improve** on Progress and My health, with **Add to my week**, which turns the plan into Week plan items;
  - Asha's Home Card;
  - **Why this plan?**;
  - Week plan suggestions, when no Goal step covers the Habit.

**Drop answers through the model.**
- **Tools:** every Chat (General included) now gets the between-donation tools:
  - `get_health_plan`
  - `get_habits_from_apps`
  - `get_readiness`
  - `get_cycle_report`
  - `find_foods`
  - `offer_week_plan`
  - `explain_recommendation`
  - `get_cycle`, `get_bands`
- **Context:** Drop's context carries the plan's headline and the week from the apps.
- **Check after the model:** `foodGuard.checkPlan` replaces any food the rules didn't choose and any medicine with the rule wording, and adds every doctor line.
- **Readiness routing:** "Am I ready for my next donation?" now goes to the model. "When can I donate?" keeps its existing shortcut.
- **Offline fallback:** rule answers for the same questions now follow what was asked: one result ("how can I raise my vitamin D?"), why these foods, cost, "I don't eat eggs", sleep, activity, readiness, add to my week. In Habit Chats they come first; in General they come after every existing rule answer, so those answers are unchanged.

**Checks.**
- `npm test`: **218 pass**. New tests:
  - `improvements.test.js`.
  - `drop-ai.test.js`, which runs Drop's real chat path with a scripted stand-in model across every persona: the tools each Chat offers, the context, multi-turn history, Week plan Cards, the plan and food checks, Vikram's urgent case, and the offline rules for every persona and Chat.
- Golden test unchanged and passing.
- Browser: the plan card for Asha, Arjun and Ananya; Add to my week.

**Live check against Azure OpenAI.** Not run here, because no credentials were available. Run it yourself:

```bash
cd backend
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com AZURE_OPENAI_DEPLOYMENT=<deployment> AZURE_OPENAI_API_KEY=<key> node test/live/drop-conversations.js
# one persona: … node test/live/drop-conversations.js D-175
```

- **What it runs:** for every persona, single questions and three multi-turn conversations in the General, Food, Mind and Movement Chats.
- **What it checks in each answer:**
  - answered by the model, not the rules;
  - no medicine;
  - every doctor line present when the plan came up;
  - Hindi for Asha and Rohan;
  - not too long.
- **Output:** a report in `backend/test/live/last-run.md`, and a non-zero exit if a check fails.

**Azure (19 Nov 2026).**
- **`data/nutrition` is now in every deploy package:**
  - the GitHub workflow and Dockerfile (Sandeep's commit 851304a);
  - `scripts/deploy-azure.sh` (this change).
- **Guard in `drop.js`:** its hooks into the between-donation features are wrapped (`coachingSafe`), so a fault there, such as a missing data file, is logged and Drop's existing Cards carry on. Checked with a production-mode package without `data/nutrition`: every persona's Drop view still worked.
- **Microsoft To Do permission:** `scripts/deploy-azure.sh` adds `Tasks.ReadWrite` to the app registration, looked up by name from Microsoft Graph.
- **AI limits:** `LLM_RATE_LIMIT_TOKENS_PER_DAY` and `LLM_MAX_CALLS_PER_DAY` in `infra/main.bicep` to be raised for the review period (Sandeep). Round 3 adds about 1,500 tokens to each model call.

**Drop on Azure (19 Nov 2026, after the first live test).**
- **What the live model showed:** asked "How can I raise my vitamin D?", it picked the general care-level and check-up tools, wrote no answer, and used about 7,000 tokens in 3 calls.
- **Change: one call, no tools.** Questions about what to improve, what to eat, habits, the apps' week, readiness and "why" are now answered in one model call on rule-checked facts. This is the same pattern Drop already uses for impact, BP and results.
  - The facts and the foods come from the rules; the model writes the answer in the donor's language.
  - The plan check adds the doctor line for the result asked about (or the two most important).
  - The last four turns go with each call, for follow-ups.
- **Agent tool list trimmed** to the 7 tools that still matter there (2,267 tokens with the existing ones, down from 2,704).
- **Cost:** a vitamin D question is now one call of about 1,300 tokens.
