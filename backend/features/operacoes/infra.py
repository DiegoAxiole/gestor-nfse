from shared.database import Database
from features.operacoes.domain import Operacao


class OperacaoRepositorySQLite:
    def __init__(self, db: Database):
        self._db = db

    def listar(self, cnpj: str | None = None, limite: int = 50, offset: int = 0) -> list[Operacao]:
        where = "1=1"
        params: list = []
        if cnpj:
            where = "prestador_cnpj = ?"
            params.append(cnpj)
        params.extend([limite, offset])
        rows = self._db.conn.execute(
            f"SELECT id, prestador_cnpj, tipo, nsu_consultado, ultimo_nsu, status, "
            f"qtd_documentos, created_at "
            f"FROM operacoes WHERE {where} ORDER BY id DESC LIMIT ? OFFSET ?",
            params,
        ).fetchall()
        return [self._row_to_operacao(dict(r)) for r in rows]

    def buscar_por_id(self, id: int) -> Operacao | None:
        row = self._db.conn.execute(
            "SELECT id, prestador_cnpj, tipo, nsu_consultado, ultimo_nsu, status, "
            "qtd_documentos, xml_request, xml_response, xml_erro, created_at "
            "FROM operacoes WHERE id = ?",
            (id,),
        ).fetchone()
        return self._row_to_operacao(dict(row)) if row else None

    def _row_to_operacao(self, row) -> Operacao:
        return Operacao(
            id=row["id"],
            prestador_cnpj=row["prestador_cnpj"],
            tipo=row["tipo"],
            nsu_consultado=row["nsu_consultado"],
            ultimo_nsu=row["ultimo_nsu"],
            status=row["status"],
            qtd_documentos=row["qtd_documentos"],
            xml_request=row.get("xml_request"),
            xml_response=row.get("xml_response"),
            xml_erro=row.get("xml_erro"),
            created_at=row["created_at"],
        )
