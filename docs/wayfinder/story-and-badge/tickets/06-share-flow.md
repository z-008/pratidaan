---
label: wayfinder:grilling
title: Which share buttons each share offers
status: closed
assignee: mihirb777@gmail.com
blocked_by: [04-share-image-prototype, 05-desktop-image-share-research]
---

## Question

For a component's Story and for a Badge, which share actions appear on desktop, and in what order? Options include saving the image, the system share sheet, WhatsApp with text, and copying text. What text goes with the image, and what does the donor see after each action? Does ShareBar stay as the one component behind both shares?

## Resolution (2026-10-14)

Facts found in the code: `ShareBar` has two callers, the "Share my impact" card (`Impact.tsx:83`) and "Write my impact story" (`Impact.tsx:256`), and [Split Story and Badge](01-split-story-and-badge.md) removes both. `StoryViewer` shares on its own by joining every slide into text (`StoryViewer.tsx:21`), with a `wa.me` fallback. Browser support is in [Can desktop browsers share an image directly?](05-desktop-image-share-research.md).

1. **One share surface:** Share appears only on a Story's last slide. Clicking a Badge on the shelf opens that Badge alone in the Story viewer, on the same last slide. An old unit's postcard is shared by replaying its Story. The Weekly report's Story never shows share buttons.
2. **Buttons, in order:** **Download image** (primary), **Copy image**, then **Share…**, shown only when `navigator.canShare({ files })` is true (Chrome, Edge and Safari, not Firefox). There is no WhatsApp link and no Copy text, because neither can carry the image. One line goes under the buttons: "Save it, then post it as your WhatsApp Status or Instagram Story from your phone."
3. **No caption:** the image is the whole message. Share… sends only the file, so every button shares exactly the same thing and there is no second copy of the words to keep within the privacy rules.
4. **After each action:**
   - Download: "Image saved. Post it from your phone."
   - Copy: "Copied. Paste it into a WhatsApp Web chat."
   - Share…: nothing on success (the promise resolves when the sheet opens) and nothing on cancel (`AbortError`).
   - If Copy or Share… fails, fall back to Download.
   - Sharing never sends a Card, and Drop doesn't remember it.
   - Filenames describe the image, never the Donor: `tracedrop-{component}-{mon}-{year}.png` and `tracedrop-badge-{badge}.png`.
5. **`ShareBar` is retired,** along with `StoryViewer`'s text share. In their place: one set of share buttons rendered only on a Story's last slide, and one renderer that draws either the postcard or the Badge (the Keepsakes design from [How the two share images look](04-share-image-prototype.md)) as a 1080×1920 PNG. The PNG is drawn as soon as the last slide opens, so the click handlers don't wait on rendering.
