# Pratidaan pitch narrative

**For the deck, the live pitch and the finale Q&A.** About 3 minutes. Each block maps to a slide in [pitch-deck.html](pitch-deck.html). Everything said here is in the live prototype or marked as a target; nothing is claimed that the build doesn't do.

**Frame:** lead with the gift: blood donation, and the lives a donor touches. Health and better cover are the reasons a donor comes back. They are not the headline.

## Speaker script

**1. Hook (15 s, slide 1).**
"Every time you give blood, it's split into parts that can save up to three people. And you never hear about any of them."

**2. Arjun (25 s, slide 2).**
- "Arjun is 34. He gave blood at his office camp on 3 October."
- "Five days later, his platelets helped a patient. He doesn't know."
- "The nurse said his BP was 148/94, so he can't give next time. It has gone up at each of his last four donations: 126, 132, 136, 148. Nobody joined the dots."
- "So he has no idea his gift mattered, no idea what to do about his health, and no reason to come back."

**3. The problem (25 s, slide 3).**
- "India collects 1.57 crore units a year. The safest supply is donors who come back."
- "Three things push them away. The gift disappears into silence. The free health check in every donation goes nowhere: only 29% of adults with high BP know it. And turned-away donors hear 'come back later' with no path back. Deferred first-time donors return at about half the normal rate."

**4. Pratidaan (30 s, slide 4).**
- "Pratidaan is the donor's app. Three things."
- "One: see every life your blood touches. We follow every part to the patient it helped, and keep the patient anonymous. When it lands, Drop, our assistant, plays you a short story you can share."
- "Two: stay well until you can give again. Your donation's results become one Goal, with one target and a few steps. Drop checks in every two weeks and tells you the day you can donate again."
- "Three: better cover for staying healthy. Like a credit limit, your health-insurance cover can rise at the same premium as your health score holds, only with your consent, and only the score is shared."

**5. Demo (45 s, slide 5; live).**
- "Arjun opens Pratidaan. Drop has a story: his platelets from 3 October have reached a patient. Some details stay private so no one can be identified. He shares the postcard."
- "Next day his results land: BP up for the fourth donation in a row. One Goal, BP under 130/80. Three steps, each with its source: brisk walks, less salt, see a doctor within three weeks. And his donations wait until it comes down."
- "He asks Drop in Kannada: 'why can't I donate?' Drop looks it up and answers in two sentences, with his BP chart."
- "Two weeks later Drop asks for a reading. 128/78. Goal reached, and the date he can give again appears: 1 January."
- "Meera was turned away twice for low haemoglobin. She photographs a lab report; Gemini reads Hb 12.6. She can donate again."
- "And Vikram, at 184/118, gets one Card that can't be hidden or snoozed: see a doctor today. No model decides that. It's a rule."

**6. How it's built (20 s, slide 6).**
- "Rules decide; Gemini helps. Every Card, threshold, Goal, cover step and privacy rule is plain code, with 152 tests. The same history always gives the same result."
- "Gemini does what rules can't: Drop's chat is an agent with 18 tools that answers any question across impact, health and cover, in six Indian languages. Gemini reads any lab's report. And it translates the Intro, keeping every number."
- "It runs on Cloud Run with Gemini on Vertex AI, and falls back to rules if the model is unavailable."

**7. Who wins (15 s, slide 7).**
- "Donors get meaning, health and cover. Blood centres get donors who return. Employers and insurers get healthier, lower-risk members. Public health gets an anonymised screening signal."
- "The donor pays nothing."

**8. Close (10 s, slide 8).**
"Give blood. See every life it touches. Pratidaan."

## Message house

| Layer | Message |
|---|---|
| **Headline** | Give blood. See every life it touches. Pratidaan gives donors three reasons to come back: impact, health and cover. |
| **Pillar 1: the gift made visible** | Every part of every donation followed to an anonymised patient; Stories, a shareable postcard, Badges and Circles. |
| **Pillar 2: health between donations** | The donation's own results become one Goal with one target and cited steps; Drop follows up lightly and shows the way back to donating. |
| **Pillar 3: cover that rises with health** | A transparent, consent-based model: lower risk creates room for more cover at the same premium. |
| **Pillar 4: AI where it counts, rules where it matters** | An agent with 18 tools, multimodal report reading and six languages; deterministic, tested rules for every safety, money and privacy decision. |
| **Proof** | A live prototype on Cloud Run with seven personas, 152 passing tests, and a fallback for every AI feature. |

