---
label: wayfinder:grilling
title: When a new Badge shows up
status: closed
assignee: mihirb777@gmail.com
blocked_by: []
---

## Question

What dates a Badge as earned, and how does "New" work with no extra Card? The questions to settle:
- What is the earned month for each rule? Transfusion months are rounded; donation dates are exact.
- Is a Badge worked out fresh every time, or is it stored in Drop's state so "New" and "already shown in a Story" survive a reload and reset with the demo clock?
- Which Story that Drop is already sending carries the Badge slide? What about a healthy Donor on the monthly report, or several Badges earned at once?
- Which moment counts as earning each Badge? A Badge that a moment earns becomes that Story's last slide (see [What a component's Story says](02-unit-story-content.md)). Some Badges are earned without a moment: Regular donor comes from a donation, not a transfusion.
- What happens when undo or a demo reset takes a milestone away?

## Resolution (2026-10-14)

Facts found in the code:
- **Drop's state** is held in memory for each Donor, starts from `drop-seed.json` and is cleared when the demo is reset (`drop.js:972`). Undo restores a snapshot of it and removes only the readings and appointments the answer added (`drop.js:677`).
- **Which transfusions become Stories:** only the first transfused unit of each donation gets an impact Card. Later units become a line in the report (`drop.js:165`).
- **Plasma has no Event:** plasma made into medicines doesn't raise one.
- **Donating in the demo** adds a completed donation whose parts only reach "separated" (`donation.js:102`), so it can earn Regular donor but no patient Badge.
- **Report schedule:** weekly for a Donor with a health goal, and on the first Sunday of the month for a healthy Donor.
- **Released age bands can be withdrawn:** when a unit's outcome is recorded it changes groups, and a group can fall below K=5 (`impact.js:81`).

1. **Earned month:** the month of the fact that completed the rule.
   - First / 5 / 10 patients: the month the 1st / 5th / 10th unit was transfused.
   - Helped a child: the month that unit was transfused.
   - Nothing wasted: the month the last part of that donation helped.
   - All five parts: the month the fifth kind of part first helped.
   - Plasma to medicine: the month the medicines were released.
   - Regular donor: the month of the 3rd completed donation.
2. **Worked out each time, not stored:**
   - A function of the Donor's journeys and donations on the demo clock decides which Badges are earned and in which month.
   - Only what the Donor has seen lives in Drop's state: the "New" mark and whether a Badge has been shown in a Story or report. Those reset with the demo clock and are covered by undo's snapshot.
   - A Badge earned before the Donor's Drop state started (a seeded Persona's history) is earned but never "New".
3. **Which Story carries a new Badge:**
   - If the completing unit has its own impact Card, the Badge becomes that Story's last slide and can be shared there.
   - Otherwise (a later unit of a donation, plasma made into medicines, or Regular donor) it goes into the next Weekly or monthly report as a slide without share buttons, with the line "Share it from your Badges on My Impact."
   - No new Card, ever.
4. **Several at once:** a Story carries one Badge, the first in shelf order that hasn't been shown yet. The rest stay "New" and Drop's line names them. A report lists all new Badges on one slide: "New Badges: 10 patients, Helped a child."
5. **A healthy Donor on the monthly report** may wait up to a month for the report slide. The "New" mark and Drop's line on My Impact appear on the day the Badge is earned.
6. **"New" clears** when the Donor opens that Badge from the shelf, or reaches the Story slide or report slide that shows it. Watching part of a Story doesn't clear it.
7. **A Badge that stops being true:**
   - Undo can't take a Badge away, because the readings and appointments it removes never earn one.
   - A demo reset recomputes everything.
   - Only "Helped a child" can stop being true, when its age band is withdrawn. It then goes back to greyed with no Card, and "N of 8" drops. Badges follow the release rules in `impact.js`.
8. **Drop's line on My Impact:**
   - While any Badge is "New", the line names it: "You earned 10 patients in May 2026. It's on your shelf below." For several: "You earned 2 new Badges: 10 patients and Helped a child."
   - Otherwise the line is unchanged.
   - It's said only on the screen and never counts against the Message budget.
