---
label: wayfinder:map
title: Story and Badge
status: closed
---

## Destination

An agreed spec for the two sharing features, Story (a moment) and Badge (the record), plus a build plan of about five steps that a build session can follow without reopening any decision.

## Notes

- Domain: Pratidaan donor app. Use the terms in [CONTEXT.md](../../../CONTEXT.md) (Donor, Drop, Card, Story, Badge, Event, Cycle, Message budget, Circle).
- Skills every session should consult: `grilling` and `domain-modeling`. Use `prototype` for how the share images look.
- Standing constraints:
  - Drop stays at the centre. Earning a Badge never sends a Card.
  - Recipient details are never more specific than `impact.js` releases them, and shared images show even less (see Decisions).
  - Use only data the app already has: `impact.donorJourneys`, `summarise`, and donations. Transfusion dates are rounded to the month.
  - Desktop demo: mouse first, touch later.
- Tracker: local markdown. The map is this file and tickets live in `tickets/`. Blocking uses `blocked_by` in each ticket's frontmatter, and a claim uses `assignee`.

## Decisions so far

- [Split Story and Badge](tickets/01-split-story-and-badge.md): a Story is a replayable moment for each component; a Badge is the lifetime record and replaces "Share my impact"; the Weekly report can't be shared; Badges surface inside Stories Drop is already sending; shares show only component, context and month; 8 Badges (corrected from 7 in "How the two share images look").
- [Can desktop browsers share an image directly?](tickets/05-desktop-image-share-research.md): only through the share sheet in Chrome, Edge and Safari; WhatsApp links are text-only; lead with Download image and Copy image.
- [What a component's Story says](tickets/02-unit-story-content.md): transfused units and plasma-to-medicines only; 4 parts in "you", generalised fields left out with one privacy line; the last slide is the shared image, either a summary postcard with lifetime patients or the Badge this moment earned.
- [How the two share images look](tickets/04-share-image-prototype.md): "Keepsakes": the postcard is a tilted card with the component as its stamp and the month as its postmark; the Badge is a foil-ringed medal on a ribbon, "N of 8" as pins; unearned Badges are greyscale with rule and progress; the top 220px and bottom 260px stay clear for the Story's chrome.
- [Which share buttons each share offers](tickets/06-share-flow.md): share only on a Story's last slide (a shelf Badge opens there too); Download image, Copy image, then Share… where supported; no caption, no WhatsApp text link; ShareBar and StoryViewer's text share are retired for one PNG renderer.
- [Name and rule for each Badge](tickets/08-badge-names-and-rules.md): plain names; a rule in "my" on the image and a goal (with progress only for real counts) on the greyed shelf; "Helped a child" means under 18; numbers in the ring only for counts, icons for the rest.
- [When a new Badge shows up](tickets/03-badge-surfacing.md): Badges are worked out each time from journeys and donations, and only "New" and "shown" live in Drop's state; the earned month is when the rule completed; the unit's own impact Story carries one Badge, otherwise the next report shows it unshared; "New" plus Drop's line on My Impact, never a Card; "Helped a child" follows the release rules.
- [Write the spec and build plan](tickets/07-spec-and-build-plan.md): [spec.md](spec.md) and a 5-step [build-plan.md](build-plan.md): Story builder, Badges, share images and buttons, My Impact shelf, new Badges in Stories and reports.

## Not yet specified

## Out of scope

- Circle Badges or leaderboards built on Badges. Circles share totals only, and nothing here changes that.
- Touch gestures and the phone share sheet beyond what the desktop demo needs.
- Hindi wording for Stories and Badges: the build doesn't need it; a later effort once the English wording has shipped.
- Whether the Weekly report's own wording changes now that it can't be shared: not needed for the build.
