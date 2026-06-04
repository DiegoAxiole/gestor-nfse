import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { taskRepository } from './tasks.repository.js'

export function criarRouterTasks(): Router {
  const router = Router()

  router.get('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await taskRepository.buscar(req.params.taskId, req.tenantId!)
      if (!task) { res.status(404).json({ detail: 'Task nao encontrada' }); return }
      res.json({
        task_id: task.id,
        tipo: task.tipo,
        chave_acesso: task.chave_acesso,
        cnpj: task.cnpj,
        status: task.status,
        progresso: task.progresso,
        mensagem: task.mensagem,
        resultado: task.resultado_json ? JSON.parse(task.resultado_json) : null,
        mensagem_erro: task.erro_texto,
        criado_em: task.criado_em,
        atualizado_em: task.atualizado_em,
      })
    } catch (err) { next(err) }
  })

  return router
}
