# Run Pratidaan locally

The app runs locally with deterministic fallbacks and no Azure spend. Microsoft sign-in, Microsoft Graph, Azure Blob Storage and Azure OpenAI are optional for local development.

## Local-only mode

Requirements: Node.js 20 or later and npm.

```bash
cd "/Users/s.samant/Documents/ChatGPT/Tracedrop-Azure"
./run.sh
```

On its first run, the script copies `azure.config.example` to the untracked `.env` file. The default settings are:

```text
NODE_ENV=development
AUTH_DISABLED=true
```

Open `http://localhost:5173`. Account data and bookings stay in memory, and every model-backed feature uses its deterministic fallback. Nothing is sent to Azure.

## Optional Azure OpenAI test

First install and authenticate Azure CLI:

```bash
./scripts/setup-azure-cli.sh
```

Use an Azure OpenAI resource that is already covered by the selected free-credit subscription. Keep the subscription spending limit enabled. Set the resource endpoint and deployment name in `.env`, then obtain a short-lived token in the shell before starting the app:

```bash
export AZURE_ACCESS_TOKEN="$(az account get-access-token --resource https://cognitiveservices.azure.com/ --query accessToken -o tsv)"
./run.sh
```

The local process enforces 20,000 tokens and 100 calls per day by default. These are application safeguards, not billing caps. Azure budgets only alert; the subscription spending limit is the hard boundary.

## Optional Microsoft sign-in and Graph

Create a Microsoft Entra application that supports organizational and personal Microsoft accounts. Add `http://localhost:5173` as a Single-page application redirect URI and grant delegated permissions:

- `User.Read`
- `Calendars.ReadWrite`
- `Mail.Send`

Then set in `.env`:

```text
AUTH_DISABLED=false
AZURE_CLIENT_ID=<application-client-id>
AZURE_AUTHORITY=https://login.microsoftonline.com/common
```

Sign-in and Calendar consent are separate. Graph access tokens remain in the browser session and are not stored by the backend.

## Checks

```bash
npm test --prefix backend
npm run type-check --prefix frontend
npm run build --prefix frontend
```

The API health response is at `http://localhost:8080/api/health`; the AI console is at `http://localhost:5173/#ai`.
