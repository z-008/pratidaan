# Pratidaan documentation

Every doc describes the build on `main` as of 16 Oct 2026 unless it says otherwise. Start with the first three.

## The idea, the product and the build

| Doc | What it covers |
|---|---|
| [01-problem-brief.md](01-problem-brief.md) | The problem, the person, what Pratidaan does, existing options, the 10x, why Gen AI, trust, who pays, how the idea changed, open questions |
| [02-product.md](02-product.md) | What the app does, screen by screen: Drop and its rules, the Intro, Impact, Stories and Badges, Health and Goals, cover, Circles, booking, Your data; what is real, simulated or illustrative; what isn't built |
| [03-architecture.md](03-architecture.md) | How it is built: modules, data, deterministic engines, AI layer (including **three-layer guardrails** in `ai/guardrails.js`), API, security, deployment, tests |
| [../CONTEXT.md](../CONTEXT.md) | The shared vocabulary: Donor, Drop, Card, Goal, Habit, Chat, Story, Badge, Circle, Choices… |

## Pitch and submission

| Doc | What it covers |
|---|---|
| [04-pitch/pitch-narrative.md](04-pitch/pitch-narrative.md) | The 3-minute script, message house, judge Q&A, and the numbers to keep consistent |
| [04-pitch/pitch-deck.html](04-pitch/pitch-deck.html), [pitch-deck.pdf](04-pitch/pitch-deck.pdf) | The 8-slide deck; re-export the PDF with the command in the checklist |
| [05-submission/submission-checklist.md](05-submission/submission-checklist.md) | Requirements, what to fill in, quality gates |
| [05-submission/judge-instructions.html](05-submission/judge-instructions.html) | Judge email attachment (open in browser): login, sample questions, **guardrails**, architecture — not hosted on Cloud Run |
| [05-submission/demo-video-script.md](05-submission/demo-video-script.md) | The video, beat by beat, checked against the build |

## Running and deploying

| Doc | What it covers |
|---|---|
| [RUN_LOCALLY.md](RUN_LOCALLY.md) | `./run.sh` or Docker, Gemini from a laptop, optional sign-in and Calendar |
| [CLOUD_RUN_VERTEX_SETUP.md](CLOUD_RUN_VERTEX_SETUP.md) | One-time Google Cloud and GitHub setup, what each deploy sets, how to check it |
| [AGENT_PLATFORM_SETUP.md](AGENT_PLATFORM_SETUP.md) | Minimal Agent Engine instance + Sessions/Memory Bank (no full agent deploy), env vars, cost controls |
| [../data/ontology/README.md](../data/ontology/README.md) | The clinical protocols and guidance the rules cite |

## For the team

| Doc | What it covers |
|---|---|
| [drop/index.html](drop/index.html) ([README](drop/README.md)) | Team guide to Drop, with 20 test scripts and tick boxes |
| [wayfinder/story-and-badge/](wayfinder/story-and-badge/spec.md) | The design record for Stories and Badges: map, spec, build plan, decision tickets (all closed and built) |

## What was removed, and why

The first plan (8–10 Oct) described a different product: a "navigator" from a health finding to care, with doctor and counsellor consoles, WhatsApp and voice, ADK agents, a FHIR store, BigQuery and Neo4j. It also quoted projected results (92% reaching care, 85% day-1 return, 0 vulnerabilities) that were never measured. Those documents were removed on 16 Oct because they no longer described the product, and several stated things the build does not do. They are in git history (`git log --diff-filter=D -- docs/`):

- `docs/archive/`: the first 5-phase build plan, phase reports, tech stack, implementation checklists, status and index files
- `docs/01-team-perspectives/`, `docs/02-user-perspectives/`, `docs/PERSPECTIVES_MASTER_GUIDE.md`: role and stakeholder perspectives written for the first plan
- `docs/05-strategy/`: consumer-positioning strategy and the lists of docs to update
- `docs/DEPLOYMENT_HANDOFF.md`: the 11 Oct deployment checklist, now complete; its eligibility check moved to the submission checklist
- `docs/02-pitch/GENERATE-PDF.md`, `PITCH-DECK-VISUAL-GUIDE.md`: guides for the old deck
- `data/ontology/QUICK_START.md`: usage for a knowledge-graph client that was never built

The pitch and submission folders were renumbered `04-pitch/` and `05-submission/` to follow the three core docs.
