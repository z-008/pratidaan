# Pratidaan: what the app does

This describes the app as built on `main` (16 Oct 2026, commit `c547232`), screen by screen. How it is built is in [03-architecture.md](03-architecture.md). The words in **bold capitals** (Donor, Drop, Card, Goal, Story, Badge, Circle, Choices…) are defined in [CONTEXT.md](../CONTEXT.md).

## The idea in one paragraph

A blood donation is split into parts that help different patients. Pratidaan follows each part and tells the donor when it reaches someone, so the gift has a face without breaking anyone's privacy. The same visit includes a free health check. Pratidaan's assistant, **Drop**, turns those results into a light follow-up between donations: one target per problem, a few concrete steps, a check-in every two weeks, and a clear date for when they can give again. A donor who stays healthy can see modelled health cover rise at the same premium. Each of these gives the donor a reason to return, and the blood supply depends on donors who return.

## Real, simulated and illustrative

| Part | Status in the prototype |
|---|---|
| Donors, donations, lab results, components, patients, Circles, insurers | **Synthetic** (`data/generate.py`, seed 42). No real person or organisation. |
| Google sign-in, sign-in history, saved booking preferences, bookings | **Real**, stored in Firestore against the Google account. A guest or local session keeps them only in server memory. |
| Google Calendar event and Gmail confirmation for a booking | **Real**, in the donor's own Google account, only if they connect Calendar. The event and email say it is a demo slot, not a reservation. |
| Blood-centre slots, doctor check-ups, check-in at the centre, the QR pass | **Simulated.** No centre or clinic is contacted or reserved. |
| Health-insurance cover, premiums, discounts | **Illustrative model.** No insurer receives anything. |
| Concerns about a unit and their escalation | **Simulated walkthrough.** No organisation is contacted. |
| Activity minutes in the weekly report | **Simulated** (no wearable data). |
| Gemini answers, lab-report reading, Intro translation | **Real** calls to Vertex AI when configured; rule-based answers otherwise. |

## Who the demo lets you be

**Viewing as** (top of every screen) picks the Persona. The first entry, **You (new donor)**, stands for the signed-in person: a new user with no records. It is one shared demo record, so two people trying the demo at once share its Intro, Choices and memories. The other six are synthetic donors.

| Persona | Starting state (Sat 10 Oct 2026, 8 am) |
|---|---|
| You (new donor) | No donations, results, Circles or insurer. Drop's Intro starts in Home's chat. |
| Arjun Rao, 34, B+ | Donated 3 Oct. His platelets reached a patient on 8 Oct (Story waiting). Results arrive on 11 Oct: BP 148/94, rising over four donations (126 → 132 → 136 → 148), HbA1c 5.7%. Donation on hold for BP. Cover ₹5 lakh, 5 points from ₹6 lakh. 6 of 8 Badges. Circles: Nimbus Technologies, Rao family, Sunday Cyclists. |
| Meera Iyer, 28, O+ | Turned away twice for low haemoglobin (11.8; she needs 12.5) with ferritin 8. Three months into a walking plan, with a daily 2 pm reminder. An Hb Check-in is open. |
| Ananya Sharma, 31, O− | All results healthy. Eligible today, and O− is short at her centre, so Drop offers donation slots. Cover at the top step (₹8 lakh). All 8 Badges. Monthly report only. |
| Vikram Gowda, 42, A+ | Turned away on 3 Oct with BP 184/118, plus prediabetes and high cholesterol. Urgent Card. Smoker. |
| Karthik Menon, 38, B+ | HbA1c 6.1% (prediabetes), BP above ideal. Can donate from 3 Nov. No Cards today. |
| Rohan Verma, 30, AB+ | Hindi. Healthy and eligible today. One unit from his June donation was withheld for safety; the app shows no reason and says the counsellor will contact him. |

