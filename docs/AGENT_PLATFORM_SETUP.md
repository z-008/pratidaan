# Agent session log on Azure (Drop)

Drop's donor-facing replies are produced by a **custom tool-calling loop** on **Azure OpenAI** (`runAgent` in `backend/src/ai/agent.js`). There is no separate Vertex Agent Engine or ADK deployment.

## What is mirrored to the cloud

When private Blob Storage is configured (`AZURE_STORAGE_*`), the app also writes:

| Blob path | Contents |
|---|---|
| `agents/sessions/<base64url(scope)>.json` | Last 100 user/assistant lines per account × persona (audit / demo) |
| `agents/memory/<base64url(donorId)>.json` | Debounced copy of Drop "remember" facts |
| `chat-cycles/<base64url(scope)>.json` | **Past Cycles** live transcript and archives |

Chat turns, optional chart actions, and LLM history for the current cycle are authoritative in `chatCycles.js`; agent blobs are a mirror for operators and reviewers.

## Status

`GET /api/health` returns `agentPlatform`:

- `agentRuntime`: `custom-tool-agent-on-azure-openai`
- `sessions` / `memoryBank`: `azure-blob-*` when Blob is configured, otherwise in-app only
- `storage`: account and container names

Guests and local dev without Blob use in-memory chat only (no cross-instance sync on App Service).

## Setup

Follow [AZURE_SETUP.md](AZURE_SETUP.md) for App Service managed identity, Blob `Storage Blob Data Contributor`, and Azure OpenAI `Cognitive Services OpenAI User`. No extra agent product is provisioned.
