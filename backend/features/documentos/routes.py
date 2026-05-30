"""FastAPI router para documentos."""

import io
import zipfile

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from shared.validators import validar_cnpj, validar_chave_acesso

from features.documentos.application import (
    ListarDocumentosUseCase,
    BaixarXmlUseCase,
    BaixarPdfUseCase,
    BaixarZipUseCase,
)
from features.documentos.domain import FiltroDocumentos


def criar_router_documentos(
    listar_uc: ListarDocumentosUseCase,
    baixar_xml_uc: BaixarXmlUseCase,
    baixar_pdf_uc: BaixarPdfUseCase,
    baixar_zip_uc: BaixarZipUseCase | None = None,
) -> APIRouter:
    """Cria o router com os endpoints de documentos.

    Args:
        listar_uc: Use case de listagem.
        baixar_xml_uc: Use case de download de XML.
        baixar_pdf_uc: Use case de download de PDF.

    Returns:
        APIRouter configurado.
    """
    router = APIRouter(prefix="/api/v1/documentos", tags=["documentos"])

    @router.get("")
    def listar(
        cnpj: str | None = Query(None),
        inicio: str | None = Query(None),
        fim: str | None = Query(None),
        data_inicio: str | None = Query(None),
        data_fim: str | None = Query(None),
        tem_pdf: bool | None = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=1000),
    ):
        """Lista documentos com filtros opcionais."""
        if cnpj and not validar_cnpj(cnpj):
            raise HTTPException(status_code=422, detail="CNPJ inválido: deve ter 14 dígitos")
        filtro = FiltroDocumentos(
            prestador_cnpj=cnpj,
            inicio=inicio,
            fim=fim,
            data_inicio=data_inicio,
            data_fim=data_fim,
            tem_pdf=tem_pdf,
            page=page,
            page_size=page_size,
        )
        resultado = listar_uc.executar(filtro)
        return {
            "documentos": [
                {
                    "chave_acesso": d.chave_acesso,
                    "prestador_cnpj": d.prestador_cnpj,
                    "nsu": d.nsu,
                    "tem_pdf": d.tem_pdf,
                    "xml_nfse": d.xml_nfse,
                    "data_emissao": d.data_emissao,
                    "emissao_dh": d.emissao_dh,
                    "created_at": d.created_at,
                }
                for d in resultado.documentos
            ],
            "total": resultado.total,
        }

    @router.get("/{chave_acesso}/xml")
    def baixar_xml(chave_acesso: str):
        """Baixa XML de um documento."""
        if not validar_chave_acesso(chave_acesso):
            raise HTTPException(status_code=422, detail="chave_acesso inválida: deve ter 44 dígitos")
        try:
            xml = baixar_xml_uc.executar(chave_acesso)
            return Response(content=xml, media_type="application/xml")
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    @router.get("/{chave_acesso}/pdf")
    def baixar_pdf(chave_acesso: str):
        """Baixa PDF de um documento."""
        if not validar_chave_acesso(chave_acesso):
            raise HTTPException(status_code=422, detail="chave_acesso inválida: deve ter 44 dígitos")
        try:
            pdf = baixar_pdf_uc.executar(chave_acesso)
            return Response(content=pdf, media_type="application/pdf")
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    @router.get("/download-zip")
    def download_zip(
        cnpj: str = Query(...),
        inicio: str = Query(...),
        fim: str = Query(...),
    ):
        """Baixa ZIP com XMLs filtrados por CNPJ e período."""
        if not validar_cnpj(cnpj):
            raise HTTPException(status_code=422, detail="CNPJ inválido: deve ter 14 dígitos")
        if baixar_zip_uc is None:
            raise HTTPException(status_code=501, detail="Funcionalidade não disponível")
        try:
            zip_bytes = baixar_zip_uc.executar(cnpj, inicio, fim)
            return Response(content=zip_bytes, media_type="application/zip",
                            headers={"Content-Disposition": f"attachment; filename=nfse_{cnpj}.zip"})
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    return router
