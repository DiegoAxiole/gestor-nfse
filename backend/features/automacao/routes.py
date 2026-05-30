"""FastAPI router para automação de consultas."""

from fastapi import APIRouter, HTTPException, Query

from features.automacao.application import (
    AgendarConsultaUseCase,
    ListarAgendamentosUseCase,
    RemoverAgendamentoUseCase,
    ListarLogsUseCase,
    AgendarInput,
)


def criar_router_automacao(
    agendar_uc: AgendarConsultaUseCase,
    listar_uc: ListarAgendamentosUseCase,
    remover_uc: RemoverAgendamentoUseCase,
    logs_uc: ListarLogsUseCase,
) -> APIRouter:
    """Cria o router com endpoints de automação de consultas.

    Args:
        agendar_uc: Use case de agendamento.
        listar_uc: Use case de listagem de agendamentos.
        remover_uc: Use case de remoção.
        logs_uc: Use case de listagem de logs.

    Returns:
        APIRouter configurado.
    """
    router = APIRouter(prefix="/api/v1/automacao", tags=["automacao"])

    @router.post("/agendar")
    def agendar(body: dict):
        """Agenda consulta periódica de distribuição."""
        cnpj = body.get("cnpj")
        intervalo = body.get("intervalo_minutos", 60)
        if not cnpj:
            raise HTTPException(status_code=422, detail="cnpj é obrigatório")
        try:
            result = agendar_uc.executar(AgendarInput(prestador_cnpj=cnpj, intervalo_minutos=intervalo))
            return {
                "id": result.id,
                "prestador_cnpj": result.prestador_cnpj,
                "intervalo_minutos": result.intervalo_minutos,
                "ativo": result.ativo,
                "proxima_execucao": result.proxima_execucao,
            }
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    @router.get("/agendamentos")
    def listar():
        """Lista todos os agendamentos."""
        agendamentos = listar_uc.executar()
        return [
            {
                "id": a.id,
                "prestador_cnpj": a.prestador_cnpj,
                "intervalo_minutos": a.intervalo_minutos,
                "ativo": a.ativo,
                "proxima_execucao": a.proxima_execucao,
            }
            for a in agendamentos
        ]

    @router.delete("/agendamentos/{id}")
    def remover(id: int):
        """Remove um agendamento."""
        try:
            remover_uc.executar(id)
            return {"ok": True}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    @router.get("/logs")
    def listar_logs(
        prestador_cnpj: str | None = Query(None),
        limite: int = Query(50, ge=1, le=200),
    ):
        """Lista logs de execução da automação."""
        logs = logs_uc.executar(prestador_cnpj=prestador_cnpj, limite=limite)
        return [
            {
                "id": l.id,
                "prestador_cnpj": l.prestador_cnpj,
                "tipo": l.tipo,
                "mensagem": l.mensagem,
                "created_at": l.created_at,
            }
            for l in logs
        ]

    return router
