# Submission checklist (due 18 Oct 2026)

Requirements from the competition brief (H2S × Google Cloud Gen AI hackathon). Confirm the exact cutoff time and the form fields on the portal.

## Eligibility

- [ ] 2–4 members, all eligible under the rules.
- [ ] All submitted code and assets were made during the official hackathon window. The repo's first commit is 8 Oct 2026, 14:31 IST. Check this against the official start date and time before submitting.
- [ ] Each member has checked their employer's IP and outside-work rules.

## Required items

| Item | Requirement | Ours | Status |
|---|---|---|---|
| **Theme** | State it clearly | Sustainability & Social Impact | [ ] |
| **Functional prototype** | Built with Gemini or Gemma (or Agent Platform, Antigravity, AI Studio); deployed on Cloud Run or Firebase | Gemini 3.1 Flash-Lite on Vertex AI; **Cloud Run** service `pratidaan`: https://pratidaan-533106233193.asia-south1.run.app · judge HTML attached to email | [ ] **Continue as guest** works; OAuth origins include live URL; AI console "Verified" |
| **Video** | About 3 minutes or less; public YouTube, Vimeo or Drive link | [demo-video-script.md](demo-video-script.md) | [ ] Public, under 3:00 |
| **Proposal deck (PDF)** | Vision, impact, problem alignment, who benefits, feasibility, scalability | [pitch-deck.pdf](../04-pitch/pitch-deck.pdf) (from [pitch-deck.html](../04-pitch/pitch-deck.html)) | [ ] Team name, members and video link filled in; PDF re-exported |
| **GitHub repo** | Public | Public repo linked in hackathon submission (MIT, synthetic-data notice in README) | [ ] README, [LICENSE](../../LICENSE) (MIT) |
| **Language** | Everything in English | Code, docs, deck, voice-over | [ ] Non-English lines subtitled |

## Fill in before submitting

- [x] Deck slides 1 and 8: team Pratidaan — Mihir Bhatt · Uppili Srinivasan · Sandeep Samant; live URL (video link on submission portal).
- [ ] Re-export the PDF. From the repo root, run:

  ```sh
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
    --print-to-pdf=docs/04-pitch/pitch-deck.pdf "file://$PWD/docs/04-pitch/pitch-deck.html"
  ```

  The deck sets its own page size (13.333 × 7.5 in). Check that each slide fits on one page.
- [x] Root `LICENSE` (MIT).

## Quality gates

- [ ] The first 60 seconds of the video show a Story, real results becoming a Goal, and Gemini answering in Kannada.
- [ ] Every number in the deck and video is in [pitch-narrative.md](../04-pitch/pitch-narrative.md) under "Numbers to keep consistent". None of the first plan's projected metrics appear.
- [ ] Nothing in the deck, video or README claims what the prototype doesn't do: no WhatsApp, voice, doctor or counsellor console, FHIR store, BigQuery, Maps or real bookings.
- [ ] The README states the data is synthetic and the prototype isn't for medical use. Cover, slots and check-ups are labelled illustrative or demo in the app.
- [ ] `cd backend && npm test` passes and `cd frontend && npm run type-check` is clean. CI runs both on every deploy.
- [ ] Past Cycles: chat as a demo persona → **This cycle (live)**; **Reset** → archived cycle in Ask Drop → Past Cycles (in-memory on Cloud Run, not Firestore).
- [ ] The latest **Deploy Pratidaan to Cloud Run** run on `main` is green, and `/api/health` answers.
- [ ] Judging capacity: deploy uses up to 4 Cloud Run instances (concurrency 20) and 500k tokens / 2k calls per instance per day. Check the AI console on the morning of judging.
- [ ] Write-up states **Cloud Firestore** only — no Firebase Auth, Hosting, or other Firebase products.
- [ ] Guardrails documented: pre-LLM checks, prompt appendix on every Gemini call, post-LLM sanitize — [03-architecture.md](../03-architecture.md) and [judge-instructions.html](judge-instructions.html) (email attachment for judges).
- [ ] A Google Cloud budget alert is set on the project.

## Special prizes to target

- **Most Impactful Solution:** blood supply through donors who return; health follow-up for donors who would otherwise get nothing.
- **Best Use of Google Cloud AI Tools:** Gemini on Vertex AI as an agent with 18 tools, multimodal report reading and six languages, on Cloud Run, with Cloud Firestore (not Firebase), Google Sign-In, Calendar and Gmail.
- **Best UI/UX:** Drop on every screen, at most one Card a day, a one-minute Intro in six languages, Stories with shareable postcards, and Your data with real deletes.
