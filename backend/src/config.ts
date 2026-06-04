export interface AppConfig {
  ambiente: string
  codigo_municipio: number
  databaseUrl: string
  jwtSecret: string
}

export function carregarConfig(): AppConfig {
  const ambiente = process.env.AMBIENTE || 'Homologacao'
  if (!['Homologacao', 'Producao'].includes(ambiente)) {
    throw new Error(`Ambiente inválido: ${ambiente}. Use 'Homologacao' ou 'Producao'.`)
  }
  return {
    ambiente,
    codigo_municipio: Number(process.env.CODIGO_MUNICIPIO) || 1001058,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/gestor_nfse',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  }
}
