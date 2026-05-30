"""Entidades do domínio de documentos NFSe."""

from dataclasses import dataclass


@dataclass
class Documento:
    """Documento NFSe armazenado no sistema."""
    chave_acesso: str
    prestador_cnpj: str
    nsu: str
    xml_nfse: str
    tem_pdf: bool = False
    data_emissao: str = ""
    emissao_dh: str = ""
    created_at: str = ""


@dataclass
class FiltroDocumentos:
    """Filtros para listagem de documentos."""
    prestador_cnpj: str | None = None
    inicio: str | None = None
    fim: str | None = None
    data_inicio: str | None = None
    data_fim: str | None = None
    tem_pdf: bool | None = None
    page: int = 1
    page_size: int = 50
