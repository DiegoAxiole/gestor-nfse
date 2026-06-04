import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/gestor_nfse',
})

export const db = drizzle(pool, { schema })

export async function closeDb() {
  await pool.end()
}
