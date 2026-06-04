import { beforeAll, afterAll } from 'vitest'
import { createApp } from '../app.js'
import type { Express } from 'express'

let app: Express

export async function getApp(): Promise<Express> {
  if (!app) {
    const result = await createApp()
    app = result.app
  }
  return app
}

beforeAll(async () => {
  await getApp()
})
