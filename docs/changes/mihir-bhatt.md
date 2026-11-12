# Changes by Mihir Bhatt

One entry per commit, newest first, so any change can be traced or reverted: the Drop-first redesign (branch `feature/drop-home`) and the New donor's Intro and "Your data" (branch `feature/onboarding`).
To revert one: find it with `git log --oneline --grep "<commit title>"`, then `git revert <hash>`.
The design behind these changes is in `CONTEXT.md` (vocabulary) and the build plan.

## 2026-10-18 · Pratidaan, not TraceDrop, on the postcard postmark and Meera's sample report

- **What and why:** two places users see still said TraceDrop. The submission film uses unedited screenshots, so the fix is in the app.
  - **Postcard postmark:** the round postmark on a Story's postcard now prints `APP_NAME` from `frontend/src/brand.ts`, uppercased: PRATIDAAN. Both names are 9 letters in a monospace font, so the line is the same width (155 px) and sits inside the inner ring with about 30 px to spare on each side. `renderShareImage` draws both the Story's last slide and the image that Download image, Copy image and Share… use.
  - **Meera's sample lab report:** the red line now reads "SAMPLE REPORT FOR THE PRATIDAAN DEMO · SYNTHETIC DATA · NOT A REAL PATIENT". The old PNG had no source, so it is now an HTML template, `data/demo/sample-lab-report-meera.html`, rendered to `frontend/public/demo/sample-lab-report-meera.png` (800 × 560) by `data/demo/render-sample-lab-report.sh` with headless Chrome. Everything else matches the old image to within anti-aliasing. `SAMPLE_FALLBACK` in `ReportUpload.tsx` already matches it (12.6, 2026-10-08, Sample Diagnostics Lab).
  - Checked live with Gemini on. As Meera, Check-in · Hb goal → Add a report → Use a sample report shows "Haemoglobin 12.6 g/dL on 2026-10-08, Sample Diagnostics Lab. Read by the AI from the photo." This used the local `.env` model, `gemini-2.5-flash-lite`. `gemini-3.1-flash-lite` also read all five results, the lab and the date from the new PNG. As Arjun, the impact story's last slide shows PRATIDAAN on the postmark.
  - **Not changed, on purpose:** the other `tracedrop` strings (cookie and storage keys, the QR payload in `AppointmentPass.tsx`, the repo and infra names). Users still see the download names `tracedrop-*.png` (`shareImage.ts`) and `tracedrop-donation-*.ics` (`AppointmentPass.tsx`).
  - 162 backend tests pass; the frontend type-check is clean.
- **Files:** `frontend/src/components/share/shareImage.ts`, `frontend/public/demo/sample-lab-report-meera.png`, `data/demo/sample-lab-report-meera.html` (new), `data/demo/render-sample-lab-report.sh` (new), `docs/changes/mihir-bhatt.md` (restored; commit 8a9c085 had removed it).
- **Revert:** safe to revert on its own; the postmark and the sample report go back to TraceDrop.

## 2026-10-15 · Trends shows its healthy band again

- **What and why:** on My health, Trends' shaded healthy band was missing whenever a Donor's values sat outside it, even partly. Recharts drops a `ReferenceArea` that runs past the axis, and the axis was set to fit the values only. Ananya's HbA1c (5.1–5.2%) got no band, and a 0.1% change filled the whole chart. Arjun's BP (126–148, band 90–120) had no band either.
  - The y-axis now always reaches the band's healthy limit (5.7% HbA1c, 120 systolic, 130 LDL, 150 triglycerides), with round steps. The band is clipped to the chart (`ifOverflow="hidden"`) instead of dropped.
  - Each point's value is printed on it (systolic/diastolic for BP), so reading Trends never needs hover.
  - The note under the chart names the range: "healthy range (under 5.7%)", "(top number 90–120)".
  - Checked in the browser: Ananya's HbA1c inside the band up to 5.7%, and Arjun's BP above the 90–120 band.
- **Files:** `frontend/src/pages/Health.tsx` (`Trends`).
- **Revert:** safe to revert on its own.

## 2026-10-15 · Merge the Gemini 3.1 Flash-Lite swap into main, checked live

