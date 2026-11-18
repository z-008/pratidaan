# Technical implementation plan: daily health between donations

- **Status:** ready to build. No code has been written yet.
- **Revision 4 (18 Nov 2026):** every demo persona now starts with the apps they would already use connected and a Food profile. Improvements apply to all profiles, and existing behaviour stays exactly as before (golden test re-recorded from `v1-baseline`). See the [build change log](2026-11-18-wellbeing-build.md#round-2-every-persona-and-app-data-used-throughout).
- **Date:** 18 Nov 2026
- **Deadline:** final submission on 20 Nov 2026
- **Builds:** the features in [2026-11-18-review-feedback-plan.md](2026-11-18-review-feedback-plan.md), revision 3
- **Revision 3:** no "What's new" switch, because a toggle would confuse hackathon reviewers. The team's earlier build is protected by the git workflow in [4.4](#44-protecting-the-teams-existing-build) instead.
- **Read first:** [CONTEXT.md](../../CONTEXT.md) (vocabulary), [02-product.md](../02-product.md) (what exists), [03-architecture.md](../03-architecture.md) (how it is built)

This document says how to build the new features without losing anything Pratidaan does today, and how to show them so the review panel sees its feedback answered.

## Contents

1. [The additive contract](#1-the-additive-contract)
2. [Audit of the feature plan against the additive contract](#2-audit-of-the-feature-plan-against-the-additive-contract)
3. [What exists and must stay, and the placeholders we fill](#3-what-exists-and-must-stay-and-the-placeholders-we-fill)
4. [Architecture](#4-architecture)
5. [Data model](#5-data-model)
6. [Component specifications](#6-component-specifications)
7. [Drop engine integration](#7-drop-engine-integration)
8. [AI layer](#8-ai-layer)
9. [Frontend](#9-frontend)
10. [API reference](#10-api-reference)
11. [Privacy and security](#11-privacy-and-security)
12. [Testing and regression](#12-testing-and-regression)
13. [Build schedule](#13-build-schedule)
14. [Demo and showcase](#14-demo-and-showcase)
15. [Risks and mitigations](#15-risks-and-mitigations)
16. [Open decisions](#16-open-decisions)

## 1. The additive contract

Every change must pass these eight rules. Reviewers of each pull request check them, and the regression suite in section 12 enforces them.

| # | Rule | How it is enforced |
|---|---|---|
| C1 | **Nothing is removed.** No screen, tile, Card, button, chip, route, API field, persona, test or doc section is deleted. | Code review. Existing API response fields are compared against the golden baseline. |
| C2 | **Nothing is renamed.** Existing terms (Cycle, Check-up, Check-in, Goal, Habit, Week plan, Your day, Weekly report, Choices…) keep their meaning and their labels on screen. | A CONTEXT.md diff only adds terms. |
| C3 | **Existing behaviour is unchanged.** Card timing, priority, Message budget, quiet hours, snooze, Undo, Goals, health score, eligibility, cover, Badges, Stories and k-anonymity work and read as today. | The golden baseline must stay identical for every persona over a scripted clock run (12.2). |
| C4 | **Existing personas start exactly as today.** New features appear for them only after a tap during the demo. | The golden test compares the new build, before any taps, with the baseline recorded from the team's current build. |
| C5 | **New features live in new places,** or as lines **added after** existing content. Existing content keeps its order and text. | Screenshot comparison of Home, My health and the side sheet for each persona (12.4). |
| C6 | **Placeholders are filled, not redesigned.** "Not built yet" items keep their label, entry point and empty-state text; they gain content only when there is something to show. | Empty-state tests (the existing `emptystates.test.js` plus new ones). |
| C7 | **The team's existing build is never overwritten.** New code goes in new files. Existing files get only the small additions listed in 4.3. Git history is never rewritten, and the current build is tagged so it can always be restored. | Git workflow in 4.4; pull-request review by the teammate who wrote the file. |
| C8 | **All existing tests pass unchanged.** Test files are never edited to make a change pass. New tests go in new files. | CI runs `npm test` (167+ tests today) and `npm run type-check`. |

## 2. Audit of the feature plan against the additive contract

The first version of the feature plan broke the contract in these places. Revision 2 of the plan has the fixes.

| Plan item | What it would have changed | Fix |
|---|---|---|
| Rename Cycle to "Season" | The CONTEXT.md term, "Earlier this cycle", Past Cycles | Keep **Cycle**. New Story is the **Cycle report**. New wording says "free health check" and never reuses Check-up or Check-in. |
| A1: Intro step "Connect your apps" | The 8-step Intro and its tests | Intro untouched. Entry points instead: a Home tile, My health's Habits and the account menu. |
| A5: replace `activityMinutes()` | Weekly report figures for Arjun and Meera | Kept as the fallback. The Demo connector reports the same numbers until the donor changes something. |
| B1: Cycle bar under Home's header | Home header layout | A new **Between donations** tile directly after the existing Next donation tile. |
| B2: Health check-up panel at the top of My health | My health's order, and a clash with the existing "Check-up" term | A new **Progress** screen (`#progress`) plus one link line on My health. |
| B6: extend the Results Card | Results Card buttons and text | A new **Watch my Cycle report** chip alongside the existing Story chips; earlier reports under Past Cycles. |
| B7: reword the deferral Goal and Results Card | Meera's wording | Wording kept. A forward-looking line is added on the new surfaces only. |
| C1: Food profile in the Intro | The Intro | Asked the first time the existing Food Chat is opened, or from Progress. |
| C2: replace `lifestyle-recommendations.json` | Goal write-ups and their citations | A new `data/nutrition/foods.json`. The old file stays. |
| C5: rename the Food Chat | The Food chip label | Same chip and label. It gains food tools. |
| C7: switch Goal write-ups to Indian foods | Goal steps, tests, demo script expectations | Write-ups untouched. A collapsed **Foods that fit you** row is added under the steps. |
| D1: "What got in the way?" for a missed day | The Your day rule that a skipped day is never mentioned | Asked only at the moment the donor taps Skipped. |
| D2: comeback Card counts against the Message budget | Existing Cards could be delayed by a new one | A separate coaching allowance (7.2): at most 1 a week, evening only, never on a day an existing Card was sent, never counted in the existing budget. |
| (implicit) Next event | New Cards would stop Next event earlier, breaking the 20 test scripts | Next event ignores the new Card types, as it already ignores Reminders. |
| (implicit) New agent tools in `tools.js` | `CHAT_TOOLS` includes every definition automatically, so existing chats would see new tools | New tools live in a separate module and are only added to specific Chats (8.1). |
| (implicit) Weekly report slides | Order of slides, and tests that check slides | New slides are only **added after** the existing ones, and only when the donor has a Week plan or connection. |
| F1: Rohan gets a ferritin overlay | Rohan's data, score and story | Rohan unchanged. New persona **Asha Khan** (`D-175`), promoted from existing synthetic donors with no data changes. |
| F1: personas seeded with connections | Every existing persona's first screen | Existing personas start unconnected. Connections are one tap in the demo. Only Asha starts fully set up. |
| E1: extend Choices | CONTEXT defines Choices as three sharing switches | Choices untouched. New permissions live on the Connected apps screen and in a Food profile section of Your data. |
| Calendar scopes | Adding `Tasks.ReadWrite` to `CALENDAR_SCOPES` would ask for calendar consent again | A separate To Do consent with its own scope list. |

## 3. What exists and must stay, and the placeholders we fill

### 3.1 Must stay exactly as is

| Area | Files | Protected behaviour |
|---|---|---|
| Personas | [routes/donors.js](../../backend/src/routes/donors.js), [data/demo/drop-seed.json](../../data/demo/drop-seed.json), [overlay.json](../../data/demo/overlay.json) | Seven personas with their starting states on Sat 10 Oct 2026, 8 am |
| Demo clock | [data/store.js](../../backend/src/data/store.js), [routes/demo.js](../../backend/src/routes/demo.js), [DemoBar.tsx](../../frontend/src/components/DemoBar.tsx) | + few hours, +1 day, +1 week, Next event, Reset, What Drop knows |
| Intro | [domain/intro.js](../../backend/src/domain/intro.js), [Intro.tsx](../../frontend/src/components/intro/Intro.tsx) | 8 steps, replay, translations |
| Drop Cards | [domain/drop.js](../../backend/src/domain/drop.js) | Card kinds, priority, budget, quiet hours, snooze, fold, Undo, memory rules, Weekly report |
| Goals | [goals.js](../../backend/src/domain/goals.js), [goalWriteup.js](../../backend/src/domain/goalWriteup.js) | Grouping, targets, order, states, write-ups and citations |
| Findings, score, eligibility | [health.js](../../backend/src/domain/health.js) | Not edited at all. New code only reads it. |
| Cover, Badges, impact, Circles | [cover.js](../../backend/src/domain/cover.js), [badges.js](../../backend/src/domain/badges.js), [impact.js](../../backend/src/domain/impact.js), [community.js](../../backend/src/domain/community.js) | Not edited. |
| Stories and share images | [story.js](../../backend/src/domain/story.js), [StoryViewer.tsx](../../frontend/src/components/drop/StoryViewer.tsx), [shareImage.ts](../../frontend/src/components/share/shareImage.ts) | Existing Stories unchanged; new ones go through the same player |
| AI | [copilot.js](../../backend/src/ai/copilot.js), [tools.js](../../backend/src/ai/tools.js), [guardrails.js](../../backend/src/ai/guardrails.js) | Existing tools, prompts, fallback answers and guardrails unchanged |
| Booking and Calendar | [booking/](../../backend/src/booking/), [calendar/](../../backend/src/calendar/), [calendarAuth.ts](../../frontend/src/calendarAuth.ts) | Existing flows and scopes |
| Your data and Choices | [YourData.tsx](../../frontend/src/pages/YourData.tsx), [auth/accountData.js](../../backend/src/auth/accountData.js) | Existing entries and deletes. New entries are added after them. |
| Showcase | [demo-video-script.md](../05-review/demo-video-script.md), [pratidaan-guide.html](../05-review/pratidaan-guide.html), [reviewer-guide.html](../05-review/reviewer-guide.html), [docs/drop/](../drop/README.md) (20 scripts) | Every beat and expected result still holds |

### 3.2 Placeholders we fill

These already exist in the app as "not built yet". Filling them is the evolution the panel asked for. Each keeps its label, entry point and empty state.

| Placeholder today | File | After |
|---|---|---|
| Habits: "Plan this week" on Movement, Food and Mind | [Health.tsx](../../frontend/src/pages/Health.tsx) `HabitShelf` | Same three Habits. With a Week plan: today's items, days kept, and source tags (app or watch). Without one: exactly today's shell. |
| This week: "No Week plan" rows | Health.tsx `ThisWeek` | A Mon–Sun row per Habit when a Week plan exists; otherwise unchanged. |
| Goal card: "Nothing planned yet. Open … to plan this week." | Health.tsx | Shows the Week plan items that serve the Goal when there are any. |
| Simplify my plan (disabled, "Comes with Week plans") | [ChatSheet.tsx](../../frontend/src/components/drop/ChatSheet.tsx) | Enabled when a Week plan exists. Behaviour as defined in CONTEXT.md. |
| Habit Chat subtitle "Habit · no Week plan yet" | ChatSheet.tsx | Unchanged until a Week plan exists, then "Habit · Week plan until Sun". |
| Drop: "saving Week plans is coming" | [copilot.js](../../backend/src/ai/copilot.js) | Drop offers a **Week plan** Card the donor taps to save. |
| Your day (in CONTEXT.md, not built) | — | Built as defined: opt-in daily Card, outside the budget. |
| Weekly report: "Activity minutes (simulated)" | drop.js `buildReport` | Same slide. Source changes to the connected device after the donor connects one. |
| Download a copy of your data | Privacy page, Your data | Built: JSON + FHIR. |

## 4. Architecture

### 4.1 Overview

```
                    ┌──────────────── existing (unchanged) ────────────────┐
 donation panel ──▶ │ health.js findings · goals.js · drop.js Cards/budget │
 lab reader     ──▶ │ score · eligibility · cover · badges · impact        │
                    └────────────▲──────────────────────────▲───────────────┘
                                 │ reads only               │ 4 small hooks (4.3)
┌─ integrations/ ──┐   ┌─ domain/ (new) ───────────────────────────────────┐
│ demo  (personas) │   │ signals.js    normalised store + rollups          │
│ junction (sbx)   │──▶│ cycle.js      Cycle phases, focus, Cycle report    │
│ googleHealth     │   │ bands.js      bands + age-group percentile        │
│ habitify         │◀─▶│ links.js      what moves each marker              │
│ msTodo (Graph)   │   │ careLevel.js  food-led vs doctor-first (rules)    │
│ appleExport (P1) │   │ foodCoach.js  filter + rank Indian foods          │
└──────────────────┘   │ weekPlan.js   Week plans, Your day, Simplify      │
                       │ routine.js    disruptions, patterns, barriers     │
                       │ adjustments.js library + selection + step-up      │
                       │ explain.js    "Why this?" objects                 │
                       │ coaching.js   new Cards + allowance (feeds drop)  │
                       └─────────────▲─────────────────────────────────────┘
                                     │
 ai/wellbeingTools.js (gated) ───────┘   routes/wellbeing.js  /api/donors/:id/...
 ai/foodGuard.js (validator)                                   /api/drop/...
                                     │
 frontend: pages/Progress.tsx · pages/Connections.tsx · components/wellbeing/*
           + additive slots in Home, Health, ChatSheet, DropCardView, DemoBar, YourData, AccountMenu
```

### 4.2 New backend modules

| Module | Responsibility | Depends on |
|---|---|---|
| `src/integrations/index.js` | Connector registry and the shared interface | — |
| `src/integrations/demo.js` | Deterministic persona storylines (5.2) | store, drop (for `activityMinutes`) |
| `src/integrations/junction.js` | Junction sandbox: create user, create demo connection, read summaries | `JUNCTION_API_KEY` |
| `src/integrations/googleHealth.js` | Google Health API v4 read (steps, sleep, resting HR, hydration, nutrition) | Google OAuth token from the page |
| `src/integrations/habitify.js` | Read habits and logs; add a log; add or update a habit | API key from the page |
| `src/integrations/msTodo.js` | Read and create recurring tasks (Microsoft Graph `/me/todo/lists/.../tasks`) | Graph token from the page |
| `src/domain/signals.js` | Ingest (with consent check), deduplicate, rollups (day / week / Cycle), delete | integrations |
| `src/domain/cycle.js` | Cycle number, phase, day x of y, focus selection, Cycle report slides | health, goals, signals, bands |
| `src/domain/bands.js` | Bands per marker (from `data/ontology/bands.json`), percentile among donors of the same sex and age band | store, health |
| `src/domain/links.js` | Marker ↔ signal table (`data/ontology/marker-signals.json`), "alongside" sentences | signals, health |
| `src/domain/careLevel.js` | Care level per marker (rules, 6.3) | health (findings, `hbMin`), store |
| `src/domain/foodCoach.js` | Food profile, filtering, safety filter, ranking, output | careLevel, `data/nutrition/*` |
| `src/domain/weekPlan.js` | Week plans, Your day, Simplify my plan, skip reasons | signals, integrations |
| `src/domain/routine.js` | Disruption rules, patterns, barrier stats | signals, weekPlan |
| `src/domain/adjustments.js` | Adjustment library, selection, step-up | routine, careLevel, goals |
| `src/domain/explain.js` | Builds "Why this?" objects from rule outputs | all of the above |
| `src/domain/coaching.js` | New Card kinds, coaching allowance, their wording and answers | drop (via hooks) |
| `src/ai/wellbeingTools.js` | New agent tools (8.1) | the domain modules above |
| `src/ai/foodGuard.js` | Output validator for food answers (8.3) | foodCoach |
| `src/routes/wellbeing.js` | New REST routes (section 10) | the domain modules above |

### 4.3 Touch points in existing files (all additive)

These are the only edits to existing files. Each one is small and only **adds** a call or an entry. The existing code around it isn't rewritten, and when a donor hasn't used a new feature, the added code does nothing (it returns early or adds an empty list).

| File | Change |
|---|---|
| [backend/src/domain/drop.js](../../backend/src/domain/drop.js) | 1. At the end of `deliver(st)`: `coaching.deliver(st, api)`, which returns at once when the donor has no Week plan, connection or Food profile (`api` exposes `pushCard`, `log`, `label`).<br>2. In `words()` / `label()` / `answer()`: before the existing `switch` falls through to its default, hand unknown `type:variant` keys to `coaching.words/label/answer`. Existing cases are untouched.<br>3. At the end of `buildReport()`: `slides.push(...coaching.reportSlides(st, from, today))` (empty when nothing is new).<br>4. In `nextEvent()`: the `count()` filter also excludes `coaching.TYPES`, as it already excludes Reminders.<br>5. `activityMinutes(donorId, iso)` stays and is exported so the Demo connector can reuse it. |
| [backend/src/data/store.js](../../backend/src/data/store.js) | None. New modules use `onStep` / `onReset`. |
| [backend/src/routes/donors.js](../../backend/src/routes/donors.js) | Add `'D-175'` to the end of the persona list. Asha is the last entry, so existing positions don't move. |
| [backend/src/server.js](../../backend/src/server.js) | Mount `routes/wellbeing.js`. |
| [backend/src/routes/demo.js](../../backend/src/routes/demo.js) | One new route, `POST /api/demo/rough-week`. Existing routes unchanged. |
| [backend/src/ai/copilot.js](../../backend/src/ai/copilot.js) | 1. Build the tool list as `CHAT_TOOLS` plus `wellbeingTools.namesFor(chatId)`.<br>2. Add a context block from `wellbeingTools.context(donorId, chatId)`.<br>3. Add new fallback intents **after** the existing ones, so existing questions still match the same intent first.<br>4. Run `foodGuard.check()` after the existing guardrail on Food-chat replies. |
| [backend/src/ai/guardrails.js](../../backend/src/ai/guardrails.js) | Add anaemia red-flag phrases (fainting, black stools, breathless at rest) to the existing pre-model urgent list. This only adds safety triggers. |
| [frontend/src/App.tsx](../../frontend/src/App.tsx) | `Screen` gains `'progress' \| 'apps'`. NAV gains `{ id: 'progress', label: 'Progress', icon: <an existing chart icon> }` after My health, without `mobile` (the mobile bar keeps its 5 items). `'apps'` is a hash-only route. |
| [frontend/src/api.ts](../../frontend/src/api.ts) | New functions only. |
| [frontend/src/pages/Home.tsx](../../frontend/src/pages/Home.tsx) | Insert `<BetweenDonationsTile/>` right after the Next donation tile; add the "Watch my Cycle report" chip to the Story chips. |
| [frontend/src/pages/Health.tsx](../../frontend/src/pages/Health.tsx) | Render the Week plan in `HabitShelf` and `ThisWeek` only when one exists (the shell otherwise); add the collapsed Foods that fit you row under each Goal card's steps; add one link line under Drop's line. |
| [frontend/src/components/drop/ChatSheet.tsx](../../frontend/src/components/drop/ChatSheet.tsx) | Enable Simplify my plan when a Week plan exists; Food profile chips the first time the Food Chat opens. |
| [frontend/src/components/drop/DropCardView.tsx](../../frontend/src/components/drop/DropCardView.tsx) | Renderers for the new Card types. Existing renderers are untouched. |
| [frontend/src/components/DemoBar.tsx](../../frontend/src/components/DemoBar.tsx) | One new button, **Simulate a rough week**, after the existing ones. |
| [frontend/src/components/AccountMenu.tsx](../../frontend/src/components/AccountMenu.tsx) | A **Connected apps** item after the existing items. |
| [frontend/src/pages/YourData.tsx](../../frontend/src/pages/YourData.tsx) | New cards after the existing places; Download my data. |

### 4.4 Protecting the team's existing build

The app has no switch or mode for new features. Reviewers see one app, the one we submit. What protects the team's earlier work is how we build:

1. **Tag the current build before anything else:** `git tag v1-baseline` on today's `main`, pushed to GitHub. It is the reference for the golden baseline (12.2) and the restore point.
2. **Branches, not direct commits:**
   - one branch per stream (`feature/wellbeing-connect`, `feature/wellbeing-cycle`, `feature/wellbeing-food`), merged into `feature/wellbeing` through pull requests;
   - one merge to `main` after the full regression pass (12.4);
   - never commit straight to `main`, never force-push, never rebase or squash other people's commits.
3. **New code in new files.** Existing files only get the additions listed in 4.3. Any other change to an existing file needs agreement, in the pull request, from the teammate who wrote it (`git log` / `git blame` shows who).
4. **Nothing is deleted:** no existing file, test, doc or change log is removed or rewritten. [docs/changes/mihir-bhatt.md](mihir-bhatt.md) and the other docs stay as they are; we write our own change log in a new file in `docs/changes/`.
5. **Existing tests are never edited** to make a change pass (C8).
6. **Every pull request description lists:**
   - which existing files it touches, and why;
   - the golden test result;
   - which of the 20 existing scripts were re-run.
7. **Conflicts are resolved in favour of the existing behaviour.** The new code adapts to the old code, never the other way round.
8. **Restore if something goes wrong on 20 Nov:** revert the merge commit on `main` (`git revert -m 1 <merge>`), which keeps all history, and let the existing deploy workflow redeploy. Or redeploy `v1-baseline`. Either way the team's earlier build is back within one deploy.

### 4.5 State and persistence

| State | Where | Lifetime |
|---|---|---|
| Persona wellbeing state: signals from the Demo connector, Week plans, Your day, Food profile, barriers, adjustments, coaching allowance | A new `st.wb = {...}` inside the Drop state per persona (in memory) | Reset with the demo clock. Included in Drop's Undo snapshot automatically, because `answer()` clones `st`. |
| Real (live) connections: Habitify, To Do, Google Health | **Never stored on the server.** Keys and tokens stay in the page (`sessionStorage`), like the existing Calendar token, and are sent per request. | Browser session |
| Data read from live connections | Kept per signed-in account and persona (`chatCycles.scopeKey(user, donorId)` pattern), in memory only | Session; cleared on sign-out, on Delete in Your data, or after 24 h |
| Junction sandbox user per persona | Server memory, `junction.users[donorId]` | Reset |
| Food library, bands, marker links | `data/nutrition/*.json`, `data/ontology/*.json` (new files) | Static, versioned in git |

**A prototype limit to state openly:** Drop's Cards come from persona (demo) data, because Drop's state is per persona and shared. Live connections show the reviewer's own data privately on Connected apps and Progress, and can write back to their own Habitify or To Do. In production every donor has their own Drop state, so live data feeds Cards directly.

## 5. Data model

### 5.1 Core shapes

```js
// Signal (signals.js) — one value per signal per day per source
{ date: '2026-10-12', signal: 'steps', value: 6420, unit: 'count',
  source: 'device' | 'app' | 'you' | 'medical_device', app: 'fitbit-demo', connectionId: 'cn-…' }
// signals: steps, active_min, sleep_min, rhr_bpm, hrv_ms, water_ml, iron_mg, sodium_mg,
//          bp (value=s, value2=d), weight_kg, habit_done (habitRef, value 0/1), food_habit_done

// Connection
{ id, provider: 'demo' | 'junction' | 'google_health' | 'habitify' | 'ms_todo' | 'apple_export',
  label: 'Fitbit (demo)', kind: 'wearable' | 'habit' | 'food' | 'device', mode: 'demo' | 'live',
  status: 'connected' | 'error' | 'disconnected', consentedTypes: ['steps','sleep_min'],
  writeBack: false, lastSync: '2026-10-10T08:00', habitMap: [{ externalId, title, habit: 'movement', signal: 'habit_done', confirmed: true }] }

// Week plan (weekPlan.js) — CONTEXT.md: one or two items per Habit, ends on Sunday
{ id, weekOf: '2026-10-12', endsOn: '2026-10-18', items: [
  { id, habit: 'movement' | 'food' | 'mind', kind: 'session' | 'guide', text: '30-minute brisk walk',
    perWeek: 3, minutes: 30, goalId: 'g-…' | null, source: { protocolId, guide },
    measuredBy: 'active_min' | 'habit_done' | 'food_habit_done' | 'you',
    sync: { provider: 'habitify', externalId } | null, setAside: false, stepDown: null } ] }

// Food profile (foodCoach.js) — chosen by the donor, never inferred
{ diet: 'veg' | 'egg' | 'nonveg' | 'vegan' | 'jain', allergies: ['peanut'], fasting: ['navratri','weekly:tue'],
  region: 'south' | 'north' | 'east' | 'west' | 'northeast', regionFrom: 'district' | 'donor',
  staple: 'rice' | 'roti' | 'millet', eatsAt: 'home' | 'canteen' | 'hostel' | 'tiffin',
  budget: 'tight' | 'moderate' | 'flexible', dislikes: ['spinach'], setOn }

// Care level (careLevel.js)
{ marker: 'iron', level: 'optimal' | 'low_normal' | 'below' | 'doctor_first' | 'urgent' | 'not_needed',
  ruleId: 'IRON-LN-1', evidence: ['Hb 12.7 g/dL on 2026-03-16 (minimum 12.5)', 'Ferritin 25 ng/mL'],
  coaching: 'food' | 'food_and_doctor' | 'rules_only' | 'none',
  doctor: { urgency: 'recommended' | 'weeks' | 'first' | 'today', text } }

// Food suggestion (foodCoach.js)
{ marker, nutrient: 'iron', dailyTarget: { value, unit, source: 'ICMR-NIN 2020' },
  foods: [{ id: 'drumstick_leaves', name: 'मुनगा पत्ती', nameEn: 'Drumstick leaves', serving: '1 katori cooked',
            perServing: { iron_mg: 2.1 }, costPerDay: { min: 4, max: 8 }, fitIn: '…in your dal, 3 days a week',
            pairWith: ['lemon'], ifct: { code: 'B…', page: 0 } }],
  tips: ['Keep chai an hour away from meals'], doctor: careLevel.doctor, explanation: Explanation }

// Explanation (explain.js) — shown by "Why this?"
{ title, dataUsed: [{ text, source, from, to }], rule: { id, text }, guidance: [{ text, source }],
  preferences: ['Vegetarian', 'Tight budget'], effect: 'BP is this Cycle\'s focus',
  wouldChange: 'Log 3 walks this week and the target steps back up',
  notUsed: ['Your lab results are never sent to habit apps', 'Nothing here changes your cover or score'] }

// Disruption (routine.js)
{ id, ruleId: 'R2', signal: 'steps', since: '2026-11-02', baseline: 7400, recent: 3900, pattern: 'P1:weekday-evenings', barrier: 'busy' }

// Adjustment (adjustments.js)
{ id: 'ADJ-SHRINK-WALK', habit: 'movement', appliesTo: { rules: ['R1','R2'], barriers: ['busy','low_energy'] },
  change: { minutes: 10 }, text: '10-minute walk after breakfast', forbiddenWhen: ['urgent_goal','unwell'], source }
```

### 5.2 Demo connector storylines (`data/demo/wellbeing-seed.json`)

The Demo connector generates signals on demand from a seeded storyline per persona. There are no large fixture files, and the output is deterministic (seed 42, matching `data/generate.py`).

| Persona | Storyline |
|---|---|
| Arjun (D-001) | Steps per day for each interval between his past donations: 9,100 → 7,800 → 6,600 → 5,200, mirroring his BP (126 → 132 → 136 → 148). From demo start, `active_min` = `activityMinutes()` exactly. Sleep 6.2–6.8 h. A travel week, available to **Simulate a rough week**. Habitify habit "Evening walk" (demo). |
| Meera (D-002) | Iron intake 9–12 mg/day (Cronometer, demo); a To Do task "Chai 1h after meals" ticked 4–5 days a week. `active_min` = `activityMinutes()`. |
| Ananya (D-003) | Oura (demo): sleep 7.4 h with regular timing, resting HR 58, steps 10,500. |
| Vikram (D-017) | A watch (demo): steps 4,000, resting HR 82. |
| Asha (D-175, new) | Connected from the start: watch + Habitify. Week plan: Food "Iron add-on with lunch" 5/wk, Movement "20-min walk" 3/wk. Your day at 9 pm. Food profile seeded. A busy fortnight pattern on Tue/Thu. |
| Karthik, Rohan, New donor | No storyline. Connecting **Demo watch** gives a generic, steady pattern. |

**Rough week:** `POST /api/demo/rough-week {donorId}` overlays the next 7 days with a disruption (steps −50%, sleep −1 h, habit completion 1/5) and a barrier code from the storyline ("travel" for Arjun, "busy" for Asha).

### 5.3 New static data files

| File | Content | Owner |
|---|---|---|
| `data/nutrition/foods.json` | 60–80 Indian foods (shape in C2). Every value cites an IFCT 2017 code and page. | Food stream; values checked by a second person |
| `data/nutrition/regions.json` | District → state → region (from the donors' districts) | Food stream |
| `data/nutrition/requirements.json` | ICMR-NIN 2020 requirements by sex for iron, vitamin C, B12, folate and protein, with the source page | Food stream |
| `data/nutrition/absorption.json` | Pairing and spacing rules (vitamin C, tea or coffee, calcium, iron kadai, sprouting and fermenting, fortified staples) | Food stream |
| `data/ontology/bands.json` | Bands per marker with sources. **Optimal is only used where a guideline defines one** (BP: optimal <120/80; LDL: optimal <100; HDL ≥60). Other markers have two bands (e.g. HbA1c healthy <5.7%). For Hb, the top band is "Comfortable for donating" (≥ minimum + 1.0). | Cycle stream; clinical sign-off |
| `data/ontology/marker-signals.json` | The marker ↔ signal links with sources | Cycle stream |
| `data/ontology/care-levels.json` | Care-level thresholds per marker (the C3 table), editable without a code change | Food stream; clinical sign-off |
| `data/nutrition/adjustments.json` | The adjustment library | Coach stream |

## 6. Component specifications

Each component lists its files, logic, API, UI, AI use, tests, and "done when". Priorities and sizes follow the feature plan.

### A. Integrations

#### A1. Connections hub (P0, M)

- **Files:** `integrations/index.js`, `integrations/demo.js`, `routes/wellbeing.js`, `frontend/src/pages/Connections.tsx`, `components/wellbeing/AppTile.tsx`.
- **Interface:**

  ```js
  module.exports = {
    id: 'habitify',
    kind: 'habit',
    mode: 'live',
    dataTypes: ['habit_done'],
    canWrite: true,
    async connect(ctx, creds) {},           // → Connection
    async sync(ctx, conn, { from, to }) {}, // → Signal[]
    async write(ctx, conn, action) {},      // action = { type: 'add_log' | 'upsert_habit' | 'create_task', … }
    async disconnect(ctx, conn) {},
  };
  ```

  `ctx = { donorId, user, token? }`. Tokens arrive per request and are never written anywhere.
- **Logic:** `signals.ingest()` drops any data type that isn't in `consentedTypes`. Disconnecting deletes that connection's signals.
- **UI:**
  - `#apps`, reached from the Home tile, My health's Habits and the account menu.
  - Groups: Habit apps / Watch & phone health / Home devices.
  - Each tile shows: name, `demo` or `live` badge, a switch per data type, Write back to this app, Last synced, Sync now, Disconnect & delete.
  - Demo tiles connect in one tap and say "Demo data, no real account".
- **Tests:**
  - consent filter;
  - disconnect deletes;
  - tokens never appear in any response or log (grep the trace).
- **Done when:** a persona can connect Fitbit (demo) and see 12 months of signals, all filtered by consent.

#### A2. Wearables (P0, M)

- **Demo connector:** storylines from 5.2.
- **Junction sandbox (live, synthetic):** `junction.js`.
  - Connect creates a Junction user and a demo connection (Fitbit or Oura), then pulls daily summaries (activity, sleep) into signals.
  - Shown on the tile as "Live sandbox · Junction".
  - Server-side key `JUNCTION_API_KEY` in App Service settings, never sent to the browser.
- **Google Health API (live, P1):**
  - The page gets a Google OAuth token; the server reads `steps`, `sleep`, `daily-resting-heart-rate`, `hydration-log` and `nutrition-log` (v4).
  - Testing mode with named test users.
  - No BP type exists, so BP stays manual or comes from a device.
- **Apple Health export (P1):** a client-side streaming XML parse (`sax`-style) of only the consented record types. It is aggregated per day in the browser and only daily totals are uploaded.
- **Done when:** Fitbit (demo), Oura (demo) and Junction sandbox all fill signals, and the Weekly report shows "(from Fitbit, demo)".

#### A3. Habit apps (P0, M)

- **Habitify (live):**
  - The page asks for the API key and keeps it in `sessionStorage`.
  - The backend proxies `GET /v2/habits`, `GET /v2/habits/{id}/logs` and adds logs.
  - Writing a habit is only offered if the API supports it on the key's plan. If it doesn't, Pratidaan adds logs and tells the donor which habit to create.
- **Microsoft To Do (live):**
  - A separate MSAL consent with `TODO_SCOPES = 'Tasks.ReadWrite'`. `CALENDAR_SCOPES` is untouched.
  - Read: completed tasks in a "Pratidaan" list.
  - Write: create a recurring task for a Week plan item (`recurrence.pattern`).
- **Demo habit apps:** Habitify (demo) and To Do (demo) through the Demo connector, for personas.
- **Habit mapping:**
  - The AI suggests a mapping (8.1, `suggest_habit_mapping`) from the habit title to `{habit, signal}`.
  - The UI shows "Evening walk → Movement · confirm / change".
  - Nothing is used until it is confirmed.
- **Streaks:** where the app's API returns a streak, the tile shows it. Otherwise Pratidaan shows "kept 4 of 7 days", in words, consistent with CONTEXT.md.
- **Done when:** a live Habitify key lists habits and accepting an adjustment adds a log, and a live To Do consent creates a recurring task.

#### A4. Food, water and home devices (P1, S)

- `iron_mg`, `sodium_mg` and `water_ml` come from Google Health `nutrition-log` / `hydration-log`, or from Cronometer (demo).
- BP and weight come from Withings (demo).
- BP from a device goes into `st.readings` **only** through the existing `logReading()` path, so the Goal and Check-in logic sees it exactly as if the donor had typed it.

#### A5. Signal store (P0, S)

- **API:**
  - `ingest(ctx, connection, signals[])`
  - `daily(ctx, signal, from, to)`
  - `rollup(ctx, signal, 'week' | 'cycle')`
  - `deleteFor(ctx, connectionId | 'all')`
- **Which source wins** for the same signal and day: `you` > `medical_device` > `device` > `app`.
- **Retention:** raw values older than 90 days are reduced to weekly totals. The Demo connector regenerates history, so personas are unaffected.

#### A6. FHIR export (P2; the button now)

- `GET /api/donors/:id/donations/:visitId/fhir` returns a FHIR R4 Bundle: one DiagnosticReport plus Observations, using the LOINC codes in [labReader.js](../../backend/src/ai/labReader.js) `MARKERS`.
- Shown as a **Download as FHIR** link on each donation's results (new link only).

### B. Every donation is a free health check

#### B1. Cycle model (P0, S)

- **Logic (`cycle.js`):**
  - `current(donorId)` → `{ number, startedOn (last completed donation), nextFrom (health.eligibility().nextEligibleDate), day, length, phase }`.
  - Phases: `recover` (days 0–3), `build`, `prep` (the last 14 days), `due` (eligible now).
  - A donor who isn't donating gets a 120-day Cycle, as CONTEXT.md defines.
- **UI:** `BetweenDonationsTile` on Home:
  - "Cycle 2 · Build · day 41 of 90";
  - "Next free health check ~2 Jan";
  - "Focus: iron · On track";
  - "2 apps connected · Connect";
  - when nothing is connected or planned: "See how your habits show up in your next results → Connect an app".

#### B2. Bands and age-group comparison (P0, M)

- **Logic (`bands.js`):**
  - `bandOf(marker, value, donor)` from `bands.json`.
  - `percentile(marker, donorId)`:
    - the comparison group is donors of the same sex and age band (18–29, 30–39, 40–49, 50–65), using each donor's latest value;
    - if fewer than 20 donors qualify, widen to sex only, then to all donors;
    - direction per marker (lower is better for BP, HbA1c, LDL and TG; higher is better for HDL, and for Hb and ferritin up to a cap).
  - Results are computed once at start-up and on Reset; 300 donors is trivial.
- **Showing it gently:**
  - "Better than X% of [group]" appears only when X ≥ 50.
  - Otherwise the screen shows the band and "Room to grow", and never the donor's rank at the bottom.
- **UI (`Progress.tsx`):** a row per marker:

  ```
  BandBar (3 or 2 segments, donor dot, last Cycle's dot hollow) · value · arrow vs last Cycle · percentile line
  ```

- **Tests:**
  - band boundaries;
  - the group widens below 20 donors;
  - no percentile below 50 is shown;
  - other donors' values never leave the server.

#### B3. What moves this marker (P0, M)

- **Logic (`links.js`):**
  - For each marker, take its linked signals.
  - For the Cycles where the donor has both signals and results, compute the average signal per Cycle.
  - For home BP, also compare weeks above and below the donor's own median of the signal.
  - Show a sentence only when there are ≥ 3 Cycles or ≥ 6 weeks of both.
  - The wording template always says "alongside" or "in weeks when", never "because" or "caused".
- **UI:** a drawer opens when a marker row is tapped:
  - a Recharts chart: results at each donation (dots on the existing colours), with the linked signal as bars underneath per Cycle;
  - the sentence;
  - "Why this?".

  It reuses the axis and band logic from Health.tsx `Trends`, extracted into `components/wellbeing/charts.ts`. The Trends component itself is untouched.

#### B4. Cycle focus for every donor (P0, S)

- **Logic:**
  1. If the donor has active Goals, the focus = the first active Goal's markers. The Goal itself is unchanged.
  2. Otherwise, the marker furthest from Optimal (a level-up focus).
  3. Leading targets come from `marker-signals.json` (e.g. iron → `food_habit_done` 5/wk, `iron_mg` ≥ target).
- **Push to apps:** "Add to Habitify" or "Add to To Do" creates the habit or task (A3) when write-back is on, and stores `sync.externalId` on the Week plan item.

#### B5. On-track status and prep (P1, S)

- **On track:** the share of leading targets met over the last 3 weeks, at least 70%. **Drifting:** below 50%. **No data:** fewer than 7 days of signals.
- **Prep Card** (`coaching` type `prep`): 14 days before `nextFrom`, inside the coaching allowance. It offers the **existing** donation slots Card through `drop.offerCard`. The slots Card itself is unchanged.

#### B6. Cycle report (P0, M)

- **Trigger:** when a new donation's results become visible (the existing `availableOn` mechanism, or Simulate check-in), `cycle.report(donorId, visitId)` is built and kept in `st.wb.reports`.
- **Slides:** plain strings plus an optional final postcard, the same contract as existing Stories, so [StoryViewer.tsx](../../frontend/src/components/drop/StoryViewer.tsx) plays it without changes:
  1. "Your free health check from 3 Jan."
  2. One slide per focus marker: "Haemoglobin 12.7 → 13.4 g/dL. Now comfortable for donating."
  3. "Better than 64% of women donors 30–39 (was 41%)." Shown only if ≥ 50%.
  4. "Alongside: iron add-on on 5 days a week, 22 walks, sleep 7.1 h." (from signals)
  5. "Your donation on 3 Jan will help up to 3 patients." (existing impact facts)
  6. "Next Cycle's focus: … · Book your next free health check."
- **Postcard (P1):** a new template in `shareImage.ts` (new function, existing ones untouched) with no health values: "3 healthy cycles · 9 patients helped".
- **AI:** optional narrative polish through the existing `dropWriter.js` pattern. It is accepted only if every number in the AI's text appears in the rule text. Otherwise the rule text is used.
- **UI:**
  - The "Watch my Cycle report" chip on Home, next to the existing Story chips.
  - Past reports under the existing **Past Cycles** chip in the side sheet.

#### B7. A deferral as a health signal (P1, S)

On the Between donations tile and Progress only: "This Cycle's focus is iron. Your next donation's results will show if it worked." No existing text changes.

### C. Food coaching

#### C1. Food profile (P0, S)

- **Storage:** `st.wb.foodProfile`, set only by the donor's taps (or by the seed for Meera and Asha). Never inferred from name, district or memory.
- **Meera's seeded profile** comes from facts already in her seed (memory "Vegetarian", "Prefers Tamil at home"), so nothing contradicts the existing persona.
- **UI:** `FoodProfileSheet.tsx` has five chip rows (diet, allergies, fasting, budget, eats at), plus region (pre-selected from the district, can be changed), staple, and dislikes. It opens:
  - the first time the Food Chat is opened (a Drop message with "Tell me how you eat · Later");
  - from Progress → "Eat for your …" panel → Set up;
  - from Your data → Food profile → Edit.
- **Default when there's no profile:** suggest only vegetarian foods, and say so.

#### C2. Food library (P0, M–L)

- **Process:**
  1. Pick the 30 iron-relevant foods first, then BP, sugar and lipid foods.
  2. For each food, enter IFCT 2017 values per 100 g with the IFCT code and page.
  3. Set a typical serving (grams + a household measure: katori, roti, handful).
  4. Tag diet, Jain, fasting, regions, seasons and allergens.
  5. Set a price band (₹ per serving), from DoCA retail price reports for staples covered there (dals, ragi, bajra, jowar, eggs, banana, besan, milk), Agmarknet mandi prices for vegetables (× 1.5 retail factor, labelled), otherwise curated. Record `asOf` and `source`.
  6. Add local names in 6 languages, checked by a native speaker on the team.
- **Checks (`test/nutrition-data.test.js`):**
  - every food has an IFCT code;
  - values are in plausible ranges;
  - every food has names in all six languages;
  - every food has a price source;
  - no food tagged `jain` contains root vegetables or onion or garlic (an exclusion list).
- **AI help:** the AI may draft local names and fitting-in tips. **Nutrient values and prices are entered by hand** from the sources.

#### C3. Care-level rules (P0, M, safety-critical)

- **Logic (`careLevel.js`):** reads `health.findings()`, the latest values (including uploaded reports) and `hbMin()`. Thresholds come from `care-levels.json` (the C3 table in the feature plan, **pending clinical sign-off**). The order of evaluation decides the level:
  1. urgent;
  2. doctor first (Hb < 10, low MCV with ferritin ≥ 30, or a red flag reported in the last 14 days);
  3. below;
  4. low-normal;
  5. optimal / not needed (high ferritin).
- **Red flags:** from the existing pre-model guardrail (extended in 4.3), recorded as `st.wb.redFlags` with a date.
- **Doctor text:** fixed strings per urgency, in all six languages (written by rules; the AI can't change them).
- **Independent of Goals:** `careLevel` never changes a Goal, a finding's severity or eligibility. Below donation level matches the existing `HB_LOW` / `IRON_LOW` Goal, which already contains "see a doctor to find the cause".
- **Doctor-first Card:** a new Card type `food:doctorfirst`, sent with the results, outside the budget like urgent Cards. It offers the **existing** check-up slots Card. No existing persona reaches this level.
- **Tests (`test/careLevel.test.js`):**
  - every boundary (Hb = minimum − 0.1 / minimum / minimum + 0.9 / minimum + 1.0; ferritin 14/15/29/30);
  - the thalassaemia pattern;
  - red flags;
  - every persona's level is as expected: Arjun none, Meera below, Asha low-normal, Vikram unaffected.

#### C4. Food recommendation engine (P0, M)

- **Pipeline (`foodCoach.suggest(donorId, marker)`):**
  1. **Care level:** if `coaching ∈ {rules_only, none}`, return no foods, or the "alongside treatment" template only for doctor first.
  2. **Target:** requirement by sex, from `requirements.json`.
  3. **Filter:** profile diet, allergies, Jain, fasting today (demo clock date vs the profile's fasting days), region (allowing `all`), season (from the month), dislikes.
  4. **Safety filter across findings:** read `health.findings()` and drop foods flagged:
     - `highSugar` if there is a prediabetes or diabetes finding;
     - `highSodium` if there is a BP finding;
     - `highPotassium` if creatinine is above range;
     - iron-rich foods if ferritin is high.
  5. **Score:**
     - `nutrientPerRupee` × 0.4
     - `nutrientPerServing` × 0.3
     - `fitsStaple` × 0.15
     - `notRecent` × 0.15 (variety over 14 days)

     Then keep the top 5, with at most 2 from the same food group.
  6. **Fit-in text:** a template per region and staple ("in your sambar", "with your roti").
  7. **Pairing:** from `absorption.json`.
  8. **Explanation:** from `explain.js`.
- **Output** as in 5.1. Every number comes from the data files.
- **Tests:**
  - a vegetarian never gets meat, fish or egg;
  - a Jain donor never gets onion, garlic or root vegetables;
  - a prediabetic donor never gets jaggery or dates;
  - the tight budget filter is respected;
  - the same input always gives the same output.

#### C5. Drop's food coaching (P0, M)

- **Tools** (`wellbeingTools.js`, Food Chat and Goal Chats for iron, BP or sugar Goals only):
  - `get_food_profile`
  - `get_care_level`
  - `find_foods(marker, meal?, maxCost?)`
  - `log_food_habit`
  - `open_food_profile`
- **Prompt rules (new context block):**
  - Mention only foods from `find_foods`.
  - Give no numbers unless a tool returned them.
  - Never name a medicine or supplement.
  - Never say food replaces treatment.
  - Use the donor's language and local food names.
  - Keep to two sentences plus at most one Card, as today.
- **After the model:** `foodGuard.check(reply, toolOutputs)`:
  - Food mentions are checked against a gazetteer of food names in 6 languages. Any food not in the tool output fails.
  - Any medicine or supplement name fails (a list: ferrous, iron tablet, B12 injection, vitamin D sachet…).
  - Any number not in the tool output fails.
  - On failure, a rule-template reply built from `find_foods` is used.
- **Doctor advice:** added **after** the reply by `copilot.js` from `careLevel.doctor.text`. The model never writes it and can't leave it out.
- **Doctor first / Urgent:** the agent isn't called for food. A rule reply plus the existing check-up slots Card is returned.
- **Fallback intents** (added after existing ones): "what should I eat", "iron food", "cheap", "breakfast/lunch/dinner", "fasting". They are answered from `foodCoach.suggest` templates and marked "AI offline: answered by rules", like the existing ones.

#### C6. Making it part of the diet (P0, S)

- **Food habit of the week:** a Week plan item `{habit: 'food', kind: 'session', perWeek: 5, measuredBy: 'food_habit_done'}`. It is created from the food panel's **Add to my week** (which offers a Week plan Card) and optionally pushed to Habitify or To Do. It rotates on the Sunday Weekly report's Plan next week.
- **Shopping list (P1):** `msTodo.write({type: 'create_list', items})` or WhatsApp share text (existing share pattern).
- **Card for whoever cooks (P1):** a new share-image template with no health values.
- **Cycle report:** the food habit's kept rate appears on the "Alongside" slide.

#### C7. Other markers (P0 for the donation panel, P1 for outside reports)

- `care-levels.json` has entries for `iron`, `b12`, `vitd`, `folate`, `sugar`, `bp` and `lipids`.
- B12 and vitamin D come only from uploaded reports. The existing lab reader already maps `b12` and `vitd`.
- Each entry has its thresholds (pending sign-off), its doctor urgency and its nutrient target.
- **Vegans with low B12:** always at least `food_and_doctor`.
- **UI:** an "Eat for your …" panel in each marker drawer on Progress, and a collapsed **Foods that fit you** row under each Goal card on My health (the panel opens inline).

### D. Comeback coach

#### D1. Disruption detection (P0, M)

- **Runs:** `routine.detect(st)` once per demo day (the first `onStep` of a new date), only when the donor has a Week plan or a connection.
- **Rules** (ids are cited in "Why this?"):

  | Id | Rule |
  |---|---|
  | R1 | Week plan item kept on < 50% of its planned days in the last 7, after ≥ 70% in the 3 weeks before |
  | R2 | 7-day average steps or active minutes < 70% of the 28-day average |
  | R3 | Sleep < 6 h on 3 of the last 5 nights |
  | R4 | Food habit kept on < 3 of the last 7 days, after ≥ 5 in the weeks before |
  | R5 | No device data for 3 days (offers "Sync now", not coaching) |

- **Patterns:**
  - **P1:** ≥ 3 of the last 4 misses fall on the same weekdays.
  - **P2:** misses cluster in the evening (from Your day or habit-app timestamps).
  - **P3:** calendar busy. Only with a live Calendar consent in the session; demo personas use a storyline flag.
- **Barriers:**
  - `st.wb.barriers[]`, from the optional chips on a Skipped answer (Your day, a Reminder or a Week plan item), or from the habit app's skip note if allowed.
  - Codes: `busy`, `travel`, `unwell`, `weather`, `festival`, `low_energy`, `caring`, `other`.

#### D2. Adjustments (P0, M)

- **Selection (`adjustments.choose(st, disruption)`):**
  1. Take the library entries matching the rule and the habit.
  2. Remove `forbiddenWhen`:
     - `urgent_goal` (any urgent Goal);
     - `unwell` (no increase in Movement);
     - care level `doctor_first` (no food plan).
  3. Score:
     - barrier match +3
     - rule match +2
     - accepted before +1
     - declined before −2

     Keep the top one; **Another idea** gives the next.
- **Never zero:** every Shrink entry has a minimum (5 minutes, 1 glass, 1 add-on a week).
- **Accept:**
  - The Week plan item gets `stepDown = {from, to, until: +7 days}`.
  - If write-back is on, the habit app is updated (A3).
  - The answer goes through Drop's existing Undo.
- **Step-up:** if the stepped-down item is kept on ≥ 5 of 7 days, a step-up Card (+10–20%, back to the original at most) is offered, inside the coaching allowance. It is only applied with a tap.
- **Simplify my plan (CONTEXT.md):**
  - Keeps the Week plan item that matters most: the one serving the first active Goal, or else the one with the highest kept rate.
  - Applies its Shrink entry and sets the rest aside (`setAside: true`), with **Bring back** on each.
  - Never touches Goals, Reminders or Your day.

#### D3. "Why this?" (P0, S)

- **`explain.js`:** each rule output (careLevel, foodCoach, routine + adjustments, B3 link, B5 status) builds an `Explanation` (5.1). The AI never writes one.
- **UI:** `WhyThis.tsx`, a bottom sheet on mobile and a side panel on desktop, using the existing sheet styles. It has five sections with icons: Data used · Rule · Guidance · Your preferences · What would change it. "Not used" is shown in grey at the bottom.

### E. Privacy (P0, M)

Implementation details are in [section 11](#11-privacy-and-security). On screen:

- Connected apps has consent and write-back switches per app.
- Your data gets four new cards after the existing ones:
  - Connected apps
  - Signals
  - Food profile
  - Sent to our data partner (Junction, sandbox)

  Each has Delete with the existing 6-second Undo pattern.
- **Download my data:** JSON of everything kept, plus a FHIR bundle of lab results.

## 7. Drop engine integration

### 7.1 New Card kinds

All of them are handled in `coaching.js` and passed through the 4.3 hooks. Existing Card kinds are untouched.

| `type:variant` | Label | Sent when | Counts against | Answers |
|---|---|---|---|---|
| `weekplan:offer` | Week plan | The donor asks in a Habit, Goal or Food Chat, or taps Plan this week or Add to my week | Outside the budget (a Card the donor asked for, existing rule) | **Save** (+ "Add to Habitify/To Do" if write-back is on) · **Change** · **Not now** |
| `day:due` | Your day | Daily at the donor's chosen time, if opted in | Outside the budget (CONTEXT.md) | Three one-tap questions (walk / glad about / mind), plus one row per Week plan item not measured by an app. Skipped shows the optional barrier chips. |
| `comeback:offer` | A lighter week | A disruption (D1) | **Coaching allowance** (7.2) | **Try this** · **Another idea** · **Pause a week** · **Not now** · Why this? |
| `comeback:stepup` | Step back up | A stepped-down item kept ≥ 5 of 7 | Coaching allowance | **Yes, step up** · **Keep it as is** |
| `food:lownormal` | Food for your iron | Results at the Low-normal level (Asha) | Coaching allowance | **See foods** (opens the panel) · **Book a check-up** (existing slots Card) · **Later** |
| `food:doctorfirst` | See a doctor first | Results at the Doctor-first level | Outside the budget (like urgent) | Existing check-up slots · **I will seek real care** (existing wording pattern) |
| `prep:checkup` | Before your next donation | 14 days before `nextFrom` | Coaching allowance | **See prep** · **Book a slot** (existing donation slots Card) |

The Weekly report gets new slides **only added after** the existing ones, when the donor has a Week plan or a connection:
- "This week: Movement kept 3 of 3, Food 4 of 5."
- "What changed and why: walk 30 → 10 min after a busy week."
- "Plan next week" (a chip that opens `weekplan:offer`).

### 7.2 The coaching allowance

```
coaching.deliver(st):                          // runs after the existing deliver() logic
  if part !== EVENING or quiet hours            → return
  if st.sentByDay[today] > 0                    → return   // an existing Card went today: stay silent
  if any existing event is pending and due      → return   // existing Cards always go first
  if st.wb.coachSentByWeek[weekStart] >= 1      → return   // at most 1 coaching Card a week
  if any open urgent Card or urgent Goal        → return
  pick the highest-priority coaching candidate (food:lownormal > comeback:offer > comeback:stepup > prep:checkup)
  pushCard(...); st.wb.coachSentByWeek[weekStart] += 1   // never touches sentByDay / sentByWeek
```

What this guarantees:
- existing Cards are never delayed or replaced;
- Drop still sends at most one unprompted Card a day in practice, because a coaching Card only goes on a day with no existing Card and only in the evening;
- quiet hours are respected.

Snoozing, folding after 7 days, and "Still waiting" in the report reuse the existing mechanisms, which work on any Card.

### 7.3 Demo controls

- **Next event:** ignores `coaching.TYPES` and `day:due`. The existing 20 scripts keep their stop points.
- **Simulate a rough week:** overlays the storyline (5.2), then steps the clock 7 days. That lands the comeback Card in the evening of the day the rule first fires.
- **What Drop knows:** new log lines (e.g. "Coaching: R2 steps 52% of usual since Tue (busy ×3). Sent 'A lighter week'.") are added through the existing `log()`.

## 8. AI layer

### 8.1 Tools (`ai/wellbeingTools.js`)

| Tool | Chats | Returns |
|---|---|---|
| `get_cycle` | General, Habit, Goal | Cycle number, phase, days, focus, on-track status |
| `get_signal_summary(signal, period)` | Movement, Food, Mind, Goal | Aggregates only ("avg 6,420 steps, 4 of 7 days ≥ 7,000"), never raw rows |
| `get_bands(marker?)` | General, Goal | Band and percentile line (if shown) |
| `explain_recommendation(id)` | All | The rules' Explanation |
| `propose_adjustment(habit)` | Habit, Goal | Up to 2 candidates from `adjustments.choose`; the model picks one, and only those ids are accepted |
| `offer_week_plan(habit, itemIds)` | Habit, Goal, Food | Opens a `weekplan:offer` Card from rule-made items |
| `get_food_profile`, `open_food_profile` | Food, iron/BP/sugar Goals | Profile; opens the sheet |
| `get_care_level(marker)` | Food, Goal | Level and doctor text (for the model's awareness; the text is still added by rules) |
| `find_foods(marker, meal?, maxCost?)` | Food, iron/BP/sugar Goals | The engine's output |
| `log_food_habit`, `log_day` | Food, Habit | Saves through the same path as a Card answer (Undo works) |
| `suggest_habit_mapping(title)` | Connected apps (not chat) | `{habit, signal, confidence}`; the donor confirms |

- **Which Chats get which tools:** `namesFor(chatId)` decides. General Chat gets only `get_cycle` and `get_bands`, which keeps existing General answers stable. Food and Habit Chats get the rest.
- **Language:** tools return local food names for the donor's current language.

### 8.2 Prompt additions

Added as a separate context block, without editing the existing `SYSTEM` text:

- the donor's Cycle line;
- the Week plan;
- the care level per marker (level only);
- the Food profile (diet and budget labels);
- the food rules from C5.

### 8.3 Validation

| Check | Where | On failure |
|---|---|---|
| Existing number and claim guardrails | Unchanged | Unchanged |
| `foodGuard`: foods, medicines, numbers | After the model, Food and Goal Chats | Rule template from `find_foods` |
| Adjustment id must be one of the candidates | `propose_adjustment` handler | Use candidate #1 |
| Cycle report narrative numbers ⊆ rule text numbers | `cycle.report` | Use the rule text |
| Doctor advice added after the reply | `copilot.js` | Always added; can't be skipped |

### 8.4 Cost and console

- New AI calls happen only on chat turns, habit mapping and the optional Cycle report polish. There are no background AI calls.
- The [AI console](../../frontend/src/pages/AIConsole.tsx) lists new feature names: `food_chat`, `habit_mapping`, `cycle_report`. The existing daily budget and rate limits apply unchanged.

## 9. Frontend

### 9.1 New screens and components

| Path | What |
|---|---|
| `pages/Progress.tsx` + `progress.css` | Top to bottom:<br>• Cycle header<br>• focus card (targets, On track, Add to app)<br>• one band row per marker<br>• marker drawer (chart, alongside sentence, "Eat for your …" panel, doctor banner, Why this?)<br>• earlier Cycles (their Cycle reports) |
| `pages/Connections.tsx` | `#apps`: groups, app tiles, connect flows (Demo one-tap, Habitify key dialog, To Do consent, Junction sandbox, Apple export P1) |
| `components/wellbeing/BetweenDonationsTile.tsx` | Home tile |
| `components/wellbeing/BandBar.tsx` | 2- or 3-segment band with the donor's dot and last Cycle's hollow dot |
| `components/wellbeing/FoodPanel.tsx`, `FoodTile.tsx`, `FoodProfileSheet.tsx` | Food coaching UI |
| `components/wellbeing/DoctorBanner.tsx` | Grey / amber / red by urgency; fixed text from the API |
| `components/wellbeing/WhyThis.tsx` | Explanation sheet |
| `components/wellbeing/WeekPlanRows.tsx` | Used inside the existing `HabitShelf` and `ThisWeek` when a plan exists |
| `components/wellbeing/charts.ts` | Shared axis and band helpers (copied from Trends, not moved) |
| `components/drop/cards/*.tsx` | Renderers for the 7.1 Card kinds, registered in DropCardView's lookup |

### 9.2 Design rules

- Use the existing `ui.tsx` primitives, `styles.css` tokens, pill classes (`pill-brand`, `pill-good`, `pill-ai`) and icon set. Nothing new should look like a different app.
- Source tags follow the existing "hollow points = your readings" convention: ⌚ device, ✓ app, ✎ you.
- Every new surface works at 360 px width, has keyboard focus order and `aria` labels like the existing sheets, and handles empty, loading and error states.
- All new strings go through the same language mechanism Drop uses. Doctor texts and food names have all six languages in data. Other UI strings are English first, with Hindi for Asha's demo path.
- Honest labels: every demo source says "demo"; every price says "approximate"; every band and percentile says "from donation results".

## 10. API reference

All new routes are under the existing auth middleware and donor scoping, and all return `{ success, data }`.

| Method & path | Purpose |
|---|---|
| `GET /api/donors/:id/wellbeing` | One call for Home and Progress: cycle, focus, bands, connections summary, week plan, care levels |
| `GET /api/donors/:id/wellbeing/marker/:marker` | Drawer: series, linked signals per Cycle, sentence, food suggestion, explanation |
| `GET /api/donors/:id/connections` · `POST …/connections` · `DELETE …/connections/:cid` | List, connect (`{provider, consentedTypes, writeBack}`; live tokens in the `X-Connector-Token` header), disconnect & delete |
| `POST /api/donors/:id/connections/:cid/sync` | Sync now |
| `PATCH /api/donors/:id/connections/:cid` | Consent, write-back, habit mapping confirmation |
| `GET/PUT/DELETE /api/donors/:id/food-profile` | Food profile |
| `GET /api/donors/:id/foods?marker=&meal=&maxCost=` | Engine output |
| `POST /api/drop/weekplan` · `POST /api/drop/weekplan/simplify` · `POST /api/drop/weekplan/items/:itemId/bring-back` | Through Drop (Undo applies) |
| `POST /api/drop/day/optin` `{time}` · `DELETE /api/drop/day/optin` | Your day |
| `GET /api/donors/:id/cycle-reports` · `GET …/cycle-reports/:visitId` | Story slides |
| `GET /api/donors/:id/explain/:recId` | Explanation |
| `GET /api/donors/:id/export` · `GET /api/donors/:id/donations/:visitId/fhir` | Download my data, FHIR |
| `POST /api/demo/rough-week` `{donorId}` | Demo only (behind the existing `DEMO_MODE`) |

Card answers for the new kinds use the **existing** `POST /api/drop/cards/:cardId/answer`.

## 11. Privacy and security

| Concern | Implementation |
|---|---|
| Consent per data type | Enforced in `signals.ingest()`, the only write path. Unconsented types are dropped before storage, and a test proves it. |
| Tokens and keys | Live tokens (Habitify, Graph To Do, Google) stay in the page and arrive per request in `X-Connector-Token`. They are never logged (the access log redacts the header) and never stored. The Junction key is server-only in App Service settings. |
| Shared demo personas | Live data never enters persona state (4.5); it is kept per account and persona and cleared on sign-out or after 24 h. |
| AI payload minimisation | Tools return aggregates only. The Food profile goes to the model as labels (diet, budget), never free text. The **Send summaries to the AI** switch (default on in the demo, off for live connections until turned on) removes the wellbeing context and tools entirely. |
| Sensitive inference | Diet is never inferred from name, district or memory. Seeds set profiles explicitly, without stereotypes. |
| Isolation from money and eligibility | `cover.js`, `health.js` score/eligibility and `badges.js` are not imported by any new module that writes. A test asserts that score, eligibility and cover are identical with and without signals. |
| Circles | No new data reaches `community.js`. |
| Retention | Raw signals are kept 90 days, then weekly totals. Live data 24 h in the prototype. |
| Deletion | Every new item has Delete in Your data with the existing Undo pattern. **Delete my account** also clears live connection data for that account. |
| OAuth | Google and Graph consents use the existing MSAL / PKCE pattern with a state check. Redirect URIs are registered for the Azure host and localhost only. |
| Data partner disclosure | Your data → "Sent to our data partner": Junction (sandbox, synthetic) and where it is hosted (US or EU). Production note: Open Wearables on Azure Central India (the DPDP Act). |
| Medical safety | Care-level rules are deterministic and tested. Doctor text is fixed and added after the model. No medicines are named. Red flags take the existing urgent path. |

## 12. Testing and regression

### 12.1 Existing tests

Run `cd backend && npm test` (167+ tests) and `cd frontend && npm run type-check` on every change. Existing test files are not edited (C8).

### 12.2 Golden baseline (Day 0, before any feature code)

- **New script `backend/test/golden/capture.js`:** for each of the 7 existing personas:
  1. Reset.
  2. Step the clock through a fixed script (`+few hours` ×3, `+1 day` ×10, `+1 week` ×6, plus every Next event stop for that persona).
  3. At each stop, record:
     - `drop.view(donorId)`
     - `/overview`
     - `/health`
     - `/impact`
     - `/cover`
     - `screenLines.line()` for each screen
     - `intro.status()`
     - any open report's slides
  4. **Normalise** volatile ids (`BOOT`-based Card and memory ids → sequence numbers) and timestamps.
- Captured on current `main` into `backend/test/golden/baseline/*.json` and committed.
- **New test `golden.test.js`:**
  - the new build, with no taps on new features, must give every field in the baseline exactly as recorded;
  - new fields are allowed only under new keys;
  - the persona list must keep the seven existing personas in the same order, with Asha added at the end.
- This is the main proof of the additive contract.

### 12.3 New unit tests (new files only)

| File | Covers |
|---|---|
| `signals.test.js` | Consent filter, which source wins, rollups, retention, delete |
| `integrations.test.js` | Demo storylines are deterministic; Arjun's `active_min` = `activityMinutes()`; connector contract; tokens never in output |
| `cycle.test.js` | Phases, 120-day non-donor Cycle, focus selection, Cycle report slide rules (percentile ≥ 50 only) |
| `bands.test.js` | Bands, group size ≥ 20 and widening, direction per marker, no other donors' values in output |
| `links.test.js` | Minimum data rule; wording never "because" |
| `careLevel.test.js` | Every boundary, thalassaemia pattern, red flags, each persona's expected level |
| `foodCoach.test.js` | Diet, Jain, allergy, fasting, budget filters; safety filter across findings; determinism; variety |
| `nutrition-data.test.js` | Data quality of `foods.json` (C2) |
| `weekplan.test.js` | ≤ 2 items per Habit, ends Sunday, Simplify rules, Bring back, Undo |
| `routine.test.js` | R1–R5, P1–P3, barrier only from a Skipped answer |
| `adjustments.test.js` | Forbidden-when, never zero, selection scores, step-up only with a tap |
| `coaching.test.js` | Allowance (7.2): never on a day an existing Card went; never delays an existing event; Next event ignores new types; quiet hours |
| `foodGuard.test.js` | Rejects foods not in the tool output, medicine names and numbers no tool returned; doctor advice always added; AI not called at Doctor first |
| `isolation.test.js` | Score, eligibility, cover and Badges are identical with and without signals or Food profile |
| `wellbeing-routes.test.js` | Every new route returns an empty, valid result for a donor who hasn't used the feature; scoping; auth |

### 12.4 Manual regression and new scripts

- Run all **20 existing scripts** in [docs/drop/](../drop/README.md) on the new build. Every expected result must hold. Record the results with the guide's "Copy my results".
- **Screenshot comparison:** Home, My health and the side sheet for each existing persona at demo start, new build vs `v1-baseline`, taken on Day 0. Differences are allowed only in new slots: the new tile, the link line, the Progress nav item.
- **New scripts 21–32** are added to the same guide (14.4).
- **AI parity:** run the reviewer guide's sample questions on General Chat before and after, and check that the same tools are called and the same Card types are offered.

### 12.5 Definition of done (every component)

1. Golden test passes.
2. New unit tests pass.
3. Works with AI off (rule fallback, labelled).
4. Works at 360 px.
5. "What Drop knows" logs its decisions.
6. Has a Your data entry if it stores anything.
7. Its "Why this?" exists if it recommends anything.
8. Docs updated (14.5).

## 13. Build schedule

Three streams in parallel, plus a showcase owner from Day 1 PM.

### Day 0: Tue 18 Nov, rest of today

| Task | Owner |
|---|---|
| Tag `v1-baseline` on `main` and push it; create the `feature/wellbeing` branches (4.4); capture the **golden baseline** (12.2); add the empty hooks (4.3) with the golden test green | Lead |
| Sign up for Junction (sandbox key) and Habitify (a team member's API key); register a Google OAuth test client (P1) | Connect stream |
| Start `foods.json`: the 30 iron foods from IFCT with codes and pages; `requirements.json`; `regions.json` | Food stream |
| Send the care-level and band thresholds (C3, `bands.json`) for clinical review | Food stream + lead |
| Write `wellbeing-seed.json` storylines (5.2); check Asha (`D-175`) findings and score with `health.findings()` | Cycle stream |

### Day 1: Wed 19 Nov

| Slot | Stream 1: Connect + Coach | Stream 2: Cycle + Progress | Stream 3: Food |
|---|---|---|---|
| AM | A1 hub, A5 signals, Demo connector, Connections screen | B1 cycle, B2 bands, Between donations tile | C3 careLevel (iron), C1 Food profile + sheet |
| PM | A3 Habitify + To Do live, A2 Junction; Week plans (`weekplan:offer`, Habits and This week filled) | Progress screen, B3 marker drawer, B4 focus + push to app | C4 engine, C2 library to 30 iron foods + BP/sugar basics |
| Evening | **Integration checkpoint:** golden test green, the 20 scripts spot-checked, deploy to Azure staging (the existing GitHub Actions workflow) | | |

### Day 2: Thu 20 Nov (submission day)

| Slot | Stream 1 | Stream 2 | Stream 3 |
|---|---|---|---|
| Early AM | D1 routine, D2 adjustments, `comeback:*` Cards, coaching allowance, Simplify my plan, Simulate a rough week | B6 Cycle report + chip + Past Cycles, D3 WhyThis | C5 tools + foodGuard + doctor advice added after the reply, C6 Add to my week, `food:*` Cards |
| Late AM | E1 Your data entries, export | Asha persona wired; Simulate a rough week in the demo bar | C7 rows (BP, sugar, lipids; B12/D from reports) |
| **Code freeze (midday)** | Full regression (12.4), fixes only, deploy to production | | |
| Afternoon | Showcase owner: record the video (14.3), update the guides and docs (14.5), deck slides, submit **well before the deadline** | | |

**Cut lines.** If behind at the Day 1 evening checkpoint, drop in this order (last dropped first):

1. P1 items (Apple export, Google Health, Todoist, shopping list, cook's card, postcard)
2. B5 prep
3. C7 rows beyond iron and BP
4. Live To Do (keep the demo)
5. Live Habitify (keep the demo)

**Never cut:** the `v1-baseline` tag, the golden test, care-level rules plus doctor advice, and "Why this?".

## 14. Demo and showcase

### 14.1 Principles

1. **The original story first, then the evolution.** Every existing walkthrough still runs exactly as before. New beats are added after the existing beats in each walkthrough, as optional steps.
2. **Asha shows the whole new loop on her first screen.** One new persona, with everything set up, so a reviewer who has only two minutes still sees it all.
3. **Every panel ask maps to something visible** (14.2).
4. **One app, no modes.** Reviewers see a single app. New features sit naturally beside the existing ones: no toggles, no "new" badges, no second version to compare.
5. **Honest labels:** demo, sandbox, approximate, from donation results.

### 14.2 Panel feedback → what to look at

| Panel ask | What answers it | Where to see it | Script |
|---|---|---|---|
| A comprehensive daily habit planner | Week plans fill the existing Habits and This week; habit apps keep track; Your day for donors without apps | My health → Habits; Connected apps | 21, 22 |
| Trackable streaks across iron-rich nutrition, hydration, sleep and activity | Signals from the donor's apps: Movement (steps, active minutes), Food (iron add-on, water), Mind (sleep); the app's own streaks; days kept | Habits tiles, Progress, Weekly report | 22, 23 |
| Comeback coach | `comeback:offer` after a disruption, with step-down and step-up | Home chat (Simulate a rough week) | 24 |
| Check-in trends over time | Results at each donation plus signals per Cycle; Arjun's year of steps vs BP | Progress → marker drawer | 23 |
| Wearable inputs | Fitbit/Oura (demo), Junction sandbox (live API) | Connected apps | 21 |
| Recurring daily barriers | Barrier chips on Skipped, weekday and evening patterns | Why this?, Weekly report "What changed and why" | 24 |
| Gentle, explainable small adjustments | Adjustment library, never zero, "Why this?" on every one | Comeback Card → Why this? | 24 |
| Adapts to missed days | Step-down, step-up, Simplify my plan, quiet when unwell or urgent | Side sheet ⋯ → Simplify my plan | 25 |
| Explains its recommendations | Rule-built Explanations | Every Card, food tile and target | 24, 27 |
| Helps keep healthy habits over time | Cycle focus, Cycle report, next donation as the next free health check | Home chip "Watch my Cycle report" | 26 |
| Strong privacy controls | Per-type consent, write-back switch, AI summaries switch, deletes, export | Connected apps, Your data | 29 |
| *(our addition)* Local, affordable food coaching | Food profile, Indian food library, prices, local names | Progress → "Eat for your iron"; Food Chat | 27, 28 |
| *(our addition)* Doctor when needed | Care levels; doctor advice always added; Doctor first overrides the AI | Asha (recommended), Meera (within 3 weeks), Hb 9.5 (first) | 28 |

### 14.3 Demo video v2 (under 3:00)

The existing beats are all kept, just tightened. New beats are inserted where they continue the story. If the submission allows two videos, keep the current one unchanged and record a separate 2-minute video of the new beats (decision 16.6).

| Time | On screen | Voice-over | |
|---|---|---|---|
| 0:00–0:08 | Title, Arjun's Home | "Arjun gave blood on 3 October. Like every donor in India, he heard nothing more." | existing |
| 0:08–0:22 | Impact story → postcard | "Pratidaan follows every part of his donation, anonymously." | existing |
| 0:22–0:38 | +1 day → Results BP 148/94 → Goal | "His free lab panel shows BP rising at every donation. One Goal: under 130/80." | existing |
| 0:38–0:55 | **Connect Fitbit (demo)** → Progress: steps fell 9,100 → 5,200 as BP rose | "He connects the watch he already wears. His steps fell as his BP rose." | **new** |
| 0:55–1:15 | Plan this week → Week plan saved to Habitify → **Simulate a rough week** → "A lighter week?" → Why this? | "When a busy week breaks his routine, Drop suggests something smaller, explains why, and updates his habit app." | **new** |
| 1:15–1:27 | Check-in 128/78 → Goal reached | "Two weeks later: target reached." | existing |
| 1:27–1:50 | **Asha**: food Card → ragi, drumstick leaves, chana at ₹12/day in Hindi → "A doctor's check is recommended" | "Asha can donate, but her iron is low-normal. Drop suggests local foods she can afford and that fit how she eats, and still recommends a doctor." | **new** |
| 1:50–2:02 | Meera: sample report Hb 12.6 → cleared; type Hb 9.5 → "See a doctor first" | "Below a safe level, rules take over: the doctor comes first." | existing + **new** |
| 2:02–2:18 | **Ananya**: Simulate check-in → Watch my Cycle report: "Better than 88% of women donors 30–39" | "Every donation is a free health check, and a report on how healthy she is, not just whether she can give." | **new** |
| 2:18–2:30 | Vikram urgent Card | "Urgent findings are rules, not model tone." | existing |
| 2:30–2:42 | Connected apps consent → Your data → Delete | "Every data type is opt-in, deletable, and never used for cover." | **new** |
| 2:42–2:50 | Cover slider, Badges | "Illustrative cover and impact milestones." | existing |
| 2:50–2:58 | Close card | "Pratidaan: give blood, stay healthy between donations, come back." | existing (updated line) |

### 14.4 New test scripts for [docs/drop/](../drop/README.md) (21–32)

Each script has steps, expected results and tick boxes, like 1–20.

| # | Script | Expected result |
|---|---|---|
| 21 | Arjun: connect Fitbit (demo) and Habitify (demo) | 12 months of signals; tiles show "demo"; Weekly report figures unchanged |
| 22 | Arjun: Plan this week in the Movement Chat → Save → Add to Habitify | Habits and This week show the plan; Undo removes it |
| 23 | Arjun: Progress → BP drawer | Results per donation, steps per Cycle, an "alongside" sentence |
| 24 | Arjun: Simulate a rough week | One comeback Card in the evening; Why this? cites R2 + Busy; no existing Card moved |
| 25 | Arjun: ⋯ → Simplify my plan → Bring back | One item kept and smaller; others set aside; Goals and Reminders untouched |
| 26 | Ananya: Simulate check-in → Watch my Cycle report | Slides as in B6; percentile shown only if ≥ 50 |
| 27 | Asha: food Card → See foods | Five foods fit eggetarian and the tight budget; doctor advice in grey |
| 28 | Meera: Simulate check-in with Hb 9.5 | Doctor first: no AI food plan; check-up slots offered; existing deferral unchanged |
| 29 | Any persona: turn off Steps consent → Your data → Delete signals | Steps vanish from Progress; Undo restores within 6 s |
| 30 | Food Chat (AI on): "Breakfast under ₹15?" as Meera | Only foods from the library; no medicines; doctor advice added |
| 31 | Reset, then open each existing persona without tapping anything new | First screens match the `v1-baseline` screenshots; Asha is last in Viewing as |
| 32 | Next event as Arjun after connecting | Same stop points as script 1–20 expectations |

### 14.5 Documentation updates (all additive)

| Doc | Change |
|---|---|
| [CONTEXT.md](../../CONTEXT.md) | New terms: Cycle report, Band, Focus, Signal, Connection, Food profile, Care level, Food habit, Comeback Card, Adjustment, Barrier. Existing terms are only extended where a placeholder is now built: Week plan, Your day, Simplify my plan. |
| [02-product.md](../02-product.md) | New sections: Progress, Connected apps, Food coaching, Comeback coach. Move built items out of "Not built yet". Add Asha to the persona table. |
| [03-architecture.md](../03-architecture.md) | New modules, integrations, data files, the coaching allowance, the AI tools and validation |
| [README.md](../../README.md) | "What a donor gets" gains a fourth point; the AI table gains food coaching and habit mapping; the "kept deterministic" list gains care levels, food filtering, doctor advice, disruptions and adjustments |
| [pratidaan-guide.html](../05-review/pratidaan-guide.html) | New section "New: health between donations", with an Asha walkthrough. Each existing persona walkthrough gets an added "Also try" step at its end. |
| [reviewer-guide.html](../05-review/reviewer-guide.html) | A "What changed since the first submission" box at the top, with the 14.2 table; new sample questions; new guardrails (foodGuard, doctor advice added after the reply) |
| [demo-video-script.md](../05-review/demo-video-script.md) | v2 timeline (14.3), keeping v1 below it for reference |
| [docs/drop/](../drop/README.md) | Scripts 21–32 |
| Pitch deck | 3 slides: "Every donation is a free health check", "Connect, don't rebuild" (integration diagram), "Food first, doctor when needed" |

## 15. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Two days is not enough | High | Three parallel streams, a Day 1 evening checkpoint, explicit cut lines (13), the `v1-baseline` tag and merge revert as the safety net (4.4) |
| A new feature changes an existing behaviour by accident | Medium | Golden baseline test (12.2), the 20 scripts re-run, screenshot comparison |
| Food values wrong | Medium | Values from IFCT by hand with code and page; a second person checks; data test; AI never supplies numbers |
| AI names a food or medicine outside the rules | Medium | `foodGuard` plus the rule-template fallback; doctor advice added by code |
| Clinical thresholds not signed off in time | Medium | Mark them "proposed thresholds, pending clinical review" in the app's Why this? and in the docs; keep them in `care-levels.json` so they can change without code |
| Junction or Habitify sign-up delays | Medium | The Demo connector covers the story; live connections are a bonus |
| To Do consent blocked on work or school accounts | Low–Medium | Demo To Do for personas; live To Do tested with a personal Microsoft account |
| Shared demo state confuses concurrent reviewers | Existing | Same as today (documented). Live data is kept per account. |
| Azure App Service F1 limits | Low | No new background jobs; percentiles computed once; the warm-up workflow already exists |
| Golden test flaky because of random ids | Medium | Normalise `BOOT`-based ids and timestamps in capture |
| Stereotyping in seeds | Low | Profiles chosen explicitly and reviewed; never derived from names |

## 16. Open decisions

1. **Clinical sign-off** of the care-level and band thresholds (C3, `bands.json`): who does it, and by when on Day 1?
2. **Food library scope** for submission: 30 iron foods plus a BP and sugar basics set (recommended), or broader and thinner?
3. **Budget bands:** ₹10–20 / ₹20–50 / flexible extra per day?
4. **Aggregator:** Junction sandbox as the live proof (recommended), with Open Wearables named for production?
5. **Live habit apps:** Habitify plus Microsoft To Do (recommended)?
6. **Video:** one 3-minute v2 (14.3), or keep v1 and add a separate video of the new features?
7. **Percentile wording:** "Better than 72% of …" (shown only ≥ 50%) or "Above average for your age"?
8. **New persona:** Asha Khan (`D-175`) as proposed, and her Food profile (eggetarian, office canteen, tight budget)?
