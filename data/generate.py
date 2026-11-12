#!/usr/bin/env python3
"""
TraceDrop synthetic data generator.

Builds a fully synthetic, reproducible world for the donor-centric demo:
  institutions   blood centres, hospitals (type + district only), labs
  donors         300 donors incl. 6 scripted demo personas
  donations      donation visits with screening vitals (BP, pulse, Hb, weight)
  observations   lab panel from each visit's donor sample (LOINC-coded)
  components     every product made from each donation and its journey
                 (collected -> tested -> separated -> stored -> issued -> used),
                 with recipients recorded only as age band, sex and clinical
                 context - no identities, no hospital names
  communities    families, friend circles and employers
  policies       employer / retail health-insurance policies (base cover)
  fhir-bundles   the same data as FHIR R5 resources (Patient, Procedure,
                 Observation, BiologicallyDerivedProduct), one bundle per line

No real person, hospital, insurer or patient data is used.

Usage: python3 data/generate.py [--seed 42] [--as-of 2026-10-10] [--output data/synthetic]
"""

import argparse
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

DISTRICTS = ["Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Tumakuru", "Mandya", "Kolar", "Ramanagara"]
DISTRICT_WEIGHTS = [0.55, 0.1, 0.12, 0.07, 0.06, 0.05, 0.05]

CENTRES = [
    {"id": "BC-01", "name": "Bengaluru Central Blood Centre", "district": "Bengaluru Urban", "kind": "Regional blood centre"},
    {"id": "BC-02", "name": "Whitefield Community Blood Bank", "district": "Bengaluru Urban", "kind": "Community blood bank"},
    {"id": "BC-03", "name": "Mysuru District Blood Centre", "district": "Mysuru", "kind": "District blood centre"},
]

# Hospitals are deliberately recorded only by type and district (privacy by design)
HOSPITALS = [
    {"id": "H-01", "kind": "Government tertiary hospital", "district": "Bengaluru Urban"},
    {"id": "H-02", "kind": "Private multispecialty hospital", "district": "Bengaluru Urban"},
    {"id": "H-03", "kind": "Children's hospital", "district": "Bengaluru Urban"},
    {"id": "H-04", "kind": "Cancer centre", "district": "Bengaluru Urban"},
    {"id": "H-05", "kind": "Maternity hospital", "district": "Bengaluru Urban"},
    {"id": "H-06", "kind": "District hospital", "district": "Tumakuru"},
    {"id": "H-07", "kind": "Thalassaemia day-care centre", "district": "Bengaluru Urban"},
    {"id": "H-08", "kind": "District hospital", "district": "Mandya"},
    {"id": "H-09", "kind": "Government tertiary hospital", "district": "Mysuru"},
    {"id": "H-10", "kind": "Trauma and burns centre", "district": "Bengaluru Urban"},
]

LABS = [
    {"id": "LAB-01", "name": "Blood centre laboratory", "kind": "In-house (NABH-accredited blood centre)"},
    {"id": "LAB-02", "name": "Partner diagnostics laboratory", "kind": "NABL-accredited partner lab"},
]

# Clinical contexts a component can be used in: label, hospital ids, age range, sex
CONTEXTS = {
    "trauma": ("Emergency surgery after a road accident", ["H-10", "H-01", "H-09", "H-06"], (18, 55), None),
    "obstetric": ("Severe bleeding after childbirth", ["H-05", "H-01", "H-06", "H-08"], (20, 38), "F"),
    "thalassaemia": ("Regular transfusion for thalassaemia", ["H-07", "H-03"], (4, 16), None),
    "cardiac_surgery": ("Open-heart surgery", ["H-02", "H-01", "H-09"], (45, 72), None),
    "cancer": ("Chemotherapy for cancer", ["H-04", "H-02"], (30, 70), None),
    "leukaemia_child": ("Treatment for childhood leukaemia", ["H-03", "H-04"], (3, 14), None),
    "dengue": ("Severe dengue with dangerously low platelets", ["H-01", "H-02", "H-06", "H-08", "H-09"], (8, 60), None),
    "neonatal": ("Newborn intensive care", ["H-03", "H-05"], (0, 0), None),
    "liver": ("Liver disease with bleeding risk", ["H-01", "H-02", "H-09"], (35, 65), None),
    "burns": ("Severe burns treatment", ["H-10", "H-01"], (5, 60), None),
    "haemophilia": ("Bleeding episode in haemophilia", ["H-01", "H-03", "H-09"], (5, 40), "M"),
    "anaemia": ("Severe anaemia", ["H-06", "H-08", "H-01"], (15, 60), None),
    "kidney": ("Kidney disease and dialysis", ["H-01", "H-02"], (35, 70), None),
}

