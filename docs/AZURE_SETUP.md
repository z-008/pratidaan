# Azure-only deployment with free-credit guardrails

Pratidaan's Azure runtime uses:

- **Azure App Service F1** for the Node API and built React app;
- **Azure OpenAI** for chat, tools, translation and lab-report extraction;
- **Microsoft Entra ID** for sign-in and **Microsoft Graph** for Calendar and confirmation mail;
- **private Azure Blob Storage** for profiles, sign-ins, preferences, bookings and agent logs;
- **managed identity** for OpenAI and Blob access, so the app has no Azure service key;
- **Azure Cost Management budgets** at 50%, 80%, 100% actual and 100% forecast.

There is deliberately no paid container registry, Kubernetes cluster, database server, Key Vault, Application Insights or Log Analytics workspace. App Service uses the fixed F1 free plan and its rolling 35 MB filesystem logs.

## Important billing boundary

An Azure budget sends alerts; it does **not** stop resources. Before deploying, open **Azure portal → Cost Management + Billing → Subscriptions → your free-credit subscription** and confirm:

1. the subscription is the free-credit subscription;
2. the remaining credit and expiry date;
3. **Spending limit: On**.

The spending limit is the hard protection against charges after credits are exhausted. Do not remove it or upgrade the subscription. Azure OpenAI is usage-billed, so the app also enforces 20,000 tokens and 100 calls per day. Set the monthly budget below the credit that remains.

## 1. Install and sign in to Azure CLI

On macOS:

```bash
./scripts/setup-azure-cli.sh
```

The helper installs Azure CLI through Homebrew when necessary, opens the interactive login, and lists subscriptions. If a managed work computer blocks package installation, run `brew install azure-cli` in your normal unrestricted terminal or install the signed Microsoft package from the Azure CLI documentation.

Copy the ID of the free-credit subscription, then select and verify it:

```bash
export AZURE_SUBSCRIPTION_ID="your-free-credit-subscription-id"
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
az account show --query '{name:name,id:id,tenantId:tenantId,state:state}' --output table
```

If the displayed subscription is not the free-credit subscription, stop.

## 2. Choose a budget inside the remaining credit

Budget values use the subscription's billing currency. For example, if the portal shows 100 units of credit remaining, choose less than that:

```bash
export AZURE_CREDIT_BUDGET="25"
export AZURE_BUDGET_EMAIL="sandeepsamant1702@gmail.com"
export AZURE_SPENDING_LIMIT_CONFIRMED="YES"
```

The deployment script refuses to run without a positive whole-number `AZURE_CREDIT_BUDGET` and the exact spending-limit confirmation. The confirmation is intentionally manual because Azure CLI does not expose a reliable hard-limit check for every subscription offer.

## 3. Provision and deploy

From the repository:

```bash
cd "/Users/s.samant/Documents/ChatGPT/Tracedrop-Azure"
chmod +x scripts/deploy-azure.sh scripts/configure-github-azure-oidc.sh
./scripts/deploy-azure.sh
```

The script:

1. verifies the selected subscription;
2. creates the budget alerts first;
3. registers only the required resource providers;
4. creates the Microsoft Entra application and delegated Graph permissions;
5. deploys `infra/main.bicep`;
6. builds and ZIP-deploys the app;
7. calls `/api/health` and prints the live URL.

The default regions are `centralindia` for App Service and storage and `eastus` for Azure OpenAI. Model availability and quota vary by subscription. Override these only when the Azure model catalog shows the requested model and quota:

```bash
export AZURE_LOCATION="centralindia"
export AZURE_OPENAI_LOCATION="eastus"
./scripts/deploy-azure.sh
```

If Azure OpenAI access or quota is unavailable, the infrastructure deployment will stop instead of silently switching to a non-Azure model. The deterministic app can still run locally with AI fallbacks.

## 4. Configure GitHub Actions without an Azure secret

After the first deployment:

```bash
./scripts/configure-github-azure-oidc.sh
```

This creates an Entra service principal with a federated credential restricted to:

```text
repo:z-008/pratidaan:ref:refs/heads/main
```

It configures the five GitHub Actions variables used by `.github/workflows/deploy-azure.yml`. The workflow can deploy only after a push reaches `main`; no Azure client secret is stored in GitHub.

## 5. Verify

```bash
az webapp list --resource-group pratidaan-free-rg --output table
az deployment group show --resource-group pratidaan-free-rg --name pratidaan-infra --output table
az consumption budget show --budget-name pratidaan-free-credit-guardrail --output table
```

Open the URL printed by the deployment and check:

- `/api/health` reports `status: ok`, `provider: azure-openai`, and Azure agent storage;
- Microsoft sign-in works;
- guest mode works without writing account data;
- connecting Calendar removes busy times, creates the event and sends the confirmation through Microsoft Graph;
- the Azure portal shows only the expected resource group and no paid observability or registry resources.

## Expected cost shape

| Service | Guardrail |
|---|---|
| App Service | F1 Free, one fixed shared instance |
| Blob Storage | Standard LRS, small JSON documents, 7-day soft delete |
| Entra ID and Graph | Delegated sign-in/Calendar/Mail at demo volume |
| Azure OpenAI | Pay-per-token against credits; app limit 20k tokens and 100 calls/day |
| Logs | App Service filesystem only, 35 MB and 3-day retention |

Free offers, model prices and eligibility can change. Treat the Azure portal's subscription credit and spending-limit pages as authoritative before every deployment.
