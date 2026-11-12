# Deploy and review checklist

Use this before sharing the live demo or cutting a new pitch PDF. Stack on `main`: **Azure App Service + Azure OpenAI + Blob Storage**.

## Live prototype

| Item | Target |
|---|---|
| **URL** | `https://pratidaan-stmzd6rrg4.azurewebsites.net` (or your App Service hostname) |
| **Stack** | App Service F1, Azure OpenAI (`gpt-5-mini`), Blob, Entra sign-in, optional Graph |
| **CI** | `.github/workflows/deploy-azure.yml` on `main` |
| **Architecture** | [03-architecture.md](../03-architecture.md), [AZURE_SETUP.md](../AZURE_SETUP.md) |
| **Reviewer pack** | [reviewer-guide.html](reviewer-guide.html), [pratidaan-guide.html](pratidaan-guide.html) |

## Quality gates

- [ ] **Continue as guest** works; `/api/health` shows AI and agent platform status.
- [ ] `cd backend && npm test` passes; `cd frontend && npm run type-check` is clean.
- [ ] Past Cycles: chat in **General** → **This cycle (live)**; turn dates follow the **demo clock**.
- [ ] Drop chips (BP, donate, impact, …) return grounded answers; charts stay visible.
- [ ] Azure spending limit and budget alerts configured ([AZURE_SETUP.md](../AZURE_SETUP.md)).

## Pitch materials

- [ ] [pitch-deck.html](../04-pitch/pitch-deck.html) matches Azure (no legacy Cloud Run / Vertex copy).
- [ ] Re-export PDF after deck edits:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --print-to-pdf=docs/04-pitch/pitch-deck.pdf "file://$PWD/docs/04-pitch/pitch-deck.html"
```

- [ ] [pitch-narrative.md](../04-pitch/pitch-narrative.md) and [demo-video-script.md](demo-video-script.md) aligned with the deck.
- [ ] Public repo: [github.com/z-008/pratidaan](https://github.com/z-008/pratidaan) (MIT), synthetic data called out in README.

## Content honesty

- [ ] No claim for WhatsApp, voice, doctor/counsellor consoles, FHIR, BigQuery, or real centre bookings.
- [ ] Cover and slots labelled illustrative in the app; data synthetic.
- [ ] Guardrails documented in [03-architecture.md](../03-architecture.md) and [reviewer-guide.html](reviewer-guide.html).