COMPONENT_USES = {
    "PRBC": [("trauma", 20), ("obstetric", 15), ("thalassaemia", 15), ("cardiac_surgery", 12),
             ("cancer", 12), ("anaemia", 13), ("kidney", 6), ("leukaemia_child", 7)],
    "PLT": [("dengue", 35), ("cancer", 20), ("leukaemia_child", 20), ("cardiac_surgery", 10), ("neonatal", 15)],
    "FFP": [("liver", 30), ("burns", 15), ("obstetric", 20), ("trauma", 20), ("cardiac_surgery", 15)],
    "CRYO": [("obstetric", 40), ("haemophilia", 30), ("trauma", 30)],
}

BLOOD_GROUPS = [("O+", 36), ("B+", 31), ("A+", 21), ("AB+", 7), ("O-", 2), ("B-", 1.5), ("A-", 1), ("AB-", 0.5)]
LANGUAGES = [("kn", 35), ("hi", 25), ("en", 25), ("ta", 8), ("te", 7)]

MALE_NAMES = ["Rahul", "Suresh", "Kiran", "Naveen", "Pradeep", "Manoj", "Sandeep", "Ajay", "Harish", "Ravi",
              "Deepak", "Vinay", "Girish", "Mahesh", "Prakash", "Sunil", "Anil", "Ramesh", "Abhishek", "Nikhil",
              "Varun", "Rohit", "Siddharth", "Akash", "Imran", "Joseph", "Faisal", "Lokesh", "Chetan", "Sachin"]
FEMALE_NAMES = ["Priya", "Divya", "Kavya", "Sneha", "Pooja", "Lakshmi", "Shruti", "Deepa", "Asha", "Swathi",
                "Nandini", "Bhavana", "Rekha", "Sowmya", "Anjali", "Fatima", "Mary", "Pallavi", "Rashmi", "Sindhu"]
SURNAMES = ["Kumar", "Reddy", "Gowda", "Shetty", "Nair", "Patil", "Hegde", "Naidu", "Prasad", "Murthy",
            "Bhat", "Joshi", "Khan", "Pillai", "Das", "Singh", "Rao", "Menon", "Iyengar", "D'Souza"]

