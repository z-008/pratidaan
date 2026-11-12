#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo 'Homebrew is required on macOS: https://brew.sh' >&2
    exit 1
  fi
  echo 'Installing Azure CLI with Homebrew...'
  brew install azure-cli
fi

az version --output table
az account show >/dev/null 2>&1 || az login
echo
echo 'Available subscriptions:'
az account list --query '[].{Name:name,SubscriptionId:id,State:state,Default:isDefault}' --output table
echo
echo 'Before deployment, select the free-credit subscription and verify Spending limit: On in the Azure portal.'
echo 'Then export AZURE_SUBSCRIPTION_ID and run:'
echo '  az account set --subscription "$AZURE_SUBSCRIPTION_ID"'
echo "  az account show --query '{name:name,id:id,tenantId:tenantId,state:state}' --output table"
