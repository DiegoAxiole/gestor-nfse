import { getAsaasConfig } from './billing.config.js'

interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  email: string
}

interface AsaasSubscription {
  id: string
  customer: string
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  value: number
  nextDueDate: string
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
}

const { apiKey, baseUrl } = getAsaasConfig()

async function asaasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      ...(options.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Asaas API error ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

const PRICE_MAP: Record<string, Record<string, number>> = {
  basico: { mensal: 2900, trimestral: 7900, anual: 29900 },
  profissional: { mensal: 7900, trimestral: 19900, anual: 79900 },
}

const CYCLE_MAP: Record<string, 'MONTHLY' | 'QUARTERLY' | 'YEARLY'> = {
  mensal: 'MONTHLY',
  trimestral: 'QUARTERLY',
  anual: 'YEARLY',
}

export const billingService = {
  async criarCliente(data: { nome: string; documento: string; email: string }): Promise<string> {
    const customer = await asaasFetch<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: data.nome,
        cpfCnpj: data.documento,
        email: data.email,
      }),
    })
    return customer.id
  },

  async criarAssinatura(params: {
    customerId: string
    plano: string
    periodo: string
    paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  }): Promise<{ subscriptionId: string; paymentLink: string }> {
    const priceInCents = PRICE_MAP[params.plano]?.[params.periodo]
    if (!priceInCents) throw new Error(`Preço não encontrado para ${params.plano}/${params.periodo}`)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 1)

    const sub = await asaasFetch<AsaasSubscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: params.customerId,
        billingType: params.paymentMethod,
        value: priceInCents / 100,
        nextDueDate: dueDate.toISOString().split('T')[0],
        cycle: CYCLE_MAP[params.periodo],
        description: `Gestor NFSe - ${params.plano} ${params.periodo}`,
      }),
    })

    return {
      subscriptionId: sub.id,
      paymentLink: `${baseUrl.replace('/api/v3', '').replace('.sandbox', '')}/subscription/${sub.id}`,
    }
  },

  async cancelarAssinatura(asaasSubscriptionId: string): Promise<void> {
    await asaasFetch(`/subscriptions/${asaasSubscriptionId}`, { method: 'DELETE' })
  },

  async processarWebhook(body: any): Promise<{ event: string; subscriptionId?: string; paymentId?: string }> {
    const event = body.event
    const payment = body.payment
    const subscription = body.subscription

    if (payment?.id && subscription?.id) {
      return { event, subscriptionId: subscription.id, paymentId: payment.id }
    }
    return { event }
  },
}
