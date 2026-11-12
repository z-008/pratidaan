# Pratidaan documentation

Every doc describes the build on `main` unless it says otherwise. **Runtime:** Azure App Service + Azure OpenAI (see [03-architecture.md](03-architecture.md)). Start with the first three.

## The idea, the product and the build

| Doc | What it covers |
|---|---|
| [01-problem-brief.md](01-problem-brief.md) | The problem, the person, what Pratidaan does, existing options, the 10x, why Gen AI, trust, who pays, how the idea changed, open questions |
| [02-product.md](02-product.md) | What the app does, screen by screen: Drop and its rules, the Intro, Impact, Stories and Badges, Health and Goals, cover, Circles, booking, Your data; what is real, simulated or illustrative; what isn't built |
| [03-architecture.md](03-architecture.md) | How it is built: modules, data, deterministic engines, AI layer (including **three-layer guardrails** in `ai/guardrails.js`), API, security, deployment, tests |
| [../CONTEXT.md](../CONTEXT.md) | The shared vocabulary: Donor, Drop, Card, Goal, Habit, Chat, Story, Badge, Circle, Choices… |

## Pitch and operations

| Doc | What it covers |
|---|---|
| [04-pitch/pitch-narrative.md](04-pitch/pitch-narrative.md) | Pitch script, message house, FAQ, numbers to keep consistent |
| [04-pitch/pitch-deck.html](04-pitch/pitch-deck.html), [pitch-deck.pdf](04-pitch/pitch-deck.pdf) | Slide deck; re-export PDF from the checklist |
| [05-review/deploy-checklist.md](05-review/deploy-checklist.md) | Deploy and review checklist (live URL, tests, deck) |
| [05-review/reviewer-guide.html](05-review/reviewer-guide.html) | Reviewer guide: login, sample questions, guardrails, Azure architecture |
| [05-review/pratidaan-guide.html](05-review/pratidaan-guide.html) | Short product + architecture guide for reviewers |
| [05-review/demo-video-script.md](05-review/demo-video-script.md) | Demo video beats (update AI stack wording when re-recording) |

## Running and deploying

| Doc | What it covers |
|---|---|
| [RUN_LOCALLY.md](RUN_LOCALLY.md) | `./run.sh`, optional Azure OpenAI, Microsoft sign-in and Graph |
| [AZURE_SETUP.md](AZURE_SETUP.md) | Azure CLI, free-credit guardrails, Azure provisioning and GitHub OIDC |
| [AGENT_PLATFORM_SETUP.md](AGENT_PLATFORM_SETUP.md) | Azure Blob session/memory mirror for Drop (no separate agent product) |
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
- `docs/DEPLOYMENT_HANDOFF.md`: the 11 Oct deployment checklist, now complete; its eligibility check moved to the deploy checklist
- `docs/02-pitch/GENERATE-PDF.md`, `PITCH-DECK-VISUAL-GUIDE.md`: guides for the old deck
- `data/ontology/QUICK_START.md`: usage for a knowledge-graph client that was never built

The pitch and review folders are `04-pitch/` and `05-review/` after the three core docs.
