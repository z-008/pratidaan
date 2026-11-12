---
label: wayfinder:grilling
title: Name and rule for each Badge
status: closed
assignee: mihirb777@gmail.com
blocked_by: []
---

## Question

What are the exact name, one-line rule and ring glyph for each of the 8 Badges (First patient, 5 patients, 10 patients, Regular donor, Nothing wasted, All five parts, Plasma to medicine, Helped a child)? The rule appears twice: in "my" on the shared image ("My blood has reached ten patients"), and as a goal plus progress on a greyed shelf slot ("Reach 10 patients · 8 so far"). The glyph sits in the medal's foil ring: a number where the Badge has one, otherwise to be decided (the prototype used "3/3", a drop and a heart). See [How the two share images look](04-share-image-prototype.md).

## Resolution (2026-10-14)

Facts found in the code: `summarise` counts Newborn, Child (1–12) and Teenager (13–17) as children (`impact.js:193`). A unit counts as "helped" if it was transfused or if it was plasma made into medicines (`impact.js:164`). Patient counts include transfused units only.

1. **Names are plain,** with numerals for counts. A Badge is a record that someone seeing a Status should understand without help.
2. **"Helped a child" counts any patient under 18** (Newborn, Child, Teenager), matching `summarise`. Under-18s are children under Indian law.
3. **What each Badge says:**

| Badge | Ring | Rule on the shared image ("my") | Goal on a greyed shelf slot | Progress |
|---|---|---|---|---|
| First patient | 1 | My blood reached its first patient | Your blood reaches its first patient | none |
| 5 patients | 5 | My blood has reached five patients | Reach 5 patients | · {n} so far |
| 10 patients | 10 | My blood has reached ten patients | Reach 10 patients | · {n} so far |
| Regular donor | 3 | I've given blood three times | Give blood three times | · {n} so far |
| Nothing wasted | check mark | Every part of one of my donations helped someone | Every part of one donation helps someone | · best so far {h} of {p} |
| All five parts | drop split into five | All five parts of my blood have helped someone | All five parts of your blood help someone | · {k} of 5 so far |
| Plasma to medicine | vial | My plasma was made into medicines | Your plasma is made into medicines | none |
| Helped a child | heart | My blood helped a child | Your blood helps a patient under 18 | none |

4. **Wording rules:**
   - The rules for Nothing wasted and All five parts say "someone", not "a patient", because plasma made into medicines helps without being one patient.
   - Progress is shown only where there is a real count, because the Donor can't steer where a part goes.
   - An earned shelf slot shows the name and "Earned {month}"; the rule appears when the Badge is opened.
5. **Numbers in the ring only for counts.** This fixes two problems in the prototype: "All five parts" showed a "5" next to "5 patients", and "3/3" was wrong for a donation separated into 4 parts.

Hindi wording stays under "Not yet specified" on the map.
