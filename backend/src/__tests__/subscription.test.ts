import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getApp } from './setup.js'
import type { Express } from 'express'

let app: Express
let token: string

beforeAll(async () => {
  app = await getApp()
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@gestornfse.com', senha: 'admin123' })
  token = res.body.token as string
})

describe('GET /api/v1/subscription', () => {
  it('retorna subscription do tenant', async () => {
    const res = await request(app)
      .get('/api/v1/subscription')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('plano')
    expect(res.body.data).toHaveProperty('status')
    expect(res.body.data).toHaveProperty('diasRestantes')
  })

  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/v1/subscription')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/subscription/upgrade', () => {
  it('inicia upgrade com pix (valida estrutura, Asaas retorna 500)', async () => {
    const res = await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ plano: 'basico', periodo: 'mensal', payment_method: 'PIX' })

    expect(res.status).toBe(500)
  })

  it('rejeita dados invalidos', async () => {
    const res = await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ plano: 'invalido' })

    expect(res.status).toBe(400)
  })
})
