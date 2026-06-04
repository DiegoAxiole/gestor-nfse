import { db } from '../../db/db.js'
import { backgroundTasks } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export const taskRepository = {
  async buscar(taskId: string, tenantId: number) {
    const rows = await db.select().from(backgroundTasks)
      .where(and(eq(backgroundTasks.id, taskId), eq(backgroundTasks.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },
}
