# Build plan: Story and Badge

Five steps that build [spec.md](spec.md). Each step is one session and one commit (or a few), and none of them reopens a decision. If a step seems to need a new decision, stop and add a ticket to [map.md](map.md).

## Ground rules for every step

- **Branch:** `feature/story-and-badge`, cut from `main`. Merge `main` in at the start of each day.
- **Done means checked:** `cd backend && npm test` passes, `cd frontend && npm run type-check` passes, and the step is clicked through in the running app at 1280 and 1440 px, as Arjun (D-001) and Ananya (D-003).
- **Desktop now, touch later:** targets at least 44px, nothing hover-only, Esc closes the Story viewer.
- **Files others may touch** (say so before editing): `frontend/src/components/Copilot.tsx`, `frontend/src/styles.css`.

| # | Step | Depends on |
|---|---|---|
| 1 | One Story builder | — |
| 2 | Badges worked out from data | — |
| 3 | Share images and share buttons | 1, 2 |
| 4 | My Impact: Watch the story and the Badge shelf | 1, 2, 3 |
| 5 | New Badges inside Stories, reports and Drop's line | 2, 3, 4 |

### 1. One Story builder

- New `backend/src/domain/story.js`: `componentStory(donorId, componentId)` returns the four slides plus the postcard data (component, headline, context or role, month, `patientsHelped`), or `null` for a unit with no Story. It follows the slide wording, the generalised-field rules and the privacy line in spec section 1, and keeps capitals in proper names.
- `drop.js` `words()` case `impact:impact` uses it instead of its own slides.
- New route `GET /:donorId/impact/:componentId/story`. Delete `ai/stories.js`, the `POST …/story` route and its `withFallback`, `api.story` and the `Story` type in `frontend/src/api.ts`.
- Tests in `backend/test/impact-correctness.test.js`:
  - D-001's 3 Oct platelets: fully generalised, no age band or place in the slides, the privacy line present.
  - A plasma unit: the medicines slide.
  - An expired unit: `null`.
  - "Bengaluru Urban" and "Karnataka" keep their capitals.
- **Done when:** Arjun's impact Card plays the new slides; the old story route returns 404.

### 2. Badges worked out from data

- New `backend/src/domain/badges.js`: `badges(donorId)` returns the 8 Badges in shelf order. Each has `id`, `name`, `ring`, `earned`, `earnedMonth`, `rule`, `goal`, `progress` and `completedBy` (the component or donation that completed it). It is a pure function of `donorJourneys`, `summarise` and completed donations on the demo clock, following the table and earned-month rules in spec section 2.
- `GET /:donorId/impact` also returns `badges`.
- Tests in a new `backend/test/badges.test.js`:
  - D-001 holds 6 of 8: 10 patients shows "· 8 so far" and All five parts shows "· 3 of 5 so far". Helped a child is earned Jul 2026, from a teenager.
  - D-003 holds 8 of 8, and 10 patients is earned May 2026, completed by the 15 Apr 2026 red cells.
  - Advancing the clock never removes a Badge, except "Helped a child" when its age band is withdrawn.
  - Same history, same output.
- **Done when:** the tests pass and the impact API shows the Badges for every Persona.

### 3. Share images and share buttons

- New `frontend/src/components/share/shareImage.ts`: one canvas renderer with two templates, the Keepsakes postcard and the Badge (spec section 3), at 1080×1920. Use `share-images.prototype.html` on `prototype/share-images` as the visual reference, but rewrite it for canvas. Load Fraunces with `document.fonts.load` before drawing. Keep the top 220px and bottom 260px free of key content.
- New `frontend/src/components/share/ShareButtons.tsx`: Download image, Copy image, then Share… when `canShare({ files })`. It also shows the help line, the feedback notes, the fallback to Download and the filenames (spec section 4). The PNG is rendered as soon as the buttons mount.
- `StoryViewer.tsx`:
  - Takes an optional `last` prop (postcard or Badge data). When it is given, the last slide shows the image with dark top and bottom scrims and `ShareButtons`.
  - Without it there is no share at all, which covers the Weekly report and the Intro.
  - Remove the text share and the `wa.me` fallback.
- Delete `frontend/src/components/impact/ShareBar.tsx`.
- **Done when:**
  - Arjun's impact Story ends on the postcard: 8 patients, October 2026, the role line.
  - Download saves `tracedrop-platelets-oct-2026.png`, and Copy image pastes into a chat in Chrome, Edge, Safari and Firefox (Share… is hidden in Firefox).
  - The Weekly report and the Intro Story show no share buttons.

### 4. My Impact: Watch the story and the Badge shelf

- In `frontend/src/pages/Impact.tsx`:
  - Replace "Write my impact story" and its AI note with **Watch the story** on each unit that has a Story. It opens `StoryViewer` with the slides from step 1 and the postcard as the last slide.
  - Replace the "Share my impact" card with the **Badge shelf** (spec section 2): earned and greyed slots, goal and progress, "Badges · n of 8".
  - Clicking an earned Badge opens it alone in `StoryViewer` with its share buttons.
- **Done when:**
  - Arjun's shelf shows 6 of 8, with 10 patients and All five parts greyed and showing their progress.
  - Ananya's shelf shows 8 of 8.
  - Every transfused or plasma unit has Watch the story, and expired or stored units don't.

### 5. New Badges inside Stories, reports and Drop's line

- In `drop.js`:
  - Add `badgesSeen` and `badgesShown` to each Donor's state. Badges earned on or before `createdOn` start as seen.
  - When an impact Card's unit completed an unshown Badge, the Story's last slide becomes that Badge (the first in shelf order) and it is marked shown.
  - `buildReport` adds one "New Badges: …" slide for every new Badge not yet shown, with "Share it from your Badges on My Impact." No new Card and no Message budget change.
- New endpoint (or field on the Drop view) to clear "New" when the Donor opens a Badge or reaches its slide.
- `backend/src/domain/screenLines.js`: the `impact` line names any New Badges (spec section 5).
- My Impact shows the "New" tag on new slots.
- Tests in `backend/test/drop.test.js`:
  - a Badge completed by an impact Card's unit replaces the postcard
  - a Badge completed by a later unit, by plasma or by Regular donor lands in the report
  - two Badges at once: the Story carries the first, the report or Drop's line lists the rest
  - "New" survives undo's snapshot and clears on reset
  - earning a Badge never adds a Card or uses the budget.
- **Done when:** jumping the demo clock earns a Badge live and shows it in the right place with its "New" mark. Example: Regular donor for Vikram (D-017) or Rohan (D-033), who have 2 donations each, after a third is checked in. Then update the change log with the feature summary.
