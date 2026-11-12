// TraceDrop Medical Ontology - Neo4j Initialization Script
// This script creates the knowledge graph structure for TraceDrop Phase 1

// === CREATE CONCEPT NODES ===

// Cardiovascular Conditions
CREATE (hypertension:Concept {
  id: 'hypertension',
  name: 'Hypertension',
  snomedCode: '38341003',
  category: 'cardiovascular',
  definition: 'Persistently elevated blood pressure, systolic >= 140 mmHg or diastolic >= 90 mmHg',
  prevalence: 'high',
  severity: 'moderate'
});

CREATE (heart_disease:Concept {
  id: 'heart_disease',
  name: 'Coronary Heart Disease',
  snomedCode: '53741008',
  category: 'cardiovascular',
  definition: 'Disease of the heart blood vessels, often characterized by atherosclerotic plaque buildup',
  prevalence: 'high',
  severity: 'high'
});

CREATE (stroke:Concept {
  id: 'stroke',
  name: 'Cerebrovascular Accident',
  snomedCode: '230690007',
  category: 'neurological',
  definition: 'Sudden interruption of blood supply to the brain, causing neurological deficit',
  prevalence: 'high',
  severity: 'critical'
});

// Metabolic Conditions
CREATE (diabetes:Concept {
  id: 'diabetes',
  name: 'Diabetes Mellitus',
  snomedCode: '73211009',
  category: 'metabolic',
  definition: 'Metabolic disorder characterized by elevated fasting blood glucose >= 126 mg/dL or HbA1c >= 6.5%',
  prevalence: 'very_high',
  severity: 'high'
});

CREATE (prediabetes:Concept {
  id: 'prediabetes',
  name: 'Prediabetes',
  snomedCode: '15777000',
  category: 'metabolic',
  definition: 'Impaired fasting glucose or impaired glucose tolerance, intermediate hyperglycemia without diabetes',
  prevalence: 'high',
  severity: 'low'
});

// Hematologic Conditions
CREATE (anemia:Concept {
  id: 'anemia',
  name: 'Anemia',
  snomedCode: '271737000',
  category: 'hematologic',
  definition: 'Reduction in hemoglobin levels below reference range, reducing oxygen-carrying capacity',
  prevalence: 'high',
  severity: 'variable'
});

// Renal Conditions
CREATE (kidney_disease:Concept {
  id: 'kidney_disease',
  name: 'Chronic Kidney Disease',
  snomedCode: '709044004',
  category: 'renal',
  definition: 'Progressive loss of kidney function over months or years, assessed by GFR and proteinuria',
  prevalence: 'moderate',
  severity: 'progressive'
});

// Ophthalmologic Conditions
CREATE (retinopathy:Concept {
  id: 'retinopathy',
  name: 'Diabetic Retinopathy',
  snomedCode: '4855003',
  category: 'ophthalmologic',
  definition: 'Microvascular complication of diabetes affecting retinal blood vessels, potentially leading to blindness',
  prevalence: 'moderate',
  severity: 'progressive'
});

// Interventions
CREATE (monitoring:Concept {
  id: 'monitoring',
  name: 'Regular Health Monitoring',
  snomedCode: '386408001',
  category: 'intervention',
  definition: 'Systematic clinical oversight and periodic assessment of health status and disease progression',
  prevalence: 'universal',
  severity: 'preventive'
});

// Lifestyle Modifications
CREATE (exercise:Concept {
  id: 'exercise',
  name: 'Physical Activity',
  snomedCode: '89670000',
  category: 'lifestyle',
  definition: 'Structured physical exercise and activity to improve cardiovascular health and metabolic function',
  prevalence: 'universal',
  severity: 'preventive'
});

CREATE (diet:Concept {
  id: 'diet',
  name: 'Dietary Modifications',
  snomedCode: '160670007',
  category: 'lifestyle',
  definition: 'Structured dietary changes including reduced sodium, balanced macronutrients, and whole foods',
  prevalence: 'universal',
  severity: 'preventive'
});

CREATE (stress_management:Concept {
  id: 'stress_management',
  name: 'Stress Management',
  snomedCode: '226063009',
  category: 'lifestyle',
  definition: 'Psychological interventions including meditation, breathing exercises, and behavioral techniques',
  prevalence: 'universal',
  severity: 'preventive'
});

CREATE (weight_management:Concept {
  id: 'weight_management',
  name: 'Weight Management',
  snomedCode: '408289007',
  category: 'lifestyle',
  definition: 'Structured program for achieving and maintaining healthy weight through diet and exercise',
  prevalence: 'universal',
  severity: 'preventive'
});

CREATE (smoking_cessation:Concept {
  id: 'smoking_cessation',
  name: 'Tobacco Cessation',
  snomedCode: '184789009',
  category: 'lifestyle',
  definition: 'Structured support and interventions to stop tobacco smoking',
  prevalence: 'high_need',
  severity: 'preventive'
});