# Demo personas: fixed visit timelines so every downstream story is coherent.
# visit = (date, status, systolic, diastolic, screening Hb g/dL, weight kg)
PERSONAS = {
    "D-001": {"name": "Arjun Rao", "sex": "M", "age": 34, "language": "kn", "group": "B+", "height": 174,
              "district": "Bengaluru Urban", "employer": "C-NIMBUS", "smoker": False, "family": ["hypertension"],
              "visits": [("2024-08-20", "completed", 126, 78, 14.9, 74), ("2025-07-15", "completed", 132, 82, 14.6, 77),
                         ("2026-06-25", "completed", 136, 86, 14.4, 79)],
              "labs": {"hba1c": [5.4, 5.5, 5.6], "ldl": [112, 120, 128], "hdl": [46, 44, 42], "tg": [138, 152, 168],
                       "ferritin": [120, 110, 105], "alt": [28, 32, 38]}},
    "D-002": {"name": "Meera Iyer", "sex": "F", "age": 28, "language": "ta", "group": "O+", "height": 160,
              "district": "Bengaluru Urban", "employer": None, "smoker": False, "family": [],
              "visits": [("2024-02-12", "completed", 112, 72, 13.1, 52), ("2024-09-18", "completed", 110, 70, 12.6, 52),
                         ("2025-06-20", "deferred", 108, 70, 12.1, 51), ("2026-07-09", "deferred", 110, 72, 11.8, 51)],
              "labs": {"ferritin": [32, 18, 11, 8], "mcv": [86, 82, 79, 76], "hba1c": [5.0, 5.0, 5.1, 5.0],
                       "ldl": [92, 95, 90, 94], "hdl": [58, 57, 59, 58], "tg": [88, 92, 85, 90]}},
    "D-003": {"name": "Ananya Sharma", "sex": "F", "age": 31, "language": "en", "group": "O-", "height": 165,
              "district": "Bengaluru Urban", "employer": "C-NIMBUS", "smoker": False, "family": [],
              "visits": [("2024-05-10", "completed", 114, 74, 13.6, 58), ("2025-03-02", "completed", 112, 72, 13.4, 58),
                         ("2025-11-20", "completed", 116, 76, 13.5, 59), ("2026-04-15", "completed", 114, 74, 13.7, 58)],
              "labs": {"hba1c": [5.1, 5.2, 5.1, 5.1], "ldl": [94, 92, 96, 92], "hdl": [62, 63, 61, 64],
                       "tg": [82, 78, 85, 80], "ferritin": [52, 48, 46, 55]}},
    "D-017": {"name": "Vikram Gowda", "sex": "M", "age": 42, "language": "kn", "group": "A+", "height": 170,
              "district": "Bengaluru Urban", "employer": "C-SAFFRON", "smoker": True, "family": ["diabetes", "heart disease"],
              "visits": [("2024-06-03", "completed", 136, 86, 15.1, 82), ("2025-08-21", "completed", 139, 88, 14.8, 84),
                         ("2026-10-03", "deferred", 184, 118, 14.6, 85)],
              "labs": {"hba1c": [5.9, 6.1, 6.3], "ldl": [150, 158, 165], "hdl": [38, 37, 36], "tg": [210, 230, 245]}},
    "D-033": {"name": "Rohan Verma", "sex": "M", "age": 30, "language": "hi", "group": "AB+", "height": 178,
              "district": "Bengaluru Urban", "employer": "C-SAFFRON", "smoker": False, "family": [],
              "visits": [("2025-04-10", "completed", 122, 78, 15.2, 72), ("2026-06-18", "completed", 120, 80, 15.0, 73)],
              "reactive_visit": 1},
    "D-050": {"name": "Karthik Menon", "sex": "M", "age": 38, "language": "en", "group": "B+", "height": 176,
              "district": "Bengaluru Urban", "employer": "C-NIMBUS", "smoker": False, "family": ["diabetes"],
              "visits": [("2024-01-15", "completed", 126, 80, 15.0, 80), ("2025-02-10", "completed", 132, 84, 14.7, 82),
                         ("2026-08-05", "completed", 138, 88, 14.9, 84)],
              "labs": {"hba1c": [5.6, 5.9, 6.1], "tg": [150, 172, 190], "ldl": [128, 134, 140]}},
}

