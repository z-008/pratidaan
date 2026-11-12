#!/usr/bin/env bash
set -euo pipefail

command -v az >/dev/null || { echo 'Azure CLI is required: brew install azure-cli'; exit 1; }
command -v npm >/dev/null || { echo 'Node.js and npm are required.'; exit 1; }
command -v zip >/dev/null || { echo 'zip is required.'; exit 1; }
command -v jq >/dev/null || { echo 'jq is required: brew install jq'; exit 1; }
command -v openssl >/dev/null || { echo 'openssl is required.'; exit 1; }
command -v curl >/dev/null || { echo 'curl is required.'; exit 1; }

: "${AZURE_SUBSCRIPTION_ID:?Set AZURE_SUBSCRIPTION_ID to the free-credit subscription.}"
: "${AZURE_CREDIT_BUDGET:?Set AZURE_CREDIT_BUDGET below the remaining free credit, in the subscription billing currency.}"
: "${AZURE_SPENDING_LIMIT_CONFIRMED:?Set AZURE_SPENDING_LIMIT_CONFIRMED=YES only after the Azure portal shows Spending limit: On.}"

[[ "$AZURE_SPENDING_LIMIT_CONFIRMED" == 'YES' ]] || { echo 'AZURE_SPENDING_LIMIT_CONFIRMED must be exactly YES.' >&2; exit 1; }
[[ "$AZURE_CREDIT_BUDGET" =~ ^[1-9][0-9]*$ ]] || { echo 'AZURE_CREDIT_BUDGET must be a positive whole number.' >&2; exit 1; }

AZURE_LOCATION="${AZURE_LOCATION:-centralindia}"
AZURE_OPENAI_LOCATION="${AZURE_OPENAI_LOCATION:-eastus}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pratidaan-free-rg}"
AZURE_BUDGET_EMAIL="${AZURE_BUDGET_EMAIL:-sandeepsamant1702@gmail.com}"
APP_DISPLAY_NAME="${APP_DISPLAY_NAME:-Pratidaan Azure}"

az account show >/dev/null 2>&1 || az login
az account set --subscription "$AZURE_SUBSCRIPTION_ID"

ACCOUNT_ID="$(az account show --query id -o tsv)"
if [[ "$ACCOUNT_ID" != "$AZURE_SUBSCRIPTION_ID" ]]; then
  echo 'Azure CLI selected the wrong subscription.' >&2
  exit 1
fi

ACCOUNT_NAME="$(az account show --query name -o tsv)"
echo "Selected Azure subscription: $ACCOUNT_NAME ($ACCOUNT_ID)"
echo "Confirmed by operator: free-credit Spending limit is On; monthly alert budget is $AZURE_CREDIT_BUDGET."

# Create the alert budget before any billable application resources.
az provider register --namespace Microsoft.Consumption --wait
BUDGET_START="$(date -u +%Y-%m-01)"
az deployment sub create --name pratidaan-budget --location "$AZURE_LOCATION" --template-file infra/budget.bicep \
  --parameters amount="$AZURE_CREDIT_BUDGET" startDate="$BUDGET_START" contactEmail="$AZURE_BUDGET_EMAIL"

for provider in Microsoft.Web Microsoft.Storage Microsoft.CognitiveServices; do
  az provider register --namespace "$provider" --wait
done

APP_ID="$(az ad app list --filter "displayName eq '$APP_DISPLAY_NAME'" --query '[0].appId' -o tsv)"
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(az ad app create --display-name "$APP_DISPLAY_NAME" --sign-in-audience AzureADandPersonalMicrosoftAccount \
    --enable-id-token-issuance true --query appId -o tsv)"
fi

GRAPH_ID='00000003-0000-0000-c000-000000000000'
az ad app permission add --id "$APP_ID" --api "$GRAPH_ID" --api-permissions \
  e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
  1ec239c2-d7c9-4623-a91a-a9775856bb36=Scope \
  e383f46e-2787-4529-855e-0e479a3ffac0=Scope >/dev/null || true

az group create --name "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION" >/dev/null
SESSION_SECRET="$(openssl rand -hex 32)"
DEPLOYMENT="$(az deployment group create --resource-group "$AZURE_RESOURCE_GROUP" --name pratidaan-infra \
  --template-file infra/main.bicep --parameters entraClientId="$APP_ID" sessionSecret="$SESSION_SECRET" \
  openAiLocation="$AZURE_OPENAI_LOCATION")"
WEBAPP_NAME="$(printf '%s' "$DEPLOYMENT" | jq -r '.properties.outputs.webAppName.value')"
WEB_URL="$(printf '%s' "$DEPLOYMENT" | jq -r '.properties.outputs.webUrl.value')"

APP_OBJECT_ID="$(az ad app show --id "$APP_ID" --query id -o tsv)"
az rest --method PATCH --url "https://graph.microsoft.com/v1.0/applications/$APP_OBJECT_ID" \
  --headers Content-Type=application/json \
  --body "{\"spa\":{\"redirectUris\":[\"$WEB_URL\",\"http://localhost:5173\"]}}" >/dev/null

npm ci --prefix frontend
npm run build --prefix frontend
npm ci --omit=dev --prefix backend

RELEASE_DIR="$(mktemp -d /tmp/pratidaan-azure-release.XXXXXX)"
mkdir -p "$RELEASE_DIR/backend" "$RELEASE_DIR/frontend" "$RELEASE_DIR/data"
cp -R backend/src backend/node_modules backend/package.json "$RELEASE_DIR/backend/"
cp -R frontend/dist "$RELEASE_DIR/frontend/"
cp -R data/synthetic data/ontology data/demo "$RELEASE_DIR/data/"
(cd "$RELEASE_DIR" && zip -qr release.zip backend frontend data)

az webapp deploy --resource-group "$AZURE_RESOURCE_GROUP" --name "$WEBAPP_NAME" \
  --src-path "$RELEASE_DIR/release.zip" --type zip --clean true --restart true
curl --fail --show-error --retry 8 --retry-delay 10 "$WEB_URL/api/health"

echo "Pratidaan deployed: $WEB_URL"
echo 'Confirm the Azure subscription spending limit remains enabled in Cost Management + Billing.'
