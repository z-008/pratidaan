# Pratidaan: problem brief

**Theme:** Sustainability & Social Impact ("supporting communities", "more informed and sustainable decisions")
**Framed:** 8 Oct 2026 · **Reframed to match the build:** 16 Oct 2026
**See also:**
- [what the app does](02-product.md)
- [how it is built](03-architecture.md)
- [pitch](04-pitch/pitch-narrative.md)
- [submission kit](05-submission/)

> **Give blood. See every life it touches.**
> Pratidaan shows each donor where every part of their blood went and who it helped, without revealing who. It turns the free health check in every donation into a light follow-up between donations, and it lets good health raise the donor's insurance cover. Each of these is a reason to give again.

## 1. The problem

India collected about **1.57 crore** units of blood in 2025 ([Rajya Sabha Q1882, 2026](https://sansad.in/getFile/annex/271/AU1882_86ur4G.pdf?source=pqars), our sum of the state rows). Behind each unit is a donor, and the system gives that donor almost nothing back.

**1. The gift disappears.**
- A donation is separated into red cells, platelets and plasma, which can reach different patients: someone in surgery, a child with dengue, a mother after childbirth.
- The donor never hears about any of it. They get a certificate, a snack and silence.
- Feedback works elsewhere. Since about 2012, Stockholm's blood service has texted donors when their blood is used, to bring them back ([The Independent, 2015](https://www.independent.co.uk/news/world/europe/blood-donors-in-sweden-get-a-text-message-whenever-someone-is-helped-with-their-blood-10310101.html); [Smithsonian, 2015](https://www.smithsonianmag.com/smart-news/social-media-helping-increase-blood-bank-stores-sweden-180955676/)). That text says only *that* the blood was used. It doesn't say where, for what, or how the parts went their separate ways.

**2. The health check goes nowhere.**
- Every donor's blood pressure and haemoglobin are measured. Every unit is screened for HIV, hepatitis B and C, syphilis and malaria ([CDSCO](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadBloodBank/Blood%20Centre%20Division_FAQs.pdf)).
- Blood centres are the country's largest routine health check of healthy working-age adults. Yet donors who pass take nothing home.
- Only 29% of Indian adults aged 30–69 with raised BP know they have it ([ICMR-NCDIR](https://www.ncdirindia.org/nnms/resources/Chapter_4_4_2.pdf)), and 35.5% of adults have hypertension ([ICMR-INDIAB 2023](https://pubmed.ncbi.nlm.nih.gov/37301218/)).
- Returning results alone isn't enough:
  - Japan has sent donors their results since 1982.
  - Taiwan's donor screening found "limited benefits… without additional interventions" ([Vox Sang 2025](https://pubmed.ncbi.nlm.nih.gov/39414251/)).
  - In New York, only 21% of donors with newly found risk factors sought care within 60 days ([Transfusion 2012](https://pubmed.ncbi.nlm.nih.gov/22320854/)).

**3. Turned-away donors drift away.**
- Donors above 140/90 are turned away. About 12 lakh a year may be deferred for low haemoglobin (**estimate**, [Ghosh 2026](https://jhas-bsh.com/burden-of-anemia-in-india-should-hematologists-and-transfusion-medicine-experts-be-mere-spectators/)).
- 57% of Indian women are anaemic ([NFHS-5](https://sansad.in/getFile/loksabhaquestions/annex/184/AU787_fRoZaf.pdf?source=pqals)), and 53.5% of women who came to donate in one Pune study were deferred ([2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2937288/)).
- They hear "come back later", with no reason they understand and no path back. Deferred first-time donors return at about half the rate of others ([Custer 2007](https://pubmed.ncbi.nlm.nih.gov/17655597/)).

**Why it matters beyond the donor:** the safest blood supply is repeat voluntary donors. Every donor who gives once and never again, or is turned away and never returns, is supply lost. A donor who sees what their blood did, who stays healthy enough to give, and who gains something for their health has three reasons to come back.

## 2. The person in a moment

> I gave blood at my office camp on 3 October. I'd like to know if it actually helped anyone. And the nurse said my BP was 148/94, which apparently means I can't give next time. Is that bad? It's been creeping up for a while, but nobody ever told me that, and I don't know what to do about it.

**Arjun, 34**, a software engineer in Bengaluru, gives at office camps in Whitefield. High blood pressure runs in his family. The centre has measured his BP at four donations, 126 → 132 → 136 → 148, rising every time, and each reading sits on a different visit's form. (Arjun is a synthetic persona; these numbers are the prototype's.)

Why him:
- BP is measured for every donor at every visit.
- ICMR's screening workflow counts a screening reading as a first reading towards a diagnosis ([ICMR STW, May 2026](https://www.icmr.gov.in/icmrobject/uploads/STWs/1778941063_hypertensioninadults_final.pdf)), so a donation reading is a real first step, and the next one is clear.
- He shows all three parts at once: his platelets reached a patient five days after he gave, his results need a follow-up, and his insurance cover is a few health points from the next step.

**Meera, 28,** is the second persona. She has been turned away twice for low haemoglobin (11.8; she needs 12.5). Her path back to donating runs through iron-rich food and a blood test.

## 3. What Pratidaan does

The donor is at the centre. Everything else is built around what they get.

**1. See every life your blood touches.** Each part of each donation is followed from collection to the patient. The donor sees what it was used for and the type of hospital. They see the patient's age band and sex only if at least five patients share that description; otherwise the details are generalised. When a part reaches someone, Drop sends a short **Story** that ends on a postcard the donor can share. **Badges** mark milestones ("5 patients", "Nothing wasted", "Helped a child"). Families, workplaces and friends see their combined impact as **Circles**.

**2. Stay well between donations.** The donation's own results are explained in plain words. A finding worth acting on becomes a **Goal** with one target ("BP under 130/80") and two or three steps, each citing the guidance it comes from. **Drop**, Pratidaan's assistant, checks in every two weeks, offers a check-up, sets reminders the donor asks for, and says exactly when they can donate again. It sends at most one new Card a day and is silent at night. Urgent findings skip all of that and say: see a doctor today.

**3. Better cover for staying healthy.** Like a credit limit that rises with good repayment, health-insurance cover steps up at the same premium (₹5 lakh → 6 → 7 → 8) when the health score shows lower risk. The donor must consent, the insurer sees only the score, and the maths is transparent. (Illustrative in the prototype.)

**Around the donor:**
- what their contribution meant for the blood centre, hospitals, labs, public health programmes and society;
- a network-wide ecosystem view;
- guided booking;
- **Your data**, which shows everything kept and deletes any of it.

## 4. What donors use today

| Option | Promise | Where it breaks | Source |
|---|---|---|---|
| **Indian blood centres** | A certificate; a "mini health check"; confidential counselling for reactive screens | No news of the blood's use; no results for donors who pass; "come back later" for deferrals. Only a third of reactive donors reach counselling. | [16-study review](https://pubmed.ncbi.nlm.nih.gov/38157224/) |
| **Sweden (Stockholm blood service)** | A text when the blood is used | Only *that* it was used, not where or for what; no health follow-up | [The Independent](https://www.independent.co.uk/news/world/europe/blood-donors-in-sweden-get-a-text-message-whenever-someone-is-helped-with-their-blood-10310101.html) |
| **Japan: Red Cross, Love Blood app** | 15 blood values after each donation, since 1982 | Reference ranges are "not normal/abnormal judgements"; no next step | [JRC](https://www.bs.jrc.or.jp/ktks/tokyo/donation/m2_02_03_index4.html) |
| **Taiwan: screening for donors over 40** | HbA1c and cholesterol | 42.7% didn't know they'd been screened; "limited benefits… without additional interventions" | [Vox Sang 2025](https://pubmed.ncbi.nlm.nih.gov/39414251/) |
| **Health-record apps** (Aarogya Setu 2.0, Eka Care) | Records and AI trends; Aarogya Setu 2.0 added OCR "Smart Reports" on 29 June 2026 | No link to donation, no follow-up, no impact | [PIB, Jul 2026](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jul/doc202676912801.pdf) |
| **Insurer wellness programmes** | Discounts or rewards for healthy behaviour, allowed under IRDAI's wellness guidelines | Generic step counts and gym visits; nothing uses the free lab panel donors already get | [IRDAI 2020](https://static.investindia.gov.in/s3fs-public/2022-09/Guidelines%20on%20Wellness%20and%20Preventive%20Features%20-%2004092020.pdf) |
| **Doing nothing** | | The main competitor: no symptoms, so no action. In Andhra Pradesh only 6% of high-risk people who were followed up got a confirmatory test. | [UDAY 2018](https://doi.org/10.1080/16549716.2017.1416744) |

Every piece exists somewhere: impact feedback (Sweden), results (Japan), records (ABHA), free care (Ayushman Arogya Mandirs, eSanjeevani), wellness-linked insurance (IRDAI). **Nothing puts them together around the donor.**

## 5. Who it serves

| Group | Size | Note |
|---|---|---|
| Blood donations | 1.57 crore in 2025 | Every donor gets a journey and a health check |
| Low-haemoglobin deferrals | about 12 lakh a year | **estimate**, [Ghosh 2026](https://jhas-bsh.com/burden-of-anemia-in-india-should-hematologists-and-transfusion-medicine-experts-be-mere-spectators/) |
| High-BP deferrals | not published | |
| Adults donors are drawn from | Hypertension 35.5%, diabetes 11.4%, prediabetes 15.3% | [ICMR-INDIAB](https://pubmed.ncbi.nlm.nih.gov/37301218/) |

- **Starting group:** donors at 2–3 Bengaluru blood centres that run company camps, where an employer group policy already exists.
- **Badly served today:**
  - urban working adults who never see a doctor;
  - men with anaemia (outside Anaemia Mukt Bharat);
  - women, who are deferred most;
  - anyone outside English and Hindi.

## 6. The 10x

**Primary dimension: continuity.** Today each donation starts from zero and ends in silence. With Pratidaan, every donation adds to one record the donor can see, and the next donation becomes the next check-up.

| Measure | Today | With Pratidaan | Where shown |
|---|---|---|---|
| Donors who learn what their blood did | Almost none in India | Every donor: every part traced to an anonymised patient | Prototype |
| Donors who leave knowing what their numbers mean and what to do | About none | Every donor: plain-language results; a Goal with one target and cited steps | Prototype |
| Deferred donors given a path back | None | A Goal whose target is the donation threshold, Check-ins, and "you can donate again" when it is met | Prototype (Meera) |
| Donors who know when they can give next | Few | A countdown, and slots offered three weeks before | Prototype |
| Repeat donation and return after deferral | Deferred first-time donors return at about half the rate | Target: measurably higher | Pilot only |

The prototype shows the experience. It doesn't measure outcomes. **No outcome figures are claimed.**

## 7. Why Gen AI, and where it stops

Most of Pratidaan is deliberately ordinary code:

- Every Card, Goal, target, threshold and cover step comes from fixed rules, unit-tested, so the same history always gives the same result.
- A model never decides anything about safety, eligibility, money or privacy.

Gen AI does the three jobs rules can't:

| Job | Without Gen AI | With Gemini |
|---|---|---|
| **Answer any question across the whole picture,** in the donor's language ("why can't I donate?", "where did my platelets go?", "how do I get to ₹6 lakh?", "my BP was 141/90 today") | A fixed FAQ in one language, or a person | **Drop's chat**: an agent with 18 donor-scoped tools that looks things up, combines them, shows a chart, offers a check-up, saves a reading, remembers a preference and opens the right screen, in English, Hindi, Kannada, Tamil, Telugu or Malayalam. Inside a Goal's Chat it keeps to that Goal's steps. |
| **Read any lab's report** | Integration with every lab (only 491 labs are on ABDM), or typing it in | **The lab-report reader**: a photo or text from any lab, mapped to 16 LOINC-coded markers with unit conversion. Schema- and range-checked, and confirmed by the donor. |
| **Meet the donor in their language** | Translators for every screen | **The Intro** is translated on first view, and a line is kept only if every number survives |

**Remove-Gemini test:** the app still runs, and the Cards, Goals, impact and cover all work. What's lost is the conversation. Donors can't ask in their own words or language, and outside reports can't be read. Each AI feature has a rule-based fallback that says so.

**Google stack in the build:** Gemini 3.1 Flash-Lite on Vertex AI, Cloud Run, Artifact Registry, Workload Identity Federation, Firestore, Google Sign-In, Calendar and Gmail APIs.

## 8. Trust and responsibility

- **No diagnosis, no prescribing.** Only a registered medical practitioner can counsel or prescribe ([Telemedicine Practice Guidelines 2020 §5.4](https://nhm.assam.gov.in/sites/default/files/swf_utility_folder/departments/nhm_lipl_in_oid_6/portlet/level_2/telemedicine_260320.pdf)).
  - Findings come from fixed thresholds (ACC/AHA 2017, ICMR) and say "a doctor confirms every finding".
  - Goal steps cite their protocol, and Drop never claims a doctor gave them.
  - Urgent findings (BP ≥ 180/120, Hb < 7) always come first and say to see a doctor today. An urgent Goal suggests no exercise until a doctor has seen the donor.
- **Recipients stay anonymous.**
  - Recipient details are released only when at least 5 patients share them; otherwise they are generalised.
  - Dates are rounded to the month.
  - Share images show even less: no age, sex, place or blood group.
- **Infection results never appear.** A unit withheld for safety says only that, and the counsellor contacts the donor privately.
- **Consent and minimal sharing.**
  - Insurer sharing is off unless the donor turns it on, and then only the score is shared.
  - Circles see totals, and names only for those who opt in.
  - **Your data** lists everything kept and deletes it.
  - The prototype follows the spirit of the DPDP Act; a deployment would need a full review.
- **Drop's memory is narrow.** It holds only stated schedule and language preferences, never health facts, medicines, religion, caste or income.
- **No inducement to donate.**
  - Indian rules prohibit paying donors in cash or kind (Drugs and Cosmetics Rules, Rule 122EA), and care must never depend on donating.
  - In Pratidaan, a deferred donor gets the same follow-up, and health checks are never sold as a reason to give.
  - **Open risk:** the illustrative cover model counts donation visits as its "monitored visits" and shows a "regular blood donor" premium discount. A deployment must count any monitored health check and drop the donor discount unless regulators agree it is not an inducement. See open questions.
- **Test-seeking.** Infection testing is never offered as a benefit. A pilot would track discard rates ([Tanzania 2026](https://pubmed.ncbi.nlm.nih.gov/42101332/)).
- **Honest demo.** Slots, check-ups, the QR pass, cover and concerns are labelled as simulated or illustrative in the app, the Calendar event and the email. All donor data is synthetic.
- **Regulation.** A deployment would likely register with CDSCO as medical device software ([MDSW guidance, Jul 2026](https://www.cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/Guidance-document-on-Medical-Device-Software-under-MDR-2017.pdf)), and follow ICMR's 2023 AI ethics guidelines.

## 9. Who pays, and how it scales

- **The donor pays nothing.**
- **Blood centres and State Blood Transfusion Councils:** repeat donors are their safest and cheapest supply, and donor follow-up is already their duty.
- **Employers:** most demo donors are on an employer group policy. Health-linked cover and Circle impact are a wellness benefit, alongside the OSH Code's annual check-ups.
- **Insurers:** lower-risk members, with consent, under IRDAI's wellness guidelines. Cover headroom comes from lower expected claims, not from a subsidy.
- **Government:** an anonymised screening signal (BP, prediabetes, anaemia) from adults who otherwise rarely meet the health system.

**Path:**
1. Start with company camps at a few Bengaluru centres, with the employer's group policy.
2. Then all donors at those centres.
3. Then State Blood Transfusion Councils and eRaktKosh.
4. Then other states and languages.
5. Then JAPAC blood services that already return results or feedback (Japan, Taiwan, Singapore) but don't combine journey, health and cover.

## 10. How the idea changed

The first framing (8 Oct) was a **navigator**: Gen AI carrying each donor from a finding to care. It had:
- a counsellor's disclosure queue for infection results;
- a doctor approving every plan;
- WhatsApp delivery;
- a FHIR store, BigQuery funnels and ADK agents.

Building it showed three things:

1. **The donor, not the finding, is the centre.** Health follow-up alone doesn't bring someone back to donate. Seeing what their blood did does, and so does a concrete health or financial benefit. The product became the donor's app, built around the blood's journey, with health and cover as reasons to return.
2. **Rules are safer than an agent for anything clinical.** Which Card to send, when, with what target and which steps is now fixed code with tests. The AI answers questions, reads reports and speaks the donor's language, and every output is checked.
3. **A demo must not claim what it doesn't do.** The doctor and counsellor consoles, infection disclosure, FHIR store, BigQuery, Maps, WhatsApp and voice were not built and are not claimed. Neither are the first plan's projected metrics (92% reaching care, 85% day-1 return); they were never measured.

**What carried over:**
- Arjun's rising BP;
- Meera's deferral;
- fixed red-flag rules;
- no inducements;
- synthetic data only.

## 11. Open questions

- **Cover and inducement:**
  - Would health-linked cover breach the no-inducement rule if monitored visits include donations?
  - Should the "regular donor" premium discount exist at all?
  - These need a legal opinion before any pilot.
- **Partner insurer:** real rating factors in place of the illustrative ones (relative risk e^(−0.0115 × (score − 70)), claims elasticity 0.6, cap 1.6× base), and the IRDAI filing route.
- **Clinical advisor:** sign-off on the thresholds, the Goal targets and the wording of every step.
- **Component-level data:** do blood centres' systems (eRaktKosh, hospital issue records) record which unit went to which hospital and use, so that journeys can be real?
- **Privacy threshold:** is k = 5 enough for small districts, or should the threshold scale with population?
- **AI-written Goal steps:** Google Cloud's terms restrict use for clinical purposes. Until that is resolved, steps stay rule-written.
- **Search-summary claims:** the 12 lakh low-Hb deferrals figure came from a search summary and should be checked against the source.

## 12. Fit with the judging criteria

| Criterion | Weight | How Pratidaan answers it |
|---|---|---|
| Technical Merit & Gen AI | 40% | An agent with 18 donor-scoped tools, multimodal lab reading and multilingual translation, all on Vertex AI behind a gateway with rate limits, budgets, traces and checked outputs. Deterministic engines for everything safety-critical, with 152 tests. Deployed on Cloud Run with CI/CD. |
| Problem Alignment & Impact | 25% | Blood supply depends on donors returning. Pratidaan gives each donor three reasons to: impact, health and cover. Every baseline is sourced. |
| Innovation & Creativity | 25% | The blood's journey, part by part, with privacy by construction. The donation as a recurring health check that leads back to donating. Health-linked cover that rises like a credit limit. |
| User Experience | 10% | One assistant on every screen, at most one Card a day, a one-minute Intro in six languages, and "Your data" with real deletes. |
