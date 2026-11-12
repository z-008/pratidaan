# Pratidaan

A platform for voluntary blood donors in India. The donor sees where every part of their blood went and who it helped, without learning who; each donation's free lab panel becomes a health follow-up between donations; and good health can raise their insurance cover. What is built and what isn't yet is in [docs/02-product.md](docs/02-product.md).

## People

**Donor**:
A person registered to give blood, whether eligible, deferred or lapsed. Everyone who uses the donor app is a Donor; there is no separate "health-only" user.
_Avoid_: User, patient, member

**Persona**:
One of the fixed demo Donors (e.g. Arjun, Meera, Ananya) chosen in **Viewing as** at the top of every screen; choosing one means using the app as that Donor. One Persona, the New donor, is a new user with no records yet, so it starts with the Intro.
_Avoid_: Test user, demo account

**Drop**:
Pratidaan's AI assistant. It speaks to the Donor first, acts on their behalf and remembers what they said.
_Avoid_: Copilot, chatbot, coach, bot

**Plan**:
The Donor's single, living set of Goals, Habits with their Week plans, and Reminders. Goals come from their results; Week plans from what they agree with Drop.
_Avoid_: Care plan, follow-up plan, programme, detailed analysis, weekly target

**Goal**:
One health problem the Donor is working on in their Plan, such as bringing their blood pressure down, with one target set by its most serious finding. It is built from one or more findings: findings with a shared lifestyle cause (high blood pressure and borderline cholesterol) make one Goal, and it stays the same Goal as later results change. Findings only worth watching never make a Goal on their own, and only the Donor can split or join Goals; a doctor's diagnosis labels a Goal but doesn't regroup it. A Goal is active, Up next, done or stopped: at most two are active at once, the rest wait in Up next, and an urgent finding always comes first. A Goal holds the reason and the target; what the Donor does about it lives in Habits.
_Avoid_: Issue, section, problem, action; paused, queued or on hold (for a Goal in Up next)

**Habit**:
One everyday area of health the Donor works on with Drop: Movement, Food or Mind. Each has its own Chat and Week plan, and works with or without a Goal.
_Avoid_: Bucket, category, section, tracker

**Week plan**:
What the Donor agreed to do in one Habit for up to a week, ending on Sunday: one or two items, each a session done at a time (three 30-minute walks in their calendar) or a guide to keep (less salt in home cooking). An item may serve a Goal ("for your BP and cholesterol"); a change to that Goal never removes it mid-week. On Sunday the Weekly report asks how it went and offers the next one. Drop never puts anything in the Donor's calendar without a tap.
_Avoid_: Routine, schedule, programme, workout plan

**From your doctor**:
The diagnoses and advice copied from the Donor's prescriptions and confirmed by them against the photo, never their medicines. A diagnosis labels the Goal it matches and the doctor's advice shapes its Week plans; Drop builds on it and never contradicts it.
_Avoid_: Doctor's notes, medical record, prescription data

**Intro**:
Drop's scripted first conversation with a newly registered Donor, in Home's chat: what Pratidaan is, their blood's journey, health between donations, their data, their Choices and booking preferences. Replayable; can be skipped.
_Avoid_: Onboarding wizard, tutorial, tour

## Sharing

**Choices**:
The Donor's three sharing switches: share their health score with their insurer (off unless they turn it on), appear on their Circles' leaderboards, and be counted in their Circles' totals. In the demo they belong to the Persona being viewed, like the rest of its state.
_Avoid_: Consent settings, privacy settings, permissions

**Circle**:
One group of Donors who see their impact together: a family, a workplace or a club. Members see only totals, and names on a leaderboard only for those whose Choices allow it.
_Avoid_: Community (the Community page lists a Donor's Circles), group, team

## Talking to the donor

**Chat**:
One conversation with Drop: the General Chat, or the Chat about one Goal or one Habit. A Goal's Chat lasts as long as the Goal and stays readable after it is done, so Drop and the Donor can look back at what was suggested and whether it worked. What is agreed in any Chat reaches the Goal or Habit it belongs to through a Card the Donor taps, and shows in that Goal's or Habit's Chat too.
_Avoid_: Thread, session, conversation

**Card**:
One message from Drop in the conversation, of a fixed kind (impact, results, urgent, check-in, slots, goal reached, reminder, weekly report), which may contain a small form the Donor answers in place.
_Avoid_: Bubble, notification, widget

**Cycle**:
The time from one donation to the next, or 120 days for a Donor who isn't donating. The General Chat starts fresh each Cycle; the Plan, Goal and Habit Chats and what Drop remembers carry over.
_Avoid_: Period, phase, quarter

**Event**:
A fact about the Donor that Drop may tell them about, such as results ready, a component reaching a patient, a check-in due or becoming eligible to donate.
_Avoid_: Trigger, alert

**Message budget**:
The cap on how many unprompted Cards Drop sends a Donor in a period. Urgent findings bypass it; Reminders don't count against it.
_Avoid_: Notification limit, quota

**Check-in**:
Drop asking for a new reading on one Goal at that Goal's protocol follow-up date, so it can tell whether the Goal is moving. Counts against the Message budget.
_Avoid_: Follow-up message, nudge

**Reminder**:
A recurring prompt the Donor asked Drop to set up, such as a tablet at 9 pm, answered with Taken or Skipped. Does not count against the Message budget.
_Avoid_: Alarm, nudge, medication tracking

**Simplify my plan**:
Drop making the Donor's week lighter: it keeps the one Week plan item that matters most, makes it smaller but never nothing, and sets the rest aside until the Donor brings them back. It never touches Goals, Reminders or Your day.
_Avoid_: Pause (items are set aside), reset, cut back

**Your day**:
A daily Card the Donor asked Drop for, at a time they chose: three one-tap questions about their day (a walk, something done they're glad about, something for their mind). Opt-in, outside the Message budget, and a skipped day is never mentioned; only what happened reaches the Weekly report, in words.
_Avoid_: Daily check-in, log, tracker, journal

**Weekly report**:
Drop's single regular summary Card, on Sunday evening: whether each Week plan was kept up, how the week went in words, Reminders, Goal progress, impact, new Badges and the donation countdown, ending with Plan next week. It comes weekly while the Donor has a Goal, a Week plan or Your day, and monthly otherwise.
_Avoid_: Digest, newsletter, adherence report

**Story**:
A short set of tap-through slides about one moment: a component reaching a patient, or the Weekly report. A component's Story can be replayed and shared; a Weekly report's is private.
_Avoid_: Carousel, slideshow, impact story

**Badge**:
A lasting record of a real milestone in the Donor's impact, earned from their own data, kept on My Impact and made to be shared. Earning one never sends a Card.
_Avoid_: Achievement, award, trophy, milestone
