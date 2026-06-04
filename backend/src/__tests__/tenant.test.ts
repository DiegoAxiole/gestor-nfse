import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { getApp } from './setup.js'

async function loginAdmin() {
  const app = await getApp()
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@gestornfse.com', senha: 'admin123' })
  return res.body.token as string
}

describe('GET /api/v1/tenant', () => {
  it('retorna perfil do admin', async () => {
    const app = await getApp()
    const token = await loginAdmin()
    const res = await request(app)
      .get('/api/v1/tenant')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.nome).toBe('Administrador')
    expect(res.body.data.tipo).toBe('pj')
    expect(res.body.data.uuid).toBeTruthy()
  })

  it('rejeita sem token', async () => {
    const app = await getApp()
    const res = await request(app).get('/api/v1/tenant')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/v1/tenant', () => {
  it('atualiza campos opcionais com null', async () => {
    const app = await getApp()
    const token = await loginAdmin()
    const res = await request(app)
      .put('/api/v1/tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome_fantasia: null,
        inscricao_estadual: null,
        email_contato: 'admin@gestornfse.com',
        whatsapp: true,
        telefone_celular: null,
        telefone_fixo: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.whatsapp).toBe(true)
    expect(res.body.data.email_contato).toBe('admin@gestornfse.com')
  })

  it('atualiza apenas campos enviados', async () => {
    const app = await getApp()
    const token = await loginAdmin()
    const res = await request(app)
      .put('/api/v1/tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ telefone_celular: '11988887777' })

    expect(res.status).toBe(200)
    expect(res.body.data.telefone_celular).toBe('11988887777')
  })

  it('rejeita email inválido', async () => {
    const app = await getApp()
    const token = await loginAdmin()
    const res = await request(app)
      .put('/api/v1/tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ email_contato: 'email_invalido' })

    expect(res.status).toBe(400)
  })

  it('rejeita sem token', async () => {
    const app = await getApp()
    const res = await request(app)
      .put('/api/v1/tenant')
      .send({ email_contato: 'admin@gestornfse.com' })

    expect(res.status).toBe(401)
  })
})
