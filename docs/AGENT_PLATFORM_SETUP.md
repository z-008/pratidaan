# Vertex Agent Platform (minimal, low cost)

Pratidaan keeps **donor-facing intelligence on Cloud Run**: `runAgent()` + Gemini + your 18 tools. That path stays unchanged for latency, cost, and behaviour.

**Agent Platform** is added as a **sidecar** for judges and compliance:

| Product | Role in Pratidaan | Cost driver |
|--------|-------------------|-------------|
| **Gemini (Vertex)** | All model calls (chat, labs, intro, cards) | Same as today — token limits in deploy |
| **Agent Engine instance** | Host for Sessions + Memory Bank APIs | Creating an instance is quick; **no agent deploy required** for Sessions/Memory ([Google REST quickstart](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/memory-bank/quickstart-api)) |
| **Sessions** | Mirror each Drop chat turn (`appendEvent`) | Per API call; in-memory map avoids duplicate session creates per donor |
| **Memory Bank** | When Drop saves preferences / “remember”, sync facts (debounced) | Per `memories:generate` call — not every chat turn |
| **Agent Engine Runtime (deployed ADK agent)** | **Optional** — only if rules require a *hosted* reasoning engine | **Avoid for hackathon** unless required: extra containers, `min_instances`, cold starts |

**Region:** Memory Bank + Sessions for this API are **`us-central1`**. Cloud Run stays **`asia-south1`**. Cross-region calls are fine for demo volume.

## One-time setup (Console — simplest)

1. **Google Cloud Console** → **Vertex AI** → **Agent Builder** / **Agent Engine**.
2. **Create an Agent Engine instance** (display name e.g. `pratidaan-platform`). You do **not** need to deploy a full ADK agent to use Sessions and Memory Bank.
3. Copy the resource name. **Pratidaan instance (no ADK deploy):**  
   `projects/533106233193/locations/us-central1/reasoningEngines/6306521894870843392`  
   (display name `pratidaan-platform`, Memory Bank enabled on create.)
4. **IAM:** runtime SA `tracedrop-run@project-6055aa98-bf59-48b5-a50.iam.gserviceaccount.com` has `roles/aiplatform.user` (Sessions + Memory Bank). Local Node uses **Application Default Credentials** — use `gcloud auth application-default login` with a project owner/editor, or rely on Cloud Run for live demos.
5. **GitHub Actions variable** (repo → Settings → Actions → Variables): `AGENT_ENGINE_NAME` = resource above; optional `AGENT_ENGINE_LOCATION` = `us-central1`. Redeploy from `main` (workflow passes these to Cloud Run).

## Wire Cloud Run

Add to deploy (GitHub Actions **variable**, not a secret):

```text
AGENT_ENGINE_NAME=projects/.../locations/us-central1/reasoningEngines/...
AGENT_ENGINE_LOCATION=us-central1
```

Redeploy. Check:

```text
GET /api/health          → agentPlatform.engineConfigured: true
GET /api/agent/status    → (requires sign-in) same fields
```

## What judges should see (talk track)

1. **Gemini:** Drop chat, lab reader, translations — `#/ai` traces on Vertex.
2. **Agent Runtime (practical):** Managed agent loop on **Cloud Run** calling Vertex Gemini with tools (`runAgent`). Optional hosted engine only if you deployed one.
3. **Session:** Conversation mirrored to **Agent Engine Sessions** (same turns as in-app chat cycles).
4. **Memory Bank:** Donor “remember” lines synced to Memory Bank (not a substitute for Firestore account data).

## Cost controls (already in code)

- Session create: once per donor per process until demo reset.
- `appendEvent`: fire-and-forget; failures log only — **copilot never depends on it**.
- Memory sync: **debounced** (see `agentPlatform.js`) — not on every token.
- Do **not** set `min_instances` on a deployed Reasoning Engine unless judges explicitly require it.

## If Session/Memory API shapes change

Update `backend/src/ai/agentPlatform.js` only. Copilot, tools, and domain logic stay untouched.
