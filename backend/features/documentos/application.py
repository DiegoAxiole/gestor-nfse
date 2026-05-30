"""Use cases para consulta de documentos."""

import io
import zipfile
from dataclasses import dataclass, field
from typing import Protocol

from features.documentos.domain import Documento, FiltroDocumentos


@dataclass
class DocumentosPaginados:
    """Resultado paginado da listagem de documentos."""

    documentos: list[Documento] = field(default_factory=list)
    total: int = 0


class DocumentoQueryPort(Protocol):
    """Port para consulta de documentos."""

    def listar(self, filtro: FiltroDocumentos) -> list[Documento]:
        """Lista documentos com filtros.

        Args:
            filtro: Filtros de busca (CNPJ, data, paginação).

        Returns:
            Lista de Documento.
        """

    def contar(self, filtro: FiltroDocumentos) -> int:
        """Conta documentos com filtros (sem paginação).

        Args:
            filtro: Filtros de busca (CNPJ, data).

        Returns:
            Total de registros que correspondem aos filtros.
        """

    def buscar_por_chave(self, chave_acesso: str) -> dict | None:
        """Busca documento pela chave de acesso.

        Args:
            chave_acesso: Chave de acesso de 44 dígitos.

        Returns:
            Dict com xml_nfse e pdf_blob, ou None se não encontrado.
        """

    def listar_por_periodo(self, cnpj: str, inicio: str, fim: str) -> list[dict]:
        """Lista XMLs de documentos em um período.

        Args:
            cnpj: CNPJ do prestador.
            inicio: Data início (YYYY-MM-DD).
            fim: Data fim (YYYY-MM-DD).

        Returns:
            Lista de dicts com chave_acesso e xml_nfse.
        """


class ListarDocumentosUseCase:
    """Lista documentos com filtros."""

    def __init__(self, repo: DocumentoQueryPort):
        self._repo = repo

    def executar(self, filtro: FiltroDocumentos) -> DocumentosPaginados:
        documentos = self._repo.listar(filtro)
        total = self._repo.contar(filtro)
        return DocumentosPaginados(documentos=documentos, total=total)


class BaixarXmlUseCase:
    """Retorna o XML de um documento."""

    def __init__(self, repo: DocumentoQueryPort):
        self._repo = repo

    def executar(self, chave_acesso: str) -> str:
        doc = self._repo.buscar_por_chave(chave_acesso)
        if doc is None:
            raise ValueError(f"Documento não encontrado: {chave_acesso}")
        return doc["xml_nfse"]


class BaixarPdfUseCase:
    """Retorna o PDF de um documento."""

    def __init__(self, repo: DocumentoQueryPort):
        self._repo = repo

    def executar(self, chave_acesso: str) -> bytes:
        doc = self._repo.buscar_por_chave(chave_acesso)
        if doc is None or doc.get("pdf_blob") is None:
            raise ValueError(f"PDF não encontrado: {chave_acesso}")
        return doc["pdf_blob"]


class BaixarZipUseCase:
    """Gera ZIP com XMLs de documentos filtrados por CNPJ e período."""

    def __init__(self, repo: DocumentoQueryPort):
        self._repo = repo

    def executar(self, cnpj: str, inicio: str, fim: str) -> bytes:
        documentos = self._repo.listar_por_periodo(cnpj, inicio, fim)
        if not documentos:
            raise ValueError("Nenhum documento encontrado no período")

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for doc in documentos:
                zf.writestr(f"{doc['chave_acesso']}.xml", doc["xml_nfse"])
        return buf.getvalue()