The **demo bar** (yellow, on Home) moves a shared demo clock: **+ few hours** (8 am → 2 pm → 7 pm → 9 pm), **+1 day**, **+1 week**, **Next event** (until the viewed donor gets a new Card), and **Reset** (everything back to 10 Oct, including Choices, language, Intro and chat). **What Drop knows** opens the engine's live state: budget used, why a Card was sent or held, what is snoozed, folded or coming, and a log. Real donors would never see either.

## Signing in

- **Continue with Google** (verified Google accounts only), or **Continue as guest** (demo data only; nothing is kept in Google or the cloud).
- A session lasts one day and is not renewed by use. The API refuses every request without one.
- Public **Privacy Policy** (`/privacy`) and **Terms** (`/terms`) pages, marked as mock documents, say the same as the Intro and Your data.
- For local work, sign-in can be switched off (`AUTH_DISABLED=true`, ignored in production).

## Home

Home is Drop first.

- **Header:** a greeting (the Google first name for the New donor), blood group and district, the donation countdown, and one button: **Book my first donation**, **Try demo donation booking** or **Donation status**.
- **Drop's conversation** (main column):
  - open **Cards**, urgent first, at most three before "N more";
  - a receipt with **Undo** for the last answer;
  - **Coming up** (booked check-ups and donations, each with Change and Cancel);
  - **Earlier this cycle**;
  - a **language switch**: English and the donor's own language as buttons, the rest under More;
  - Stories waiting to be watched, as chips above the chat ("Watch my impact story", "Watch my week");
  - **Drop's chat**: the General Chat, inline, with suggested questions.
- **Tiles** (right column): Your blood has helped, Health score, Demo doctor check-up, Illustrative health cover, Next donation, Your badges (four, with progress rings, linking to the full shelf), Your circles.
- A donor with no records sees plain empty tiles that point to their first donation.

## Drop

### Cards: what Drop says on its own

Fixed rules turn **Events** (facts about the donor) into **Cards**. The same history always gives the same Cards.

| Card | Sent when | What the donor can do |
|---|---|---|
| **Impact** | The first part of a donation is transfused | **Watch the story** |
| **Results** | A visit's lab panel arrives | **Open** *Goal name* (opens that Goal's Chat), **Try demo check-up slots**, **Explain my results**; with nothing to act on, **Got it** |
| **Urgent** | An urgent finding (e.g. BP ≥ 180/120) | Pick a demo check-up time today or tomorrow, or **I will seek real care** |
| **Demo check-up** | Asked for from Results, chat or My health | Pick a time; **Weekday evenings instead** (also remembered) |
| **Demo donation slots** | Three weeks before the donor can give again (Ananya's, for a shortage of O−, and Rohan's start open) | Pick a time |
| **Check-in · BP goal** | Every 2 weeks while the first active Goal targets BP | Type a reading (scroll wheels on touch screens) or **No reading this week** |
| **Check-in · Hb goal** | Every 2 weeks while the first active Goal targets haemoglobin | **Add a report** (a photo the AI reads, or the demo sample) or **Not yet** |
| **Check-in** (after a visit) | The day after a booked check-up | Started a tablet / No tablet, just walking / Didn't go |
| **Goal reached** | A reading or report meets the target | Book a demo donation slot (Hb), or acknowledge (BP: "Your next donation will confirm it") |
| **Reminder** | Offered after "Started a tablet" or on request in chat; then daily at the chosen time | Pick a time; then **Taken** / **Skipped** |
| **Weekly report** (monthly for healthy donors) | Sunday at 2 pm | **Watch my week**: a private Story of reminders kept, activity (simulated), latest BP, other units used, Cards put off, patients helped, new Badges and days until they can donate. "Still waiting" chips reopen anything folded in. |

### The rules

