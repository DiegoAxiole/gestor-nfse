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

describe('GET /api/v1/usuarios', () => {
  it('lista usuarios do tenant', async () => {
    const res = await request(app)
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/v1/usuarios')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/usuarios', () => {
  const uid = Date.now()

  it('cria usuario operador', async () => {
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `operador_${uid}@test.com`, nome: 'Operador Teste', papel: 'operador', senha: '123456' })

    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe(`operador_${uid}@test.com`)
    expect(res.body.data.papel).toBe('operador')
  })

  it('rejeita email duplicado', async () => {
    const email = `op_dup_${uid}@test.com`
    await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, nome: 'Original', papel: 'operador', senha: '123456' })

    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, nome: 'Duplicado', papel: 'operador', senha: '123456' })

    expect(res.status).toBe(409)
  })

  it('rejeita papel invalido', async () => {
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `bad_role_${uid}@test.com`, nome: 'Invalido', papel: 'superadmin', senha: '123456' })

    expect(res.status).toBe(400)
  })

  it('rejeita senha curta', async () => {
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `short_${uid}@test.com`, nome: 'Curta', papel: 'operador', senha: '12' })

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/v1/usuarios/:id/papel', () => {
  let usuarioId: number

  beforeAll(async () => {
    const uid = Date.now()
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `patch_${uid}@test.com`, nome: 'Patch Test', papel: 'operador', senha: '123456' })
    usuarioId = res.body.data.id
  })

  it('altera papel para admin', async () => {
    const res = await request(app)
      .patch(`/api/v1/usuarios/${usuarioId}/papel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ papel: 'admin' })

    expect(res.status).toBe(200)
    expect(res.body.data.papel).toBe('admin')
  })

  it('retorna 404 para ID inexistente', async () => {
    const res = await request(app)
      .patch('/api/v1/usuarios/999999/papel')
      .set('Authorization', `Bearer ${token}`)
      .send({ papel: 'operador' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/usuarios/:id', () => {
  let usuarioId: number

  beforeAll(async () => {
    const uid = Date.now()
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `delete_${uid}@test.com`, nome: 'Delete Test', papel: 'operador', senha: '123456' })
    usuarioId = res.body.data.id
  })

  it('remove usuario existente', async () => {
    const res = await request(app)
      .delete(`/api/v1/usuarios/${usuarioId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('retorna 404 para ID ja removido', async () => {
    const res = await request(app)
      .delete(`/api/v1/usuarios/${usuarioId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
