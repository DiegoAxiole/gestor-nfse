"""Adapters para consulta de distribuição NFSe via Unimake DLL.

Contém:
- UnimakeDistribuicaoAdapter: chamada real à DLL (fallback mock p/ testes).
- OperacaoRepositorySQLite: persistência de operações de consulta.
- DocumentoRepositorySQLite: persistência de documentos encontrados.

ATENÇÃO: O adapter engole exceções da DLL e retorna valores mock
em ambiente sem DLL (modo testing). Em produção, erros reais da DLL
NÃO são propagados — o status "ERRO" é retornado sem detalhes.
Para depuração, verificar os logs da DLL no servidor.
"""

import xml.etree.ElementTree as ET
from shared.database import Database


class UnimakeDistribuicaoAdapter:
    """Adapter que chama a DLL Unimake para consulta de distribuição.

    Em ambientes sem a DLL instalada (CI/testing), captura exceções
    e retorna valores mock com status "ERRO". Isso permite que os
    testes validem o contrato da API sem depender da DLL real.
    """

    def consultar(self, cnpj: str, nsu: str, tipo_nsu: str, codigo_municipio: int,
                  certificado_pfx: bytes, certificado_senha: str, ambiente: str,
                  progress_callback=None) -> tuple[str, str, str]:
        """Executa consulta de distribuição via DLL Unimake.

        Tenta chamar a DLL real. Se falhar (DLL não disponível, certificado
        inválido, erro de rede), captura a exceção e retorna mock com
        status "ERRO".

        Args:
            cnpj: CNPJ do prestador.
            nsu: NSU para consultar.
            tipo_nsu: 'DISTRIBUICAO' ou 'REMESSA'.
            codigo_municipio: Código IBGE do município.
            certificado_pfx: Binário do PFX.
            certificado_senha: Senha do certificado.
            ambiente: 'Homologacao' ou 'Producao'.
            progress_callback: Função opcional (progresso: int, mensagem: str).

        Returns:
            Tupla (xml_retorno, status_processamento, ultimo_nsu).
        """
        if progress_callback:
            progress_callback(10, "Preparando consulta de distribuição...")
        try:
            from shared.dll import ServiceBase, inicializar_dll
            inicializar_dll()
            from Unimake.Business.DFe.Servicos import Servico
            from Unimake.Business.DFe.Servicos.NFSe import ConsultarDistribuicaoNFSeNSU

            class _Service(ServiceBase):
                @property
                def _servico(self):
                    return Servico.NFSeConsultarDistribuicaoNFSeNSU

            service = _Service(None, certificado_pfx, certificado_senha, ambiente, codigo_municipio)
            xml_enviado = self._gerar_xml(nsu, tipo_nsu)

            if progress_callback:
                progress_callback(30, "Consultando SEFAZ...")
            servico = ConsultarDistribuicaoNFSeNSU()
            servico.Executar(xml_enviado, service._cfg_base)
            xml_retorno = servico.RetornoWSString

            if progress_callback:
                progress_callback(60, "Processando resposta...")

            status_processamento = "DOCUMENTOS_LOCALIZADOS"
            ultimo_nsu = nsu
            try:
                status_processamento = servico.Result.StatusProcessamento
                count = servico.Result.GetLoteDFeCount
                if count > 0:
                    ultimo = servico.Result.GetLoteDFe(count - 1)
                    ultimo_nsu = ultimo.NSU
            except Exception:
                root = ET.fromstring(xml_retorno)
                st = root.find("StatusProcessamento")
                status_processamento = st.text if st is not None else "ERRO"
                lotes = root.findall(".//LoteDFe")
                if lotes:
                    ultimo_nsu = lotes[-1].findtext("NSU", nsu)

            if progress_callback:
                progress_callback(90, "Consulta concluída")
            return xml_retorno, status_processamento, ultimo_nsu
        except Exception:
            if progress_callback:
                progress_callback(100, "Erro na consulta")
            root = ET.Element("retDistribuicaoNFSe")
            st = ET.SubElement(root, "StatusProcessamento")
            st.text = "ERRO"
            xml_retorno = ET.tostring(root, encoding="unicode")
            return xml_retorno, "ERRO", nsu

    def _gerar_xml(self, nsu: str, tipo_nsu: str) -> str:
        """Gera XML de consulta de distribuição NFSe.

        Tenta usar a DLL Unimake para gerar o XML. Em fallback (testes),
        retorna um XML simplificado.

        Args:
            nsu: NSU para consultar.
            tipo_nsu: 'DISTRIBUICAO' ou 'REMESSA'.

        Returns:
            XML string de requisição.
        """
        try:
            from Unimake.Business.DFe.Xml.NFSe.NACIONAL.Consulta import DistribuicaoNFSe
            obj = DistribuicaoNFSe()
            obj.NSU = nsu
            obj.TipoNSU = tipo_nsu
            obj.Lote = "true"
            return obj.GerarXMLString()
        except Exception:
            return f'<distribuicaoNFSe><NSU>{nsu}</NSU><TipoNSU>{tipo_nsu}</TipoNSU></distribuicaoNFSe>'


