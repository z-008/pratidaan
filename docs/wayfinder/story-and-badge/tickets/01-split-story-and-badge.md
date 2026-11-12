---
label: wayfinder:grilling
title: Split Story and Badge
status: closed
assignee: mihirb777@gmail.com
blocked_by: []
---

## Question

Two features both say "your unit reached a patient": the Story in Drop's chat and the impact story on My Impact. What is each one for, what goes, and what merges?

## Resolution (2026-10-14)

Facts found in the code:
- Sharing a Story joins every slide into the WhatsApp text (`StoryViewer.tsx:21`). The Weekly report's slides include BP and results (`drop.js:325-327`), so sharing a report leaked health data.
- Only the first unit from each donation gets an impact Card (`drop.js:164`). Other units only appear as a line in the report.
- "Write my impact story" is a fixed template (`ai/stories.js`), even though the UI presents it as AI writing.

Decisions:
1. **Destination:** an agreed spec plus a build plan. Building happens after the map.
2. **Weekly report:** stays a Story and can't be shared.
3. **Story is a moment you can replay.** Drop delivers it once. Any unit that reached a patient can replay its Story from My Impact, including units that never got a Card. "Write my impact story" and `stories.js` go. Drop and My Impact build the Story with one shared function.
4. **Badges replace the lifetime "Share my impact" card,** not the per-unit story.
5. **How a donor finds out about a Badge:** a final slide in a Story Drop was already sending (the impact Story or the Weekly report), a "New" mark on the Badge shelf, and Drop's line on the Impact screen. No new Card.
6. **What a shared image shows:** component, treatment context and month only. No age band or sex, no place, no outcome, and no donor name unless the donor adds one. In the app, impact.js's release rules are unchanged.
7. **Badge set (8; first counted as 7, corrected in [How the two share images look](04-share-image-prototype.md)):** First patient · 5 / 10 patients · Regular donor (3+ completed donations) · Nothing wasted (every component of one donation helped) · All five parts · Plasma to medicine · Helped a child (released age bands only). Unearned Badges show greyed out with their rule. Ruled out: recovery outcomes, specific diseases, rare blood group, Circle ranks, streaks.
8. **Term:** "Badge", added to CONTEXT.md. The map is kept as local markdown, not on the upstream GitHub repo.
