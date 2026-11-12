# Spec: Story and Badge

Agreed on 14 Oct 2026. Each rule below links to the ticket that decided it; the ticket holds the reasoning. Terms are defined in `CONTEXT.md` (Donor, Drop, Card, Story, Badge, Event, Cycle, Message budget).

## In one paragraph

A **Story** is a replayable moment: one of the Donor's components reaching a patient, or their plasma becoming medicines. Drop delivers it once in an impact Card, and the Donor can replay it from My Impact. Its last slide is a **summary postcard** they can share. A **Badge** is a lasting record of a milestone, worked out from the Donor's own data and kept on a shelf on My Impact. A new Badge appears inside a Story or report Drop is already sending, never in a Card of its own. Shared images show only the component, the treatment context and the month, plus the lifetime patient count.

## 1. Story

Decided in [Split Story and Badge](tickets/01-split-story-and-badge.md) and [What a component's Story says](tickets/02-unit-story-content.md).

- **Which units get a Story:** transfused units and plasma that became medicines. Expired, withheld and in-progress units get no Story and no "Watch the story" button.
- **Where it plays:** from Drop's impact Card (first transfused unit of each donation, as today) and from "Watch the story" on any eligible unit on My Impact. One backend function builds it for both.
- **Slides:** four parts in "you", then the last slide in "my".
  - Given: "On {date} you gave blood at {centre}." (exact date)
  - Became: "It was separated into parts. One was your {component}: {role}."
  - Reached: "In {month} they went to {place}."
  - Helped: "They helped {patient} with {context}." Add "The hospital recorded a good recovery." only when that outcome is released.
  - Plasma: given → pooled with {poolSize} donations → your share became about {albumin} vial of albumin, {ivig} dose of IVIG and {factor} IU of factor VIII ({month}) → last slide.
- **Generalised fields** are left out of the sentence, not printed: "a patient", "a hospital in Karnataka", "helped a patient in hospital". Wherever something was held back, add: "Some details stay private so no one can be identified." Proper names keep their capitals ("Bengaluru Urban", "Karnataka"); today's slides lowercase them, which is a bug.
- **Last slide:** the summary postcard (section 3), unless this moment earned a Badge, in which case the Badge replaces it (section 5). The postcard can still be shared later by replaying that unit's Story.
- **Weekly report:** stays a Story but can never be shared. The Intro's journey Story can't be shared either.

## 2. Badge

Decided in [Split Story and Badge](tickets/01-split-story-and-badge.md), [Name and rule for each Badge](tickets/08-badge-names-and-rules.md) and [When a new Badge shows up](tickets/03-badge-surfacing.md).

### The 8 Badges

| Badge | Ring | Earned when | Earned month | Rule on the image ("my") | Goal on a greyed slot | Progress |
|---|---|---|---|---|---|---|
| First patient | 1 | 1 transfused unit | month of the 1st transfusion | My blood reached its first patient | Your blood reaches its first patient | none |
| 5 patients | 5 | 5 transfused units | month of the 5th | My blood has reached five patients | Reach 5 patients | · {n} so far |
| 10 patients | 10 | 10 transfused units | month of the 10th | My blood has reached ten patients | Reach 10 patients | · {n} so far |
| Regular donor | 3 | 3 completed donations | month of the 3rd donation | I've given blood three times | Give blood three times | · {n} so far |
| Nothing wasted | check mark | every part of one donation helped | month the last part helped | Every part of one of my donations helped someone | Every part of one donation helps someone | · best so far {h} of {p} |
| All five parts | drop split into five | each of the five kinds of part has helped | month the fifth kind first helped | All five parts of my blood have helped someone | All five parts of your blood help someone | · {k} of 5 so far |
| Plasma to medicine | vial | plasma made into medicines | month the medicines were released | My plasma was made into medicines | Your plasma is made into medicines | none |
| Helped a child | heart | a released age band under 18 (Newborn, Child, Teenager) | month of that transfusion | My blood helped a child | Your blood helps a patient under 18 | none |

- "Helped" means transfused, or plasma made into medicines. Patient counts include transfused units only, as `summarise` does today.
- Names are plain. "N of 8" counts each Badge once.
- Ruled out: recovery outcomes, specific diseases, rare blood group, Circle ranks, streaks.

### How Badges are worked out

- **Worked out each time**, from the Donor's journeys and donations on the demo clock: which Badges are earned and in which month. The same history always gives the same Badges.
- **Only what the Donor has seen is stored**, in Drop's state: the "New" mark and whether a Badge has been shown in a Story or report. It resets with the demo clock and is covered by undo's snapshot.
- A Badge earned before the Donor's Drop state started (a seeded Persona's history) is earned but never "New".
- **Badges follow the release rules.** If a released age band is later withdrawn, "Helped a child" goes back to greyed with no Card, and "N of 8" drops. Undo can't take a Badge away, and a demo reset recomputes everything.

### The shelf (My Impact)

