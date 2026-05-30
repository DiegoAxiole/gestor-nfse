from fastapi import APIRouter, HTTPException, Query

from features.operacoes.application import ListarOperacoesUseCase, BuscarOperacaoUseCase


def criar_router_operacoes(
    listar_uc: ListarOperacoesUseCase,
    buscar_uc: BuscarOperacaoUseCase,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/operacoes", tags=["operacoes"])

    @router.get("")
    def listar(
        cnpj: str | None = Query(None),
        limite: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
    ):
        resultado = listar_uc.executar(cnpj=cnpj, limite=limite, offset=offset)
        return [
            {
                "id": o.id,
                "prestador_cnpj": o.prestador_cnpj,
                "tipo": o.tipo,
                "nsu_consultado": o.nsu_consultado,
                "ultimo_nsu": o.ultimo_nsu,
                "status": o.status,
                "qtd_documentos": o.qtd_documentos,
                "created_at": o.created_at,
            }
            for o in resultado.operacoes
        ]

    @router.get("/{id}")
    def buscar(id: int):
        try:
            op = buscar_uc.executar(id)
            return {
                "id": op.id,
                "prestador_cnpj": op.prestador_cnpj,
                "tipo": op.tipo,
                "nsu_consultado": op.nsu_consultado,
                "ultimo_nsu": op.ultimo_nsu,
                "status": op.status,
                "qtd_documentos": op.qtd_documentos,
                "xml_request": op.xml_request,
                "xml_response": op.xml_response,
                "xml_erro": op.xml_erro,
                "created_at": op.created_at,
            }
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    return router
