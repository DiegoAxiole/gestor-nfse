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

describe('GET /api/v1/documentos', () => {
  it('retorna lista paginada (vazia)', async () => {
    const res = await request(app)
      .get('/api/v1/documentos')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('documentos')
    expect(res.body).toHaveProperty('total')
    expect(Array.isArray(res.body.documentos)).toBe(true)
  })

  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/v1/documentos')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/documentos/:chave/xml', () => {
  it('retorna 404 para chave inexistente', async () => {
    const res = await request(app)
      .get('/api/v1/documentos/12345678901234567890123456789012345678901234/xml')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/documentos/:chave/pdf', () => {
  it('retorna 404 para chave inexistente', async () => {
    const res = await request(app)
      .get('/api/v1/documentos/12345678901234567890123456789012345678901234/pdf')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/documentos/download-zip', () => {
  it('rejeita sem parametros obrigatorios', async () => {
    const res = await request(app)
      .get('/api/v1/documentos/download-zip')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(422)
  })

  it('retorna 404 quando nao ha documentos no periodo', async () => {
    const res = await request(app)
      .get('/api/v1/documentos/download-zip?cnpj=12345678000199&inicio=2024-01-01&fim=2024-12-31')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
