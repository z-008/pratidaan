# Clinical knowledge (`data/ontology/`)

Clinical protocols and lifestyle guidance that TraceDrop's rules and Drop's chat cite. All of it is hand-written seed data for the prototype. A clinical advisor has not reviewed it, and it is not medical advice.

## What the app reads

`backend/src/data/store.js` loads two files at start-up, and the Docker image ships this folder.

| File | Contents | Used by |
|---|---|---|
| `protocols.json` | 11 protocols, each with a name, recommended action, follow-up days, escalation threshold, lifestyle notes and monitoring intervals | `domain/health.js` tags each finding with a protocol id. `domain/goals.js` sets a Goal's next check from the follow-up days. `domain/goalWriteup.js` cites "Protocol BP-G1: …" as evidence. The chat's `get_protocol` tool returns it. |
| `lifestyle-recommendations.json` | 5 topics, each with a source and interventions with targets and expected effect | `domain/goalWriteup.js` cites them as each step's evidence, e.g. "Aerobic Exercise: 5-7 mmHg systolic (ICMR Guidelines, ACC/AHA 2017)". The chat's `get_lifestyle_guidance` tool returns them. |

### Protocols

| Id | Name | Follow-up | Set by the finding |
|---|---|---|---|
| `BP-G1` | Blood Pressure Grade 1 Hypertension | 21 days | BP ≥ 140/90 |
| `BP-G2` | Blood Pressure Grade 2 Hypertension | 7 days | BP ≥ 160/100 |
| `BP-URGENCY` | Hypertensive Urgency/Emergency | same day | BP ≥ 180/120 |
| `HB-DEF` | Mild to Moderate Anemia | 14 days | Hb below the donation minimum, or ferritin < 15 |
| `HB-SEV` | Severe Anemia | 1 day | Hb < 7 |
| `DM-PREDIAB` | Prediabetes Management | 90 days | HbA1c 5.7–6.4% |
| `DM-DIAB` | Diabetes Mellitus Management | 30 days | HbA1c ≥ 6.5% |
| `CARDIAC-MON`, `RENAL-MON`, `EYE-SCREEN`, `STROKE-EMERG` | Monitoring and emergency protocols | 0–365 days | Not set by any current finding; available to the chat |

### Lifestyle topics

| Topic | Source | Interventions |
|---|---|---|
| `hypertension_grade1` | ICMR Guidelines, ACC/AHA 2017 | Dietary sodium restriction, DASH diet, aerobic exercise, weight loss, alcohol moderation, stress management, sleep |
| `diabetes_management` | ICMR Diabetes Guidelines, ADA Standards | Carbohydrate quality, portion control, fibre, physical activity, weight, glucose self-monitoring, foot care |
| `prediabetes_reversal` | Diabetes Prevention Program | Structured weight loss, moderate-intensity activity, dietary pattern |
| `anemia_management` | WHO Guidelines | Iron-rich foods, vitamin C with meals, avoiding iron inhibitors, protein |
| `general_cardiovascular_health` | ACC/AHA 2019 Guidelines | Mediterranean diet, smoking cessation, stress reduction, social engagement |

## Reference material (not loaded by the app)

These were written for the first design, which planned a knowledge-graph database and embedding search. The current app uses neither. They are kept as reference for a future clinical review.

| File | Contents |
|---|---|
| `concepts.json` | 16 concepts (8 conditions, 2 interventions, 6 lifestyle areas) with SNOMED-CT and ICD-10 codes, definitions and risk factors |
| `relationships.json` | 42 edges between concepts (`increases_risk_of`, `improved_by`, …) with a strength and evidence note |
| `medical-coding.json` | ICD-10, LOINC, SNOMED-CT and ATC mappings |
| `test-values-ranges.json` | Reference ranges by test group |
| `embeddings.json` | Placeholder 384-dimension vectors per concept, not from a real embedding model |
| `neo4j-init.cypher` | A script that loads the concepts and protocols into Neo4j |

## Changing the rules

The thresholds that decide findings and Goals are code, not data: see `backend/src/domain/health.js` and `goals.js`, and the tables in [docs/03-architecture.md](../../docs/03-architecture.md#health-findings-score-and-eligibility). If you change a protocol's follow-up days or an intervention's wording here, run `cd backend && npm test`. The Goal tests check the cited evidence.
