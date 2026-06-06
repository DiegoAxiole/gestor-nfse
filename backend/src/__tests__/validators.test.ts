import { describe, it, expect } from 'vitest'
import { validarCnpj, validarChaveAcesso } from '../validators.js'

describe('validarCnpj', () => {
  it('aceita CNPJ com 14 dígitos', () => {
    expect(validarCnpj('12345678000199')).toBe(true)
  })

  it('rejeita string com menos de 14 dígitos', () => {
    expect(validarCnpj('1234567800019')).toBe(false)
  })

  it('rejeita string com mais de 14 dígitos', () => {
    expect(validarCnpj('123456780001999')).toBe(false)
  })

  it('rejeita string com letras', () => {
    expect(validarCnpj('abc45678000199')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(validarCnpj('')).toBe(false)
  })

  it('rejeita CNPJ formatado com pontuação', () => {
    expect(validarCnpj('12.345.678/0001-99')).toBe(false)
  })
})

describe('validarChaveAcesso', () => {
  it('aceita chave de 44 dígitos', () => {
    expect(validarChaveAcesso('12345678901234567890123456789012345678901234')).toBe(true)
  })

  it('aceita chave nacional de 50 dígitos', () => {
    expect(validarChaveAcesso('12345678901234567890123456789012345678901234567890')).toBe(true)
  })

  it('rejeita chave com 43 dígitos', () => {
    expect(validarChaveAcesso('1234567890123456789012345678901234567890123')).toBe(false)
  })

  it('rejeita chave com 45 dígitos', () => {
    expect(validarChaveAcesso('123456789012345678901234567890123456789012345')).toBe(false)
  })

  it('rejeita chave com letras', () => {
    expect(validarChaveAcesso('abcdefghij1234567890123456789012345678901234')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(validarChaveAcesso('')).toBe(false)
  })
})