CREATE (medication_adherence:Concept {
  id: 'medication_adherence',
  name: 'Medication Compliance',
  snomedCode: '418633004',
  category: 'intervention',
  definition: 'Systematic adherence to prescribed medications for chronic disease management',
  prevalence: 'universal',
  severity: 'critical'
});

CREATE (alcohol_reduction:Concept {
  id: 'alcohol_reduction',
  name: 'Alcohol Reduction',
  snomedCode: '228366006',
  category: 'lifestyle',
  definition: 'Reduction or elimination of alcohol consumption to safe limits',
  prevalence: 'moderate_need',
  severity: 'preventive'
});

// === CREATE PROTOCOL NODES ===

CREATE (bp_g1:Protocol {
  id: 'BP-G1',
  name: 'Blood Pressure Grade 1 Hypertension',
  category: 'hypertension_management',
  applicableCondition: 'Systolic 140-159 mmHg OR Diastolic 90-99 mmHg',
  severity: 'mild_to_moderate',
  followUpDays: 21,
  escalationThreshold: '160/100 mmHg'
});

CREATE (bp_g2:Protocol {
  id: 'BP-G2',
  name: 'Blood Pressure Grade 2 Hypertension',
  category: 'hypertension_management',
  applicableCondition: 'Systolic 160-179 mmHg OR Diastolic 100-109 mmHg',
  severity: 'moderate_to_severe',
  followUpDays: 7,
  escalationThreshold: '>=180/>=120 mmHg'
});

CREATE (bp_urgency:Protocol {
  id: 'BP-URGENCY',
  name: 'Hypertensive Urgency/Emergency',
  category: 'hypertension_emergency',
  applicableCondition: 'BP >=180/>=120 mmHg',
  severity: 'critical',
  followUpDays: 0,
  escalationThreshold: 'Emergency evaluation required'
});

CREATE (hb_def:Protocol {
  id: 'HB-DEF',
  name: 'Mild to Moderate Anemia',
  category: 'anemia_management',
  applicableCondition: 'Hemoglobin 7-12 g/dL',
  severity: 'mild_to_moderate',
  followUpDays: 14,
  escalationThreshold: '<7 g/dL'
});

CREATE (hb_sev:Protocol {
  id: 'HB-SEV',
  name: 'Severe Anemia',
  category: 'anemia_management',
  applicableCondition: 'Hemoglobin <7 g/dL',
  severity: 'critical',
  followUpDays: 1,
  escalationThreshold: '<5 g/dL'
});

CREATE (dm_prediab:Protocol {
  id: 'DM-PREDIAB',
  name: 'Prediabetes Management',
  category: 'diabetes_prevention',
  applicableCondition: 'Fasting glucose 100-125 mg/dL OR HbA1c 5.7-6.4%',
  severity: 'low_reversible',
  followUpDays: 90,
  escalationThreshold: 'Progression to diabetes'
});

CREATE (dm_diab:Protocol {
  id: 'DM-DIAB',
  name: 'Diabetes Mellitus Management',
  category: 'diabetes_management',
  applicableCondition: 'Fasting glucose >=126 mg/dL OR HbA1c >=6.5%',
  severity: 'moderate_to_high',
  followUpDays: 30,
  escalationThreshold: 'HbA1c >9%'
});

// === CREATE RELATIONSHIPS: CONDITIONS ===

// Hypertension increases risk of complications
CREATE (hypertension)-[:INCREASES_RISK_OF {strength: 0.85, evidence: 'Major risk factor for coronary artery disease'}]->(heart_disease);
CREATE (hypertension)-[:INCREASES_RISK_OF {strength: 0.92, evidence: 'Leading modifiable risk factor for stroke'}]->(stroke);
CREATE (hypertension)-[:INCREASES_RISK_OF {strength: 0.78, evidence: 'Hypertension damages glomerular filtration'}]->(kidney_disease);

// Diabetes increases risk of complications
CREATE (diabetes)-[:INCREASES_RISK_OF {strength: 0.90, evidence: 'Diabetics have 2-4x higher cardiovascular risk'}]->(heart_disease);
CREATE (diabetes)-[:INCREASES_RISK_OF {strength: 0.85, evidence: 'Diabetes doubles stroke risk'}]->(stroke);
CREATE (diabetes)-[:INCREASES_RISK_OF {strength: 0.88, evidence: 'Leading cause of chronic kidney disease'}]->(kidney_disease);
CREATE (diabetes)-[:INCREASES_RISK_OF {strength: 0.95, evidence: 'Leads to vision loss if uncontrolled'}]->(retinopathy);
CREATE (diabetes)-[:INCREASES_RISK_OF {strength: 0.65, evidence: 'Chronic kidney disease from diabetes causes anemia'}]->(anemia);

