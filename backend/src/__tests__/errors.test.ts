import { describe, it, expect } from 'vitest'
import { AppError, NotFoundError, ValidationError, ConflictError } from '../shared/errors.js'

describe('AppError', () => {
  it('cria com valores padrão', () => {
    const err = new AppError('Algo deu errado')
    expect(err.message).toBe('Algo deu errado')
    expect(err.statusCode).toBe(500)
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.name).toBe('AppError')
  })

  it('aceita statusCode e code customizados', () => {
    const err = new AppError('Custom', 418, 'TEAPOT')
    expect(err.statusCode).toBe(418)
    expect(err.code).toBe('TEAPOT')
  })
})

describe('NotFoundError', () => {
  it('cria mensagem sem ID', () => {
    const err = new NotFoundError('Usuario')
    expect(err.message).toBe('Usuario nao encontrado')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })

  it('cria mensagem com ID', () => {
    const err = new NotFoundError('Usuario', '42')
    expect(err.message).toBe('Usuario nao encontrado: 42')
    expect(err.statusCode).toBe(404)
  })
})

describe('ValidationError', () => {
  it('cria com status 422', () => {
    const err = new ValidationError('Campo obrigatorio')
    expect(err.message).toBe('Campo obrigatorio')
    expect(err.statusCode).toBe(422)
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})

describe('ConflictError', () => {
  it('cria com status 409', () => {
    const err = new ConflictError('Email ja existe')
    expect(err.message).toBe('Email ja existe')
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe('CONFLICT')
  })
})
