# Pratidaan: Azure architecture

Pratidaan is a React single-page application and Node.js API deployed together on Azure App Service. Safety, privacy and cover decisions remain deterministic. Azure OpenAI is used only for language tasks that have checked fallbacks.

## Runtime

```text
Browser
  React + Microsoft Authentication Library
  Microsoft sign-in and delegated Graph consent
       |
       | HTTPS + signed session cookie
       v
Azure App Service F1
  Node.js + Express API
  deterministic health, eligibility, privacy, cover and booking rules
       |                    |                         |
       v                    v                         v
Azure OpenAI          Azure Blob Storage        Microsoft Graph
managed identity      managed identity          delegated browser token
chat and extraction   account JSON + logs       calendar + confirmation mail
```

The F1 plan is a fixed free shared tier with limited daily CPU. There is no Azure Container Registry, Kubernetes, database server, Key Vault, Application Insights or Log Analytics workspace.

## Repository layout

| Path | Responsibility |
|---|---|
| `frontend/src/` | React app, Microsoft sign-in, Calendar consent and product screens |
| `backend/src/domain/` | Deterministic health, eligibility, cover, privacy, Cards, Goals, booking and impact engines |
| `backend/src/ai/` | Azure OpenAI gateway, tool loop, checked structured output and rule fallbacks |
| `backend/src/auth/` | Microsoft ID-token validation, signed sessions and account-data operations |
| `backend/src/azure/` | Managed-identity tokens, private Blob JSON storage and per-account repository |
| `backend/src/calendar/` | Microsoft Graph free/busy, event creation/deletion and mail |
| `backend/src/data/store.js` | Synthetic demo data and in-memory demo state |
| `infra/` | Subscription budget alerts and Azure resource definitions in Bicep |
| `scripts/` | Azure CLI setup, guarded deployment and GitHub OIDC configuration |

## Identity and sessions

The browser uses MSAL with the Entra application client ID returned by `/api/auth/config`. It requests an OpenID ID token for sign-in. The backend:

1. downloads Microsoft's current signing keys;
2. accepts only RS256 tokens signed by a known key;
3. verifies expiry, tenant-specific issuer and application audience;
4. creates a one-day HMAC-SHA256 signed, HttpOnly, SameSite=Lax session cookie.

`SESSION_SECRET` is required in production. `AUTH_DISABLED=true` is accepted only outside production. Guest sessions use random subjects and never write to Azure Blob Storage.

Calendar access is separate from sign-in. The browser asks for delegated `User.Read`, `Calendars.ReadWrite` and `Mail.Send` scopes only when the user connects Calendar. The Graph access token stays in browser session storage and is sent only with the relevant booking request; the server never persists it.

## Persistence

Private Blob Storage stores one JSON document per signed-in account at `users/<base64url-subject>.json`. It contains the profile, sign-in history, preferences and appointments. Agent activity is stored separately under the same private container.

The storage account disables anonymous blob access and shared-key authorization. App Service receives `Storage Blob Data Contributor` through its system-assigned managed identity. Local and guest modes use an in-memory repository.

The synthetic donor world and demo clock remain in process memory. They reset when the F1 worker restarts; this is intentional prototype behavior, not production-grade state management.

## Azure OpenAI

`backend/src/ai/llm.js` calls the Azure OpenAI chat-completions endpoint directly. Production authentication uses the App Service system-assigned managed identity with the `Cognitive Services OpenAI User` role. No Azure OpenAI API key is stored.

The gateway converts text, images, tool calls and tool results to the Azure chat format. Structured results use JSON Schema or a final `submit_result` tool and are revalidated by application code. Every AI caller has a deterministic fallback.

Per-process safeguards default to:

- 2 requests per second;
- 20,000 tokens per day;
- 100 calls per day;
- at most 6,000 output tokens per call.

These limits reduce accidental use but are not billing caps. The Azure free-subscription spending limit is the hard cost boundary.

## Security boundaries

- Recipient details are generalized server-side with k-anonymity before any AI call.
- Safety, medical thresholds, eligibility, Goals, cover and slot ranking are deterministic.
- Blob access and Azure OpenAI access use managed identity.
- Storage shared keys and Azure OpenAI local authentication are disabled.
- The app uses HTTPS-only, TLS 1.2 minimum and disabled FTP.
- Calendar and mail tokens are delegated, short-lived and not stored.
- Lab-report photos arrive as request data and are not persisted.
- Helmet sets browser security headers; the popup-compatible opener policy is limited to the sign-in requirement.

## Deployment and cost controls

`infra/main.bicep` provisions:

- one Linux App Service F1 plan and web app;
- one Standard LRS StorageV2 account and private container;
- one Azure OpenAI account and the smallest model deployment capacity;
- managed-identity role assignments;
- small App Service filesystem logs only.

`infra/budget.bicep` creates 50%, 80%, 100% actual and 100% forecast alerts. Budgets alert but do not stop spending. `scripts/deploy-azure.sh` therefore refuses to provision until the operator supplies:

- the exact subscription ID;
- a positive budget below remaining credit;
- `AZURE_SPENDING_LIMIT_CONFIRMED=YES` after checking the Azure portal.

The script creates the budget before application resources, deploys the infrastructure, builds the frontend, packages the Node application, ZIP-deploys it and checks `/api/health`.

GitHub Actions uses OIDC federated identity restricted to `z-008/pratidaan` on `refs/heads/main`. It has Contributor only on the Pratidaan resource group and stores no Azure client secret.

See [AZURE_SETUP.md](AZURE_SETUP.md) for the operator procedure.

## Configuration

| Variable | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Entra application client ID for sign-in |
| `AZURE_AUTHORITY` | MSAL authority, normally the `common` endpoint |
| `AZURE_STORAGE_ACCOUNT` | Blob Storage account name |
| `AZURE_STORAGE_CONTAINER` | Private data container |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name |
| `AZURE_OPENAI_API_VERSION` | REST API version |
| `LLM_RATE_LIMIT_RPS` | Per-process request rate |
| `LLM_RATE_LIMIT_TOKENS_PER_DAY` | Per-process daily token safeguard |
| `LLM_MAX_CALLS_PER_DAY` | Per-process daily call safeguard |
| `SESSION_SECRET` | Session-cookie and check-in-code signing secret |
| `AUTH_DISABLED` | Local-development sign-in bypass; ignored in production |

Local defaults are in `azure.config.example`. Production settings are declared in Bicep.

## Verification

```bash
npm test --prefix backend
npm run type-check --prefix frontend
npm run build --prefix frontend
bash -n run.sh scripts/*.sh
```

After deployment, verify `/api/health`, Microsoft sign-in, guest mode, Calendar free/busy, event creation, Graph mail, account deletion and the exact resources/costs in the Azure portal.