- Replaces the "Share my impact" card. Header: "Badges · {n} of 8".
- Earned slot: small medal, name, "Earned {month}". A new Badge gets a "New" tag on a warm highlight.
- Unearned slot: greyscale medal at about 40% opacity, greyed name, goal and progress.
- Clicking any earned Badge opens it alone in the Story viewer, on the same last slide as in a Story, with the share buttons.

## 3. The share images

Decided in [How the two share images look](tickets/04-share-image-prototype.md) (direction C, "Keepsakes"). Reference: `share-images.prototype.html` on branch `prototype/share-images`.

Both images are 1080×1920 PNGs. The top 220px and bottom 260px hold no key content, because the Story viewer's progress bars, title, close button and share buttons sit there.

- **Summary postcard:** the component's tint as background. A white postcard, tilted slightly, carries:
  - a perforated stamp (the component tile, colours from `KIND_STYLE`)
  - a round postmark with the short month ("OCT 2026 · TRACEDROP")
  - the headline in Fraunces: "My {component} reached a patient", or "My plasma became medicines"
  - the context line, or the component's role if the context is generalised (plasma: "Albumin, immunoglobulin and clotting factor")
  - the month in italics
  - a dashed rule, then a large "{N} patients helped by my blood" (lifetime `patientsHelped`)
  - the Pratidaan mark below the card, in the component's colour.
- **Badge:** dark red felt background, a striped ribbon and a gold loop. Below them:
  - the medal: a foil ring with a red enamel centre holding the ring glyph
  - the name, the rule in "my", "Earned {month}"
  - a row of 8 pins (filled when earned, hollow when not) with "{n} of 8 Badges"
  - the mark in gold.
- **Family:** both use Fraunces with Inter, gold foil, dark red and the mark. Gold foil only ever means a Badge.
- **Privacy:** the postcard shows component, context or role, month, lifetime patients and the mark. The Badge shows name, rule, earned month, n of 8 and the mark. Neither ever shows age band, sex, place, outcome, donor name or blood group. In the app, `impact.js`'s release rules are unchanged.

## 4. Sharing

Decided in [Which share buttons each share offers](tickets/06-share-flow.md), from [Can desktop browsers share an image directly?](tickets/05-desktop-image-share-research.md).

- **One surface:** share buttons appear only on a Story's last slide when that slide is a postcard or a Badge. This covers a Badge opened from the shelf.
- **Buttons, in order:** **Download image** (primary), **Copy image**, then **Share…** only when `navigator.canShare({ files })` is true. Below them: "Save it, then post it as your WhatsApp Status or Instagram Story from your phone."
- **No caption** and no WhatsApp link or Copy text. Every button shares the image only.
- **Feedback:**
  - Download: "Image saved. Post it from your phone."
  - Copy: "Copied. Paste it into a WhatsApp Web chat."
  - Share…: nothing on success or cancel.
  - If Copy or Share… fails, fall back to Download.
- **Filenames:** `tracedrop-{component}-{mon}-{year}.png` and `tracedrop-badge-{badge}.png`. They never name the Donor.
- **Drop:** sharing never sends a Card and Drop doesn't remember it.
- **Rendering:** the PNG is drawn as soon as the last slide opens, so the click handlers don't wait. Clipboard and share need a user gesture.

## 5. How a new Badge shows up

Decided in [When a new Badge shows up](tickets/03-badge-surfacing.md).

- **Earning a Badge never sends a Card.**
- **The completing unit has its own impact Card:** the Badge becomes that Story's last slide and can be shared there.
- **Otherwise** (a later unit of a donation, plasma made into medicines, Regular donor): the next Weekly or monthly report shows the Badge as a slide, without share buttons, with the line "Share it from your Badges on My Impact."
- **Several at once:**
  - A Story carries one Badge: the first in shelf order that hasn't been shown.
  - A report lists all new ones on one slide: "New Badges: 10 patients, Helped a child."
- **"New" mark:**
  - It shows on the shelf from the day the Badge is earned.
  - It clears when the Donor opens the Badge from the shelf, or reaches the Story slide or report slide that shows it. Watching part of a Story doesn't clear it.
- **Drop's line on My Impact** names any New Badges: "You earned 10 patients in May 2026. It's on your shelf below." For several: "You earned 2 new Badges: 10 patients and Helped a child." It never counts against the Message budget.
- A healthy Donor on the monthly report may wait up to a month for the report slide. The "New" mark and Drop's line appear on the day the Badge is earned.

## 6. What goes

- "Write my impact story", `backend/src/ai/stories.js`, its route `POST /:donorId/impact/:componentId/story` and `api.story`. The "AI" story was a fixed template.
- The "Share my impact" card and `frontend/src/components/impact/ShareBar.tsx`.
- `StoryViewer`'s text share (joining every slide into a WhatsApp message), which leaked the Weekly report's health data.

## Out of scope

- Circle Badges and leaderboards built on Badges.
- Touch gestures and the phone share sheet beyond what the desktop demo needs.
- Hindi wording and whether the Weekly report's own wording changes (still under "Not yet specified" on the map).