LAB_TESTS = {  # key: (LOINC, display name, unit, ref low, ref high)
    "hb": ("718-7", "Haemoglobin", "g/dL", None, None),
    "wbc": ("6690-2", "White blood cells", "10^3/uL", 4.0, 11.0),
    "plt": ("777-3", "Platelets", "10^3/uL", 150, 410),
    "mcv": ("787-2", "Mean corpuscular volume", "fL", 80, 100),
    "hba1c": ("4548-4", "HbA1c", "%", None, 5.7),
    "tc": ("2093-3", "Total cholesterol", "mg/dL", None, 200),
    "ldl": ("13457-7", "LDL cholesterol", "mg/dL", None, 130),
    "hdl": ("2085-9", "HDL cholesterol", "mg/dL", 40, None),
    "tg": ("2571-8", "Triglycerides", "mg/dL", None, 150),
    "ferritin": ("2276-4", "Ferritin", "ng/mL", None, None),
    "alt": ("1742-6", "ALT (liver enzyme)", "U/L", None, 45),
    "creat": ("2160-0", "Creatinine", "mg/dL", None, None),
    "tsh": ("3016-3", "TSH (thyroid)", "mIU/L", 0.4, 4.5),
}
SEX_RANGES = {"hb": {"M": (13.0, 17.0), "F": (12.0, 15.5)}, "ferritin": {"M": (30, 400), "F": (15, 150)},
              "creat": {"M": (0.7, 1.3), "F": (0.5, 1.1)}}


def clamp(value, low, high):
    return max(low, min(high, value))


def iso(d):
    return d.isoformat()