| Rule | What it does |
|---|---|
| **Message budget** | At most 1 new Card a day. A donor with a Goal: 2 a week plus a weekly report. A healthy donor: 1 a week plus a monthly report (first Sunday). |
| **Priority** | urgent → results → donating → check-in → goal reached → impact. Anything else waits. |
| **Outside the budget** | Urgent Cards; Cards the donor asked for (slots, a reminder offer); follow-ups to something they did; their own Reminders. |
| **Quiet hours** | Nothing new from 9 pm to 8 am, except urgent Cards and the donor's Reminders. |
| **Snooze** | ⋯ or **Not now**: In 1 hour, Tonight (7 pm), Tomorrow morning, Next week, Hide for now (until the app is opened again). Three snoozes fold the Card into the next report. |
| **Urgent** | Always first. Can't be hidden. Can only wait an hour. Never expires. |
| **Unanswered** | A Card left for 7 days folds into the next report as "Still waiting: …". |
| **Impact** | Only the first part of a donation to reach a patient gets its own Card; the rest go in the report. |
| **Reminders** | Only ones the donor asked for. An unanswered day becomes "no answer"; no streaks, no nagging. |
| **Undo** | Undoes an answer and anything it saved (a reading, a booking), until the clock moves on. |
| **Memory** | Only a schedule or language preference the donor states ("Saturdays suit you", "Evenings suit you", "Hindi suits you"). Never health facts, medicines, religion, caste, income, family health or anything about recipients. Up to 20, each deletable; a newer one replaces a contradicting one. |

### Drop's line on each screen

My health, My impact, Donate, Health cover and Community each open with one true sentence from fixed rules, for example "5 more health points would raise your cover to ₹6 lakh, same premium." Tapping it opens Drop's chat with that sentence and two or three questions. × hides it on that screen for the rest of the demo day. New Badges are announced here ("You earned Regular donor in October 2026. It's on your shelf below."), never in a Card.

### Drop's chat

- **Where:** inline on Home (the General Chat). On other screens, **Ask Drop** opens a side sheet with chips for General, each Goal, Movement, Food, Mind and Past Cycles.
- **How it answers:** in one or two sentences, in the donor's language, plus at most one Card: a trend chart, check-up slots or a reminder offer. It looks up facts with tools and never states a number a tool didn't return.
- **What it can do:** save a BP reading the donor types ("141/90 at the pharmacy"), remember a stated preference (shown as a "Remembered: …" line with Undo), switch language, and open a screen.
- **What it won't do:** diagnose or name medicines. For anything urgent it says to see a doctor today. It treats every slot as a demo slot.
- **In a Goal's Chat:** it follows that Goal's steps and never says a doctor gave them. For an urgent Goal it suggests no exercise until a doctor has seen the donor. Asked for a week's plan, it suggests one or two things and says saving Week plans is coming.
- **Without the AI:** common questions (results, BP, iron, impact, donating, cover, check-ups, memory, language, the Intro step) get rule-based answers marked "AI offline: answered by rules".
- **During the Intro:** questions the donor types are kept with the Intro.

### The side sheet's menu (⋯)

- **Add a reading:** BP number boxes for a BP Goal, otherwise the lab report reader.
- **Book a check-up**
- **Stop this Goal:** not for an urgent Goal.
- **What Drop remembers**
- **Simplify my plan:** shown but disabled ("Comes with Week plans").

A Goal's Chat pins three things: the latest point on its trend, the target, and this week. Done and stopped Goals' Chats are read-only. A stopped Goal has **Start again**.

## The Intro (You, new donor)

Drop's scripted first conversation, in Home's chat. It works with the AI off, takes about a minute, and every step can be skipped. While it runs, Home lights up the tile each step talks about.

| # | Step | What it shows |
|---|---|---|
| 1 | Language | Six languages; the rest of the Intro follows the choice (translated by the AI, English with a note if it can't) |
| 2 | What Pratidaan is | "Show me" |
| 3 | Your blood's journey | An **Example** donation (Arjun's 3 Oct one, unnamed) and where its parts went; Watch the story |
| 4 | Health between donations | An **Example** results card |
| 5 | Your data | What is kept and where; Open Your data (the account chip pulses) |
| 6 | Your choices | The three **Choices** (insurer sharing off, leaderboard on, totals on) |
| 7 | When you can donate | Days, time of day and place, saved with the Google account and used whenever they book (optional) |
| 8 | All set | **Book my first donation** or **Start using Pratidaan** |

