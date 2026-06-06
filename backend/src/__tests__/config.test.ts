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

describe('GET /api/v1/config', () => {
  it('retorna configuracao padrao', async () => {
    const res = await request(app)
      .get('/api/v1/config')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('ambiente')
    expect(res.body).toHaveProperty('codigo_municipio')
    expect(res.body).toHaveProperty('lgpd_ativo')
    expect(res.body).toHaveProperty('cnpj')
    expect(res.body).toHaveProperty('razao_social')
  })

  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/v1/config')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/v1/config', () => {
  it('atualiza ambiente', async () => {
    const res = await request(app)
      .put('/api/v1/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ ambiente: 'Homologacao' })

    expect(res.status).toBe(200)
    expect(res.body.ambiente).toBe('Homologacao')
  })

  it('rejeita ambiente invalido', async () => {
    const res = await request(app)
      .put('/api/v1/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ ambiente: 'Invalido' })

    expect(res.status).toBe(422)
  })

  it('atualiza lgpd_ativo', async () => {
    const res = await request(app)
      .put('/api/v1/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ lgpd_ativo: true })

    expect(res.status).toBe(200)
    expect(res.body.lgpd_ativo).toBe(true)
  })
})
