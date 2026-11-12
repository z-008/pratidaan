@description('Short prefix used for all resources.')
param namePrefix string = 'pratidaan'

@description('India region for the web app and account data.')
param location string = resourceGroup().location

@description('Azure region where the selected OpenAI model has quota.')
param openAiLocation string = 'eastus'

@description('Microsoft Entra application client ID used by browser sign-in.')
param entraClientId string

@secure()
@minLength(32)
param sessionSecret string

param openAiModelName string = 'gpt-5-mini'
param openAiModelVersion string = '2025-08-07'
param openAiDeploymentName string = 'pratidaan-chat'
param deployOpenAi bool = true

var suffix = take(uniqueString(subscription().id, resourceGroup().id), 10)
var storageName = take(toLower(replace('${namePrefix}${suffix}', '-', '')), 24)
var appName = toLower('${namePrefix}-${suffix}')
var openAiName = toLower('${namePrefix}-ai-${suffix}')
var blobRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var openAiUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

resource dataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'pratidaan-data'
  properties: { publicAccess: 'None' }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-free-plan-${suffix}'
  location: location
  kind: 'linux'
  sku: { name: 'F1', tier: 'Free', size: 'F1', capacity: 1 }
  properties: { reserved: true }
}

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (deployOpenAi) {
  name: openAiName
  location: openAiLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: openAiName
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource model 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = if (deployOpenAi) {
  parent: openAi
  name: openAiDeploymentName
  // The smallest deployment capacity keeps demo throughput deliberately low.
  sku: { name: 'GlobalStandard', capacity: 1 }
  properties: {
    model: { format: 'OpenAI', name: openAiModelName, version: openAiModelVersion }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource web 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: false
      ftpsState: 'Disabled'
      http20Enabled: true
      minTlsVersion: '1.2'
      appCommandLine: 'node backend/src/server.js'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'AUTH_DISABLED', value: 'false' }
        { name: 'SESSION_SECRET', value: sessionSecret }
        { name: 'AZURE_CLIENT_ID', value: entraClientId }
        { name: 'AZURE_AUTHORITY', value: 'https://login.microsoftonline.com/common' }
        { name: 'AZURE_STORAGE_ACCOUNT', value: storage.name }
        { name: 'AZURE_STORAGE_CONTAINER', value: dataContainer.name }
        { name: 'AZURE_OPENAI_ENDPOINT', value: deployOpenAi ? openAi.properties.endpoint : '' }
        { name: 'AZURE_OPENAI_DEPLOYMENT', value: deployOpenAi ? model.name : '' }
        { name: 'AZURE_OPENAI_API_VERSION', value: '2024-10-21' }
        { name: 'LLM_RATE_LIMIT_RPS', value: '2' }
        { name: 'LLM_RATE_LIMIT_TOKENS_PER_DAY', value: '30000' }
        { name: 'LLM_MAX_CALLS_PER_DAY', value: '100' }
      ]
    }
  }
}

resource logs 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: web
  name: 'logs'
  properties: {
    applicationLogs: { fileSystem: { level: 'Information' } }
    httpLogs: { fileSystem: { enabled: true, retentionInMb: 35, retentionInDays: 3 } }
    detailedErrorMessages: { enabled: false }
    failedRequestsTracing: { enabled: false }
  }
}

resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, web.id, blobRoleId)
  properties: { roleDefinitionId: blobRoleId, principalId: web.identity.principalId, principalType: 'ServicePrincipal' }
}

resource openAiAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployOpenAi) {
  scope: openAi
  name: guid(openAi.id, web.id, openAiUserRoleId)
  properties: { roleDefinitionId: openAiUserRoleId, principalId: web.identity.principalId, principalType: 'ServicePrincipal' }
}

output webAppName string = web.name
output webUrl string = 'https://${web.properties.defaultHostName}'
output storageAccountName string = storage.name
output openAiResourceName string = deployOpenAi ? openAi.name : ''
