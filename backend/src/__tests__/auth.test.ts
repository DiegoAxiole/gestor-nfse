import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { getApp } from './setup.js'
import { cnpj, cpf } from 'cpf-cnpj-validator'

describe('POST /api/v1/auth/cadastrar', () => {
  const uid = Date.now()

  it('cadastra PJ com CNPJ válido', async () => {
    const app = await getApp()
    const doc = cnpj.generate()
    const res = await request(app)
      .post('/api/v1/auth/cadastrar')
      .send({ tipo: 'pj', documento: doc, nome: 'Empresa Teste', email: `test_${uid}_pj@test.com`, senha: '123456' })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.tenant.tipo).toBe('pj')
    expect(res.body.tenant.documento.replace(/\D/g, '')).toBe(doc.replace(/\D/g, ''))
  })

  it('cadastra PF com CPF válido', async () => {
    const app = await getApp()
    const doc = cpf.generate()
    const res = await request(app)
      .post('/api/v1/auth/cadastrar')
      .send({ tipo: 'pf', documento: doc, nome: 'João PF', email: `test_${uid}_pf@test.com`, senha: '123456' })

    expect(res.status).toBe(201)
    expect(res.body.tenant.tipo).toBe('pf')
    expect(res.body.tenant.documento.replace(/\D/g, '')).toBe(doc.replace(/\D/g, ''))
  })

  it('rejeita CNPJ inválido (dígitos errados)', async () => {
    const app = await getApp()
    const res = await request(app)
      .post('/api/v1/auth/cadastrar')
      .send({ tipo: 'pj', documento: '12345678000199', nome: 'Inválida', email: `test_${uid}_invalid_cnpj@test.com`, senha: '123456' })

    expect(res.status).toBe(422)
  })

  it('rejeita CPF inválido (dígitos errados)', async () => {
    const app = await getApp()
    const res = await request(app)
      .post('/api/v1/auth/cadastrar')
      .send({ tipo: 'pf', documento: '93541134786', nome: 'Inválido', email: `test_${uid}_invalid_cpf@test.com`, senha: '123456' })

    expect(res.status).toBe(422)
  })

  it('rejeita documento duplicado', async () => {
    const app = await getApp()
    const doc = cnpj.generate()
    const body = { tipo: 'pj', documento: doc, nome: 'Original', email: `test_${uid}_dup_doc@test.com`, senha: '123456' }

    await request(app).post('/api/v1/auth/cadastrar').send(body)
    const res = await request(app).post('/api/v1/auth/cadastrar').send({ ...body, email: `test_${uid}_dup_doc2@test.com` })

    expect(res.status).toBe(409)
  })

  it('rejeita email duplicado', async () => {
    const app = await getApp()
    const email = `test_${uid}_dup_email@test.com`

    const r1 = await request(app).post('/api/v1/auth/cadastrar').send({ tipo: 'pj', documento: cnpj.generate(), nome: 'Email1', email, senha: '123456' })
    expect(r1.status).toBe(201)

    const r2 = await request(app).post('/api/v1/auth/cadastrar').send({ tipo: 'pj', documento: cnpj.generate(), nome: 'Email2', email, senha: '123456' })
    expect(r2.status).toBe(409)
  })

  it('rejeita campos obrigatórios ausentes', async () => {
    const app = await getApp()
    const res = await request(app)
      .post('/api/v1/auth/cadastrar')
      .send({ email: `test_${uid}_missing@test.com` })

    expect(res.status).toBe(422)
  })
})

describe('POST /api/v1/auth/login', () => {
  const uid = Date.now()
  let emailCriado: string
  let senhaCriada: string

  it('login com credenciais válidas (admin legacy)', async () => {
    const app = await getApp()
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@gestornfse.com', senha: 'admin123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.usuario.email).toBe('admin@gestornfse.com')
  })

  it('login com usuário criado via cadastro', async () => {
    const app = await getApp()
    emailCriado = `test_${uid}_login@test.com`
    senhaCriada = 'minha_senha'

    await request(app)
      .post('/api/v1/auth/cadastrar')
      .send({ tipo: 'pf', documento: cpf.generate(), nome: 'Login Test', email: emailCriado, senha: senhaCriada })

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: emailCriado, senha: senhaCriada })

    expect(res.status).toBe(200)
    expect(res.body.usuario.email).toBe(emailCriado)
  })

  it('rejeita senha errada', async () => {
    const app = await getApp()
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@gestornfse.com', senha: 'senha_errada' })

    expect(res.status).toBe(401)
  })

  it('rejeita email inexistente', async () => {
    const app = await getApp()
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nao_existe@test.com', senha: '123456' })

    expect(res.status).toBe(401)
  })
})
