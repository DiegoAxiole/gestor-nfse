import { useState, useEffect, useRef } from "react"
import { buscarTask } from "../api"
import type { TaskStatus } from "../api-types"

export interface UseTaskPollingResult {
  status: TaskStatus["status"] | "idle"
  progresso: number
  mensagem: string
  resultado: TaskStatus["resultado"]
  mensagem_erro: string | null
}

const POLL_INTERVAL = 2000

export function useTaskPolling(taskId: string | null): UseTaskPollingResult {
  const [state, setState] = useState<UseTaskPollingResult>({
    status: "idle",
    progresso: 0,
    mensagem: "",
    resultado: null,
    mensagem_erro: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!taskId) {
      setState({ status: "idle", progresso: 0, mensagem: "", resultado: null, mensagem_erro: null })
      return
    }

    setState({ status: "processing", progresso: 0, mensagem: "Iniciando...", resultado: null, mensagem_erro: null })

    const poll = async () => {
      try {
        const task = await buscarTask(taskId)
        setState({
          status: task.status,
          progresso: task.progresso,
          mensagem: task.mensagem,
          resultado: task.resultado,
          mensagem_erro: task.mensagem_erro,
        })
        if (task.status === "completed" || task.status === "error") {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch (err: any) {
        setState({
          status: "error",
          progresso: 0,
          mensagem: "",
          resultado: null,
          mensagem_erro: err.message || "Erro ao consultar task",
        })
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [taskId])

  return state
}
