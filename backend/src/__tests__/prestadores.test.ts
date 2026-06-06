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

const CNPJ = '12345678000199'

describe('POST /api/v1/prestadores', () => {
  it('cadastra prestador sem certificado', async () => {
    const res = await request(app)
      .post('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)
      .field('cnpj', CNPJ)
      .field('razao_social', 'Empresa Teste Ltda')
      .field('ambiente', 'Homologacao')
      .field('certificado_senha', '123456')

    expect(res.status).toBe(201)
    expect(res.body.cnpj).toBe(CNPJ)
    expect(res.body.razao_social).toBe('Empresa Teste Ltda')
  })

  it('rejeita CNPJ com menos de 14 digitos (ou limite do plano)', async () => {
    const res = await request(app)
      .post('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)
      .field('cnpj', '123')
      .field('razao_social', 'Inválida')
      .field('ambiente', 'Homologacao')
      .field('certificado_senha', '123456')

    expect([403, 422]).toContain(res.status)
  })

  it('rejeita ambiente invalido (ou limite do plano)', async () => {
    const res = await request(app)
      .post('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)
      .field('cnpj', '22345678000199')
      .field('razao_social', 'Ambiente Inválido')
      .field('ambiente', 'Invalido')
      .field('certificado_senha', '123456')

    expect([403, 422]).toContain(res.status)
  })

  it('rejeita sem token', async () => {
    const res = await request(app)
      .post('/api/v1/prestadores')
      .field('cnpj', '32345678000199')
      .field('razao_social', 'Sem Token')
      .field('ambiente', 'Homologacao')
      .field('certificado_senha', '123456')

    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/prestadores', () => {
  it('lista prestadores do tenant', async () => {
    const res = await request(app)
      .get('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })
})

describe('GET /api/v1/prestadores/:cnpj', () => {
  it('busca prestador por CNPJ', async () => {
    const res = await request(app)
      .get(`/api/v1/prestadores/${CNPJ}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.cnpj).toBe(CNPJ)
  })

  it('retorna 404 para CNPJ inexistente', async () => {
    const res = await request(app)
      .get('/api/v1/prestadores/00000000000000')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/v1/prestadores/:cnpj', () => {
  it('atualiza razao_social', async () => {
    const res = await request(app)
      .put(`/api/v1/prestadores/${CNPJ}`)
      .set('Authorization', `Bearer ${token}`)
      .field('razao_social', 'Empresa Atualizada Ltda')

    expect(res.status).toBe(200)
    expect(res.body.razao_social).toBe('Empresa Atualizada Ltda')
  })

  it('retorna 404 para CNPJ inexistente', async () => {
    const res = await request(app)
      .put('/api/v1/prestadores/00000000000000')
      .set('Authorization', `Bearer ${token}`)
      .field('razao_social', 'Inexistente')

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/prestadores/:cnpj', () => {
  it('remove prestador existente', async () => {
    const res = await request(app)
      .delete(`/api/v1/prestadores/${CNPJ}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('retorna 404 para CNPJ ja removido', async () => {
    const res = await request(app)
      .delete(`/api/v1/prestadores/${CNPJ}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