A reload folds what was done into "Done so far" and Drop says "Welcome back". Finished or skipped, it folds into one line ("Intro · finished 10 Oct · Replay") with the questions asked. **Replay intro** is in the account menu, for the New donor only.

## My impact: where your blood went

- **Badge shelf** ("Badges · n of 8"):
  - Earned Badges show a gold medal and the month; one not yet opened has a **New** tag.
  - Unearned ones show a progress ring, the goal and the count so far ("Reach 10 patients · 8 so far").
  - Opening an earned Badge shows its share image.
- **My donations:** a calendar marks donation days. Picking one lists its parts. For each part:
  - its journey (collected, tested, separated, stored, issued, transfused, followed up), with transfusion dates rounded to the month;
  - the patient as an age band and sex, the treatment and the type of hospital, released only when at least 5 currently transfused units share the description; otherwise generalised, down to "a patient in hospital";
  - **Watch the story** for a part that reached a patient, or plasma that became medicines;
  - for an expired part, **Why it wasn't used** (shelf life, how many units of that group were issued meanwhile) and **What happens because of it**;
  - for a withheld part, only "kept out of the supply as a safety precaution", with no reason;
  - **Something wrong? Raise a concern:** a simulated walkthrough (wasted unit, tracking, privacy, treatment) with an example owner and deadline at three levels: medical officer, then State Blood Transfusion Council, then State Drugs Control. It can be escalated when overdue.
- **Who benefited:** what the donor's units meant for the blood centre, hospitals, labs, government programmes and society, with drill-downs. Monetary values are labelled as estimates.

### Stories and Badges

A **Story** is a few tap-through slides about one moment. It plays from Drop's impact Card, and any eligible part can replay it from My impact:

> On 3 October 2026 you gave blood at Whitefield Community Blood Bank. → It was separated into parts. One was your platelets… → In October 2026 they went to a hospital in Karnataka. → They helped a patient in hospital. Some details stay private so no one can be identified.

The last slide is a 1080×1920 **postcard**: the part, the treatment or its role, the month and lifetime patients helped. If that moment completed a **Badge**, the Badge replaces the postcard. **Download image**, **Copy image** and **Share…** (where the browser can share files) share the image only, with no caption. The shared image never shows age band, sex, place, outcome, name or blood group. The weekly report and the Intro's Story can't be shared.

The 8 Badges are worked out from the donor's own data:

- First patient
- 5 patients
- 10 patients
- Regular donor (three donations)
- Nothing wasted (every part of one donation helped)
- All five parts
- Plasma to medicine
- Helped a child

Earning one never sends a Card. It appears in the next Story or report and on Drop's line. The full design record is in [wayfinder/story-and-badge/](wayfinder/story-and-badge/spec.md).

## My health

From the free lab panel on every donation, plus reports the donor adds. Top to bottom:

