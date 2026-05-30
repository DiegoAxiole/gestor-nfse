"""Use case para consulta de distribuição NFSe.

Regras de negócio:
1. WAIT de 3600s entre consultas com mesmo status (NENHUM_DOCUMENTO_LOCALIZADO ou ERRO).
2. Se WAIT é violado, o prestador é bloqueado temporariamente — retorna sucesso=False.
3. O NSU inicial é obtido automaticamente da última operação se não fornecido.
4. Documentos encontrados são persistidos automaticamente.
"""

from dataclasses import dataclass
from typing import Protocol

from features.distribuicao.domain import ResultadoDistribuicao, LoteDFe


def _sub_callback(parent_cb, offset: int, scale: int):
    """Mapeia progresso de 0..100 do filho para offset..offset+scale do pai."""
    if parent_cb is None:
        return None
    def cb(progresso: int, mensagem: str):
        mapeado = offset + int(progresso * scale / 100)
        parent_cb(min(mapeado, offset + scale), mensagem)
    return cb


class UnimakeDistribuicaoPort(Protocol):
    """Port para chamada à DLL Unimake de consulta de distribuição."""

    def consultar(self, cnpj: str, nsu: str, tipo_nsu: str, codigo_municipio: int,
                  certificado_pfx: bytes, certificado_senha: str, ambiente: str,
                  progress_callback=None) -> tuple[str, str, str]:
        """Executa consulta de distribuição NFSe na DLL Unimake.

        Args:
            cnpj: CNPJ do prestador (14 dígitos).
            nsu: NSU inicial da consulta.
            tipo_nsu: 'DISTRIBUICAO' (padrão) ou 'REMESSA'.
            codigo_municipio: Código IBGE do município.
            certificado_pfx: Conteúdo binário do certificado PFX.
            certificado_senha: Senha do certificado.
            ambiente: 'Homologacao' ou 'Producao'.
            progress_callback: Função opcional (progresso: int, mensagem: str).

        Returns:
            Tupla (xml_retorno, status_processamento, ultimo_nsu).
        """


class OperacaoRepositoryPort(Protocol):
    """Port para persistência de operações de consulta."""

    def registrar_operacao(self, prestador_cnpj: str, tipo: str, nsu_consultado: str,
                           ultimo_nsu: str, status: str, qtd_documentos: int,
                           xml_request: str, xml_response: str, xml_erro: str | None) -> int:
        """Registra uma operação de consulta.

        Returns:
            ID da operação registrada.
        """

    def ultimo_nsu(self, prestador_cnpj: str) -> str:
        """Retorna o último NSU consultado com sucesso para o prestador."""

    def ultima_operacao(self, prestador_cnpj: str) -> dict | None:
        """Retorna a última operação do prestador (qualquer status)."""


class DocumentoRepositoryPort(Protocol):
    """Port para persistência de documentos encontrados."""

    def inserir_documentos(self, docs: list, operacao_id: int, prestador_cnpj: str) -> None:
        """Persiste lista de documentos encontrados na consulta."""


@dataclass
class ConsultarDistribuicaoInput:
    """Input para o use case de consulta de distribuição.

    Attributes:
        cnpj: CNPJ do prestador (obrigatório).
        nsu: NSU para iniciar a consulta. Se None, usa o último conhecido.
        tipo_nsu: 'DISTRIBUICAO' (padrão) ou 'REMESSA'.
    """
    cnpj: str
    nsu: str | None = None
    tipo_nsu: str = "DISTRIBUICAO"