// Prediabetes progression
CREATE (prediabetes)-[:INCREASES_RISK_OF {strength: 0.95, evidence: 'Prediabetes progresses to diabetes in 30% within 3-5 years'}]->(diabetes);

// Heart disease and stroke share common pathology
CREATE (heart_disease)-[:INCREASES_RISK_OF {strength: 0.78, evidence: 'Shared atherosclerotic pathology'}]->(stroke);

// Kidney disease and anemia
CREATE (kidney_disease)-[:INCREASES_RISK_OF {strength: 0.82, evidence: 'Reduced erythropoietin production in renal failure'}]->(anemia);

// === CREATE RELATIONSHIPS: INTERVENTIONS ===

// Hypertension management
CREATE (hypertension)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);
CREATE (hypertension)-[:IMPROVED_BY {strength: 0.75}]->(exercise);
CREATE (hypertension)-[:IMPROVED_BY {strength: 0.80}]->(diet);
CREATE (hypertension)-[:IMPROVED_BY {strength: 0.65}]->(stress_management);
CREATE (hypertension)-[:IMPROVED_BY {strength: 0.72}]->(weight_management);
CREATE (hypertension)-[:IMPROVED_BY {strength: 0.68}]->(alcohol_reduction);
CREATE (hypertension)-[:REQUIRES_ACTION {strength: 1.0}]->(medication_adherence);

// Diabetes management
CREATE (diabetes)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);
CREATE (diabetes)-[:IMPROVED_BY {strength: 0.80}]->(exercise);
CREATE (diabetes)-[:IMPROVED_BY {strength: 0.88}]->(diet);
CREATE (diabetes)-[:IMPROVED_BY {strength: 0.85}]->(weight_management);
CREATE (diabetes)-[:REQUIRES_ACTION {strength: 1.0}]->(medication_adherence);

// Prediabetes interventions
CREATE (prediabetes)-[:IMPROVED_BY {strength: 0.88, evidence: 'Exercise reduces diabetes risk by 58% in prediabetes'}]->(exercise);
CREATE (prediabetes)-[:IMPROVED_BY {strength: 0.85}]->(diet);
CREATE (prediabetes)-[:IMPROVED_BY {strength: 0.92}]->(weight_management);

// Anemia management
CREATE (anemia)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);
CREATE (anemia)-[:IMPROVED_BY {strength: 0.85}]->(diet);

// General cardiovascular interventions
CREATE (heart_disease)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);
CREATE (smoking_cessation)-[:REDUCES_RISK_OF {strength: 0.90}]->(heart_disease);

CREATE (stroke)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);
CREATE (smoking_cessation)-[:REDUCES_RISK_OF {strength: 0.85}]->(stroke);

// Kidney disease
CREATE (kidney_disease)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);

// Retinopathy
CREATE (retinopathy)-[:REQUIRES_ACTION {strength: 1.0}]->(monitoring);

// === CREATE RELATIONSHIPS: SYNERGIES ===

CREATE (exercise)-[:SYNERGISTIC_WITH {strength: 0.85}]->(diet);
CREATE (exercise)-[:SUPPORTS {strength: 0.80}]->(weight_management);

// === CREATE PROTOCOL MAPPINGS ===

CREATE (hypertension)-[:MAPPED_TO {strength: 1.0}]->(bp_g1);
CREATE (hypertension)-[:MAPPED_TO {strength: 1.0}]->(bp_g2);
CREATE (hypertension)-[:MAPPED_TO {strength: 1.0}]->(bp_urgency);

CREATE (anemia)-[:MAPPED_TO {strength: 1.0}]->(hb_def);
CREATE (anemia)-[:MAPPED_TO {strength: 1.0}]->(hb_sev);

CREATE (prediabetes)-[:MAPPED_TO {strength: 1.0}]->(dm_prediab);
CREATE (diabetes)-[:MAPPED_TO {strength: 1.0}]->(dm_diab);

// === CREATE INDICES ===

CREATE INDEX ON :Concept(id);
CREATE INDEX ON :Concept(category);
CREATE INDEX ON :Concept(snomedCode);
CREATE INDEX ON :Protocol(id);
CREATE INDEX ON :Protocol(category);

// === VERIFY GRAPH CREATION ===

MATCH (c:Concept)
RETURN count(c) AS concept_count;

MATCH (p:Protocol)
RETURN count(p) AS protocol_count;

MATCH ()-[r:INCREASES_RISK_OF]->()
RETURN count(r) AS risk_relationships;

MATCH ()-[r:IMPROVED_BY]->()
RETURN count(r) AS improvement_relationships;

MATCH ()-[r:MAPPED_TO]->()
RETURN count(r) AS protocol_mappings;
