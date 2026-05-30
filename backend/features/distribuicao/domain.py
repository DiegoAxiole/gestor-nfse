"""Entidades do domínio de distribuição NFSe.

Representa os dados retornados pela consulta de distribuição
de NFS-e junto ao webservice da prefeitura via Unimake DLL.
"""

from dataclasses import dataclass, field


@dataclass
class LoteDFe:
    """Lote com dados resumidos de uma NFS-e retornado na consulta.

    Attributes:
        chave_acesso: Chave de acesso de 44/50 dígitos da NFS-e.
        nsu: Número sequencial único atribuído pela prefeitura.
        xml_nfse: XML completo da NFS-e (conteúdo da tag ArquivoXml).
        data_emissao: Data de competência (dCompet), formato YYYY-MM-DD.
        emissao_dh: Data/hora de emissão (dhEmi), ISO 8601.
    """
    chave_acesso: str
    nsu: str
    xml_nfse: str
    data_emissao: str = ""
    emissao_dh: str = ""


@dataclass
class ResultadoDistribuicao:
    """Resultado da consulta de distribuição NFSe por NSU.

    Attributes:
        sucesso: True se a consulta foi processada sem exceções.
        status_processamento: Código retornado pela SEFAZ
            (DOCUMENTOS_LOCALIZADOS, NENHUM_DOCUMENTO_LOCALIZADO,
             WAIT, ERRO).
        lote_dfe: Lista de NFS-e encontradas.
        proximo_nsu: NSU para continuar a consulta na próxima vez.
        mensagem_erro: Descrição do erro quando sucesso=False.
    """
    sucesso: bool
    status_processamento: str
    lote_dfe: list[LoteDFe]
    proximo_nsu: str
    mensagem_erro: str = ""
