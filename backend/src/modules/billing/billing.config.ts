export function getAsaasConfig() {
  const sandbox = process.env.ASAAS_SANDBOX !== 'false'
  return {
    apiKey: process.env.ASAAS_API_KEY || '',
    baseUrl: sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3',
    webhookSecret: process.env.ASAAS_WEBHOOK_SECRET || '',
    sandbox,
  }
}