## Likely judge questions

| Question | Answer |
|---|---|
| **Isn't this just a chatbot on a blood app?** | No. Drop's Cards, Goals and timing come from rules; the chat is one way in. The AI does three jobs rules can't: answering open questions across the donor's whole record with tools, reading any lab's report, and speaking their language. Every AI output is checked by code. |
| **Is the AI giving medical advice?** | No. Findings come from fixed ACC/AHA and ICMR thresholds and say a doctor confirms them. Goal steps cite their source and are written by rules. Drop never diagnoses or names medicines, and urgent findings always say to see a doctor today. |
| **How do you keep patients anonymous?** | A patient's age band, treatment and hospital type are shown only when at least 5 patients share that description; otherwise they're generalised. Dates are rounded to the month. Share images show even less. |
| **Isn't better insurance cover an inducement to donate?** | It must not be, and this is our biggest open question. Cover rises with health, not with donations, and a deferred donor gets the same follow-up. But the prototype counts donation visits as "monitored visits" and shows a regular-donor discount. A deployment would count any health check and needs a legal opinion first. |
| **Where's the data from?** | All synthetic: 300 donors, 657 visits, 1,627 blood components, generated with a fixed seed. The prototype contacts no real blood centre, clinic or insurer. |
| **Do blood centres even track which unit went where?** | Units carry bag IDs, and hospitals record issue and transfusion. Joining them is the pilot's first data question. |
| **Why would anyone come back to the app?** | It doesn't ask them to: at most one new Card a day, silence at night, a weekly or monthly report. The donation is the next check-up, so the app follows the donation cycle. |
| **What's the business model?** | Blood centres and SBTCs (repeat donors), employers (wellness benefit with their group policy), insurers (lower-risk members, with consent). Donors pay nothing. |
| **What did you change from your first idea?** | We started as a navigator from a finding to care, with doctor and counsellor consoles. Building it showed the donor, not the finding, is the centre, and that rules are safer than an agent for anything clinical. See the [problem brief](../01-problem-brief.md#10-how-the-idea-changed). |

## Numbers to keep consistent

| Number | Use | Source |
|---|---|---|
| 1.57 crore (15.7 million) units, 2025 | Scale | [Rajya Sabha Q1882 annex](https://sansad.in/getFile/annex/271/AU1882_86ur4G.pdf?source=pqars) (our sum of state rows) |
| 29.2% of adults aged 30–69 with raised BP know it | Silent disease | [ICMR-NCDIR NNMS](https://www.ncdirindia.org/nnms/resources/Chapter_4_4_2.pdf) |
| 35.5% of adults with hypertension | Burden | [ICMR-INDIAB 2023](https://pubmed.ncbi.nlm.nih.gov/37301218/) |
| 57% of women anaemic | Meera | [NFHS-5 via Lok Sabha](https://sansad.in/getFile/loksabhaquestions/annex/184/AU787_fRoZaf.pdf?source=pqals) |
| Deferred first-time donors return at about half the rate | Why deferral matters | [Custer 2007](https://pubmed.ncbi.nlm.nih.gov/17655597/) |
| Sweden texts donors when their blood is used (since about 2012) | Feedback works | [The Independent, 2015](https://www.independent.co.uk/news/world/europe/blood-donors-in-sweden-get-a-text-message-whenever-someone-is-helped-with-their-blood-10310101.html) |
| "Limited benefits… without additional interventions" | Results alone fail | [Taiwan, Vox Sang 2025](https://pubmed.ncbi.nlm.nih.gov/39414251/) |
| One donation can help up to three people | Hook | Component separation (red cells, platelets, plasma) |
| 18 chat tools · 6 languages · 152 tests · 300 donors / 657 visits / 1,627 components | Build facts | This repository, 16 Oct 2026 |
| Arjun: 126 → 132 → 136 → 148; Goal BP < 130/80; can donate from 1 Jan 2027 after a 128/78 reading | Demo | Synthetic persona D-001 |

Don't use the first plan's figures (92% reaching care, 85% day-1 return, 90% retention, 2.8×). They were projections, never measured.
