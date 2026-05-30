from fastapi import APIRouter, HTTPException

from features.config.application import ObterConfigUseCase, AtualizarConfigUseCase


def criar_router_config(
    obter_uc: ObterConfigUseCase,
    atualizar_uc: AtualizarConfigUseCase,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/config", tags=["config"])

    @router.get("")
    def obter():
        config = obter_uc.executar()
        return {
            "cnpj": config.cnpj,
            "razao_social": config.razao_social,
            "ambiente": config.ambiente,
            "codigo_municipio": str(config.codigo_municipio),
            "certificado_caminho": config.certificado_caminho,
            "certificado_senha_mascarada": "****" if config.certificado_senha else "",
            "lgpd_ativo": config.lgpd_ativo,
        }

    @router.put("")
    def atualizar(body: dict):
        allowed = {"ambiente", "codigo_municipio", "certificado_caminho", "certificado_senha", "lgpd_ativo", "cnpj", "razao_social"}
        dados = {k: v for k, v in body.items() if k in allowed}
        if "ambiente" in dados and dados["ambiente"] not in ("Homologacao", "Producao"):
            raise HTTPException(status_code=422, detail="Ambiente inválido. Use 'Homologacao' ou 'Producao'.")
        try:
            config = atualizar_uc.executar(dados)
            return {
                "cnpj": config.cnpj,
                "razao_social": config.razao_social,
                "ambiente": config.ambiente,
                "codigo_municipio": str(config.codigo_municipio),
                "certificado_caminho": config.certificado_caminho,
                "certificado_senha_mascarada": "****" if config.certificado_senha else "",
                "lgpd_ativo": config.lgpd_ativo,
            }
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    return router