1. **Add a lab report**, and Drop's line.
2. **Habits:** Movement, Food and Mind. Each opens its Chat. Week plans aren't built yet, so each says "Plan this week".
3. **This week:** Monday to Sunday, one row per Habit ("No Week plan").
4. **Your Goal** cards (up to two active), then **Up next**:
   - on the left: the name, the target, "Your next donation waits on this" when it does, and "Why it matters";
   - the 2–3 steps, each tagged Movement, Food, See a doctor or Add a reading;
   - **Open** (its Chat) and **Add a reading**;
   - "Where these steps come from": the protocol or guidance each step cites, and a note for the doctor;
   - on the right: the trend in plain words ("Up at each of your last 4 donations: 126/78 → 148/94"), a chart against the target line (the donor's own readings shown as hollow points), "Also in this Goal" and the next check.
5. **Health score** (0–100, "from results only"), beside **Your Chats with Drop**.
6. **Keep an eye on** (findings that make no Goal), **From your doctor** (not built: "Nothing added yet") and **Check-ups** (booked demo visits, with details, Change and Cancel).
7. **Add an outside lab report:** a photo or text, read by the AI. The donor sees each test as printed, what it was mapped to, the value in standard units and their previous value, then saves. Values outside a plausible range are skipped. Uploaded values can be deleted later.
8. **Trends across your donations** (collapsed): BP, haemoglobin, HbA1c, LDL, triglycerides, ferritin and weight against a shaded healthy band, with every value printed on its point.
9. **Readings and results** (collapsed): readings the donor added (deletable) and blood-centre results (each can be hidden from the app; hiding never changes eligibility).

### How findings become Goals

All fixed rules (`backend/src/domain/goals.js`). Neither the AI nor the donor sets grouping, targets or order.

- **Two groups.**
  - *Lifestyle*: BP, cholesterol, blood sugar, weight.
  - *Iron*: haemoglobin, ferritin.

  A group becomes a Goal only when it has a moderate or worse finding; its watch-level findings then join it. Watch-only groups and a raised liver enzyme go to **Keep an eye on**.
- **Name:** what it covers, most serious first, up to three ("BP and cholesterol", "Haemoglobin and iron").
- **One target, set by the most serious finding:**

  | Lead finding | Target |
  |---|---|
  | Blood pressure | BP under 130/80 |
  | HbA1c in the diabetes range (≥ 6.5%) | A doctor's check within 30 days |
  | Prediabetes (5.7–6.4%) | HbA1c under 5.7% |
  | Cholesterol | LDL under 130, triglycerides under 150 |
  | Low haemoglobin or iron | Haemoglobin 12.5 (women) or 13.0 (men) or more, ferritin 15 or more |
- **Order:** urgent, high, moderate. On a tie, the Goal that stops donation comes first, then the older one. At most two are active; the rest are **Up next**.
- **States:** active, Up next, done (the group is back to watch or better) and stopped. An urgent Goal can't be stopped. A done Goal reopens with the same identity if its findings return.
- **The write-up** (rules, with evidence from `data/ontology`) is written once when a Goal is made or its findings change. For example:
  - stage 1 BP: brisk walks 30 minutes on 5 days a week, less salt, see a doctor within 3 weeks;
  - urgent BP: see a doctor today, less salt, add a reading afterwards, and no exercise step;
  - iron: iron-rich food with vitamin C, tea and coffee away from meals, see a doctor to find the cause.

The findings, score and eligibility rules are listed in [03-architecture.md](03-architecture.md#health-findings-score-and-eligibility).

## Health cover (illustrative)

- **The ladder:** a group or retail policy's cover steps ₹5 lakh → 6 → 7 → 8 at the same premium, as the health score allows. The model is in [03-architecture.md](03-architecture.md#health-cover).
- **What it needs:** two monitored visits in the last 12 months, and the **Choice** to share the health score with the insurer (the score only, never results).
- **What the screen shows:**
  - what's holding the next step back;
  - the insurer switch's live effect ("On: your cover can rise with your score (next step ₹6 lakh at 80). Off: it stays at ₹5 lakh.");
  - a **What if my health score changed?** slider;
  - modelled cover over time;
  - the donor's policy stack (base policy, other policies, super top-up);
  - example premium discounts: 5% for a regular donor, 5–10% wellness, 5% non-smoker, capped at 20%;
  - the base policy's illustrative terms.
- Every figure is labelled illustrative: no insurer receives anything.

## Community: your Circles

- **Circles:** family, workplace or friends. Each shows patients helped together, the share of members who donated this year, what the Circle's blood was used for, and its blood groups.
- **Leaderboard:** first names, donations and patients helped.
- **Choices:** two of the donor's three Choices act here.
  - Leaderboard off: others don't see them, and they see themselves marked "Only you see yourself here".
  - Totals off: they leave every total and the leaderboard, and the Circle shows "1 member not counted (their choice)".
- Health data is never shared with a Circle.

## Donate

- **Booking** (also inside Drop's chat), one step at a time:
  - **Checks**: age 18–65, weight ≥ 45 kg, feeling well, and the other minimum requirements.
  - **Place**: device location, rounded to about 1 km, or a district; how far they'll travel (5, 15 or 30 km).
  - **Date and time**: the earliest week or the week after, time of day, skip public holidays.
  - **Slot**: ranked by fixed rules from centre hours, closed days, holidays, distance and, if connected, Google Calendar free/busy.
  - **Booked.**
- **The pass:**
  - a QR code and check-in code, clearly marked demo;
  - WhatsApp details and Email details;
  - a calendar file with a reminder the day before.
- **Connect Google Calendar** (separate consent from sign-in): Pratidaan reads free/busy, adds an event to the donor's calendar and emails the confirmation from their Gmail to themselves. The access token stays in the page and is never stored.
- **Simulate check-in** (demo only, on the booking day):
  - Enter vitals, or leave them blank to use the persona's pattern.
  - A deferral happens if Hb is below the minimum, BP is above 140/90 or weight is under 45 kg.
  - A completed donation creates three new parts (red cells, platelets, plasma) and a lab panel, so Impact and Health update straight away.

## Ecosystem view

What all donors' blood adds up to, aggregates only:

- donations, deferrals, components, patients helped, wastage and the repeat-donor rate;
- units by component, by treatment and by hospital type;
- an anonymised screening signal for public health: elevated BP, prediabetes and low Hb;
- the share of donors whose modelled cover rose.

## Your data (account menu)

Everything kept about the signed-in person, where it lives and how long. **Your choices** comes first; then one card per place:

- **with your Google account** (Firestore): profile, sign-in history, donation preferences, bookings;
- **in your own Google account**: Calendar events and confirmation emails;
- **with the demo donor** (server memory): memories, readings, values read from lab reports;
- **sent to Gemini**;
- **server logs**;
- **this browser**.

Each item has **Delete**, with a 6-second Undo, or says when it deletes itself. **Delete my account** removes the profile, sign-ins, preferences and bookings (cancelling upcoming ones and, if asked, their Calendar events), clears the browser and signs out; you type DELETE to confirm.

## AI console

Not in the menu: open `/#ai`. It shows the model and whether Vertex access is verified, calls and tokens used today against the daily budget, cached tokens, the rate limit, and the last 50 model calls with latency, tokens and result.

Some of the console's feature descriptions are older than the current app:

- It lists "Impact stories", with a "Write my story" button that no longer exists.
- It lists "Insight of the day" on Home, which the interface no longer shows.
- It leaves out the Intro translation.

[03-architecture.md](03-architecture.md#the-ai-layer) has the current list.

## Not built yet

| Item | Status |
|---|---|
| **Week plans**, **Your day**, **Simplify my plan** | Agreed in CONTEXT.md; Habits and This week show empty shells, and the chat says saving a Week plan is coming |
| **From your doctor** (prescriptions read and confirmed) | Placeholder ("Nothing added yet") |
| **Past Cycles** | Server keeps this demo cycle’s Drop turns per persona; **Reset** archives to read-only past cycles. Demo personas include a sample earlier cycle. In-memory on Cloud Run (not Firestore); Vertex Sessions mirror separately when configured. |
| AI-written Goal write-ups | Waiting on a team decision about Google Cloud's "no clinical purposes" term; the rules version runs and stays the fallback |
| Card wording in the donor's language | The AI rewrite is wired, but only wording identical to the rules is accepted, so Cards keep their rule wording; only the slots Card has a Hindi version |
| Drop's state, the New donor and memories per account in Firestore | In server memory, shared by everyone viewing a demo donor, reset on restart |
| Download a copy of your data | The privacy page says to email for one |
| WhatsApp or SMS delivery, voice, real centre and clinic booking, real insurer link, wearable data | Out of scope for the prototype |
| Doctor and counsellor consoles, infection-result disclosure workflow | Dropped from the first design (see the [problem brief](01-problem-brief.md#10-how-the-idea-changed)) |
