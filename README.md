# Pratidaan

**Give blood. See every life it touches.**

Pratidaan is an app for voluntary blood donors in India. A donation is split into parts (red cells, platelets, plasma) that reach different patients. Pratidaan follows each part and tells the donor when it helps someone, without ever revealing who. The same donation's sample doubles as a health check. Drop, Pratidaan's assistant, uses it to keep the donor well until they can give again, and a good health record can raise their health-insurance cover. Those are the reasons a donor comes back.

- **Azure deployment:** provision with [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md). The app supports Microsoft sign-in or **Continue as guest**.
- **Licence:** [MIT](LICENSE)
- **Origin:** Sustainability & Social Impact prototype, now migrated to an Azure-only runtime.
- **Data:** entirely synthetic: 300 donors, 657 donation visits, 1,627 blood components and 8,541 lab results, generated with seed 42. Institutions, insurers and people are fictional. Nothing is sent to a blood centre, clinic or insurer.

## What a donor gets

1. **Their blood's journey.** Each component's path is shown from collection to the patient: an age band, the treatment and the type of hospital, released only when at least 5 patients share that description. When a part reaches a patient, Drop sends a short **Story** that ends on a shareable postcard. **Badges** record milestones ("5 patients", "Nothing wasted", "Helped a child"). **Circles** (family, workplace, friends) see what they have done together.
2. **Health between donations.** Drop explains each donation's results in plain words. A finding worth acting on becomes a **Goal** with one target and two or three steps, each citing the protocol or guidance behind it. Drop checks in every two weeks, offers check-up slots, sets reminders the donor asks for, and says when they can donate again. It sends at most one new Card a day and is silent at night.
3. **Better cover for staying healthy** (illustrative). Like a credit limit that rises with good repayment, the modelled health-insurance cover steps up (₹5 lakh → 6 → 7 → 8) at the same premium as the health score holds. It needs two monitored visits in 12 months and the donor's consent, and only the score is ever shared.

