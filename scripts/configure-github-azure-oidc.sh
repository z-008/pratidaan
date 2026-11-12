#!/usr/bin/env bash
set -euo pipefail

command -v az >/dev/null || { echo 'Azure CLI is required: brew install azure-cli'; exit 1; }
: "${AZURE_SUBSCRIPTION_ID:?Set AZURE_SUBSCRIPTION_ID.}"

AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pratidaan-free-rg}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-z-008/pratidaan}"
DISPLAY_NAME="${AZURE_DEPLOY_APP_NAME:-Pratidaan GitHub Deploy}"

az account set --subscription "$AZURE_SUBSCRIPTION_ID"
TENANT_ID="$(az account show --query tenantId -o tsv)"
APP_ID="$(az ad app list --filter "displayName eq '$DISPLAY_NAME'" --query '[0].appId' -o tsv)"
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(az ad app create --display-name "$DISPLAY_NAME" --query appId -o tsv)"
fi

SP_ID="$(az ad sp list --filter "appId eq '$APP_ID'" --query '[0].id' -o tsv)"
if [[ -z "$SP_ID" ]]; then
  SP_ID="$(az ad sp create --id "$APP_ID" --query id -o tsv)"
fi

SCOPE="/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP"
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$SCOPE" >/dev/null

for NAME_SUBJECT in \
  "github-main|repo:${GITHUB_REPOSITORY}:ref:refs/heads/main" \
  "github-main-oidc-claim|repo:z-008@20239469/pratidaan@1455099723:ref:refs/heads/main"; do
  NAME="${NAME_SUBJECT%%|*}"
  SUBJECT="${NAME_SUBJECT#*|}"
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"${NAME}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"description\": \"GitHub Actions main branch OIDC\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" >/dev/null 2>&1 || true
done

WEBAPP_NAME="$(az webapp list --resource-group "$AZURE_RESOURCE_GROUP" --query '[0].name' -o tsv)"

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh variable set AZURE_DEPLOY_CLIENT_ID --repo "$GITHUB_REPOSITORY" --body "$APP_ID"
  gh variable set AZURE_TENANT_ID --repo "$GITHUB_REPOSITORY" --body "$TENANT_ID"
  gh variable set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPOSITORY" --body "$AZURE_SUBSCRIPTION_ID"
  gh variable set AZURE_RESOURCE_GROUP --repo "$GITHUB_REPOSITORY" --body "$AZURE_RESOURCE_GROUP"
  gh variable set AZURE_WEBAPP_NAME --repo "$GITHUB_REPOSITORY" --body "$WEBAPP_NAME"
  echo "GitHub Actions variables configured for $GITHUB_REPOSITORY."
else
  echo "Set these GitHub Actions variables in $GITHUB_REPOSITORY:"
  printf 'AZURE_DEPLOY_CLIENT_ID=%s\nAZURE_TENANT_ID=%s\nAZURE_SUBSCRIPTION_ID=%s\nAZURE_RESOURCE_GROUP=%s\nAZURE_WEBAPP_NAME=%s\n' \
    "$APP_ID" "$TENANT_ID" "$AZURE_SUBSCRIPTION_ID" "$AZURE_RESOURCE_GROUP" "$WEBAPP_NAME"
fi