class OperacaoRepositorySQLite:
    """Repositório de operações de consulta em SQLite.

    Cada consulta à SEFAZ gera um registro de operação com
    status, NSUs e XMLs de request/response para auditoria.
    """

    def __init__(self, db: Database):
        """Inicializa o repositório.

        Args:
            db: Instância compartilhada de Database (SQLite).
        """
        self._db = db

    def registrar_operacao(self, prestador_cnpj: str, tipo: str, nsu_consultado: str,
                           ultimo_nsu: str, status: str, qtd_documentos: int,
                           xml_request: str, xml_response: str, xml_erro: str | None) -> int:
        """Registra uma operação de consulta no banco.

        Args:
            prestador_cnpj: CNPJ do prestador.
            tipo: Tipo da operação (ex: 'consulta_distribuicao').
            nsu_consultado: NSU que foi consultado.
            ultimo_nsu: NSU retornado como último.
            status: Status de processamento.
            qtd_documentos: Quantidade de documentos encontrados.
            xml_request: XML enviado na requisição.
            xml_response: XML recebido na resposta.
            xml_erro: XML de erro (se houver).

        Returns:
            ID da operação registrada.
        """
        cur = self._db.conn.execute(
            """INSERT INTO operacoes
               (prestador_cnpj, tipo, nsu_consultado, ultimo_nsu, status,
                qtd_documentos, xml_request, xml_response, xml_erro)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (prestador_cnpj, tipo, nsu_consultado, ultimo_nsu, status,
             qtd_documentos, xml_request, xml_response, xml_erro),
        )
        self._db.conn.commit()
        return cur.lastrowid

    def ultimo_nsu(self, prestador_cnpj: str) -> str:
        """Retorna o último NSU de sucesso do prestador.

        Args:
            prestador_cnpj: CNPJ do prestador.

        Returns:
            Último NSU ou '000000000000000' se nunca houve sucesso.
        """
        row = self._db.conn.execute(
            """SELECT ultimo_nsu FROM operacoes
               WHERE prestador_cnpj = ? AND status = 'DOCUMENTOS_LOCALIZADOS'
               ORDER BY id DESC LIMIT 1""",
            (prestador_cnpj,),
        ).fetchone()
        return row["ultimo_nsu"] if row else "000000000000000"

    def ultima_operacao(self, prestador_cnpj: str) -> dict | None:
        """Retorna a última operação do prestador (qualquer status).

        Args:
            prestador_cnpj: CNPJ do prestador.

        Returns:
            Dict com os dados da operação ou None se nunca consultou.
        """
        row = self._db.conn.execute(
            """SELECT id, prestador_cnpj, tipo, nsu_consultado, ultimo_nsu, status, qtd_documentos, xml_request, xml_response, xml_erro, created_at FROM operacoes
               WHERE prestador_cnpj = ?
               ORDER BY id DESC LIMIT 1""",
            (prestador_cnpj,),
        ).fetchone()
        return dict(row) if row else None


class DocumentoRepositorySQLite:
    """Repositório de documentos encontrados na consulta em SQLite."""

    def __init__(self, db: Database):
        self._db = db

    def inserir_documentos(self, docs: list, operacao_id: int, prestador_cnpj: str) -> None:
        """Persiste lista de documentos (INSERT OR IGNORE por chave).

        Args:
            docs: Lista de LoteDFe com metadados.
            operacao_id: ID da operação que encontrou os documentos.
            prestador_cnpj: CNPJ do prestador.
        """
        for doc in docs:
            self._db.conn.execute(
                "INSERT OR IGNORE INTO documentos (chave_acesso, prestador_cnpj, operacao_id, nsu, xml_nfse, data_emissao, emissao_dh) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (doc.chave_acesso, prestador_cnpj, operacao_id, doc.nsu, doc.xml_nfse, doc.data_emissao, doc.emissao_dh),
            )
        self._db.conn.commit()