class ConsultarDistribuicaoUseCase:
    """Use case para consultar distribuição NFSe por NSU.

    Aplica WAIT de 3600s entre consultas com o mesmo status para evitar
    bloqueio do prestador junto à prefeitura. Se a regra de WAIT for
    violada, retorna sucesso=False com status_processamento="WAIT".

    Raises (internamente capturadas):
        ValueError: Se cnpj for inválido.
        Exception: Da DLL Unimake — convertida em ResultadoDistribuicao com erro.
    """

    WAIT_SEGUNDOS = 3600

    def __init__(self, unimake: UnimakeDistribuicaoPort,
                 operacao_repo: OperacaoRepositoryPort,
                 documento_repo: DocumentoRepositoryPort):
        self._unimake = unimake
        self._operacao_repo = operacao_repo
        self._documento_repo = documento_repo

    def obter_ultimo_nsu(self, cnpj: str) -> str:
        """Retorna o último NSU conhecido para o prestador.

        Args:
            cnpj: CNPJ do prestador.

        Returns:
            Último NSU ou '000000000000000' se nunca consultou.
        """
        return self._operacao_repo.ultimo_nsu(cnpj)

    def executar(self, input_data: ConsultarDistribuicaoInput,
                 certificado_pfx: bytes, certificado_senha: str,
                 ambiente: str, codigo_municipio: int,
                 progress_callback=None) -> ResultadoDistribuicao:
        """Executa a consulta de distribuição NFSe.

        Fluxo:
        1. Define NSU (fornecido ou último conhecido).
        2. Verifica WAIT — se a última operação tem o mesmo status
           e foi há menos de WAIT_SEGUNDOS, bloqueia o prestador.
        3. Chama a DLL Unimake.
        4. Se NENHUM_DOCUMENTO_LOCALIZADO, registra operação e retorna.
        5. Se DOCUMENTOS_LOCALIZADOS, extrai lote e persiste documentos.
        6. Em caso de exceção, registra ERRO e retorna com mensagem.

        Args:
            input_data: CNPJ, NSU opcional e tipo NSU.
            certificado_pfx: Binário do PFX do prestador.
            certificado_senha: Senha do certificado.
            ambiente: 'Homologacao' ou 'Producao'.
            codigo_municipio: Código IBGE do município.
            progress_callback: Função opcional (progresso: int, mensagem: str).

        Returns:
            ResultadoDistribuicao com status, lote e mensagem de erro.
        """
        from datetime import datetime, timedelta, timezone

        if progress_callback:
            progress_callback(5, "Preparando consulta...")

        nsu = input_data.nsu
        if nsu is None:
            nsu = self._operacao_repo.ultimo_nsu(input_data.cnpj)

        if progress_callback:
            progress_callback(10, "Verificando WAIT...")
        ultima = self._operacao_repo.ultima_operacao(input_data.cnpj)
        if ultima and ultima.get("status") in ("NENHUM_DOCUMENTO_LOCALIZADO", "ERRO"):
            criado = datetime.fromisoformat(ultima["created_at"])
            if datetime.now(timezone.utc).replace(tzinfo=None) - criado < timedelta(seconds=self.WAIT_SEGUNDOS):
                return ResultadoDistribuicao(
                    sucesso=False,
                    status_processamento="WAIT",
                    lote_dfe=[],
                    proximo_nsu=nsu,
                    mensagem_erro=(
                        f"Prestador bloqueado temporariamente. "
                        f"Aguardar {self.WAIT_SEGUNDOS}s entre consultas "
                        f"(último status: {ultima['status']})"
                    ),
                )

        if progress_callback:
            progress_callback(15, "Consultando SEFAZ...")
        try:
            xml_retorno, status_processamento, ultimo_nsu = self._unimake.consultar(
                cnpj=input_data.cnpj,
                nsu=nsu,
                tipo_nsu=input_data.tipo_nsu,
                codigo_municipio=codigo_municipio,
                certificado_pfx=certificado_pfx,
                certificado_senha=certificado_senha,
                ambiente=ambiente,
                progress_callback=_sub_callback(progress_callback, 15, 70),
            )

            if progress_callback:
                progress_callback(85, "Processando resultado...")

            if status_processamento in ("NENHUM_DOCUMENTO_LOCALIZADO", "ERRO"):
                self._operacao_repo.registrar_operacao(
                    input_data.cnpj, "consulta_distribuicao", nsu, nsu,
                    status_processamento, 0, "", xml_retorno, None,
                )
                return ResultadoDistribuicao(
                    sucesso=status_processamento == "NENHUM_DOCUMENTO_LOCALIZADO",
                    status_processamento=status_processamento,
                    lote_dfe=[], proximo_nsu=nsu,
                )

            lote_dfe = self._extrair_lote(xml_retorno)
            if lote_dfe:
                ultimo_nsu = lote_dfe[-1].nsu

            if progress_callback:
                progress_callback(90, "Persistindo documentos...")
            op_id = self._operacao_repo.registrar_operacao(
                input_data.cnpj, "consulta_distribuicao", nsu, ultimo_nsu,
                "DOCUMENTOS_LOCALIZADOS", len(lote_dfe), "", xml_retorno, None,
            )

            if lote_dfe:
                self._documento_repo.inserir_documentos(lote_dfe, op_id, input_data.cnpj)

            if progress_callback:
                progress_callback(100, "Consulta concluída")
            return ResultadoDistribuicao(
                sucesso=True,
                status_processamento="DOCUMENTOS_LOCALIZADOS",
                lote_dfe=lote_dfe,
                proximo_nsu=ultimo_nsu,
            )

        except Exception as e:
            self._operacao_repo.registrar_operacao(
                input_data.cnpj, "consulta_distribuicao", nsu, nsu,
                "ERRO", 0, "", "", str(e),
            )
            return ResultadoDistribuicao(
                sucesso=False,
                status_processamento="ERRO",
                lote_dfe=[],
                proximo_nsu=nsu,
                mensagem_erro=str(e),
            )

    def _extrair_lote(self, xml_retorno: str) -> list[LoteDFe]:
        """Extrai lista de LoteDFe do XML de retorno da SEFAZ.

        Args:
            xml_retorno: XML string retornado pela consulta.

        Returns:
            Lista de LoteDFe encontrados (vazia se parsing falhar).
        """
        import xml.etree.ElementTree as ET

        lote_dfe = []
        try:
            root = ET.fromstring(xml_retorno)
            for lote_el in root.findall(".//LoteDFe"):
                chave = lote_el.findtext("ChaveAcesso", "")
                nsu_val = lote_el.findtext("NSU", "")
                arq = lote_el.find("ArquivoXml")
                xml_nfse_val = ""
                if arq is not None and len(arq):
                    xml_nfse_val = ET.tostring(arq[0], encoding="unicode")
                data_emissao, emissao_dh = self._extrair_datas_nfse(xml_nfse_val)
                lote_dfe.append(LoteDFe(
                    chave_acesso=chave, nsu=nsu_val, xml_nfse=xml_nfse_val,
                    data_emissao=data_emissao, emissao_dh=emissao_dh,
                ))
        except Exception:
            pass
        return lote_dfe

    @staticmethod
    def _extrair_datas_nfse(xml_nfse: str) -> tuple[str, str]:
        """Extrai data de competência e data/hora de emissão do XML da NFSe.

        Args:
            xml_nfse: XML string da NFSe (padrão Nacional DPS).

        Returns:
            Tupla (data_emissao, emissao_dh) — vazio se não encontrar.
        """
        import xml.etree.ElementTree as ET

        if not xml_nfse:
            return "", ""
        ns = {"ns0": "http://www.sped.fazenda.gov.br/nfse"}
        try:
            root = ET.fromstring(xml_nfse)
            dcompet = root.findtext(".//ns0:dCompet", "", ns)
            dh_emi = root.findtext(".//ns0:dhEmi", "", ns)
            return dcompet, dh_emi
        except Exception:
            return "", ""
