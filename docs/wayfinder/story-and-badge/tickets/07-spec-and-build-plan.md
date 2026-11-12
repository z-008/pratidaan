---
label: wayfinder:task
title: Write the spec and build plan
status: closed
assignee: mihirb777@gmail.com
blocked_by: [02-unit-story-content, 03-badge-surfacing, 04-share-image-prototype, 06-share-flow, 08-badge-names-and-rules]
---

## Question

Put the closed tickets together into one spec (Story, Badge, the share images, what's deleted) and a build plan of about five steps, each step something one session can do and the change log can record.

Starting draft, from [Split Story and Badge](01-split-story-and-badge.md):
1. Add one backend function that builds a component's Story, used by the impact Card and a "Watch the story" button on My Impact. Delete `ai/stories.js` and its route.
2. Add a pure `badges(donorId)` function built on `donorJourneys` and donations, and return it from the impact API.
3. Add a Badge shelf on My Impact in place of "Share my impact", with a detail view and Share.
4. Add one canvas renderer with two templates. Component Stories share an image; the Weekly report has no share.
5. Show a new Badge as a slide in a Story Drop is already sending, a "New" mark, and Drop's line on the Impact screen. Update the change log.

## Resolution (2026-10-14)

Done. The spec is [spec.md](../spec.md) and the build plan is [build-plan.md](../build-plan.md). Both are on the map's folder and link back to the decision tickets.

- The spec covers Story, Badge (all 8, with earned months and wording), the Keepsakes share images, sharing, how a new Badge shows up and what is deleted.
- The build plan has 5 steps, each one session with its own "done when":
  1. One Story builder
  2. Badges worked out from data
  3. Share images and share buttons
  4. My Impact: Watch the story and the Badge shelf
  5. New Badges inside Stories, reports and Drop's line
- Facts found while writing it:
  - `StoryViewer` is also used by the Intro (`Intro.tsx:314`) and by Drop's panel (`Copilot.tsx:380`). So share must be opt-in through a prop, not on every last slide.
  - Vikram (D-017) and Rohan (D-033) have 2 completed donations each, so they can earn Regular donor live in the demo.
