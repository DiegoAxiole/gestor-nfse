"""FastAPI router para consulta de distribuição NFSe.

Endpoints:
- POST /api/v1/distribuicao/consultar — consulta NFS-e por NSU.
- GET  /api/v1/distribuicao/ultimo-nsu — último NSU do prestador.
"""

from fastapi import APIRouter, HTTPException

from shared.validators import validar_cnpj

from features.distribuicao.application import (
    ConsultarDistribuicaoUseCase,
    ConsultarDistribuicaoInput,
)

from features.prestadores.infra import PrestadorRepositorySQLite


def criar_router_distribuicao(
    use_case: ConsultarDistribuicaoUseCase,
    prestador_repo: PrestadorRepositorySQLite,
    task_manager=None,
    codigo_municipio: int = 1001058,
) -> APIRouter:
    """Cria o router com os endpoints de distribuição NFSe.

    Args:
        use_case: Caso de uso de consulta de distribuição.
        prestador_repo: Repositório para buscar dados do prestador.
        task_manager: Gerenciador de background tasks (opcional).
        codigo_municipio: Código IBGE do município (default: 1001058).

    Returns:
        APIRouter configurado.
    """
    router = APIRouter(prefix="/api/v1/distribuicao", tags=["distribuicao"])

    @router.post("/consultar", status_code=202)
    def consultar(body: dict):
        """Consulta distribuição de NFS-e por NSU (assíncrono).

        Retorna task_id para polling em GET /api/v1/tasks/{task_id}.
        Se já existir task ativa para o mesmo CNPJ, retorna 409.

        Body (JSON):
            cnpj (obrigatório): CNPJ do prestador (14 dígitos).
            nsu (opcional): NSU para consultar. Se omitido, usa o último.
            tipo_nsu (opcional): 'DISTRIBUICAO' (padrão) ou 'REMESSA'.

        Retorna:
            202: Task criada ({task_id, status}).
            404: Prestador não encontrado.
            409: Já existe task ativa.
            422: CNPJ não informado.
        """
        cnpj = body.get("cnpj")
        if not cnpj:
            raise HTTPException(status_code=422, detail="cnpj é obrigatório")
        if not validar_cnpj(cnpj):
            raise HTTPException(status_code=422, detail="CNPJ inválido: deve ter 14 dígitos")

        prestador = prestador_repo.buscar_por_cnpj(cnpj)
        if prestador is None:
            raise HTTPException(status_code=404, detail="Prestador não encontrado")

        input_data = ConsultarDistribuicaoInput(
            cnpj=cnpj,
            nsu=body.get("nsu"),
            tipo_nsu=body.get("tipo_nsu", "DISTRIBUICAO"),
        )

        if task_manager:
            def task_fn(progress_callback):
                resultado = use_case.executar(
                    input_data,
                    certificado_pfx=prestador.certificado_pfx,
                    certificado_senha=prestador.certificado_senha,
                    ambiente=prestador.ambiente,
                    codigo_municipio=codigo_municipio,
                    progress_callback=progress_callback,
                )
                return {
                    "sucesso": resultado.sucesso,
                    "status_processamento": resultado.status_processamento,
                    "lote_dfe": [
                        {"chave_acesso": d.chave_acesso, "nsu": d.nsu}
                        for d in resultado.lote_dfe
                    ],
                    "proximo_nsu": resultado.proximo_nsu,
                    "mensagem_erro": resultado.mensagem_erro,
                }

            chave_id = body.get("nsu") or use_case.obter_ultimo_nsu(cnpj)
            task_id, is_nova = task_manager.iniciar("consultar_distribuicao", chave_id, cnpj, task_fn)
            if not is_nova:
                raise HTTPException(
                    status_code=409,
                    detail="Já existe uma consulta ativa para este prestador",
                    headers={"X-Task-Id": task_id},
                )
            return {"task_id": task_id, "status": "processing"}
        else:
            resultado = use_case.executar(
                input_data,
                certificado_pfx=prestador.certificado_pfx,
                certificado_senha=prestador.certificado_senha,
                ambiente=prestador.ambiente,
                codigo_municipio=codigo_municipio,
            )

            return {
                "sucesso": resultado.sucesso,
                "status_processamento": resultado.status_processamento,
                "lote_dfe": [
                    {
                        "chave_acesso": d.chave_acesso,
                        "nsu": d.nsu,
                    }
                    for d in resultado.lote_dfe
                ],
                "proximo_nsu": resultado.proximo_nsu,
                "mensagem_erro": resultado.mensagem_erro,
            }

    @router.get("/ultimo-nsu")
    def ultimo_nsu(cnpj: str):
        """Retorna o último NSU consultado com sucesso para o prestador.

        Args:
            cnpj: CNPJ do prestador (query param obrigatório).

        Retorna:
            200: {"ultimo_nsu": "..."}
            422: CNPJ não informado.
        """
        if not cnpj:
            raise HTTPException(status_code=422, detail="cnpj é obrigatório")
        nsu = use_case.obter_ultimo_nsu(cnpj)
        return {"ultimo_nsu": nsu}

    return router