- **What and why:** `gemini-2.5-flash-lite` retires on 20 Oct 2026 (team decision D2). This merges `chore/gemini-3.1-flash-lite` (commit c7189dc, its entry is below) into `feature/health-goals` and then `main`, after the live check its entry asked for. The only conflict was this change log; both sides are kept.
  - **Checked against live Vertex AI with `gemini-3.1-flash-lite`** (project from the machine's application-default credentials):
    - **Chat:** Vikram's Movement Chat, twice, gets a doctor first and no exercise. Arjun's "Show my BP trend" calls `show_chart`. A second turn after that tool call ("my BP was 141/90 this morning") calls `log_reading` and saves the reading, and a third turn answers where his platelets went. So the returned `functionCall.id` works across turns. Meera's "I prefer evenings, and please talk to me in Tamil" calls `remember` and replies in Tamil.
    - **Lab reader:** a low-contrast photo of a report and the same report as text both give triglycerides 204.6, LDL 138.4, HDL 40.2 mg/dL, HbA1c 5.63% and Hb 14.1, with the right date and lab name.
    - **Card rewording:** the fact-check filter declines it, as it does on 2.5; this isn't a change.
  - **One fix:** 3.1 sometimes answered the insight of the day with a made-up candidate id ("iron_depletion_001" for Meera), which fell back to the rules wording. `insights.js` now limits `candidateId` to the real candidates' ids, and Meera and Arjun get the AI insight in 2 of 2 runs.
  - 149 backend tests pass.
- **Files:** the swap's files (see its entry below), `backend/src/ai/insights.js`, `docs/changes/mihir-bhatt.md`.
- **Revert:** revert this merge commit with `git revert -m 1`; the app goes back to `gemini-2.5-flash-lite`, which stops working on 20 Oct.

## 2026-10-15 · Drop's chat knows which Chat it's in and follows the Goals' steps

- **What and why:** a fix found while trying the side sheet (branch `feature/health-goals`). In Vikram's Movement Chat, "Help me plan this week's movement" and then "I want to have a plan" got "Sorry, I lost my words there" twice. The model had written its own notes ("The user wants…", "Given this, I should advise the user…") or Python-style tool code as its answer, and the filter threw the whole reply away. Separately, Drop's chat didn't know the Goals' write-ups: in testing it suggested 150 minutes of exercise a week to Vikram, whose urgent Goal says no exercise until a doctor has seen him.
  - The app now sends which Chat a question is asked in (`chat`: `general`, `goal:<id>` or `habit:<name>`) with each copilot turn.
  - Drop's context adds each live Goal's target, "why" and steps from the write-up, says the steps come from Pratidaan's rules and not a doctor, and says to suggest only those steps. An urgent Goal adds: no exercise, Movement plan or walks until the Donor says a doctor has seen them.
  - It also adds which Chat this is. Asked for a week's plan, Drop suggests one or two things from the Goals' steps (with no Goal, a simple everyday idea and no health reason), says saving a Week plan and adding it to the calendar is coming, and never claims it saved or scheduled anything. Week plans are step 6.
  - A reply that reads as the model's own notes (it mentions "the user", or narrates "I should / I will advise…") or tool code, or an empty reply with no action, gets one more try with no tools, told to answer the Donor directly. Actions from the first try are kept. Only if that also fails does the old fallback run.
  - Checked against live Vertex AI (`gemini-2.5-flash-lite`, still this branch's model): Vikram's two turns, three runs, plus Arjun's. No leaked notes; Vikram is pointed to a doctor and less salt with no exercise; Arjun gets brisk walks from his steps. The model still varies run to run.
  - Local setup, not committed: the `health-goals-api` preview server now sets `GOOGLE_CLOUD_PROJECT` (from the repo docs and the machine's application-default credentials), so the AI is live in the preview.
- **Files:** `backend/src/ai/copilot.js`, `backend/src/domain/drop.js` (`chatContext` carries the Goals' write-ups), `backend/src/routes/donors.js` (`chat` on the copilot route), `frontend/src/api.ts`, `frontend/src/components/Copilot.tsx`.
- **Revert:** safe to revert on its own; Drop's chat goes back to not knowing the Chat or the write-ups.

## 2026-10-15 · The Chat over the app: the side sheet (From results to habits, step 5)

- **What and why:** step 5 of the build plan, on branch `feature/health-goals`. Until now a Goal's Open fired `drop:open` into the old Drop panel; it now opens in its own side sheet, variant B of `frontend/prototype/goal-chat.prototype.html` (branch `prototype/results-to-habits`, commit 3da2c46).
  - **The sheet** (new `frontend/src/components/drop/ChatSheet.tsx` and `chat-sheet.css`): a 680 px panel slides in from the right over the blurred app. × , Escape or a click on the blurred app closes it. Off Home it replaces the old Drop panel, and **Ask Drop** opens it on the General Chat. Home keeps its own General Chat, and the sheet's General Chat is the same conversation.
  - **Header:** the Chat's name and state ("Your Goal · active", "· up next, starts when *X* is done", "· stopped", "· done"; "Habit · no Week plan yet"; "Chat · this Cycle"), a ⋯ menu and ×.
  - **The ⋯ menu:** **Simplify my plan** is shown but disabled ("Comes with Week plans", step 10). **Add a reading** is on an active or Up next Goal: the BP number boxes for a BP Goal, otherwise the lab report reader, as on My health. **Book a check-up** gives the check-up slots Card in that Chat. **Stop this Goal** is on an active or Up next Goal; for an urgent Goal it is disabled, with "An urgent Goal can't be stopped". **What Drop remembers** is kept from the old panel's header so it isn't lost.
  - **Chips:** General, each Goal (with a dot while a Card that opens it is still open, and its state when it isn't active), Movement, Food, Mind and Past Cycles. Past Cycles is an empty state ("No past Cycles yet"), because Chats aren't stored until step 3.
  - **A Goal Chat's pinned line:** where you are (the latest point on its trend), the target, and this week ("Nothing planned yet" until step 6, "After *X*" when Up next, "Stopped"). Habit and General Chats pin nothing for now.
  - **Ticket 01's Chat rules** (`goalChat` in `backend/src/domain/drop.js`): an active Goal opens with its target and trend. An **Up next** Goal stays open both ways but offers no "What could I do this week?". Asked "Can I start it now?", Drop answers by rule: "It starts when *X* is done. What you do for Movement helps it too." A **done** Goal's Chat is read-only, with no input or questions. A **stopped** Goal's Chat is read-only, with **Start again** at its foot.
  - **Stop and Start again:** new `POST /api/donors/:id/drop/goals/:goalId/stop` and `/start-again`, which use `goals.stop` and `goals.startAgain` through new `drop.stopGoal` and `drop.startGoalAgain`. Drop confirms in one line in the Goal's Chat ("You stopped *X* on Sat 10 Oct…", "*X* is back on." or "back, up next"). An urgent Goal's stop comes back as a 400 with the reason.
  - **Opening it:** `openChat()` in `chat.ts` now carries which Chat (`goalId`, or a Habit). The Goal card's Open, Up next's Open, the results Card's button (its action's `open`, with `goalId`), Your Chats on My health, Plan this week, and Drop's line all open the sheet. Off Home, the sheet also takes Drop's asks, bookings and check-ups (`drop:ask`, `drop:book`, `drop:checkup`).
  - **Replies** still go through the existing copilot (`Copilot.tsx`), now with one conversation per Chat, kept in the browser until step 3. Opening a Chat again doesn't repeat its opening line.
  - **Desktop now, touch later:** every button in the sheet (chips, menu items, ×, suggestions, send, Start again) is at least 44 px, checked in the browser. The menu opens on click, and nothing needs hover.
  - The BP reading form moved from `Health.tsx` to `frontend/src/components/drop/BpReading.tsx` so the sheet can use it too. Two icons were added: `dots` and `history`.
  - **Not built here, on purpose:** the results Card's "still low, want to pick it back up?" for a stopped Goal at the next results, a Habit Chat's pinned week items (step 6), stored Chats and real Past Cycles (step 3), and the one-Card endings (from step 6). The phone version (likely a full-screen sheet) stays in the map's "Not yet specified".
  - Checked live at 1400 px with Arjun and Vikram, with no console errors. Open, Your Chats and the results Card each open the Goal Chat, and the Goal's chip has a dot while the results Card is open. Stop, then Start again, works. Vikram's urgent Goal can't be stopped. A copilot reply arrives, Book a check-up and Add a reading work, the Movement chip works, and Home's own General Chat is still there.
  - Tests: two more in `backend/test/goals.test.js`: stop and Start again through Drop, with the stopped and urgent cases; and the Up next and done Chats. 147 backend tests pass.
- **Files:** `backend/src/domain/drop.js`, `backend/src/routes/drop.js`, `backend/test/goals.test.js`, `frontend/src/components/drop/ChatSheet.tsx` (new), `frontend/src/components/drop/chat-sheet.css` (new), `frontend/src/components/drop/BpReading.tsx` (new, moved from `Health.tsx`), `frontend/src/components/drop/chat.ts`, `frontend/src/components/Copilot.tsx` (no own panel or fab; per-Chat conversations, openers, rule answers, read-only), `frontend/src/components/drop/DropLine.tsx`, `frontend/src/pages/Health.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/ui.tsx`.
- **Revert:** safe to revert on its own. Goal Chats go back to opening in the old Drop panel, and Stop this Goal goes away.

## 2026-10-15 · Health shows Goals, with empty Habit shelf and This week (From results to habits, step 4)

- **What and why:** step 4 of the build plan, with step 6's Habit shelf and This week as empty shells, as the plan says (branch `feature/health-goals`). It follows variant A of `frontend/prototype/health-goals.prototype.html` (branch `prototype/results-to-habits`, commit 3da2c46) plus variant B's "This week".
  - **My health, top to bottom:** "Your health" with **Add a lab report**; Drop's line; the Habit shelf (Movement, Food, Mind, each "Plan this week"); This week (this Monday to Sunday, "ends with your Weekly report" only for Donors on the weekly report, one row per Habit with "No Week plan" and **Plan this week**); up to two Goal cards; Up next; the Health score beside Your Chats with Drop; Keep an eye on, From your doctor and Check-ups in one row; the lab report reader; Trends and Readings and results, both collapsed.
  - **A Goal card:** left, the name, the target, "Your next donation waits on this" when it does (and "Urgent" for an urgent Goal), "Why it matters" from the write-up, This week ("Nothing planned yet", until step 6), the 2–3 tagged steps, **Open** and **Add a reading**, and "Where these steps come from" (each step's evidence and the note for a doctor). Right, the trend in plain words ("Up at each of your last 4 donations", "126/78 → 148/94"), a chart of the lead marker against the dashed target line, "Also in this Goal" lines and the next check. Values are printed on the chart's points, so nothing needs hover; the Donor's own readings are hollow points.
  - **Add a reading:** for a BP Goal, two number boxes and **Save reading** (new `POST /api/donors/:id/drop/readings`, which uses Drop's `logReading`); for any other Goal it opens the lab report reader. A reading joins the trend and never changes the Health score.
  - **Open, Your Chats and the Habits:** until the Chat side sheet (step 5) and server-side Chats (step 3), each opens the existing Drop panel with that Chat's opening line and questions (`openChat`, a `drop:open` event; with no text it just opens the panel). Your Chats lists General ("This Cycle, since your 3 Oct donation" when that is within 120 days), every Goal with its target or state, and the three Habits ("Not started"). Past Cycles isn't listed: there are no stored Chats yet.
  - **Health score:** "From results only", with the cover line (Drop's cover-screen line) moved under it.
  - **Results Card:** with a Goal, its button is **Open** *Goal name* and opens that Goal's Chat; "Try demo check-up slots" and "Explain my results" become chips. The answer's receipt is "Results seen · opened *Goal name*". Without a Goal it's unchanged.
  - **Removed:** "What your results say" (every finding is now in a Goal or Keep an eye on), "Your Plan" (`PlanSection` in `HealthDrop.tsx`), the "Your Plan is ready" Card with **Save my Plan** (its event, priority, label and answer), and "Your Plan has the next steps" in `screenLines.js` and `copilot.js`. The Plan (activity target and first Check-in) now starts when results that make a Goal are sent. The Detailed analysis card went in step 2.
  - **Not built here, on purpose:** Simplify my plan at This week's foot (nothing to simplify before Week plans), the prescription half of the upload button and From your doctor (step 16; it says "Nothing added yet."), uploads grouped by Cycle (step 14), Stop this Goal / Start again (step 5).
  - **Desktop now, touch later:** every button, tab, row, section toggle and Drop's line on the page is at least 44 px (`frontend/src/pages/health.css`), checked in the browser.
  - Checked live at 1400 and 1000 px for Arjun, Meera, Karthik, Vikram, Rohan, Ananya, Imran (D-013) and the New donor (unchanged "No results yet"), with no console errors: Open and the results Card open the Goal's Chat, and a 128/78 reading appears as a hollow point with the score unchanged.
  - Tests: four more in `backend/test/goals.test.js` (Arjun's results Card and no Plan Card; the Goal's view; a reading on the trend with the score unchanged; Drop's line). 145 backend tests pass.
- **Files:** `backend/src/domain/drop.js`, `backend/src/domain/screenLines.js`, `backend/src/ai/copilot.js`, `backend/src/routes/drop.js`, `backend/test/goals.test.js`, `frontend/src/pages/Health.tsx`, `frontend/src/pages/health.css` (new), `frontend/src/components/drop/HealthDrop.tsx`, `frontend/src/components/drop/chat.ts` (new), `frontend/src/components/drop/DropCardView.tsx` (an action's `open`), `frontend/src/components/Copilot.tsx` (opening with no line), `frontend/src/api.ts`, `frontend/src/ui.tsx` (walk, food and mind icons).
- **Revert:** safe to revert on its own; My health goes back to the step 2 page (Your Plan listing the Goals) and the results Card to "Try demo check-up slots" with Save my Plan the next day.

## 2026-10-15 · The Goal write-up, rules version (From results to habits, step 2)

- **What and why:** step 2 of the build plan, rules fallback only (branch `feature/health-goals`). The AI version waits on team decision D1 (Google Cloud's "no clinical purposes" term), so it isn't wired; the rules version is what runs, and stays the fallback when the AI comes.
  - New `backend/src/domain/goalWriteup.js` writes, per Goal, a two-sentence "why this matters" and 2–3 steps, each tagged `movement`, `food`, `mind`, `doctor` or `reading`, each with its evidence. Evidence comes only from `data/ontology`: the lead finding's protocol ("Protocol BP-G1: …") and the lifestyle guidance with its own effect sizes ("Aerobic Exercise: 5-7 mmHg systolic (ICMR Guidelines, ACC/AHA 2017)").
  - By lead: BP (walks, less salt, a doctor within the protocol's follow-up; stage 2 puts the doctor first; urgent is a doctor today, less salt and a reading, with no Movement step), prediabetes (150 minutes a week, whole grains, the next HbA1c), the diabetes range (a doctor within 30 days first), cholesterol (whole grains, beans and vegetables in place of fried food, walks, a lipid result) and iron (iron-rich food with vitamin C, tea and coffee away from meals, a doctor to find the cause; severe anaemia is a doctor today).
  - Written when a Goal is made or its findings change (lead, finding ids, whether it stops donation), never on a view, and kept on the Goal's record in Drop's state. The Drop view's `goals` carry it as `writeup`.
  - Code still writes the facts (step 1's `facts`): the trend, the target, the doctor note and the next check. The write-up never sets grouping, a target or the order.
  - Removed: `backend/src/ai/carePlan.js` (`PLAN_SCHEMA`, `generate` and its fallback), `POST /:donorId/care-plan`, `store.session.carePlans` and its clears on lab save, lab delete and check-in, `api.carePlan` and the `CarePlan`/`PlanAction` types. With its API gone, Health's Detailed analysis card (`CarePlanCard`) goes in this step rather than step 4.
  - The AI console lists "Goal write-up" (Rules) in place of the care-plan agent; the booking flow's "Your care plan in My health" now says "Your Goal"; the README no longer describes the care-plan agent.
  - The cover line moves to the Health score in step 4, where Health is rebuilt.
  - Tests: six more in `backend/test/goals.test.js` (every Persona's Goal has a valid write-up; Arjun's steps and evidence; urgent and diabetes-range doctor steps; written once and rewritten when Meera's findings change; the route is gone). The lab-save 400 test in `domain.test.js` now checks nothing was saved instead of the care-plan cache. 141 backend tests pass.
- **Files:** `backend/src/domain/goalWriteup.js` (new), `backend/src/domain/goals.js`, `backend/src/domain/drop.js`, `backend/src/ai/carePlan.js` (deleted), `backend/src/routes/donors.js`, `backend/src/data/store.js`, `backend/src/domain/donation.js`, `backend/test/goals.test.js`, `backend/test/domain.test.js`, `frontend/src/api.ts`, `frontend/src/pages/Health.tsx`, `frontend/src/pages/AIConsole.tsx`, `frontend/src/components/BookingFlow.tsx`, `README.md`.
- **Revert:** revert together with step 4 (which builds on the write-up); on its own it brings back the Detailed analysis card and route.

## 2026-10-15 · Goals in code (From results to habits, step 1)

- **What and why:** step 1 of the "From results to habits" build plan (`docs/wayfinder/results-to-habits/handoff.md` on `plan/results-to-habits`; ticket 01), on branch `feature/health-goals` from `main`. Mihir lifted the "nothing before the 18 Oct demo" rule for the Health tab; this branch isn't merged before the demo unless he says so.
  - New `backend/src/domain/goals.js` turns findings into Goals by fixed rules. Two groups: lifestyle (BP, cholesterol, sugar, weight) and iron (Hb, ferritin). A group makes a Goal only with a moderate-or-worse finding; its watch findings then join it. A raised ALT, and watch findings in a group with no Goal, are "keep an eye on" lines.
  - Name: what the Goal covers, lead finding first, up to three ("BP and cholesterol", "Blood sugar, BP and cholesterol", "Haemoglobin and iron").
  - One target from the lead finding: BP under 130/80; HbA1c under 5.7%; LDL under 130 with triglycerides under 150; haemoglobin 12.5 (women) or 13.0 (men) with ferritin 15 or more; for the diabetes range, a doctor's check within 30 days with no number.
  - Order: urgent, high, moderate; on a tie the Goal that stops donation, then the older one. Two are active; the rest are Up next with "starts when *X* is done". States: active, Up next, done (the group is back to watch or better) and stopped (`stop` refuses an urgent Goal; `startAgain`). A done Goal reopens with the same id when its findings come back. No route or button calls stop or Start again yet; that's step 5.
  - Code-written facts per Goal (`facts`): the trend in plain words with real numbers ("Up at each of your last 4 donations", "126/78 → 148/94"), the Goal's other findings ("Triglycerides 138 → 152 → 168"), urgency, the doctor note and the next check from the lead's protocol.
  - Drop's state keeps one record per Goal (`st.goals`: started, done, reopened, stopped). `drop.goals(donorId)` lists them and the Drop view carries `goals`.
  - Removed: `BP_GOAL` 135/85 (readiness, "reached your target", the report's BP slide and the chat reading now use 130/80) and the single Hb 12.5 (the Hb Check-in and its "reached" check use the Goal's target by sex). `planFindings` and the Goal part of `draftPlan` are gone; Imran (D-013, prediabetes only) now gets a Goal and the Plan Card after his results. Meera's seeded Plan loses its `goals` line.
  - `health.js` exports `hbMin` and `blocksDonation`, used by Goals, eligibility and Drop's readiness. `lcFirst` keeps acronyms ("target BP under 130/80", not "bP").
  - `CONTEXT.md` takes the glossary agreed on `plan/results-to-habits` (Plan, Goal, Habit, Week plan, From your doctor, Chat, Cycle, Check-in, Simplify my plan, Your day, Weekly report).
  - Tests: new `backend/test/goals.test.js` (18) covers Arjun, Karthik, Meera, Imran (D-013) and Rohan, plus Ananya, Vikram, Hb by sex (D-087), the diabetes range (D-053), ALT (D-185), two Goals (D-038), cholesterol as lead (D-015), order and Up next, stop and Start again, done and reopen, and 130/80. One `drop.test.js` test no longer hand-writes a 135/85 Plan. 135 backend tests pass.
  - Imran is not in the Persona switcher; the tests use synthetic donor D-013 (Imran Menon), the only Imran with prediabetes alone.
- **Files:** `backend/src/domain/goals.js` (new), `backend/src/domain/drop.js`, `backend/src/domain/health.js`, `backend/src/domain/screenLines.js`, `backend/test/goals.test.js` (new), `backend/test/drop.test.js`, `data/demo/drop-seed.json`, `frontend/src/api.ts` (`DropGoal`, `goals` on the Drop view, `goals` off `DropPlan`), `frontend/src/components/drop/DropKnows.tsx`, `frontend/src/components/drop/HealthDrop.tsx` (Your Plan lists the Goals until step 4 removes it), `CONTEXT.md`.
- **Revert:** safe to revert on its own before step 2; the Plan goes back to BP 135/85 and Hb 12.5 Goals made on Save my Plan.
## 2026-10-15 · Gemini 2.5 Flash-Lite swapped for 3.1 Flash-Lite before its retirement

- **What and why:** branch `chore/gemini-3.1-flash-lite` (from `main`). Google's Vertex AI model versions page (checked 15 Oct 2026) says `gemini-2.5-flash-lite` retires on 20 Oct 2026. It names `gemini-3.8-flash`, `gemini-3.1-flash-lite` or Gemma 4 as replacements. 3.1 Flash-Lite is GA, available on the `global` endpoint, with the same 65,536 output and 1,048,576 context limits, the same image types and 7 MB inline cap, and structured output and function calling. Every AI feature (Drop's chat, lab reader, care plan, Drop's and the Intro's wording, home insight) uses this one model.
  - The model id changes in `llm.js` (the default), the Cloud Run deploy workflow (`LLM_MODEL`), `.env.example` and `docs/RUN_LOCALLY.md`.
  - Request changes from Google's 2.5 → 3.x migration guide: `temperature: 0.2` is removed, since Google says to drop sampling parameters on 3.x models. Gemini's own function-call `id`, when it sends one, now goes back on the call and on its `functionResponse` (3.x matches results to calls by id; a mismatch can give an empty reply).
  - No change needed: JSON schema mode (`responseMimeType` + `responseSchema`) and image input (`inlineData`) keep the same shape. Thinking defaults to `MINIMAL` on 3.1 Flash-Lite, and thought signatures already go back with each tool call.
  - Two new tests in `backend/test/llm.test.js`. All 119 backend tests pass. Not yet checked against live Vertex.
- **Files:** `backend/src/ai/llm.js`, `backend/src/ai/agent.js`, `backend/test/llm.test.js`, `.github/workflows/deploy-cloud-run.yml`, `.env.example`, `docs/RUN_LOCALLY.md`.
- **Revert:** safe to revert on its own until 20 Oct; after that the reverted model id stops answering and every AI feature falls back to rules.

## 2026-10-14 · An impact Card's own unit is no longer repeated in the report

- **What and why:** a bug fix in `detect()`, branch `fix/impact-fold-first-unit` (from `feature/story-and-badge`). The first transfused unit of a donation raises the impact Card. On every later check the "fold the rest into the report" branch also caught that same unit, so it came back in the next Weekly or monthly report as "My red blood cells … helped a patient". Seen with Vikram's (D-017) test donation: red cells transfused 12 Oct, repeated in the 18 Oct Weekly report.
  - The unit that raises the impact Card is now marked as told (`impact_more:<unit>`), and so is a seeded impact Card's unit. Later units of the donation still fold into the report as before.
  - It marks the unit, not "the first in the list": Arjun's (D-001) seeded Card is about platelets transfused 8 Oct, before Drop started, so the first unit Drop sees for that donation is his red cells (15 Oct), a later unit. Skipping index 0 would have dropped them from the report. His platelets were never repeated, since they fall before Drop's start.
  - One new test in `backend/test/drop.test.js`: Vikram's report lists his platelets but not his red cells, and Arjun's lists his red cells.
- **Files:** `backend/src/domain/drop.js`, `backend/test/drop.test.js`.
- **Revert:** safe to revert on its own; the Card's unit shows up again in the next report.

## 2026-10-14 · New Badges in Stories, reports and Drop's line (Story and Badge complete)

- **Feature summary (steps 1–5 on `feature/story-and-badge`):** every unit that reached a patient, or plasma that became medicines, has one Story, built in `story.js`. It plays from Drop's impact Card or "Watch the story" on My Impact, and ends on a shareable 1080×1920 postcard (Download image, Copy image, Share… where the browser can share files). Eight Badges are worked out from the Donor's own data (`badges.js`) and shown on My Impact's Badge shelf. Each earned Badge opens as a shareable medal image. A newly earned Badge is marked "New" and shows up in the Story, report or Drop's line, never as a new Card. The text share, the old "AI" story and "Share my impact" are gone.
- **What and why (this step):** step 5 of the build plan (spec section 5).
  - Drop's state gains `badgesSeen` and `badgesShown`. Badges earned on or before the day Drop's state started begin as seen, so a seeded Persona's history is never "New". Undo keeps both lists (it can't unsee or unshow a Badge), and a demo reset starts them over.
  - When an impact Card's unit completed a Badge no Story or report has shown, that Story's last slide is the Badge (first in shelf order) instead of the postcard, with its share buttons.
  - Otherwise (a later unit of the donation, plasma made into medicines, Regular donor) the next Weekly or monthly report gets one slide: "New Badge: Regular donor. Share it from your Badges on My Impact." Several Badges at once share one slide: "New Badges: A, B. Share them from …". "them" for several is my wording; the spec only gives the one-Badge line. Reports show no share buttons.
  - "New" clears when the Donor opens the Badge on the shelf or reaches the Story or report slide that shows it (`POST /api/donors/:id/drop/badges/seen`). Watching part of a Story doesn't clear it.
  - Drop's line on My Impact names New Badges: "You earned Regular donor in October 2026. It's on your shelf below." / "You earned 2 new Badges: 5 patients and Helped a child." The shelf shows a "New" tag on a warm highlight. Earning a Badge never sends a Card or uses the Message budget.
  - `badges.js` also gives exact earned dates (`earnedDates`) for these rules. They stay on the server; the app still gets the month only.
  - Six new tests in `backend/test/drop.test.js`.
  - Checked live: Rohan (D-033) checks in a third donation. Regular donor is "New" on the shelf at once and Drop's line names it. His 1 Nov monthly report carries the Badge slide, and reaching it clears "New".
- **Files:** `backend/src/domain/drop.js`, `backend/src/domain/badges.js`, `backend/src/domain/screenLines.js`, `backend/src/routes/drop.js`, `backend/src/routes/donors.js` (`newBadges` on the impact response), `backend/test/drop.test.js`, `frontend/src/api.ts`, `frontend/src/components/drop/StoryViewer.tsx` (`onSlide`, `badgeSeenOnSlide`), `frontend/src/components/drop/DropFeed.tsx`, `frontend/src/components/Copilot.tsx` (one prop and its import), `frontend/src/components/impact/BadgeShelf.tsx`, `frontend/src/components/impact/badges.css`, `frontend/src/pages/Impact.tsx`.
- **Revert:** safe to revert on its own; Badges stay on the shelf and in sharing, but nothing is "New" and impact Stories always end on the postcard.

## 2026-10-14 · My Impact: Watch the story and the Badge shelf

- **What and why:** step 4 of the Story and Badge build plan (spec section 2, "The shelf").
  - Every unit with a Story (transfused, or plasma made into medicines, and not withheld) has **Watch the story** in its detail. It loads the slides from `GET …/impact/:componentId/story` and plays them in the Story viewer, ending on the postcard with its share buttons. Expired, stored, in-progress and withheld units have no button. The rule matches `componentStory` for every Persona.
  - The **Badge shelf** sits where "Share my impact" was, under Drop's line: "Badges · n of 8", then the 8 Badges in shelf order. Earned: small gold medal, name, "Earned {month}". Not earned: greyed medal at 40%, greyed name, goal and progress ("Reach 10 patients · 8 so far"). Clicking an earned Badge opens it alone in the Story viewer with its share buttons (`tracedrop-badge-{name}.png`).
  - Small fix to step 3's postcard: a long component name ("Fresh frozen plasma") shrinks to fit inside the stamp.
- **Files:** `frontend/src/pages/Impact.tsx`, `frontend/src/components/impact/BadgeShelf.tsx` (new), `frontend/src/components/impact/badges.css` (new), `frontend/src/api.ts` (`api.impactStory`), `frontend/src/components/share/shareImage.ts`.
- **Revert:** safe to revert on its own before step 5; My Impact loses the shelf and the Watch buttons.

## 2026-10-14 · Share images and share buttons on a Story's last slide

- **What and why:** step 3 of the Story and Badge build plan (spec sections 3 and 4). A component's Story now ends on its summary postcard as an image you can save or share, and the old text share is gone.
  - `shareImage.ts` draws the two "Keepsakes" images on a 1080×1920 canvas: the postcard (tilted card on the component's tint, perforated stamp, postmark, Fraunces headline, context or role, month, lifetime patients, the mark) and the Badge (felt, ribbon, gold medal with the ring glyph, name, rule, earned month, 8 pins, "n of 8 Badges"). Numbers are drawn as type; check, five-drop, vial and heart as icons. It waits for Fraunces with `document.fonts.load` and keeps the top 220px and bottom 260px free of key content. A long name or rule lifts the medal so the text never reaches the pins.
  - `ShareButtons.tsx`: Download image, Copy image, and Share… only when `navigator.canShare({ files })` is true, then the help line and the feedback notes. Copy or Share… falling over saves the image instead. Files are `tracedrop-{component}-{mon}-{year}.png` and `tracedrop-badge-{badge}.png`. The PNG is drawn as the buttons mount. No caption, no WhatsApp link, no Copy text.
  - `StoryViewer` takes an optional `last` (postcard or Badge). With it, the last slide is the image under dark top and bottom scrims with the share buttons; without it there is no share at all (Weekly report, Intro). The "Share to WhatsApp status" text share and its `wa.me` fallback are removed. It now renders through a portal to `document.body`: inside Home's chat it sat under a `.fade-in` transform, which pushed the fixed overlay (and so the share buttons) off-screen.
  - Drop's impact Card now carries `last: { postcard }` from `componentStory`, and Home's chat and the Drop feed pass it to the viewer.
  - `ShareBar.tsx` and My Impact's "Share my impact" button are removed; the Badge shelf replaces them in step 4.
  - Fraunces is loaded in `index.html` for the images.
- **Files:** `frontend/src/components/share/shareImage.ts` (new), `frontend/src/components/share/ShareButtons.tsx` (new), `frontend/src/components/drop/StoryViewer.tsx`, `frontend/src/components/drop/drop.css`, `frontend/src/components/drop/DropFeed.tsx`, `frontend/src/components/Copilot.tsx` (one prop), `frontend/src/components/impact/ShareBar.tsx` (deleted), `frontend/src/pages/Impact.tsx`, `frontend/src/api.ts` (`Postcard`, `Badge`, `StoryLast`, `badges` on the impact response), `frontend/index.html`, `backend/src/domain/drop.js` (the impact Card's `last`).
- **Revert:** safe to revert on its own before step 4 lands; the Story goes back to its text share and My Impact gets "Share my impact" back.

## 2026-10-14 · Keep the share-image prototype off the feature branch

- **What and why:** the step 1 commit brought `docs/wayfinder/story-and-badge/share-images.prototype.html` onto `feature/story-and-badge` along with the wayfinder docs. Prototypes live only on their throwaway branch, so it is removed here. It stays on `prototype/share-images` (commit 747ef00), which the spec, build plan and ticket already point to.
- **Files:** `docs/wayfinder/story-and-badge/share-images.prototype.html` (removed).
- **Revert:** safe to revert on its own.

## 2026-10-14 · Merge Badges (step 2) into the Story and Badge branch

- **What and why:** steps 1 and 2 of the Story and Badge build plan were built in parallel on `feature/story-and-badge` and `feature/story-and-badge-badges`. This merges step 2 in so steps 3 to 5 start from both. The only conflict was this change log; both entries are kept.
- **Files:** none beyond the two merged commits.
- **Revert:** `git revert -m 1 <merge commit>` takes step 2 back out.

## 2026-10-14 · Work out each Donor's Badges from their own data

- **What and why:** step 2 of the Story and Badge build plan. `badges(donorId)` returns the 8 Badges in shelf order (First patient, 5 patients, 10 patients, Regular donor, Nothing wasted, All five parts, Plasma to medicine, Helped a child), each with its ring, rule ("my"), goal, progress (only where there's a real count), whether it's earned, the month it was earned and the unit or donation that completed it. It is worked out fresh from the Donor's released journeys and completed donations on the demo clock, so the same history always gives the same Badges and nothing is stored. Earned dates leave the server as a month only. "Helped a child" uses released age bands (under 18), so it follows `impact.js`'s release rules. `GET /api/donors/:donorId/impact` now also returns `badges`. Nothing in the app shows them yet.
- **Files:** `backend/src/domain/badges.js` (new), `backend/src/routes/donors.js` (the impact handler), `backend/test/badges.test.js` (new).
- **Revert:** safe to revert on its own until the Badge shelf and Drop's Badge slides land (build steps 4 and 5).

## 2026-10-14 · Story and Badge step 1: one Story builder

- **What and why:** step 1 of `docs/wayfinder/story-and-badge/build-plan.md` (spec section 1). A component's Story is now built in one place, `backend/src/domain/story.js` (`componentStory(donorId, componentId)`), so Drop's impact Card and My Impact's coming "Watch the story" say the same thing.
  - Four slides in "you": Given, Became, Reached, Helped. Plasma that became medicines gets given → pooled → its share of albumin, IVIG and factor VIII. Expired, withheld and in-progress units get no Story (`null`).
  - Generalised fields are left out of the sentence ("a patient", "a hospital in Karnataka", "helped a patient in hospital") instead of printed, and "Some details stay private so no one can be identified." is added wherever something was held back. A released recovery adds "The hospital recorded a good recovery."
  - Proper names keep their capitals ("Bengaluru Urban", "Karnataka"); the old slides lowercased them.
  - It also returns the postcard data for step 3: component, headline, context (or the role when the context is generalised), month and lifetime patients helped.
  - New route `GET /api/donors/:donorId/impact/:componentId/story` (404 when the unit has no Story).
  - Removed the old "AI" story, which was a fixed template: `backend/src/ai/stories.js`, `POST …/impact/:componentId/story`, `api.story` and the `Story` type. My Impact's "Write my impact story" button goes with it; "Watch the story" replaces it in step 4.
  - Also commits the Story and Badge wayfinder docs (`docs/wayfinder/`) and the Story and Badge terms in `CONTEXT.md`.
- **Files:** `backend/src/domain/story.js` (new), `backend/src/domain/drop.js`, `backend/src/routes/donors.js`, `backend/src/ai/stories.js` (deleted), `backend/src/data/store.js` (drops the unused story cache), `backend/test/impact-correctness.test.js`, `backend/test/ai-correctness.test.js` (drops the old story test), `frontend/src/api.ts`, `frontend/src/pages/Impact.tsx`, `CONTEXT.md`, `docs/wayfinder/`.
- **Revert:** safe to revert on its own; the impact Card goes back to its own slides and My Impact gets "Write my impact story" back. Revert before steps 3–5 land, or with them.

## 2026-10-14 · A language switch for every donor, and no leaked tool code in Drop's replies

- **What and why:**
  - Home's language switch only appeared for donors whose own language isn't English, so Ananya, Karthik and the New donor had no visible way to change it. Now every donor gets it: English and their own language as buttons (plus whichever language is in use), and a **More** menu with the other languages. It switches straight away (it no longer waits for Drop's cards to reload), and the Intro and Drop's chat follow it. Cards and page text stay English (see the merge entry).
  - Gemini sometimes wrote its tool call as text ("tool_codeprint(default_api.get_profile())") instead of calling it. Such replies are now treated like a leaked planning note: Drop answers from the rules instead (those answers are in English).
- **Files:** `frontend/src/components/drop/DropFeed.tsx`, `frontend/src/components/drop/drop.css`, `backend/src/ai/copilot.js`.
- **Revert:** safe to revert on its own.

## 2026-10-14 · "Viewing as" at the top, with "You (new donor)" first

- **What and why:** choosing who to view is part of the demo, but the picker was hidden in the account menu. It now sits at the top of every screen as **Viewing as**, beside the yellow demo bar on Home when there's room (1440 px and up; at 1280 px the demo bar takes its own row so its buttons stay on one line). The New donor is listed first as **You (new donor)**, since it stands for the signed-in person. It is still one shared demo record (option A): two people trying the demo at once share its Intro, Choices and memories. A private per-account "you" is for after the demo, with Drop's state in Firestore. The account menu keeps Your data, Replay intro, the links and Sign out. The team guide's steps point to Viewing as.
- **Files:** `frontend/src/App.tsx`, `frontend/src/components/AccountMenu.tsx`, `frontend/src/styles.css`, `docs/drop/index.html`.
- **Revert:** safe to revert on its own; the picker goes back into the account menu.

## 2026-10-14 · Merge Uppili's fixes from main into the onboarding work

- **What and why:** `main` gained Uppili's commit `f06bbdf` ("corrected the small bugs and errors in logic and method": stricter AI checks, k-anonymity across all recipient fields, honest "demo / illustrative" labels for cover and booking, a current health score, and three new test files) while onboarding was being built. 10 files conflicted; each was resolved to keep both sides:
  - **Choices:** Uppili had also made the totals switch work. Kept his rule that others see a member on the leaderboard only when both their switches allow it, his clearer privacy note and his participation fix, plus onboarding's: you still see yourself with your leaderboard switch off ("Only you see yourself here"), the "N not counted" figure, and "prefer not to be listed" counting whoever isn't shown. Once you leave the totals you also leave your own leaderboard view (his test); the switch's second line now says so.
  - **Reset:** kept onboarding's reload of the donor records on Reset, which restores every donor's Choices (Uppili's intent) and also the New donor's language; his copy-and-restore code is dropped.
  - **Wording:** his demo labels win on Arjun's screens ("Try demo donation booking", "Demo doctor check-up", "Illustrative health cover", the Cover page header); the New donor keeps "Book my first donation" and Donate reads "Try booking your first donation (demo)". The insurer switch stays the shared Choices switch (it already says no insurer receives anything in the demo).
  - **Health:** his current score plus onboarding's empty state; Drop's line on My health shows his urgent line first, then the first-donation line.
  - **Ecosystem:** his date-aware figures (no cache), still leaving out the New donor; **cover route:** his error handling plus the demo flag; **chat:** his history filter and incomplete-reply handling plus the New donor's name, the Intro step and the planning-note check.
  - **Knock-on fixes:** Drop's Card check now only accepts AI wording identical to the rules, which would have blocked every Intro translation, so the Intro keeps its own check (every number and placeholder must survive; the Intro's words are scripted and non-clinical). The example journey shows a part as helped even when the patient's details are held back for privacy. The Intro no longer works out the whole k-anonymity picture just to name its current step. The team guide uses the new tile and button names.
- **Checks:** 102 backend tests pass (onboarding's and Uppili's three new files), type-check clean; the New donor's Intro clicked through in Hindi end to end, and Arjun's screens and Choices checked, at 1280 px.
- **Files:** `backend/src/ai/copilot.js`, `backend/src/ai/introWriter.js`, `backend/src/data/store.js`, `backend/src/domain/community.js`, `backend/src/domain/cover.js`, `backend/src/domain/intro.js`, `backend/src/domain/screenLines.js`, `backend/src/routes/donors.js`, `backend/src/routes/platform.js`, `frontend/src/components/Choices.tsx`, `frontend/src/pages/Cover.tsx`, `frontend/src/pages/Donate.tsx`, `frontend/src/pages/Health.tsx`, `frontend/src/pages/Home.tsx`, `docs/drop/index.html`.
- **Revert:** `git revert -m 1 <merge commit>` takes the branch back to onboarding without Uppili's commit; prefer fixing forward.

## 2026-10-14 · Onboarding step 8: mock privacy policy and terms, and the team guide

- **What and why:**
  - `frontend/src/Legal.tsx`: a mock privacy policy and terms, clearly marked as a demo ("has not had a legal review"), that say the same as the Intro and Your data: what is kept where and for how long (Google account in Firestore; your own Google Calendar and Gmail; the shared demo donor in server memory; Gemini up to 24 hours, up to 90 days if flagged; server logs 30 days; this browser and a 1-day cookie), the three Choices, shared demo donors, lab report photos not kept, how to delete (Your data, Delete my account, what deletes itself, what you delete yourself), and "email us" for a copy. It no longer claims everything runs in India: only the app server's region is stated, and it makes no promise about where the database or the AI keep or process data. The terms explain shared demo donors and that no blood centre, clinic or insurer receives anything.
  - `docs/drop/index.html` (team guide): a section on the New donor's Intro (the 8 steps and the tile each lights up, questions, Skip, coming back, Replay), Choices and Your data; seven new test scripts (the Intro start to finish; Skip, Welcome back, Replay and Reset; languages; Choices as Arjun; empty states; Your data deletes and Undo; Delete my account, including the live-site check with a spare Google account) and an AI-off step for the Intro. Brought up to date where Sandeep's Home changes made it stale: the donor switcher is in the account menu, impact and weekly stories are chips above Home's chat, Home's chat is inline (no panel to open or close), the demo bar is on Home only, booking runs in the chat, the snooze test uses the Results card, and the run command checks out `main`.
- **Files:** `frontend/src/Legal.tsx`, `frontend/src/styles.css`, `docs/drop/index.html`.
- **Revert:** safe to revert on its own.

## 2026-10-14 · Onboarding step 7: "Your data" and Delete my account

- **What and why:** a real "Your data" screen (account menu → Your data, `#data`), rewritten from the prototype's variant A, so a person can see what Pratidaan keeps, where, for how long, and delete it.
  - **The page:** three short facts; the three Choices first (the same switches as everywhere else); then one card per place: with your Google account (profile, sign-in history, donation preferences, each booking), in your own Google account (Calendar events, Gmail confirmations, Pratidaan's access, with links), the demo donor you're viewing (Choices, Drop's memories, readings you added, values read from lab reports, and their records from the blood centre), Gemini (up to 24 hours, up to 90 days only if flagged), server logs (30 days) and this browser. Each row says what it is, how long it's kept, and has a button or a status. Empty groups say so; for the New donor the demo donor group is empty apart from Choices. With sign-in off, the Google rows say nothing is kept.
  - **Single deletes:** memories and readings use today's endpoints; new deletes for values read from lab reports (`DELETE /api/donors/:id/labs/:observationId`, never the blood centre's results), sign-in history (`DELETE /api/auth/signins`), donation preferences (`DELETE /api/auth/preferences`) and a booking (`DELETE /api/auth/bookings/:id`, upcoming ones cancelled first, asking for Calendar access when it has an event); "Clear" for this browser's saved data. The row disappears at once and the delete is sent when the 6-second Undo toast closes (or straight away if you delete something else or leave the page).
  - **Delete my account:** what goes straight away, what deletes itself later and what you delete yourself; "Also remove my Google Calendar events" (ticked) asks for Calendar access once; confirmed by typing DELETE in any case; Esc or "Keep my account" closes it. `DELETE /api/auth/account` deletes the user record (profile and donation preferences), every sign-in record and every booking (cancelling upcoming ones first) and clears the cookie; locally it clears the in-memory copies. The page clears the browser's saved data and shows "Your account is deleted", then back to sign in. A Calendar event that can't be removed doesn't stop the deletion; the page says how many are left.
  - `GET /api/auth/data` reads the account's profile, sign-in history (count, first sign-in, last browser) and every booking. The Intro's data step gets "Open Your data".
- **Files:** `backend/src/auth/accountData.js` (new), `backend/src/auth/userSettings.js`, `backend/src/routes/auth.js`, `backend/src/routes/donors.js`, `backend/src/domain/intro.js`, `backend/test/yourdata.test.js` (new), `frontend/src/pages/YourData.tsx` and `YourData.css` (new), `frontend/src/App.tsx`, `frontend/src/components/AccountMenu.tsx`, `frontend/src/components/intro/Intro.tsx`, `frontend/src/api.ts`.
- **Revert:** safe to revert on its own; the Firestore deletes go with it. Only the live site can show the Firestore deletes working (sign in with a spare Google account).

## 2026-10-14 · Onboarding step 6: Choices that work

- **What and why:** the three Choices now do what they say, everywhere.
  - **Count me in my Circles' totals** was read nowhere. Now a member with it off is left out of every Circle total (donations, patients helped, causes helped, blood group mix, participation), and the Community page says "N members not counted (their choice)"; Home's "Your circles" tile uses the same totals and shows "N not counted" (`backend/src/domain/community.js`).
  - **Leaderboard:** with their own switch off, the donor still sees themself, marked "Only you see yourself here"; others don't see them, and the "prefer not to be listed" count no longer counts the viewer. The switch's second line reads "Your first name, donations and patients helped".
  - **Insurer:** the switch's second line shows its live effect, e.g. "On: your cover can rise with your score (next step ₹6 lakh at 80). Off: it stays at ₹5 lakh", "On: your cover is ₹8 lakh…" or "…rises to ₹7 lakh after one more monitored visit this year", plus "In this demo no insurer receives anything". Turning it off drops cover back at once. For the New donor, with no insurer yet, it says what it will do once one is linked.
  - The Community page gets the leaderboard and totals switches (also when you're not in a Circle yet). Cover, Community, the Intro and "Your data" all change the same saved Choices through one switch component (`frontend/src/components/Choices.tsx`); a change refreshes every screen. A small `GET /api/donors/:id/consent` reads them.
  - Demo Reset puts every Persona's Choices back to where they started (the donor reload from step 3), now tested.
- **Files:** `backend/src/domain/community.js`, `backend/src/domain/cover.js`, `backend/src/routes/donors.js`, `backend/test/choices.test.js` (new), `backend/test/domain.test.js` (a leaderboard row may carry the `onlyYou` flag), `frontend/src/components/Choices.tsx` (new), `frontend/src/pages/Cover.tsx`, `frontend/src/pages/Community.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/styles.css`.
- **Revert:** safe to revert on its own; the totals switch goes back to doing nothing.

## 2026-10-14 · Onboarding step 5: the Intro in the chosen language

- **What and why:** step 1 sets the language, and the rest of the Intro appears in it.
  - `backend/src/ai/introWriter.js` (new): for a language other than English, Gemini translates each step's words and buttons, and the Intro's own words (bar, Skip, coming back, the folded line), the first time they are shown, once per language. A translation is used only if every number and every `{placeholder}` survives, the same check as Drop's Cards; otherwise that text stays in English and a quiet note says so ("Shown in English: a translation isn't available right now"). With the AI off, the Intro is in English with that note. The pictures stay in English. Outside English the progress reads "3/8" (the AI sometimes swapped the numbers in "3 of 8").
  - Asking Drop to switch language mid-Intro works: a new `set_language` tool for the AI, and a rule answer ("talk to me in Hindi", "English please") when it is off. Home's language switch (English plus the donor's chosen language) also changes it mid-Intro, and the Intro carries on in the new language; the chat waits for the translated Intro before it stops "thinking".
  - If the AI's reply opens with its own planning ("The user wants…"), Drop answers from the rules instead, or asks to be asked again; answers in the Intro thread are formatted like the rest of the chat.
- **Files:** `backend/src/ai/introWriter.js` (new), `backend/src/routes/intro.js`, `backend/src/ai/tools.js`, `backend/src/ai/agent.js`, `backend/src/ai/copilot.js`, `backend/test/intro.test.js`, `frontend/src/components/intro/Intro.tsx`, `frontend/src/components/Copilot.tsx`, `frontend/src/components/drop/DropFeed.tsx`, `frontend/src/api.ts`, `frontend/src/ui.tsx`.
- **Revert:** safe to revert on its own; the Intro is then English only.

## 2026-10-14 · Onboarding step 4: the Intro on Home, with the tile highlight

- **What and why:** the New donor now meets Drop through the Intro in Home's chat.
  - `frontend/src/components/intro/` (new): the thread and the step pictures (an example journey and an example results card, both labelled "Example"; what is kept and where; the three Choices; when donating suits you; a summary), rewritten from the prototype's variant D.
  - In Home's chat (`Copilot.tsx`, inline only): while the Intro is new or running, the chat shows the Intro thread instead of the normal conversation and hides the suggestion buttons. Drop's Cards and the stat tiles stay. A bar at the top: "Getting started", progress, "3 of 8" and **Skip intro** (Drop asks to confirm). Buttons sit under the latest message only. Typed questions go to the AI and appear in the thread, followed by "Carry on: {step}" and "Skip intro"; with the AI off they get a rule answer that names the step.
  - A new visit (reload or sign-in) folds the finished steps into "Done so far…" and Drop says "Welcome back, we stopped at…"; other screens in the same visit keep the thread.
  - Finished or skipped, the thread folds into one line at the top of the chat, "Intro · finished 10 Oct · Replay" (the demo date), with the questions asked during it; the normal suggestions return. "Book my first donation" opens today's booking steps in the chat. Booking asked for from Home's button while the Intro is still running opens the Donate screen.
  - The account menu gets **Replay intro**, only when viewing the New donor. Replaying highlights the language chosen before; skipping a replay changes nothing (the first run's questions come back too).
  - The full-page "When can you donate?" setup (and `BookingChat.tsx`, which only it used) is removed from `AuthGate.tsx`, with the `tracedrop.localSetupDone` browser flag; the Intro's step 7 replaces it. Booking itself is unchanged.
  - **Tile highlight** (`Home.tsx`): the tile Drop is talking about gets a purple ring and moves to the top of the column (journey: "Your blood has helped"; health: "Health score" and "Doctor check-up"; Choices: "Health insurance cover"; when to donate: "Next donation"). On the data step the account chip pulses instead; with motion turned off it is a still ring.
- **Files:** `frontend/src/components/intro/Intro.tsx`, `pictures.tsx`, `intro.css` (new), `frontend/src/components/Copilot.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/components/AccountMenu.tsx`, `frontend/src/App.tsx`, `frontend/src/AuthGate.tsx`, `frontend/src/BookingChat.tsx` (deleted), `frontend/src/styles.css` (its style), `frontend/src/api.ts`, `backend/src/domain/intro.js` and `backend/src/routes/intro.js` (the Intro's own words for the bar, Skip and coming back, so they can be translated with the steps), `backend/test/intro.test.js`.
- **Revert:** reverting this brings back the setup screen and leaves the Intro engine unused; nothing else depends on it until "Your data".

## 2026-10-14 · Onboarding step 3: the Intro engine (server, no screens)

- **What and why:** Drop's Intro for a new user, as rules and data on the server, so the screens in the next commit only show it.
  - `backend/src/domain/intro.js` keeps, per demo donor in server memory, the Intro's `status` (new, running, done, skipped), `step` (1–8), `finishedOn` (the demo date) and the questions asked during it. Only the New donor starts as new; every other Persona is done and can't replay it. Demo Reset puts it back.
  - The 8 steps as data: Drop's English words, which picture, and the buttons. Language; what Pratidaan is; your blood's journey, shown with a labelled example built from the demo's 3 Oct donation as it stands on the demo clock (no name), with a story to watch; health between donations, with an example results card from the same donation; your data; your Choices; when you can donate; all set, with "Book my first donation" and "Start using Pratidaan".
  - Answers land where they belong: the language becomes Drop's language and the donor's own (so Home's switch offers English plus it); the Choices become the donor's Choices; "when can you donate" (days, time of day, place) is saved with the signed-in Google account through the same preferences store booking reads, as the old setup screen did. Skip keeps the defaults (insurer off). Replay starts at step 1 with what was chosen before filled in and saves only what changes; skipping a replay changes nothing.
  - Demo Reset now also reloads the donor records, so the New donor's language and every Persona's Choices go back to where they started.
  - Routes under `/api/donors/:id/intro`: read, answer a step, skip, replay, finish. Drop's view includes the Intro's status. Drop's chat is told which step the person is on, so "what's this?" mid-Intro gets a sensible answer; with the AI off the rule answer names the step. Questions asked during the Intro are kept with it.
- **Files:** `backend/src/domain/intro.js` (new), `backend/src/routes/intro.js` (new), `backend/src/server.js` (one line mounting it), `backend/src/data/store.js`, `backend/src/domain/drop.js`, `backend/src/ai/copilot.js`, `backend/src/routes/donors.js`, `backend/test/intro.test.js` (new).
- **Revert:** safe to revert on its own (no screen uses it yet).

## 2026-10-14 · Onboarding step 2: empty states for a donor with no records

- **What and why:** the New donor has no donations, results, blood group, Circles or insurer, and several screens failed or read oddly for them.
  - **Server:** every donor API (overview, health, impact, who benefited, cover and its what-if, community, slots and eligibility, Drop and Drop's line on each screen) now answers normally. Cover for a donor with no insurer says so (`linked: false`; the overview's `cover` is `null`); BMI is `null` without a height; Drop's line on each screen says what their first donation will bring instead of "All 0 of your results are in range". Drop sends no monthly report to someone who has never donated. The chat knows the New donor is the signed-in person (it uses their Google first name, or no name with sign-in off) and never calls them "New"; without the AI, questions about results or BP get "no results yet", and "What happens at a donation?" gets a plain answer.
  - **Home:** greets the New donor by the signed-in person's Google first name ("Hello" with sign-in off); the line under it says "No donations yet" and the countdown "You can book your first donation"; the button reads "Book my first donation". Tiles: "Your blood has helped: your first donation will show here", "Health score: after your first donation", "Doctor check-up: none booked", "Health insurance cover: no cover linked yet", "Next donation: book your first donation", and no "Your circles" tile. The chat's suggestions for a first-time donor are about the first donation. Home is now keyed by donor, so switching donors never shows one donor's numbers under another's name while loading.
  - **Other screens:** My impact, My health (check-ups stay), Health cover and Community ("You're not in a Circle yet") each show one short message instead of empty charts or errors; Donate's booking section reads "Book your first donation".
- **Files:** `backend/src/domain/cover.js`, `backend/src/domain/impact.js`, `backend/src/domain/screenLines.js`, `backend/src/domain/drop.js`, `backend/src/routes/donors.js`, `backend/src/ai/copilot.js`, `backend/src/ai/agent.js`, `backend/src/ai/dropWriter.js`, `backend/src/ai/insights.js`, `backend/src/ai/carePlan.js`, `backend/test/emptystates.test.js` (new), `backend/test/newdonor.test.js`, `frontend/src/api.ts`, `frontend/src/App.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/components/Copilot.tsx`, `frontend/src/pages/Impact.tsx`, `frontend/src/pages/Health.tsx`, `frontend/src/pages/Cover.tsx`, `frontend/src/pages/Community.tsx`, `frontend/src/pages/Donate.tsx`.
- **Revert:** safe to revert on its own; the New donor's screens then fail again.

## 2026-10-14 · Onboarding step 1: glossary, two fixes, and the New donor

- **What and why:**
  - `CONTEXT.md` gets the onboarding vocabulary: **Intro**, **Choices** and **Circle**, and the **Persona** entry now says choosing one means using the app as that Donor, with the New donor as a new user who starts with the Intro.
  - **Sign-in wiped saved preferences:** every Google sign-in rewrote the user record in Firestore without merging, so saved donation preferences disappeared. It now merges. This matters more now that the Intro saves donation preferences with the account.
  - **Demo Reset left old chat behind:** Drop's Card ids restarted at 1 after a Reset, so the chat could show a new Card under an old one's id. Ids now never repeat (they also carry a per-server-start stamp). The demo bar announces a Reset (also when it sees the demo clock go backwards because someone else reset it), and the chat clears its saved conversation and its list of Cards it showed; the Card list on Home drops its old Cards straight away.
  - **The New donor:** the demo overlay loader accepts donors, so `data/demo/overlay.json` adds one without touching the synthetic data: a new id (`D-NEW`) and no records at all (no donations, results, blood group, Circles, insurer or Plan; Choices at their defaults: insurer off, leaderboard on, totals on; English). `data/demo/drop-seed.json` gives Drop an empty start for them. Drop no longer sends "Get ready to donate" to someone who has never donated (they book their first donation from Home or the Intro). The New donor is kept out of the Ecosystem view's network figures, which stay about the 300 synthetic donors.
  - The donor picker lists **New donor** first, and a first visit (nothing saved in the browser) opens on them. Their screens are fixed in the next commit; until then Home shows an error for them, and the server stays up.
- **Files:** `CONTEXT.md`, `backend/src/auth/accessLog.js`, `backend/src/domain/drop.js`, `backend/src/data/store.js`, `backend/src/routes/donors.js`, `backend/src/routes/platform.js`, `backend/test/newdonor.test.js` (new), `backend/test/domain.test.js` (the cover test covers donors with an insurer), `data/demo/overlay.json`, `data/demo/drop-seed.json`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/components/DemoBar.tsx`, `frontend/src/components/Copilot.tsx`, `frontend/src/components/drop/DropFeed.tsx`.
- **Revert:** safe to revert on its own, but the onboarding commits after it need the New donor.

## 2026-10-13 · Change or cancel bookings any time; Home uses the full width on ultra-wide screens

- **What and why:**
  - Tapping "Book a free check-up" used to leave a "Booking a free check-up…" receipt on Home that never went away. Answers that open a follow-up Card (book a check-up, book a donation after a goal, rebook a missed visit) no longer leave a receipt; the follow-up Card is the response, and a line goes into "Earlier this cycle".
  - Undo only lasts until time moves on, so there was no way to change a booking later. Booked check-ups and donations now show under "Coming up" on Home with Change (removes it and offers new slots) and Cancel. A cancelled visit gets no "How did it go?" check-in; a cancelled donation is removed from appointments.
  - On ultra-wide screens Home left a large empty area. The cards and stats now share the width in proportion; on very wide screens the cards stop at a readable width and the stat tiles spread into columns.
  - "Your week, in 1 taps" now reads "1 tap".
- **Files:** `backend/src/domain/drop.js`, `backend/src/routes/drop.js`, `backend/test/drop.test.js`, `frontend/src/api.ts`, `frontend/src/components/drop/DropFeed.tsx`, `frontend/src/components/drop/drop.css`, `frontend/src/pages/Home.tsx`, `docs/drop/index.html` (test script and rules updated).
- **Revert:** safe to revert on its own.

## 2026-10-13 · Fix empty Drop answers, a wrong donation date, and Home on wide and medium windows

- **What and why:**
  - "Explain my latest results" sometimes got "Done." because Gemini looked up the results and then returned no words. Drop now asks once more for the answer and, if it is still empty, answers from the rules. Gemini 2.5 Flash-Lite also sometimes sends a malformed tool call (`MALFORMED_FUNCTION_CALL`), which used to fall back to the offline answer; it is now retried once.
  - "When can I donate next?" could get an invented past date. The profile tool now gives Drop the same plain sentence the Donate screen uses.
  - Home on wide windows left a large empty gap between the cards and the stats; on medium windows the stats dropped below the cards. The cards and stats now grow together side by side from about 1,000 px wide, Home is capped at 1,360 px, and Drop's header row wraps instead of squeezing the language switch.
- **Files:** `backend/src/ai/agent.js`, `backend/src/ai/copilot.js`, `backend/src/ai/tools.js`, `frontend/src/components/drop/drop.css`, `frontend/src/pages/Home.tsx`.
- **Revert:** safe to revert on its own.

## 2026-10-13 · Ship the demo data in the Docker image

- **What and why:** the live site was missing Arjun's 3 Oct donation and every demo donor's starting Drop state, because the Dockerfile only copied `data/synthetic` and `data/ontology`. It now also copies `data/demo`.
- **Files:** `Dockerfile`.
- **Revert:** don't; without it the live demo has no results card for Arjun.

## 2026-10-13 · Add the team guide to Drop, and refuse medicine names as memories

- **What and why:** `docs/drop/index.html` is a self-contained page (open it in a browser, no build) for the team: why Drop exists, the six demo donors, how Drop decides with a diagram, the rules, card types, where the AI comes in, how to run it locally, the demo controls, what isn't built yet, where the code is, and ten test scripts with expected results, tick boxes saved in the browser, and a "Copy my results" button for the team chat. `docs/drop/README.md` points to it, since GitHub shows HTML as source. Drop's memory guard now also refuses medicine names and doses (e.g. "metformin 500 mg"), which belong in the Plan.
- **Files:** `docs/drop/index.html` (new), `docs/drop/README.md` (new), `backend/src/ai/tools.js`, `backend/test/drop.test.js`.
- **Revert:** safe to revert on its own.

## 2026-10-13 · Add the "What Drop knows" panel

- **What and why:** a "What Drop knows" button on the demo bar opens a side panel with the Drop engine's real state for the Donor being viewed: the demo date and quiet hours, the message budget used today and this week, which Cards are on Home and whether they counted against the budget, what is waiting and why, what is snoozed, hidden or folded, what is coming up, a log of what just happened, the Plan, memories and readings, and how many open Cards the AI worded. It explains why a Card appeared, waited or folded away. Demo mode only; Esc closes it.
- **Files:** `frontend/src/components/drop/DropKnows.tsx` (new), `frontend/src/components/DemoBar.tsx`, `frontend/src/components/drop/drop.css`.
- **Revert:** safe to revert on its own.

## 2026-10-13 · Fixes from the full click-through

- **What and why:** problems found by clicking through every Drop flow at desktop width.
  - AI wording now applies only while it matches exactly what the rules say. Before, after "Weekday evenings instead" the slots Card kept the AI's Saturday labels while its buttons booked evening slots.
  - "Next event" moves to the next Card for the Donor being viewed and skips routine Reminders (Meera's daily reminder used to stop it every day).
  - Pressing Enter in the BP number boxes saves the reading.
  - After a goal is reached, the next check-in moves to a month later instead of staying in the past.
  - The demo bar keeps its date in step with the server (it showed a stale date after a backend restart).
  - Locally, the "When can you donate?" question is remembered in the browser once answered or skipped; the backend only keeps it in memory, so it came back after every restart.
  - Drop's chat replies are held to two short sentences.
- **Files:** `backend/src/domain/drop.js`, `backend/src/ai/dropWriter.js`, `backend/src/ai/copilot.js`, `backend/src/routes/demo.js`, `backend/test/drop.test.js`, `frontend/src/components/drop/DropCardView.tsx`, `frontend/src/components/drop/DropFeed.tsx`, `frontend/src/components/DemoBar.tsx`, `frontend/src/App.tsx` (passes the donor to the demo bar), `frontend/src/AuthGate.tsx` (local-only memory of the preferences answer), `frontend/src/api.ts`.
- **Revert:** safe to revert on its own; the bugs above come back.

## 2026-10-13 · Give Drop its voice and put it on every screen

- **What and why:** finishes groups 1 and 2 of the local build.
  - **AI wording:** Gemini rewrites the sentence and button labels of up to 3 open Cards in the Donor's language whenever the conversation is read (`backend/src/ai/dropWriter.js`). A Card keeps its rule wording if the AI is unavailable or drops any number. A language switch next to Drop on Home (English / the Donor's own language) rewrites open Cards; Rohan defaults to Hindi.
  - **Drop's chat panel:** the old chat panel becomes Drop (`frontend/src/components/Copilot.tsx`). Replies are one or two sentences plus at most one Card. New tools: `show_chart` (BP including readings the Donor added, Hb, labs), `offer_care_slots` and `offer_reminder` (real Drop Cards, also shown on Home, outside the budget), `remember` (preferences only; health facts, religion, caste, income are refused) with a "Remembered: … · Undo" line, and `log_reading`. Drop reads its memory and the Plan on every turn. When Gemini ends with no text after a tool call, the reply says what was done instead of failing. Without AI, common questions (results, BP, impact, donating, cover, check-up, memory) get rule-based answers. Card chips such as "Explain my results" now open the panel and ask.
  - **Drop's line on each screen:** Health, Impact, Donate, Cover and Community open with one true sentence from fixed rules (`backend/src/domain/screenLines.js`); tapping it opens Drop with 2–3 questions for that screen; × hides it on that screen for the rest of the demo day.
  - **Health shows what Drop keeps:** "Your Plan" (goals, weekly activity, reminders, notes, next check-in); "Readings and results" with the readings the Donor added (Delete) and the blood centre's latest results ("Hide from my app", which only hides them from the list and never changes eligibility). BP readings the Donor added appear on the BP trend chart. The AI care-plan card is renamed "Detailed analysis" so there is one Plan.
- **Files:** `backend/src/ai/dropWriter.js` (new), `backend/src/domain/screenLines.js` (new), `backend/src/ai/copilot.js`, `backend/src/ai/agent.js`, `backend/src/ai/tools.js`, `backend/src/domain/drop.js`, `backend/src/routes/drop.js`, `backend/src/routes/donors.js` (copilot fallback gets the donor; lab results carry their id), `backend/test/drop.test.js`, `frontend/src/components/Copilot.tsx`, `frontend/src/components/drop/` (`DropLine.tsx`, `HealthDrop.tsx` new; `DropFeed.tsx`, `drop.css`), `frontend/src/pages/` (`Health.tsx`, and one `DropLine` line plus its import in `Impact.tsx`, `Donate.tsx`, `Cover.tsx`, `Community.tsx`), `frontend/src/api.ts`, `frontend/src/ui.tsx`.
- **Revert:** reverting this returns Drop to rule wording and the old chat panel; Home's Cards keep working.

## 2026-10-13 · Make Home Drop-first: Cards, demo bar, Stories and lab report upload

- **What and why:** Home now leads with Drop's open Cards (urgent first, at most 3 before "N more"), each with one sentence, an optional form, one main button and one way out, plus a ⋯ menu to snooze (1 hour / tonight 7 pm / tomorrow / next week) or hide. Answers turn into a one-line receipt with Undo and fold into "Earlier this cycle". Numbers are typed into plain boxes on desktop; scroll wheels appear only on touch screens (swipe-left also only on touch). The numbers (impact, health score, cover, next donation, circles) move to a quiet right-hand column, and the donation countdown sits in the header. New: a tap-through Story viewer (arrow keys, Esc, share via the share sheet or a WhatsApp link), the "What Drop remembers" list, an "Add a lab report" dialog (a photo the AI reads, or the demo's synthetic sample, confirmed before saving), and a demo bar above every screen (+ few hours, +1 day, +1 week, Next event, Reset, and an ⓘ note saying it is demo-only). The old "For you today" and "Try the AI" tiles are replaced by Drop's Cards. Drop's wording keeps marker names like HbA1c intact.
- **Files:** `frontend/src/pages/Home.tsx`, `frontend/src/App.tsx` (two lines: import and mount the demo bar), `frontend/src/components/DemoBar.tsx` (new), `frontend/src/components/drop/` (new: `DropFeed.tsx`, `DropCardView.tsx`, `ScrollWheel.tsx`, `StoryViewer.tsx`, `ReportUpload.tsx`, `MemorySheet.tsx`, `drop.css`), `backend/src/domain/drop.js`.
- **Revert:** reverting this restores the previous Home; the Drop API keeps working underneath.

## 2026-10-13 · Add the Drop API and the demo "next event" jump

- **What and why:** routes under `/api/donors/:donorId/drop` let the app read a Donor's Drop state (open Cards with their wording and forms, receipts, Earlier this cycle, memory, Plan, readings, budget, what's waiting and why) and act on it: answer, snooze, hide, undo, reopen, forget memories, undo a memory, delete an added reading, hide a blood-centre result. Rule violations (e.g. hiding an urgent Card) return 400 with the reason. `POST /api/demo/next` jumps the clock to the next moment any demo Donor gets a new Card. `frontend/src/api.ts` gets the matching types and calls.
- **Files:** `backend/src/routes/drop.js` (new), `backend/src/server.js` (one line mounting it), `backend/src/routes/demo.js`, `backend/src/domain/drop.js`, `frontend/src/api.ts`.
- **Revert:** safe to revert on its own; the UI commits that follow use these routes.

## 2026-10-13 · Add the Drop engine: Events to Cards under the message budget

- **What and why:** `backend/src/domain/drop.js` decides which Cards each Donor sees and when, using the rules agreed in the redesign: at most 1 new Card a day; Donors with a goal get 2 a week plus a Weekly report on Sunday afternoon, healthy Donors 1 a week plus a monthly report; priority urgent > results > donating > check-ins and Plan > goal reached > impact; quiet hours from 9 pm (only urgent Cards and the Donor's own Reminders); Cards that follow up on something the Donor did skip the budget; snooze (1 hour / tonight 7 pm / tomorrow / next week), urgent Cards only an hour and never hidden; 3 snoozes or 7 days unanswered fold into the next report; only the first unit per donation gets an Impact Card; skipped Reminders become "no answer"; memory with replace and undo; undo of an answer, including results or bookings it added. State is in memory, seeded from `data/demo/drop-seed.json`, and resets with the demo clock (Firestore is pending after the demo). The demo day now has four parts (8 am, 2 pm, 7 pm, 9 pm) so "Tonight" (7 pm) and quiet hours both work. Haemoglobin findings now use the newest Hb, including an uploaded lab report, so Meera's report can clear her deferral.
- **Files:** `backend/src/domain/drop.js` (new), `backend/test/drop.test.js` (new, the prototype's walkthroughs as tests), `backend/src/domain/health.js`, `backend/src/data/store.js`, `backend/src/routes/demo.js`.
- **Revert:** revert this and the later Drop API / UI commits together; on its own it only changes the Hb rule and the four-part day.

## 2026-10-13 · Add demo data: Arjun's 3 Oct donation, Drop's starting state, Meera's sample report

- **What and why:** the demo story needs Arjun to have donated on 3 Oct with BP 148/94 (trend 132 → 136 → 148), with his platelets used on 8 Oct and his red cells on 15 Oct. This lives in `data/demo/overlay.json`, applied on top of the synthetic data at load time so regenerating synthetic data doesn't remove it. Lab results can carry an `availableOn` date and stay hidden until the demo clock reaches it (Arjun's arrive on 11 Oct). `data/demo/drop-seed.json` holds each demo Persona's starting state for Drop (open Cards, earlier Cards, Plan, memories, Reminders, language). `frontend/public/demo/sample-lab-report-meera.png` is a clearly-labelled synthetic report (Hb 12.6) for Meera's comeback.
- **Files:** `data/demo/overlay.json` (new), `data/demo/drop-seed.json` (new), `frontend/public/demo/sample-lab-report-meera.png` (new), `backend/src/data/store.js`, `backend/test/domain.test.js` (the "rising BP before hypertension" check moves to Karthik, since Arjun is now stage 1 by design; a new check covers Arjun).
- **Revert:** safe to revert on its own; Arjun goes back to his June donation and the Drop seed is unused until the engine lands.

## 2026-10-13 · Add a demo clock that can move forward and reset

- **What and why:** the fixed simulation date (`store.TODAY`) becomes a demo clock (`store.today()`, with morning / afternoon / night) so the jump-ahead bar can show Drop over days and weeks. New `/api/demo` routes read, advance and reset it (on by default since all data is synthetic; `DEMO_MODE=false` turns them off). Reset also reloads donations, results and components and clears demo-session data. Impact journeys now only show steps that have happened by the demo date, so a unit used "next week" isn't shown as used today.
- **Files:** `backend/src/data/store.js`, `backend/src/routes/demo.js` (new), `backend/src/server.js` (one line mounting `/api/demo`), `backend/src/domain/impact.js`, and `store.TODAY` → `store.today()` in `ai/copilot.js`, `ai/tools.js`, `ai/carePlan.js`, `ai/labReader.js`, `domain/cover.js`, `domain/health.js`, `domain/donation.js`, `domain/community.js`, `routes/platform.js`, `routes/donors.js`.
- **Revert:** safe to revert on its own until the Drop engine lands (later commits listen to the clock).

## 2026-10-13 · Start the Drop-first redesign: glossary and change log

- **What and why:** adds `CONTEXT.md`, the shared vocabulary for the redesign (Donor, Persona, Drop, Plan, Card, Cycle, Event, Message budget, Check-in, Reminder, Weekly report, Story), and this change log.
- **Files:** `CONTEXT.md`, `docs/changes/mihir-bhatt.md`.
- **Revert:** safe to revert on its own; nothing depends on it at runtime.
