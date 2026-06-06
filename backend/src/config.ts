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

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definida. Configure a URL de conexão PostgreSQL.')
  }

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET não definida. Configure uma chave secreta para assinatura dos tokens.')
  }

  return {
    ambiente,
    codigo_municipio: Number(process.env.CODIGO_MUNICIPIO) || 1001058,
    databaseUrl,
    jwtSecret,
  }
}