Around the donor: an **ecosystem view** (what all donors' blood did for blood centres, hospitals, labs and public health), guided **booking** with an optional Microsoft Calendar event, and **Your data**, which shows everything kept and deletes any of it.

## Try it

Choose who to be in **Viewing as** at the top of every screen. The demo starts on **Saturday 10 Oct 2026, 8 am**. The yellow demo bar on Home moves time forward so Drop's behaviour over days and weeks can be seen.

| Persona | What it shows |
|---|---|
| **You (new donor)** | A new user with no records. Drop's eight-step **Intro** in Home's chat: language, how the blood's journey works, health between donations, your data, your Choices, when donating suits you. |
| **Arjun Rao** (B+) | **The main demo.** Gave blood on 3 Oct; his platelets reached a patient on 8 Oct. His results arrive on 11 Oct: BP 148/94, up at each of his last four donations (126 → 132 → 136 → 148). A Goal, *BP, blood sugar and cholesterol*, a demo check-up, a BP Check-in two weeks later, and the target reached. |
| **Meera Iyer** (O+) | Turned away twice for low haemoglobin (11.8; she needs 12.5). Her Goal is *Haemoglobin and iron*. Adding her sample lab report (Hb 12.6) clears her to donate again. |
| **Ananya Sharma** (O−) | Healthy, rare group, all 8 Badges, top cover (₹8 lakh). O− is short at her centre, so Drop offers slots. |
| **Vikram Gowda** (A+) | BP 184/118: an urgent Card that always sits first, can't be hidden and says to see a doctor today. His Goal suggests no exercise until a doctor has seen him. |
| **Karthik Menon** (B+) | Prediabetic HbA1c (6.1%), can donate from 3 Nov, no Cards today. What a quiet Home looks like. |
| **Rohan Verma** (AB+) | Hindi. One unit is withheld for safety with no reason shown; the counsellor contacts him privately. |

The team guide in [docs/drop/](docs/drop/README.md) has 20 click-through test scripts with expected results.

## Where AI is used, and where it isn't

All AI runs through **Azure OpenAI** using the web app's managed identity. If Azure OpenAI isn't configured or available, features with deterministic fallbacks continue to work and say so.

| Feature | Where | What the model does |
|---|---|---|
| **Drop's chat** | Home, and the **Ask Drop** side sheet on every other screen | An agent with 18 donor-scoped tools: reads results, trends, impact, cover and Circles; shows a chart; offers check-up slots or a reminder; saves a BP reading; remembers a schedule or language preference; switches language; opens a screen. It answers in English, Hindi, Kannada, Tamil, Telugu or Malayalam, in one or two sentences. In a Goal's Chat it follows that Goal's steps. |
| **Lab-report reader** | My health → Add an outside lab report; Meera's Check-in | Reads a photo or text of a report from any lab, maps test names to 16 LOINC-coded markers and converts units. The output is schema-checked and range-checked, and the donor confirms before anything is saved. |
| **The Intro in your language** | New donor, Home | Translates the scripted Intro the first time each line is shown. A translation is kept only if every number and placeholder survives. |

**Kept deterministic on purpose**, because these decide safety, money or privacy:

- donation eligibility (NBTC gaps and limits)
- clinical findings and their severity (ACC/AHA 2017 and ICMR thresholds)
- the health score
- Goals (grouping, target and order) and their written steps
- every Card Drop sends, and when
- the cover ladder
- Badges
- recipient privacy (k-anonymity)
- slot ranking

The model can't change any of them.

## Run it

**With Docker**

```bash
docker compose up --build
# open http://localhost:8080
```

**Without Docker** (Node 20+)

```bash
./run.sh                    # installs dependencies on first run, starts API + web app
# open http://localhost:5173
```

`run.sh` copies `azure.config.example` to `.env` on first run. For local use without Microsoft sign-in, keep `AUTH_DISABLED=true` and `NODE_ENV=development`. Azure deployment and CLI setup are in [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md).

For Azure CLI setup, run `./scripts/setup-azure-cli.sh`. Deployment remains blocked until you explicitly confirm the selected free-credit subscription has **Spending limit: On**.

## Architecture in brief

```
frontend/           React 19 + Vite + TypeScript + Recharts: the donor app
backend/src/
  domain/           deterministic engines: health, eligibility, cover, impact (privacy), Circles,
                    Drop (Cards, budget, Goals), Intro, Stories, Badges, booking rank, concerns
  ai/               Azure OpenAI gateway (rate limits, daily budgets, traces), agent loop, 19 tools,
                    Drop's chat, lab reader, Intro translation, Card wording, home insight
  auth/             Microsoft Entra sign-in, guest sessions, Azure records, "Your data" deletes
  booking/ calendar/  slot booking, Microsoft Calendar event and Graph email confirmation
  azure/            managed identity, private Blob Storage and account repository
  data/store.js     in-memory store over data/synthetic plus data/demo, and the demo clock
  routes/           REST API under /api
data/               synthetic world (generate.py), demo overlay and seed, clinical protocols
```

One Node process serves the API and built app from Azure App Service F1. GitHub Actions deploys with Azure OIDC and no stored cloud secret. Signed-in account data uses private Azure Blob Storage. Azure OpenAI and Blob access use the app's system-assigned managed identity.

## Tests

```bash
cd backend && npm test        # 156 tests: findings, eligibility, cover, privacy, Drop's rules, Goals,
                              # Intro, Badges, booking, sign-in, Your data, AI output checks
cd frontend && npm run type-check
```

## Documentation

| Doc | For |
|---|---|
| [docs/01-problem-brief.md](docs/01-problem-brief.md) | The problem, who it's for, why Gen AI, trust and open questions |
| [docs/02-product.md](docs/02-product.md) | What the app does, screen by screen; what is real and what is simulated; what isn't built |
| [docs/03-architecture.md](docs/03-architecture.md) | How it is built: modules, rules, AI layer, data, API, security, deployment |
| [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md) | Azure CLI, free-credit guardrails, provisioning, deployment and GitHub OIDC |
| [docs/04-pitch/](docs/04-pitch/) | Pitch narrative and deck (HTML and PDF) |
| [docs/05-submission/](docs/05-submission/) | Submission checklist and demo video script |
| [docs/drop/](docs/drop/README.md) | Team guide to Drop, with test scripts |
| [CONTEXT.md](CONTEXT.md) | The shared vocabulary (Donor, Drop, Card, Goal, Story, Badge…) |
| [docs/README.md](docs/README.md) | Every doc, including design records and the change log |

Pratidaan is a demonstration. It is not a medical device and gives no medical advice.
