---
label: wayfinder:research
title: Can desktop browsers share an image directly?
status: closed
assignee:
blocked_by: []
---

## Question

On desktop Chrome, Edge, Safari and Firefox (current versions, macOS and Windows), does `navigator.canShare({ files: [png] })` / `navigator.share` with a PNG file work? What do WhatsApp Web and `wa.me` links accept (text only, or images)? What is the most reliable desktop path for getting a 1080×1920 image into a WhatsApp or Instagram status?

## Resolution (2026-10-14)

Full findings are in `docs/wayfinder/story-and-badge/research/desktop-image-share.md` on branch `research/desktop-image-share` (commit 0756da5).

- Sharing a PNG through `navigator.share` works in Chrome 128+, Edge 93+ and Safari 14+ on desktop, but not in Firefox. Even when it works it only opens the system share sheet, and WhatsApp and Instagram aren't documented share targets on desktop.
- `wa.me` links carry text only and open a chat, not Status. WhatsApp Web can add images to a chat, but nothing documents posting a Status from desktop. Instagram's own sources disagree on desktop Stories.
- The most reliable desktop path: render the PNG first, then offer **Download image** and **Copy image** (both work in all four browsers), plus **Share…** only when `canShare` is true. The donor posts from their phone. Fallback: open the PNG in a new tab.