class World:
    def __init__(self, seed, as_of):
        self.rng = random.Random(seed)
        self.seed = seed
        self.as_of = as_of
        self.donors, self.donations, self.observations, self.components = [], [], [], []
        self.communities = []

    def pick(self, weighted):
        items, weights = zip(*weighted)
        return self.rng.choices(items, weights=weights)[0]

    # ------------------------------------------------------------------ donors
    def make_donors(self, count):
        for i in range(1, count + 1):
            donor_id = f"D-{i:03d}"
            p = PERSONAS.get(donor_id)
            if p:
                sex, age, height = p["sex"], p["age"], p["height"]
                name, language, group, district = p["name"], p["language"], p["group"], p["district"]
                employer, smoker, family = p["employer"], p["smoker"], p["family"]
            else:
                sex = "M" if self.rng.random() < 0.8 else "F"
                age = int(clamp(self.rng.gauss(33, 8), 18, 62))
                first = self.rng.choice(MALE_NAMES if sex == "M" else FEMALE_NAMES)
                name = f"{first} {self.rng.choice(SURNAMES)}"
                language, group = self.pick(LANGUAGES), self.pick(BLOOD_GROUPS)
                district = self.rng.choices(DISTRICTS, weights=DISTRICT_WEIGHTS)[0]
                height = int(self.rng.gauss(171 if sex == "M" else 158, 6))
                employer = self.rng.choices(["C-NIMBUS", "C-SAFFRON", None], weights=[18, 12, 70])[0]
                smoker = self.rng.random() < (0.14 if sex == "M" else 0.03)
                family = self.rng.sample(["hypertension", "diabetes", "heart disease"], k=self.rng.choice([0, 0, 1, 1, 2]))
            self.donors.append({
                "id": donor_id, "name": name, "sex": sex, "age": age, "bloodGroup": group, "language": language,
                "district": district, "heightCm": height, "smoker": smoker, "familyHistory": family,
                "employerId": employer, "phone": f"+91 9{self.rng.randint(100000000, 999999999)}",
                "policyId": {"C-NIMBUS": "P-NIMBUS", "C-SAFFRON": "P-SAFFRON"}.get(employer, "P-RETAIL"),
                "consent": {"shareHealthWithInsurer": self.rng.random() < 0.85 or donor_id in PERSONAS,
                            "showOnLeaderboard": self.rng.random() < 0.8 or donor_id in PERSONAS,
                            "includeInCommunityStats": True},
                "communityIds": [],
            })

    # --------------------------------------------------------------- donations
    def make_donations(self):
        for donor in self.donors:
            p = PERSONAS.get(donor["id"])
            if p:
                visits = [(date.fromisoformat(d), s, sbp, dbp, hb, w) for d, s, sbp, dbp, hb, w in p["visits"]]
            else:
                visits = self.random_visits(donor)
            baseline = self.lab_baseline(donor, visits[0][5])
            for n, (d, status, sbp, dbp, hb, weight) in enumerate(visits):
                visit_id = f"{donor['id']}-V{n + 1}"
                reason = None
                if status == "deferred":
                    reason = "Low haemoglobin" if hb < 12.5 else "Blood pressure outside safe range"
                reactive = p is not None and p.get("reactive_visit") == n
                self.donations.append({
                    "id": visit_id, "donorId": donor["id"], "date": iso(d), "status": status,
                    "deferralReason": reason, "centreId": self.centre_for(donor), "volumeMl": 450 if weight >= 55 else 350,
                    "bagId": f"BAG-{d.strftime('%y%m%d')}-{self.rng.randint(1000, 9999)}",
                    "vitals": {"systolic": sbp, "diastolic": dbp, "pulse": self.rng.randint(66, 88),
                               "haemoglobin": hb, "weightKg": weight},
                    "confidentialFollowUp": reactive,
                })
                self.add_labs(donor, visit_id, d, n, hb, baseline, p)
                if status == "completed":
                    self.add_components(donor, visit_id, d, reactive)

    def centre_for(self, donor):
        return "BC-03" if donor["district"] == "Mysuru" else self.rng.choice(["BC-01", "BC-01", "BC-02"])

    def random_visits(self, donor):
        sex = donor["sex"]
        bmi_weight = clamp(self.rng.gauss(24.5 if sex == "M" else 23, 3.2), 18, 36) * (donor["heightCm"] / 100) ** 2
        sbp0 = self.rng.gauss(121 + 0.35 * (donor["age"] - 30), 10)
        dbp0 = self.rng.gauss(77 + 0.2 * (donor["age"] - 30), 7)
        hb0 = self.rng.gauss(14.7 if sex == "M" else 13.0, 0.9)
        count = self.rng.choices([1, 2, 3, 4, 5], weights=[15, 25, 30, 20, 10])[0]
        d = self.as_of - timedelta(days=self.rng.randint(150, 1080))
        visits = []
        for _ in range(count):
            if d > self.as_of - timedelta(days=5):
                break
            sbp = int(sbp0 + self.rng.gauss(0, 4))
            dbp = int(dbp0 + self.rng.gauss(0, 3))
            hb = round(hb0 + self.rng.gauss(0, 0.35), 1)
            weight = round(bmi_weight + self.rng.gauss(0, 1.2))
            ok = hb >= 12.5 and 100 <= sbp <= 140 and 60 <= dbp <= 90 and weight >= 45
            visits.append((d, "completed" if ok else "deferred", sbp, dbp, hb, weight))
            d += timedelta(days=self.rng.randint(110 if sex == "M" else 130, 420))
        return visits

    # -------------------------------------------------------------------- labs
    def lab_baseline(self, donor, weight):
        sex, age = donor["sex"], donor["age"]
        bmi = weight / (donor["heightCm"] / 100) ** 2
        r = self.rng
        return {
            "hba1c": clamp(r.gauss(5.3 + 0.012 * (age - 30) + 0.04 * (bmi - 23), 0.3), 4.6, 7.4),
            "ldl": clamp(r.gauss(104 + 0.8 * (age - 30) + 2 * (bmi - 23), 22), 55, 210),
            "hdl": clamp(r.gauss(54 if sex == "F" else 44, 8), 28, 85),
            "tg": clamp(r.gauss(118 + 4 * (bmi - 23), 32), 50, 320),
            "ferritin": clamp(r.lognormvariate(math.log(38 if sex == "F" else 110), 0.45), 6, 380),
            "alt": clamp(r.gauss(25 + (bmi - 23), 7), 8, 90),
            "creat": clamp(r.gauss(0.76 if sex == "F" else 0.96, 0.1), 0.5, 1.4),
            "tsh": clamp(r.lognormvariate(math.log(2.0), 0.35), 0.4, 8),
            "wbc": clamp(r.gauss(7.0, 1.3), 4.0, 11.5), "plt": clamp(r.gauss(260, 50), 150, 420),
            "mcv": clamp(r.gauss(88, 4), 76, 98),
        }

    def add_labs(self, donor, visit_id, d, n, hb, baseline, persona):
        scripted = (persona or {}).get("labs", {})
        values = {}
        for key, base in baseline.items():
            if key in scripted:
                values[key] = scripted[key][n]
            else:
                noise = {"hba1c": 0.08, "ldl": 6, "hdl": 2, "tg": 12, "ferritin": base * 0.08, "alt": 3,
                         "creat": 0.04, "tsh": 0.2, "wbc": 0.5, "plt": 12, "mcv": 1}[key]
                values[key] = base + self.rng.gauss(0, noise)
        values["hb"] = round(hb + self.rng.gauss(0, 0.1), 1)
        values["tc"] = values["ldl"] + values["hdl"] + values["tg"] / 5
        for key, (loinc, display, unit, low, high) in LAB_TESTS.items():
            if key in SEX_RANGES:
                low, high = SEX_RANGES[key][donor["sex"]]
            value = values[key]
            decimals = 1 if key in ("hb", "hba1c", "wbc", "tsh", "mcv") else (2 if key == "creat" else 0)
            self.observations.append({
                "id": f"OBS-{visit_id}-{key}", "donorId": donor["id"], "visitId": visit_id, "code": loinc,
                "key": key, "name": display, "value": round(value, decimals) if decimals else int(round(value)),
                "unit": unit, "low": low, "high": high, "date": iso(d), "source": "donation_sample",
                "labId": "LAB-01",
            })

    # -------------------------------------------------------------- components
    def recipient(self, kind):
        context_key = self.pick(COMPONENT_USES[kind])
        label, hospitals, (lo, hi), sex = CONTEXTS[context_key]
        return {"contextKey": context_key, "context": label, "hospitalId": self.rng.choice(hospitals),
                "age": self.rng.randint(lo, hi), "sex": sex or self.rng.choice(["M", "F"]),
                "outcome": self.rng.choices(["recovered", "ongoing", "not_reported"], weights=[70, 15, 15])[0]}

    def lifecycle(self, unit, d, issue_after, issue_prob, shelf_days):
        """Append storage/issue/use events; future events are cut at as_of."""
        events = unit["events"]
        events.append(("stored", d + timedelta(days=1)))
        if self.rng.random() < issue_prob:
            issued = d + timedelta(days=issue_after)
            used = issued + timedelta(days=self.rng.randint(0, 1))
            unit["recipient"] = self.recipient(unit["kind"])
            events += [("issued", issued), ("transfused", used),
                       ("outcome", used + timedelta(days=self.rng.randint(4, 14)))]
        else:
            events.append(("expired", d + timedelta(days=shelf_days)))

    def add_components(self, donor, visit_id, d, reactive):
        base_events = [("collected", d), ("tested", d + timedelta(days=1)), ("separated", d)]
        units = []

        def unit(kind):
            u = {"id": f"{visit_id}-{kind}", "donationId": visit_id, "donorId": donor["id"], "kind": kind,
                 "bloodGroup": donor["bloodGroup"], "events": list(base_events), "recipient": None,
                 "fractionation": None}
            units.append(u)
            return u

        prbc = unit("PRBC")
        if reactive:
            for u in [prbc]:
                u["events"].append(("withheld", d + timedelta(days=1)))
        else:
            self.lifecycle(prbc, d, self.rng.randint(2, 30), 0.95, 42)
            if self.rng.random() < 0.82:
                self.lifecycle(unit("PLT"), d, self.rng.randint(1, 4), 0.74, 5)
            if self.rng.random() < 0.3:
                self.lifecycle(unit("CRYO"), d, self.rng.randint(10, 200), 0.85, 365)
                plasma = unit("PLASMA")
                plasma["events"].append(("fractionation", d + timedelta(days=self.rng.randint(60, 180))))
            else:
                ffp = unit("FFP")
                if self.rng.random() < 0.62:
                    self.lifecycle(ffp, d, self.rng.randint(3, 240), 1.0, 365)
                else:
                    ffp["events"] += [("stored", d + timedelta(days=1)),
                                      ("fractionation", d + timedelta(days=self.rng.randint(150, 300)))]
            for u in units:
                if any(e == "fractionation" for e, _ in u["events"]):
                    u["fractionation"] = {"poolSize": self.rng.choice([1800, 2200, 2600]),
                                          "albuminVials": 0.5, "ivigVials": 0.2, "factorViiiIu": 45}
                    u["events"].append(("products_released", max(t for _, t in u["events"]) + timedelta(days=120)))

        for u in units:
            u["events"] = [{"type": t, "date": iso(when)} for t, when in sorted(u["events"], key=lambda e: e[1])
                           if when <= self.as_of]
            if not any(e["type"] == "issued" for e in u["events"]):
                u["recipient"] = None  # not used yet as of the simulation date
            elif not any(e["type"] == "outcome" for e in u["events"]):
                u["recipient"]["outcome"] = "ongoing"
            self.components.append(u)

    # ------------------------------------------------------------- communities
    def make_communities(self):
        by_id = {d["id"]: d for d in self.donors}
        others = [d for d in self.donors if d["id"] not in PERSONAS]

        def add(cid, name, kind, members, description):
            self.communities.append({"id": cid, "name": name, "kind": kind, "description": description,
                                     "memberIds": members})
            for m in members:
                by_id[m]["communityIds"].append(cid)

        for cid, name in [("C-NIMBUS", "Nimbus Technologies"), ("C-SAFFRON", "Saffron Logistics")]:
            members = [d["id"] for d in self.donors if d["employerId"] == cid]
            add(cid, name, "workplace", members, f"{name} employee blood-donor circle (fictional company)")

        rao = self.rng.sample(others, 5)
        for d in rao:
            d["name"] = d["name"].split()[0] + " Rao"
        add("C-RAOFAM", "Rao family", "family", ["D-001"] + [d["id"] for d in rao], "Arjun's family")

        iyer = self.rng.sample([d for d in others if d not in rao], 2)
        for d in iyer:
            d["name"] = d["name"].split()[0] + " Iyer"
        add("C-IYERFAM", "Iyer family", "family", ["D-002"] + [d["id"] for d in iyer], "Meera's family")

        pool = [d for d in others if d not in rao + iyer]
        add("C-CYCLE", "Sunday Cyclists", "friends",
            ["D-001", "D-003", "D-050"] + [d["id"] for d in self.rng.sample(pool, 6)], "Weekend cycling friends")
        add("C-ALUMNI", "Malleshwaram Alumni Circle", "friends",
            ["D-002", "D-003", "D-033"] + [d["id"] for d in self.rng.sample(pool, 18)], "College friends")

    # ------------------------------------------------------------------ export
    def fhir_bundles(self):
        obs_by, don_by, comp_by = {}, {}, {}
        for o in self.observations:
            obs_by.setdefault(o["donorId"], []).append(o)
        for v in self.donations:
            don_by.setdefault(v["donorId"], []).append(v)
        for c in self.components:
            comp_by.setdefault(c["donorId"], []).append(c)
        for d in self.donors:
            entries = [{"resourceType": "Patient", "id": d["id"], "gender": {"M": "male", "F": "female"}[d["sex"]],
                        "name": [{"text": d["name"]}], "address": [{"district": d["district"], "state": "KA", "country": "IN"}],
                        "communication": [{"language": {"coding": [{"system": "urn:ietf:bcp:47", "code": d["language"]}]}}]}]
            for v in don_by.get(d["id"], []):
                entries.append({"resourceType": "Procedure", "id": v["id"], "status": "completed" if v["status"] == "completed" else "not-done",
                                "code": {"text": "Whole blood donation"}, "subject": {"reference": f"Patient/{d['id']}"},
                                "occurrenceDateTime": v["date"], "location": {"reference": f"Location/{v['centreId']}"}})
            for o in obs_by.get(d["id"], []):
                entries.append({"resourceType": "Observation", "id": o["id"], "status": "final",
                                "code": {"coding": [{"system": "http://loinc.org", "code": o["code"], "display": o["name"]}]},
                                "subject": {"reference": f"Patient/{d['id']}"}, "effectiveDateTime": o["date"],
                                "valueQuantity": {"value": o["value"], "unit": o["unit"]}})
            for c in comp_by.get(d["id"], []):
                entries.append({"resourceType": "BiologicallyDerivedProduct", "id": c["id"],
                                "productCategory": {"text": "fluid" if c["kind"] in ("FFP", "PLASMA", "CRYO") else "cells"},
                                "productCode": {"text": c["kind"]}, "collection": {"collector": {"reference": f"Patient/{d['id']}"}},
                                "productStatus": {"text": c["events"][-1]["type"] if c["events"] else "collected"}})
            yield {"resourceType": "Bundle", "type": "collection", "id": f"bundle-{d['id']}",
                   "entry": [{"fullUrl": f"urn:tracedrop:{r['resourceType']}/{r['id']}", "resource": r} for r in entries]}

    def write(self, out):
        out.mkdir(parents=True, exist_ok=True)
        compact = {"separators": (",", ":")}
        files = {
            "institutions.json": {"asOf": iso(self.as_of), "bloodCentres": CENTRES, "hospitals": HOSPITALS, "labs": LABS},
            "donors.json": self.donors, "donations.json": self.donations, "observations.json": self.observations,
            "components.json": self.components, "communities.json": self.communities,
            "policies.json": [
                {"id": "P-NIMBUS", "sponsor": "Nimbus Technologies", "kind": "Employer group health policy",
                 "baseCover": 500000, "programmeStart": "2024-04-01"},
                {"id": "P-SAFFRON", "sponsor": "Saffron Logistics", "kind": "Employer group health policy",
                 "baseCover": 500000, "programmeStart": "2025-01-01"},
                {"id": "P-RETAIL", "sponsor": "Individual (retail) policy", "kind": "Individual health policy",
                 "baseCover": 500000, "programmeStart": "2024-01-01"},
            ],
        }
        for name, payload in files.items():
            (out / name).write_text(json.dumps(payload, ensure_ascii=False, **compact))
        with open(out / "fhir-bundles.jsonl", "w") as f:
            for bundle in self.fhir_bundles():
                f.write(json.dumps(bundle, **compact) + "\n")
        (out / "ground-truth.json").write_text(json.dumps({
            "seed": self.seed, "asOf": iso(self.as_of),
            "counts": {k: len(v) for k, v in [("donors", self.donors), ("donations", self.donations),
                                              ("observations", self.observations), ("components", self.components)]},
            "personas": {k: v["name"] for k, v in PERSONAS.items()},
        }, indent=2))
        for stale in ("findings.json", "lab_reports.json"):
            (out / stale).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Generate TraceDrop synthetic data")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--as-of", default="2026-10-10", help="Simulation date (events after it are not generated)")
    parser.add_argument("--donors", type=int, default=300)
    parser.add_argument("--output", default=str(Path(__file__).parent / "synthetic"))
    args = parser.parse_args()

    world = World(args.seed, date.fromisoformat(args.as_of))
    world.make_donors(args.donors)
    world.make_donations()
    world.make_communities()
    world.write(Path(args.output))
    print(f"Generated {len(world.donors)} donors, {len(world.donations)} donation visits, "
          f"{len(world.observations)} lab results, {len(world.components)} blood components, "
          f"{len(world.communities)} communities -> {args.output}")


if __name__ == "__main__":
    main()
