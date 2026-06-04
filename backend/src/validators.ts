const CNPJ_PATTERN = /^\d{14}$/
const CHAVE_ACESSO_PATTERN = /^\d{44}$/
const CHAVE_ACESSO_NACIONAL_PATTERN = /^\d{50}$/

export function validarCnpj(cnpj: string): boolean {
  return CNPJ_PATTERN.test(cnpj)
}

export function validarChaveAcesso(chave: string): boolean {
  return CHAVE_ACESSO_PATTERN.test(chave) || CHAVE_ACESSO_NACIONAL_PATTERN.test(chave)
}
