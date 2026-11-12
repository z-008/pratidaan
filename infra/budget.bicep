targetScope = 'subscription'

@description('Monthly budget amount in the subscription billing currency. Set this below the remaining free credit.')
@minValue(1)
param amount int

@description('Email addresses receiving Azure Cost Management alerts.')
param contactEmail string

@description('First day of the current month, for example 2026-11-01.')
param startDate string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'pratidaan-free-credit-guardrail'
  properties: {
    amount: amount
    category: 'Cost'
    timeGrain: 'Monthly'
    timePeriod: { startDate: startDate }
    notifications: {
      Actual50: { enabled: true, operator: 'GreaterThan', threshold: 50, thresholdType: 'Actual', contactEmails: [contactEmail] }
      Actual80: { enabled: true, operator: 'GreaterThan', threshold: 80, thresholdType: 'Actual', contactEmails: [contactEmail] }
      Actual100: { enabled: true, operator: 'GreaterThan', threshold: 100, thresholdType: 'Actual', contactEmails: [contactEmail] }
      Forecast100: { enabled: true, operator: 'GreaterThan', threshold: 100, thresholdType: 'Forecasted', contactEmails: [contactEmail] }
    }
  }
}
