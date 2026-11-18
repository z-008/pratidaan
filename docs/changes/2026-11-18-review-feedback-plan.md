# Plan: responding to the review panel's feedback

- **Status:** proposed. Nothing in this plan is built yet.
- **Revision 2 (18 Nov 2026):** reviewed against the rule that **nothing that exists today may change or be removed** (see [rule 8](#3-rules-every-component-follows)). Components that would have renamed, reworded, re-ordered or re-timed something existing have been changed so they only add to it. Each fix is listed in the [technical implementation plan](2026-11-18-technical-implementation-plan.md#2-audit-of-the-feature-plan-against-the-additive-contract), which is the document to build from.
- **Revision 3 (18 Nov 2026):** no "What's new" switch in the app. Reviewers see one app, and the team's earlier build is protected by how we build (new files, listed additions only, a tagged baseline, no history rewrites).
- **Revision 4 (18 Nov 2026):** every demo persona now starts with the apps they would already use connected and a Food profile. Improvements apply to all profiles, and existing behaviour stays exactly as before (golden test re-recorded from `v1-baseline`). See the [build change log](2026-11-18-wellbeing-build.md#round-2-every-persona-and-app-data-used-throughout).
- **Date:** 18 Nov 2026
- **Deadline:** final submission on **20 Nov 2026** (working prototype and supporting documentation)
- **Source:** the Future Health Digital Innovation Challenge review email of 17 Nov 2026 (`docs/Gmail - Your Submission Feedback & Next Steps.pdf`)

## Contents

1. [What the panel said](#1-what-the-panel-said)
2. [The product, from the donor's side](#2-the-product-from-the-donors-side)
3. [Rules every component follows](#3-rules-every-component-follows)
4. [Components](#4-components)
   - [A. Connect what the donor already uses](#a-connect-what-the-donor-already-uses)
   - [B. Every donation is a free health check](#b-every-donation-is-a-free-health-check)
   - [C. Food coaching from Drop](#c-food-coaching-from-drop)
   - [D. Drop as the comeback coach](#d-drop-as-the-comeback-coach)
   - [E. Privacy](#e-privacy)
   - [F. Demo, documentation and tests](#f-demo-documentation-and-tests)
5. [Build plan (18–20 Nov)](#5-build-plan-1820-nov)
6. [Decisions needed before Day 1](#6-decisions-needed-before-day-1)
7. [Integration facts checked on 18 Nov 2026](#7-integration-facts-checked-on-18-nov-2026)
8. [Sources](#8-sources)

## 1. What the panel said

The panel liked the concept: anonymised impact stories, multilingual AI support and post-donation health Goals. But they found the prototype is "primarily a basic blood donation application with limited everyday habit-building depth". They asked for:

- a daily habit planner with trackable wellness streaks across iron-rich nutrition, hydration, sleep and physical activity;
- Drop as a **proactive comeback coach**, using check-in trends over time, wearable inputs and recurring daily barriers;
- gentle, **explainable** small adjustments when a donor's routine is disrupted;
- a system that **adapts to missed days**, explains its recommendations, helps people keep healthy habits over time, and has **strong privacy controls**.

Our team's response adds three things to that:

1. **Reuse, don't rebuild.** We connect the habit apps, wearables and food apps people already use, instead of building our own habit tracker.
2. **Every donation is a free health check.** Daily habits are linked to the lab panel taken at every donation, so donating becomes part of the donor's health routine. The aim is above-average health, not only being eligible to donate.
3. **Food coaching that fits the donor.** Drop suggests local, affordable foods that suit the donor's diet for low or low-normal results. It always recommends a doctor's check, and hands over to fixed rules (doctor first) when a result is too low for food to fix.

## 2. The product, from the donor's side

> "My watch and my habit app already track my days, and Pratidaan connects to them. Every three or four months I donate blood, and the free lab panel from that visit is my health check. It shows whether my habits changed my BP, haemoglobin or blood sugar. When something is low, even if it's still within the limit, Drop suggests foods I can buy nearby, that I can afford and that fit how I eat. It turns them into a habit, and it also tells me when I should see a doctor. Donating is part of how I look after my health."

The loop:

1. **Daily:** the donor's own apps and watch record habits and signals. Pratidaan reads them; nobody has to track anything twice.
2. **Between donations:** Drop links those signals to the markers they affect, coaches on food, notices when a routine slips and suggests a small change, which the donor's habit app delivers.
3. **Donation (the checkpoint):** the lab panel shows what those months did to each marker.
4. **Cycle report:** what improved, where the donor stands against donors their age, and next Cycle's focus. The next donation is booked as the next free health check.

**Words.** This plan keeps every existing term in [CONTEXT.md](../../CONTEXT.md):
- **Cycle:** the time between two donations (90 days for men, 120 for women under NBTC rules). It is already used in "Earlier this cycle" and Past Cycles.
- **Check-up:** a demo doctor visit.
- **Check-in:** Drop asking for a reading.

New features use **Cycle report** (alongside the existing Weekly report) and the phrase "free health check" in their wording. They never reuse "Check-up" or "Check-in" for anything new.

## 3. Rules every component follows

1. **Reuse, don't rebuild.** Habit tracking, streaks, wearables and food logging come from existing apps. Pratidaan connects them and interprets the data.
2. **The donation is the checkpoint.** Every Cycle ends in a lab-checked result.
3. **The aim is above-average health, not only donation-ready.** Every marker shows three bands: Donation minimum, Healthy and Optimal.
4. **Rules decide, the AI explains.** Fixed rules handle:
   - the care level and the doctor advice;
   - which foods are allowed;
   - disruptions and adjustments.

   Drop (Azure OpenAI) personalises wording and meal ideas within those limits. This follows the "kept deterministic on purpose" principle in the README.
5. **Food first, never food instead.** Food is the foundation. Drop never advises against prescribed medicine. When a result is very low, the rules take over and the doctor comes first.
6. **A doctor's check is recommended whenever a result is low**, even within the limit. How urgent the advice is depends on the level.
7. **Privacy by default.** Consent is per data type. The AI receives aggregates only. Nothing from connected apps or the Food profile affects eligibility, the health score, insurance cover or Circles.
8. **Add, never replace.** Everything that exists today keeps working, reading and timing exactly as it does now:
   - personas and their starting states;
   - the Intro;
   - Cards and their rules;
   - Goals and their write-ups;
   - the health score, eligibility, cover and Badges;
   - Stories;
   - the existing demo scripts and video beats.

   New features appear in new places, or as extra lines added under existing content. Existing placeholders that say "not built yet" (Habits, This week, Simplify my plan, Download my data) get filled in, keeping their labels and entry points. The team's existing build stays intact: new code goes in new files, existing files only get small, listed additions, and git history is never rewritten (see [technical plan 4.4](2026-11-18-technical-implementation-plan.md#44-protecting-the-teams-existing-build)).

## 4. Components

- **Priority:** **P0** is needed for the 20 Nov submission, **P1** is strongly recommended, **P2** is for the roadmap and documentation.
- **Size:** **S** is up to half a day, **M** about a day, **L** more than a day.

### A. Connect what the donor already uses

#### A1. Connections hub (P0, M)

- **Build:**
  - New folder `backend/src/integrations/` with one interface per connector: `connect`, `disconnect`, `sync(from, to)`, `capabilities`.
  - A **Demo** connector replays persona data through the same interface, so the demo and real connections behave the same way.
  - Each connection is stored as `{provider, status, scopes[], lastSync, consentedTypes[]}`. Tokens and keys are kept on the server (Key Vault, or encrypted at rest) and never sent to the browser.
- **What the donor sees:**
  - A new **Connected apps** screen with three groups: *Habit apps*, *Watch & phone health*, *Home devices*.
  - Each app tile shows a switch per data type ("Shares: steps, sleep"), "Last synced" and **Disconnect & delete**.
  - The Intro is **not** changed. Connected apps is reached from a new Home tile, from My health's Habits, and from the account menu.

#### A2. Wearables (P0, M)

- **Build:**
  - **Prototype:** Junction sandbox. Its demo connections give real API calls with synthetic Fitbit, Oura and Apple Health data.
  - **Google Health API** (Google OAuth, testing mode with test users) for anyone with a real Fitbit or Pixel Watch. The legacy Fitbit Web API shut down on 2 Nov 2026.
  - Signals pulled: steps, active minutes, sleep duration and regularity, resting heart rate, and HRV and VO₂max where available.
  - A daily sync job plus a **Sync now** button.
  - **P1:** upload an Apple Health export (`export.xml`) and parse only the data types the donor consented to.
  - **P2:** a native companion app (Expo) using the aggregator's SDK for live HealthKit and Health Connect sync. For production, Open Wearables self-hosted on Azure.
- **What the donor sees:** steps, active minutes, sleep and resting heart rate, each tagged with its source ("⌚ from Fitbit").

#### A3. Habit apps (P0, M)

- **Build:**
  - **Habitify:** the donor pastes an API key. Pratidaan reads habits and logs, and can add a log or a habit.
  - **Microsoft To Do:** add the `Tasks.ReadWrite` permission to the existing Microsoft Graph consent. Pratidaan reads completed recurring tasks and can create one.
  - **P1:** Todoist (REST, recurring tasks and completed items), and CSV import for apps with no API (Loop and similar).
  - Apps with no API (Streaks, HabitNow) are reached through Apple Health or Health Connect where they write to it.
  - **Habit mapping:** the AI suggests which health signal each habit feeds ("Chai one hour after lunch" → *iron absorption*, "Evening walk" → *movement*). The donor confirms or changes it, and nothing is used until they do.
- **What the donor sees:**
  - "Your habit 'Evening walk' counts towards Movement."
  - The habit app's own streaks appear on its tile. Pratidaan doesn't run its own streak engine.

#### A4. Food, water and home devices (P1, S)

- **Build:**
  - Iron, sodium and water intake from nutrition apps (Cronometer, MyFitnessPal and similar), through the phone's health store or the Google Health API (`hydration-log`, `nutrition-log`).
  - BP cuffs and scales (Withings, Omron) through the aggregator. The Google Health API has no blood-pressure data type.
  - Manual BP entry stays as it is.
- **What the donor sees:** intake and readings on the existing trends ([drop.js `chartPoints`](../../backend/src/domain/drop.js)), each tagged with its source.

#### A5. Signal store (P0, S)

- **Build:**
  - New file `backend/src/domain/signals.js`. Each record is `{date, signal, value, unit, source, app}`, with daily and Cycle rollups.
  - When sources disagree, the donor's own entry wins, then a medical device, then the watch, then an app.
  - Only signals the donor consented to are stored.
  - The Weekly report's simulated activity minutes (`activityMinutes()` in [drop.js](../../backend/src/domain/drop.js)) stay exactly as they are until the donor connects a device. The Demo device connector then reports the same numbers, so the report's figures don't jump.
- **What the donor sees:** nothing directly; it feeds every other screen.

#### A6. ABHA / FHIR (P2; the export is built now)

- **Build:**
  - **Now:** a **Download as FHIR** button for each lab panel, as a FHIR R4 DiagnosticReport. The LOINC codes are already mapped in [labReader.js](../../backend/src/ai/labReader.js).
  - **Roadmap:**
    - register with ABDM as a Health Information Provider and send each donation's panel to the donor's ABHA health record;
    - pull outside lab reports with ABDM consent.

    This needs sandbox registration and a security audit before production keys.
- **What the donor sees:** a download button on each donation's results.

### B. Every donation is a free health check

#### B1. Cycle model (P0, S)

- **Build:**
  - New file `backend/src/domain/cycle.js`. It reuses the existing Cycle (CONTEXT.md) and the next eligible date (`health.eligibility()`). It doesn't change how [chatCycles.js](../../backend/src/domain/chatCycles.js) archives chats.
  - Phases:
    - **Recover**, days 0–3;
    - **Build**;
    - **Prep**, the last 2 weeks;
    - **Checkpoint**, the donation itself.
- **What the donor sees:** a new **Between donations** tile on Home, directly after the existing Next donation tile, for example "Cycle 2 · Build · day 41 of 90 · next free health check ~2 Jan · focus: iron". Home's header and existing tiles don't change.

#### B2. Bands and age-group comparison (P0, M)

- **Build:**
  - Three bands per marker: **Donation minimum**, **Healthy** and **Optimal**, each with its guideline source in the ontology. Examples:
    - BP: under 120/80 is Optimal;
    - Hb: the minimum is 12.5 (women) or 13.0 (men), with a higher Optimal band;
    - HbA1c: under 5.7%;
    - LDL: under 100.
  - The donor's percentile among donors of the same sex and age band.
    - It reuses the k-anonymity idea in [impact.js](../../backend/src/domain/impact.js): an age group needs at least 20 donors, otherwise the band widens.
    - Only the percentile is shown, never anyone else's values.
  - The existing health score stays the only score.
- **What the donor sees:** a new **Progress** screen (`#progress`, a new nav item after My health), reached from the Between donations tile and from one new link on My health. My health's existing order doesn't change.
  - one row per marker, with a three-band bar and the donor's position on it;
  - last checkpoint against this one;
  - "Better than 72% of women donors 25–34".

#### B3. What moves this marker (P0, M)

- **Build:**
  - A fixed table, in the ontology, linking markers to the daily signals that influence them. Each link cites its guideline source.

    | Marker | Signals that influence it |
    |---|---|
    | Hb, ferritin | Iron intake, tea or coffee timing, days since donation |
    | BP | Movement, sleep, salt, resting heart rate, home BP, weight |
    | HbA1c | Movement, walks after meals, sleep, weight |
    | LDL, triglycerides | Movement, weight, diet |

  - Wording only says things happened together ("in weeks you walked 4+ days…"), never that one caused the other. A line appears only when there are enough data points.
- **What the donor sees:**
  - A page per marker with its trend across checkpoints and the donor's signals plotted underneath. It reuses the Recharts components already in Trends.
  - A line such as "In weeks you walked 4+ days, your home BP averaged 136/86 vs 144/92."

#### B4. Cycle focus for every donor (P0, S)

- **Build:**
  - One or two focus markers per Cycle, chosen by fixed rules.
    - Donors with a problem keep their existing Goal ([goals.js](../../backend/src/domain/goals.js)).
    - Healthy donors get a "level up" focus towards Optimal or a higher percentile, so Ananya and Rohan have something to work towards too.
  - Each focus has **leading targets** built from connected signals, for example "iron-rich food logged 5 days a week" or "sleep 7h+ on 5 nights".
  - With one tap, Pratidaan creates or links the matching habit in the donor's habit app (Habitify or To Do).
- **What the donor sees:** a focus card with its daily targets and "Added to Habitify ✓".

#### B5. On-track status and checkpoint prep (P1, S)

- **Build:**
  - A rule-based **On track / Drifting / No data** status per focus, from how consistent the leading signals have been. It never predicts a lab value.
  - A Prep Card two weeks before the checkpoint: sleep, water, iron, and booking the donation. It reuses the existing slots Card and Microsoft Calendar event.
- **What the donor sees:** a status chip on the focus card, and the Prep Card in Home's chat.

#### B6. Cycle report: the checkpoint reveal (P0, M)

- **Build:**
  - A new Story played by the existing Story player ([story.js](../../backend/src/domain/story.js), [StoryViewer.tsx](../../frontend/src/components/drop/StoryViewer.tsx)). The Results Card is not changed.
  - Slides:
    - each focus marker before and after, and its band;
    - the change in percentile;
    - the signals and food habits kept alongside ("Averaged 7,900 steps, up from 5,200");
    - which habit-app streaks were kept up;
    - the patients this donation will help.
  - It ends with **Next Cycle**: a suggested focus, one tap to push it to the habit app, and one tap to book the next checkpoint as a recurring calendar event.
  - Drop writes the narrative only from figures the tools return, checked by the existing number guardrail.
  - The demo's **Simulate check-in** ([Donate.tsx](../../frontend/src/pages/Donate.tsx)) already creates a new lab panel, so a reviewer can trigger the reveal live.
- **What the donor sees:**
  - A **Watch my Cycle report** chip, next to the existing "Watch my impact story" and "Watch my week" chips above Home's chat.
  - The Cycle report for each earlier Cycle can be watched from the existing Past Cycles chip.
  - The shareable postcard has no health values ("3 healthy cycles · 9 patients helped").

#### B7. A deferral is treated as a health signal (P1, S)

- **Build:** the existing Goal and Results Card wording stays. A new line is added on the Progress screen and the Between donations tile: "This Cycle's focus is iron. Your next donation's results will show if it worked."
- **What the donor sees:** the same deferral and Goal as today, with a forward-looking line beside them.

### C. Food coaching from Drop

#### C1. Food profile (P0, S)

- **What:** Drop learns how the donor eats before suggesting anything.
- **Fields:**
  - **Diet:** vegetarian, eggetarian, non-vegetarian, vegan, Jain (no root vegetables, onion or garlic).
  - **Allergies and intolerances:** peanut, gluten, lactose.
  - **Fasting days and festivals:** Navratri, Ramzan, Ekadashi, weekly fasts.
  - **Home food style:** set automatically from the donor's district; the donor can change it ("lives in Bengaluru, cooks North Indian at home").
  - **Staple:** rice, roti or millets.
  - **Where they eat:** home, canteen, hostel or tiffin; who cooks.
  - **Extra food budget per day:** tight (₹10–20), moderate (₹20–50) or flexible.
- **Build:**
  - Stored separately from Drop's **Memory**, which stays limited to schedule and language preferences (CONTEXT.md).
  - Diet can hint at religion, so it is only ever **chosen by the donor**, never inferred. It is never shared and can be deleted.
  - Until a profile exists, Drop suggests only vegetarian foods (the safe default) and asks first.
- **What the donor sees:** five chip questions the first time they open the existing Food Chat, or a food panel on the Progress screen. They can be edited from Your data. The Intro doesn't change.

#### C2. Indian food and nutrient library (P0, M–L; most of the time goes into curating the data)

- **What:** a reviewed list of about 60–80 Indian foods, in a **new** file. The existing [lifestyle-recommendations.json](../../data/ontology/lifestyle-recommendations.json) and the Goal write-ups that cite it stay as they are. Food coaching makes the general guidance ("iron-rich foods with vitamin C") local, affordable and personal.
- **Build:** each food is one entry in a new `data/nutrition/foods.json` with:
  - **Nutrients per serving**, from **IFCT 2017**, the Indian food composition tables from ICMR's National Institute of Nutrition (ICMR-NIN): iron, vitamin C, B12, folate, protein, sodium, potassium, sugar and fibre.
  - **Diet and Jain suitability**, and whether it can be eaten while fasting.
  - **Region** and **season.**
  - **Local names** in all six app languages (for example, ragi = nachni / nagli = kezhvaragu).
  - **Price band** in ₹ per serving, from DoCA retail prices and Agmarknet mandi prices where available, otherwise curated and labelled "approximate".
  - **Conflict flags:** high sugar, high salt, high potassium.
- **Absorption rules alongside the foods:**
  - vitamin C with iron-rich meals (amla, guava, lemon, tomato);
  - tea and coffee at least an hour away from them;
  - curd and milk away from iron-rich meals;
  - cooking in an iron kadai;
  - sprouting and fermenting (sprouted moong, idli, dosa);
  - fortified staples: double-fortified salt, and fortified rice from the ration shop.
- **Example foods:** ragi, bajra, horse gram, rajma, chana, sprouted moong, drumstick leaves, amaranth, garden cress seeds, sesame, eggs, fish, chicken liver.
- **Rule:** nutrient values come from IFCT, never from the AI.

#### C3. Care-level rules: when food leads and when the doctor does (P0, M, safety-critical)

- **What:** deterministic rules in a new `backend/src/domain/careLevel.js` decide, per marker, whether Drop coaches on food or sends the donor to a doctor. They sit on top of the existing findings in [health.js](../../backend/src/domain/health.js).
- **Iron levels.** The thresholds are **proposals**. A clinical advisor needs to sign them off against WHO and ICMR guidance.

  | Level | Rule (proposed) | What Drop does | Doctor advice (fixed wording, always shown) |
  |---|---|---|---|
  | **Optimal** | Hb ≥ donor minimum + 1.0 and ferritin ≥ 30 | Keep it up: one food idea a week | — |
  | **Low-normal** | Hb within 1.0 of the donor minimum, or ferritin 15–29, or Hb down ≥ 1.0 since the last donation | **Food coaching leads** | "You can still donate. A doctor's check is recommended to find out why it's on the low side." Book a check-up (optional). |
  | **Below donation level** | Hb below the donor minimum, or ferritin under 15 (existing `HB_LOW` / `IRON_LOW`) | Food coaching, with the doctor as a Goal step | "See a doctor within 3 weeks to find the cause." Can't be hidden for good. |
  | **Doctor first** | Hb under 10, or a pattern food won't fix (low MCV with normal ferritin, which may be a thalassaemia trait), or a red-flag symptom (breathless, fainting, black stools, heavy periods) | **Rules only.** AI food plans are switched off for this marker. Foods appear only as "alongside your treatment, after your visit" | "See a doctor first." A new Card sent with the results, outside the budget (as urgent Cards are), with a check-up slot. No existing persona reaches this level. |
  | **Urgent** | Hb under 7 (existing `HB_SEVERE`) | Existing urgent Card | "See a doctor today." |
  | **Iron not needed** | High ferritin | No iron foods suggested | Shown only if another rule applies |

- **Why donors in particular:** each donation takes about 200–250 mg of iron. That makes repeat donors a natural audience for iron coaching, and it belongs in the "Why it matters" text.

#### C4. Food recommendation engine (P0, M)

- **What:** picks foods that suit the donor's markers, diet, region, season and budget.
- **Build:** a new `backend/src/domain/foodCoach.js` works in four steps.
  1. **Target:** the nutrient gap, from the care level, measured against the ICMR-NIN 2020 daily requirement for the donor's sex.
  2. **Filter:** diet, allergies, Jain, fasting day, region and season.
  3. **Safety filter across all the donor's findings:**
     - no jaggery, dates or juice for prediabetes or diabetes;
     - no pickles, papad or namkeen for high BP;
     - no potassium push if creatinine is raised;
     - no iron foods if ferritin is high.
  4. **Ranking:** nutrient per rupee, nutrient per serving, how well it fits the donor's usual meals, and variety (no repeat within 2 weeks).
- **Output:** three to five foods, each with:
  - how to fit it in ("drumstick leaves in your sambar, twice a week");
  - a pairing ("squeeze lemon on it");
  - the extra cost a day;
  - its source (IFCT).
- **Plan size:** one or two changes at a time ("small, never nothing", the same principle as Simplify my plan).

#### C5. Drop's food coaching: the AI within those limits (P0, M)

- **What:** Drop turns what the engine chose into practical meal ideas, in the donor's language and with local food names.
- **Build:**
  - New agent tools in [tools.js](../../backend/src/ai/tools.js):
    - `get_food_profile`
    - `get_care_level`
    - `find_foods` (returns the allowed foods with their values and prices)
    - `log_food_habit`
  - Drop may mention **only foods that `find_foods` returned.** A validator rejects any other food, any medicine or supplement name, and any number no tool returned. This extends [guardrails.js](../../backend/src/ai/guardrails.js).
  - **The doctor advice is added by the rules after the AI writes**, so the AI can never leave it out or soften it.
  - At the **Doctor first** and **Urgent** levels, the AI isn't called for food plans; a fixed template is used.
  - **"Tweak my usual meals":** the donor describes a normal day and Drop suggests one swap or add-on per meal ("swap your 4 pm biscuits for roasted chana: ₹5, about 3× the iron").
  - **Without the AI:** template sentences built from the same engine output.
- **What the donor sees:** the existing **Food** Chat (the Food chip in Ask Drop and My health's Habits), now able to answer with food suggestions. Example questions:
  - "Breakfast ideas under ₹15?"
  - "What can I eat for iron during Navratri?"
  - "I don't like spinach."

#### C6. Making it part of the diet (P0, S)

- **Food habit of the week:** one add-on, pushed to the donor's habit app (Habitify or To Do).
  - It is ticked there, or counted automatically when a nutrition app logs the iron intake.
  - It changes every week or two for variety.
- **Shopping list (P1):** sent to a Microsoft To Do list or shared on WhatsApp.
- **Card for whoever cooks (P1):** a shareable card with no health values ("Add drumstick leaves to sambar twice a week; iron kadai for the sabzi").
- **Cycle report (B6):** shows how often the food habit was kept ("on 5 days a week for 10 weeks") next to the ferritin and Hb change at the checkpoint.
- **Comeback coach (D2):** in festival or fasting weeks, offers fasting-friendly options such as rajgira/amaranth and peanut chikki (left out if the donor is prediabetic).

#### C7. Other deficiencies and conditions (P0 for markers on the donation panel, P1 for outside lab reports)

Every marker uses the same four levels as iron:

1. **Low-normal:** food leads, a doctor's check is recommended.
2. **Below:** food plus a doctor within weeks.
3. **Doctor first:** rules only.
4. **Urgent:** see a doctor today.

| Marker | Comes from | Food focus | When the doctor comes first |
|---|---|---|---|
| **Hb / ferritin / MCV** | Donation panel | Iron + vitamin C, timing, iron kadai | Hb under 10, thalassaemia pattern, red-flag symptoms |
| **Vitamin B12** | Outside report (lab reader) | Dairy, curd, paneer, eggs, fish. **For vegans food alone is often not enough**, so a doctor is recommended | Very low, or with numbness |
| **Vitamin D** | Outside report | A morning sunlight routine, fortified milk and oil, eggs, fish | Very low |
| **Folate (high MCV)** | Donation panel / outside report | Leafy greens, dals, sprouts | High MCV with low B12 |
| **HbA1c 5.7–6.4%** | Donation panel | Millet swaps, a plate with dal and vegetables first, rice portions, walks after meals. No jaggery or juice | Diabetes range (existing 30-day doctor rule) |
| **BP** | Donation panel / home cuff | Less salt (pickles, papad, packaged snacks); potassium-rich local foods unless the kidney rule applies | Stage 2 and above |
| **LDL / triglycerides** | Donation panel | Oil quantity, fried snacks, oats or barley, nuts within budget | High |

- **Build:**
  - Each marker gets its own entry in the care-level rules and its own nutrient target in the engine.
  - The existing Goal write-ups ([goalWriteup.js](../../backend/src/domain/goalWriteup.js)) **don't change**. A collapsed **Foods that fit you** row is added under a Goal card's steps on My health.
- **What the donor sees:**
  - On each marker page on the Progress screen, an **"Eat for your iron"** (or B12, sugar, BP…) panel:
    - three food tiles, each with the local name, ₹ per day, "fits: vegetarian · South Indian" and a pairing tip;
    - a doctor banner coloured by level: grey (recommended), amber (within 3 weeks) or red (first or today);
    - buttons: **Add to my week**, **Other foods**, **Book a check-up**, **Why these?**
  - When results arrive at the Low-normal level, a new food Card on Home. No existing persona is at that level, so no existing persona's Cards change; the new persona Asha (F1) shows it:
    > "Your iron is fine for donating but on the low side. Three foods that fit you: … A doctor's check is also recommended."

### D. Drop as the comeback coach

#### D1. Disruption detection (P0, M)

- **Build:**
  - New file `backend/src/domain/routine.js`, run once a day. It compares the last 7 days with the donor's 28-day normal on each signal.
  - Rules, each with an id so "Why this?" can cite it:
    - habit completions dropping;
    - steps falling;
    - sleep under 6 hours on 3 of 5 nights;
    - food habit missed;
    - device gone quiet.
  - **Recurring patterns:** misses that cluster by day of the week, and travel (inferred only from the donor's calendar busy status, never from location).
  - **Barriers:** one-tap reasons from fixed codes: Busy, Travel, Unwell, Weather, Festival/fasting, Low energy, Caring for family. They can also be read from the habit app's skip reason or note, if the donor allows it.
- **What the donor sees:** optional "What got in the way?" chips, offered **only at the moment the donor marks an item Skipped**. This keeps the existing Your day rule that a skipped day is never mentioned afterwards.

#### D2. Small adjustments, written back to the donor's apps (P0, M)

- **Build:**
  - New file `backend/src/domain/adjustments.js` with a fixed library of adjustments:
    - **Shrink:** 30 → 10 minutes.
    - **Shift:** to the morning.
    - **Swap:** an indoor option.
    - **Anchor:** water with each meal.
    - **Travel:** iron-rich station food and a walking break.
    - **Unwell:** pause Movement.
    - **Fasting week:** fasting-friendly foods.
  - It never suggests exercise during an urgent Goal, and never cuts a habit to zero.
  - When the donor accepts, the habit app is updated: the Habitify target changes or a new To Do task is created. The target steps back up after 5 good days, and only with a tap.
  - A new **comeback** Card type in [drop.js](../../backend/src/domain/drop.js), with its own allowance so existing Cards keep their timing:
    - at most one a week;
    - only in the evening part of the day;
    - never on a day an existing Card was sent;
    - never counted against the existing Message budget, so it can't delay any existing Card;
    - ignored by **Next event**;
    - never at night;
    - suppressed while a Goal is urgent.
  - Switches on **Simplify my plan**, which is currently disabled ([ChatSheet.tsx](../../frontend/src/components/drop/ChatSheet.tsx)).
  - New agent tools:
    - `get_signal_summary`
    - `get_cycle`
    - `explain_recommendation`
    - `propose_adjustment` (can pick only from the library's candidates)
- **What the donor sees:**
  > "Busy fortnight? Try a 10-minute walk after breakfast. I'll update Habitify."
  >
  > [Try this] [Another idea] [Pause a week] [Not now] · **Why this?**

#### D3. "Why this?" (P0, S)

- **Build:** built by the rules, not the AI, for every recommendation, including foods. It shows:
  - the data used, with the app and date range;
  - the rule;
  - the source (IFCT, ICMR, WHO);
  - the donor's preferences and budget;
  - the effect on the checkpoint;
  - what would change it;
  - what was **not** used.
- **What the donor sees:** a bottom sheet under every Card, food tile and target.

### E. Privacy

#### E1. Consent, data limits and deletion (P0, M)

- **Build:**
  - New switches, all off by default:
    - consent per app and per data type;
    - **Write back to my apps**;
    - **Food profile**;
    - **Send summaries to the AI** (Drop gets aggregates such as "steps fell 40%", never raw logs);
    - **Pause coaching.**
  - Raw signals are kept 90 days, then only Cycle summaries remain.
  - **Download my data** (JSON and FHIR). This is currently listed as not built.
  - **Hard rules:** signals and the Food profile never change eligibility, the health score or insurance cover, and are never shared with Circles.
  - **Production note:** self-hosting Open Wearables on Azure Central India keeps data in India, in line with India's data protection law (the DPDP Act), instead of sending it to a US or EU processor.
- **What the donor sees:**
  - [YourData.tsx](../../frontend/src/pages/YourData.tsx) gets these entries, each with Delete and a 6-second Undo:
    - Connected apps
    - Signals
    - Food profile
    - Sent to our data partner (Junction in the prototype)
  - A lock line: "Never used for your cover or shared with Circles."

### F. Demo, documentation and tests

#### F1. Persona scenarios (P0, M)

**Every existing persona starts exactly as it does today.** New features light up only after a tap during the demo (Connect, Plan this week, Food profile), so every existing script and video beat still works unchanged. One **new** persona shows the full loop from the first screen.

| Persona | What's added (after a tap, unless new) | What it shows |
|---|---|---|
| **Asha Khan (new)** | Promoted from the existing synthetic donors (`D-175`: F, 34, Bengaluru, Hindi, Hb 12.7, ferritin 25; no data changed). Starts with a demo watch and Habitify connected, a Week plan, Your day and a Food profile (eggetarian, office canteen, tight budget; chosen in the seed, never inferred from her name). | **Low-normal iron:** she can donate, but iron is on the low side. A food Card, a doctor's check recommended, local foods in Hindi at about ₹12 a day, a comeback Card in a busy week, and a Cycle report when she donates. |
| **Meera** | Food profile (vegetarian, Tamil at home: both already in her seeded memory), Cronometer (demo), To Do "Chai 1h after meals" | **Below donation level:** ragi, drumstick leaves and sprouted moong, with a doctor within 3 weeks; her existing jaggery-and-lemon Reminder stays. Her existing beat (sample report Hb 12.6, cleared) is unchanged. Entering Hb 9.5 in **Simulate check-in** switches to **Doctor first**. |
| **Arjun** | **Connect Fitbit (demo)** brings in a year of history; Habitify; Withings (demo) | His steps fell across the year as his BP rose (126 → 148), shown on Progress. Week plan → **Simulate a rough week** → comeback Card that updates Habitify → his existing Check-in 128/78 → Goal reached (unchanged). Food: less salt, millet swaps, jaggery filtered out. |
| **Ananya** | Connect Oura (demo) | Level-up focus; top 10% of her age group. She can donate today, so **Simulate check-in** plays a Cycle report live. |
| **Vikram** | Connect a watch | Urgent: coaching and AI food plans stay off; rules only. |
| **Karthik, Rohan, New donor** | Nothing seeded | Unchanged. Every new feature is available to them through the same taps. |

- Demo bar: add **Simulate a rough week** after the existing buttons.
- [Reviewer guide](../05-review/reviewer-guide.html):
  - a two-minute "Cycle loop" walkthrough;
  - a one-minute "Food coaching and doctor rules" walkthrough.

#### F2. Documentation (P0, S)

- [CONTEXT.md](../../CONTEXT.md): new terms. Existing terms aren't changed.
  - Cycle report
  - Band
  - Focus
  - Signal
  - Connection
  - Food profile
  - Care level
  - Food habit
  - Comeback Card
  - Adjustment
- [02-product.md](../02-product.md) and [03-architecture.md](../03-architecture.md): new screens, engines and integrations.
- README:
  - add the new features to "Where AI is used";
  - add care level, food filtering and doctor advice to the "kept deterministic" list.
- Pitch deck: an "Every donation is a free health check" slide, an integration diagram, and "Food first, doctor when needed".
- Update the demo video script.

#### F3. Tests (P0, S–M)

- Care-level boundaries for every marker.
- The doctor advice is always present at Low-normal and above.
- The AI is switched off at Doctor first.
- The food validator rejects foods outside the allowed list and any medicine names.
- The safety filter across findings (no jaggery for prediabetes).
- Diet and Jain filters.
- Budget limits.
- Which source wins when signals disagree.
- The age-group comparison needs at least 20 donors.
- Disruption rules.
- Consent is enforced.
- The AI receives aggregates only.

## 5. Build plan (18–20 Nov)

Three streams run in parallel.

The day-by-day schedule, including a Day 0 regression baseline, is in the [technical implementation plan](2026-11-18-technical-implementation-plan.md#13-build-schedule).

| | Stream 1: Connect | Stream 2: Free health check and Cycle | Stream 3: Food coaching |
|---|---|---|---|
| **Day 1 AM** | A5 signal store, A1 hub with the Demo connector | B1 Cycle, B2 bands and age-group comparison | C1 Food profile, start C2 library (iron foods first) |
| **Day 1 PM** | A3 Habitify and To Do (real), A2 Junction sandbox | Progress screen, B3 marker pages | C3 care-level rules (iron), C4 engine |
| **Day 2 AM** | D1 detection, D2 comeback Card | B4 focus with push to habit apps, B6 Cycle report | C5 Drop food tools and validator, C6 food habit, C7 BP, sugar and lipid rows |
| **Day 2 PM** | E1 privacy entries | D3 "Why this?" (shared) | Food panels on marker pages, F1 persona seeds |
| **Final hours** | F2 docs, deck and video; F3 tests | | |

**If time runs short, keep these, which make the whole case:** A1, A3 (Habitify), A5, B1, B2, B6, C1, C2 (iron only), C3, C4, C5, D2, D3 and F1 (Asha, Meera, Arjun).

**Real in the submission:**
- Habitify, Microsoft To Do and Junction sandbox calls;
- Microsoft Calendar;
- Azure OpenAI for meal ideas, translation and the Cycle report narrative.

**Simulated and labelled as such:** Withings, Cronometer and Apple Health data, and all persona history.

**Roadmap (in the deck):** Google Health API in production, a companion app for HealthKit and Health Connect, Open Wearables on Azure, ABHA/ABDM.

## 6. Decisions needed before Day 1

1. **Care-level thresholds (C3):** who on the team, or which clinical advisor, signs them off? The "Hb under 10 = Doctor first" line in particular.
2. **Food library scope:** iron foods fully covered by Day 1 PM, with B12, vitamin D and folate as a smaller set? Or a smaller set across every marker?
3. **Budget bands:** are ₹10–20 / ₹20–50 / flexible per day (extra spend) right for our target donors?
4. **Aggregator:** Junction sandbox for the prototype, with Open Wearables named as the production route? The alternative is the Google Health API only: simpler, but it covers only Fitbit and Pixel and has no BP.
5. **Habit apps supported for real:** Habitify plus Microsoft To Do (recommended, because To Do reuses the Microsoft sign-in), or Todoist instead of one of them?
6. **Age-group comparison wording:** "Better than 72% of…", or just "Above average for your age"?
7. **Accounts:** Junction (sandbox key) and Habitify (API key from its mobile app) each need someone on the team to sign up.

## 7. Integration facts checked on 18 Nov 2026

- **Fitbit Web API:** shut down on 2 Nov 2026. Fitbit data now comes through the **Google Health API** (Google OAuth, v4). It covers steps, sleep, resting heart rate, hydration and nutrition, but **has no blood-pressure data type**.
- **Terra:** no free tier (from $399/month), so it is ruled out for the prototype.
- **Junction:** a sandbox for up to 50 users, with demo connections that return synthetic Apple HealthKit, Fitbit and Oura data. The prototype uses this.
- **Open Wearables:** MIT-licensed and self-hosted. It covers Garmin, Oura, Whoop, Polar, Strava, Withings and Google Health, plus SDKs for Apple Health, Samsung and Health Connect, and Apple Health XML import. This is the production route that keeps data on our own Azure tenancy.
- **Apple Health and Health Connect:** can only be read by a native app. Pratidaan is a web app, so it reaches them through an aggregator's mobile SDK (a future companion app) or an uploaded Apple Health export.
- **Habitify:** a public REST API (v2, `X-API-Key` header) with habit logs, plus an MCP server.
- **ABDM:** labs act as Health Information Providers by sending FHIR R4 DiagnosticReport bundles to the ABDM gateway. Production keys need NHA testing and a CERT-In security audit.
- **Food data:** IFCT 2017 (ICMR-NIN) has 151 nutrients for 528 Indian foods. ICMR-NIN's 2020 report gives nutrient requirements (for men, an iron RDA of 19 mg a day; check the women's value against the NIN brief note before citing it). DoCA monitors daily retail prices of about 40 essential foods, including dals, ragi, bajra, jowar and eggs.

## 8. Sources

- [Google Health API: about, and the Fitbit Web API shutdown](https://developers.google.com/health/about)
- [Google Health API migration](https://developers.google.com/health/migration)
- [Google Health API data types](https://developers.google.com/health/data-types)
- [Terra: Google Health API overview](https://www.tryterra.co/blog/everything-you-need-to-know-about-google-health-new-api)
- [Terra pricing](https://tryterra.co/pricing)
- [Junction API](https://docs.junction.com/api-details/junction-api)
- [Junction sandbox test data](https://docs.junction.com/wearables/providers/test_data)
- [Open Wearables](https://github.com/the-momentum/open-wearables)
- [Habitify API docs](https://docs.habitify.me/)
- [Habitify API v2](https://intercom.help/habitify-app/en/articles/6113937-use-habitify-api-v2)
- [ABDM sandbox FAQ](https://sandboxcms.abdm.gov.in/uploads/FAQ_25_06_2025_715cda8ad6.pdf)
- [ABDM integration checklist 2026](https://qualysec.com/abdm-integration-checklist/)
- [IFCT 2017 (ICMR-NIN)](https://www.nin.res.in/ebooks/IFCT2017.pdf)
- [Dietary Guidelines for Indians 2024 (ICMR-NIN)](https://www.nin.res.in/downloads/DGI_Booklet_English_CMYK.pdf)
- [ICMR-NIN 2020 nutrient requirements, brief note](https://www.nin.res.in/rdabook/brief_note.pdf)
- [DoCA price monitoring](https://consumeraffairs.gov.in/pages/achievements)
- [data.gov.in mandi price API client](https://github.com/kayalshri/commodityprice)
