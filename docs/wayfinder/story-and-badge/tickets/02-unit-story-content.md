---
label: wayfinder:grilling
title: What a component's Story says
status: closed
assignee: mihirb777@gmail.com
blocked_by: []
---

## Question

What exactly do the slides in a component's Story say, now that Drop's Card and My Impact's "Watch the story" share them? This covers how many slides there are and their wording, how a generalised recipient ("Treatment (details not shared)", "A hospital in Karnataka") reads on a slide, what a unit with no recipient shows (plasma that became medicines, expired, withheld, still in progress), and which line becomes the shared postcard's headline and context.

## Resolution (2026-10-14)

Facts: 7 of D-001's 8 transfused units are generalised, and the demo Card's unit (3 Oct platelets) is fully generalised. The current slides lowercase proper names ("bengaluru urban"); this is a bug to fix in the build.

1. **Which units:** transfused units and plasma that became medicines. Expired, withheld and in-progress units get no Story and no "Watch the story" button.
2. **Voice:** the slides say "you" (Drop telling the Donor); the last slide says "My…" (the Donor posting).
3. **Structure:** 4 parts, then one last slide. The last slide is exactly the image that gets shared, and Share appears only there.
   - Given: "On {date} you gave blood at {centre}." (exact date)
   - Became: "It was separated into parts. One was your {component}: {role}."
   - Reached: "In {month} they went to {place}."
   - Helped: "They helped {patient} with {context}." Add "The hospital recorded a good recovery." when that outcome is released.
   - Plasma: given → pooled with {poolSize} donations → your share became about {albumin} vial of albumin, {ivig} dose of IVIG and {factor} IU of factor VIII ({month, rounded}) → last slide.
4. **Generalised fields** are left out of the sentence rather than printed: "a patient", "a hospital in Karnataka" (keeping the capital K), "helped a patient in hospital". Wherever something was held back, add: "Some details stay private so no one can be identified."
5. **Outcome:** a released "recovered" is shown on the slides, never on the shared image.
6. **The last slide (summary postcard),** top to bottom:
   - Headline: "My {component} reached a patient", or for plasma "My plasma became medicines"
   - Context line, or the component's role if the context is generalised (for plasma: "Albumin, immunoglobulin and clotting factor")
   - The month
   - A large "{N} patients helped by my blood" (lifetime `patientsHelped`)
   - The Pratidaan mark
   It never shows patient band, place or outcome.
7. **If this moment earned a Badge,** the Badge replaces the summary postcard as the last slide and is what gets shared. The moment's postcard can still be shared later from that unit on My Impact.
