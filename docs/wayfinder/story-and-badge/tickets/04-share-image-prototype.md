---
label: wayfinder:prototype
title: How the two share images look
status: closed
assignee: mihirb777@gmail.com
blocked_by: [02-unit-story-content]
---

## Question

What do the two 1080×1920 share images look like, side by side, using real data from a demo Donor?
- **Summary postcard:** the component tile, headline, context line (or the component's role), month, a large "{N} patients helped by my blood", and the Pratidaan mark. Start from the layout agreed in [What a component's Story says](02-unit-story-content.md).
- **Badge medallion:** a foil ring with the tier number, the name, a one-line rule, the earned month and "N of 8".

They should look like one family but read differently at a glance. Also settle: the greyed-out unearned state on the shelf, and how both read as a Story's last slide, the same image the donor shares.

## Resolution (2026-10-14)

Picked **direction C, "Keepsakes"**: each image is drawn as a physical object. The prototype (three directions: A Paper & foil, B Night, C Keepsakes) is `docs/wayfinder/story-and-badge/share-images.prototype.html` on branch `prototype/share-images` (commit 747ef00).

Data used: the postcard is D-001 Arjun's 3 Oct 2026 platelets (context generalised, so the role line shows; Oct 2026; 8 patients). The Badge is D-003 Ananya's "10 patients", earned May 2026 by her 15 Apr 2026 red cells; she holds 8 of 8. The shelf is Arjun's, 6 of 8.

1. **Summary postcard:** the background is the component's tint. On it sits a white postcard, tilted slightly, with:
   - a perforated stamp in the top right that is the component tile (colours from `KIND_STYLE`)
   - a round postmark with the short month ("OCT 2026 · TRACEDROP")
   - the headline in a serif (Fraunces), then the context line or the component's role, then the month in italics
   - a dashed rule, then the large "{N} patients helped by my blood"
   - the Pratidaan mark below the card, in the component's colour.
2. **Badge:** a dark red felt background, a striped ribbon and a gold loop, then the medal: a foil ring around a red enamel centre showing the tier number. Below it: the name, the one-line rule in "my" ("My blood has reached ten patients"), "Earned {month}", a row of 8 pins (filled when earned, hollow when not) with "N of 8 Badges", and the mark in gold.
3. **One family that reads differently:** both images share Fraunces with Inter, gold foil, dark red and the mark. At a glance the postcard is a light rectangle and the Badge is a dark hanging medal. Gold foil only ever means a Badge.
4. **Shelf:** small medals (about 76px) in the Badge style. An unearned Badge is greyscale at about 40% opacity, with its name greyed and its rule plus progress shown ("Reach 10 patients · 8 so far", "All five parts used · 3 of 5 so far"). A new Badge gets a "New" tag on a warm highlight.
5. **As a Story's last slide:** the image fills the 9:16 slide exactly. The top 220px and bottom 260px of the 1080×1920 canvas hold no key content, because the Story's progress bars, title, close button and share buttons sit there. The chrome is white, so it needs dark scrims at the top and bottom; the light postcard is unreadable under it without them. The buttons in the prototype (Download image, Copy image, More ways to share…) are placeholders; the real set is decided in "Which share buttons each share offers".
6. **8 Badges:** 5 patients and 10 patients are separate Badges, so there are 8 in all and "N of 8" counts each Badge once. This corrects the "7" in "Split Story and Badge".
7. **Privacy is unchanged:** the postcard shows component, context or role, month, lifetime patients and the mark. The Badge shows name, rule, earned month, N of 8 and the mark. Neither shows age band, sex, place, outcome, donor name or blood group.

Still open: the exact name, rule and ring glyph for each Badge. The prototype used numbers where there is one, and "3/3", a drop and a heart otherwise. This is now the ticket "Name and rule for each Badge".
