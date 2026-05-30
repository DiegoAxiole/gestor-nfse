"""Repositório de documentos em SQLite."""

from shared.database import Database
from features.documentos.domain import Documento, FiltroDocumentos


class DocumentoRepositorySQLite:
    """Repositório de documentos usando SQLite."""

    def __init__(self, db: Database):
        self._db = db

    def _build_where(self, filtro: FiltroDocumentos) -> tuple[str, list]:
        clauses = []
        params = []
        if filtro.prestador_cnpj:
            clauses.append("prestador_cnpj = ?")
            params.append(filtro.prestador_cnpj)
        if filtro.inicio:
            clauses.append("created_at >= ?")
            params.append(filtro.inicio)
        if filtro.fim:
            clauses.append("created_at <= ?")
            params.append(filtro.fim)
        if filtro.data_inicio:
            clauses.append("data_emissao >= ?")
            params.append(filtro.data_inicio)
        if filtro.data_fim:
            clauses.append("data_emissao <= ?")
            params.append(filtro.data_fim)
        if filtro.tem_pdf is True:
            clauses.append("pdf_blob IS NOT NULL")
        elif filtro.tem_pdf is False:
            clauses.append("pdf_blob IS NULL")
        where = " AND ".join(clauses) if clauses else "1=1"
        return where, params

    def listar(self, filtro: FiltroDocumentos) -> list[Documento]:
        """Lista documentos aplicando filtros e paginação.

        Args:
            filtro: Filtros e parâmetros de paginação.

        Returns:
            Lista de Documento.
        """
        where, params = self._build_where(filtro)
        query = f"SELECT chave_acesso, prestador_cnpj, nsu, xml_nfse, pdf_blob IS NOT NULL AS tem_pdf, data_emissao, emissao_dh, created_at FROM documentos WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?"
        offset = (filtro.page - 1) * filtro.page_size
        params.extend([filtro.page_size, offset])

        rows = self._db.conn.execute(query, params).fetchall()
        return [
            Documento(
                chave_acesso=r["chave_acesso"],
                prestador_cnpj=r["prestador_cnpj"],
                nsu=r["nsu"],
                xml_nfse=r["xml_nfse"],
                tem_pdf=bool(r["tem_pdf"]),
                data_emissao=r["data_emissao"],
                emissao_dh=r["emissao_dh"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def contar(self, filtro: FiltroDocumentos) -> int:
        """Conta documentos aplicando filtros (sem paginação).

        Args:
            filtro: Filtros de busca.

        Returns:
            Total de registros que correspondem aos filtros.
        """
        where, params = self._build_where(filtro)
        row = self._db.conn.execute(
            f"SELECT COUNT(*) as total FROM documentos WHERE {where}", params
        ).fetchone()
        return row["total"]

    def buscar_por_chave(self, chave_acesso: str) -> dict | None:
        """Busca documento pela chave de acesso.

        Args:
            chave_acesso: Chave de acesso de 44 dígitos.

        Returns:
            Dict com xml_nfse, pdf_blob e created_at, ou None.
        """
        row = self._db.conn.execute(
            "SELECT chave_acesso, prestador_cnpj, nsu, xml_nfse, pdf_blob, data_emissao, emissao_dh, created_at FROM documentos WHERE chave_acesso = ?",
            (chave_acesso,),
        ).fetchone()
        return dict(row) if row else None

    def listar_por_periodo(self, cnpj: str, inicio: str, fim: str) -> list[dict]:
        """Lista chave_acesso e xml_nfse de documentos em um período.

        Args:
            cnpj: CNPJ do prestador.
            inicio: Data início (YYYY-MM-DD).
            fim: Data fim (YYYY-MM-DD).

        Returns:
            Lista de dicts com chave_acesso e xml_nfse.
        """
        rows = self._db.conn.execute(
            "SELECT chave_acesso, xml_nfse FROM documentos "
            "WHERE prestador_cnpj = ? AND data_emissao >= ? AND data_emissao <= ? "
            "ORDER BY data_emissao",
            (cnpj, inicio, fim),
        ).fetchall()
        return [dict(r) for r in rows]
