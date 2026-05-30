from shared.database import Database
from features.prestadores.domain import Prestador

_COLS = "cnpj, razao_social, ambiente, certificado_pfx, certificado_senha, certificado_validade, certificado_nome"


class PrestadorRepositorySQLite:
    def __init__(self, db: Database):
        self._db = db

    def listar_todos(self) -> list[Prestador]:
        rows = self._db.conn.execute(
            f"SELECT {_COLS} FROM prestadores ORDER BY razao_social"
        ).fetchall()
        return [self._row_to_prestador(r) for r in rows]

    def buscar_por_cnpj(self, cnpj: str) -> Prestador | None:
        row = self._db.conn.execute(
            f"SELECT {_COLS} FROM prestadores WHERE cnpj = ?",
            (cnpj,),
        ).fetchone()
        return self._row_to_prestador(row) if row else None

    def salvar(self, prestador: Prestador) -> None:
        self._db.conn.execute(
            f"INSERT INTO prestadores ({_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (prestador.cnpj, prestador.razao_social, prestador.ambiente,
             prestador.certificado_pfx, prestador.certificado_senha,
             prestador.certificado_validade, prestador.certificado_nome),
        )
        self._db.conn.commit()

    def atualizar(self, cnpj: str, dados: dict) -> Prestador | None:
        campos = []
        valores = []
        for key in ("razao_social", "ambiente", "certificado_pfx", "certificado_senha",
                     "certificado_validade", "certificado_nome"):
            if key in dados:
                campos.append(f"{key} = ?")
                valores.append(dados[key])
        if not campos:
            return self.buscar_por_cnpj(cnpj)
        valores.append(cnpj)
        self._db.conn.execute(
            f"UPDATE prestadores SET {', '.join(campos)} WHERE cnpj = ?",
            valores,
        )
        self._db.conn.commit()
        return self.buscar_por_cnpj(cnpj)

    def remover(self, cnpj: str) -> bool:
        cursor = self._db.conn.execute("DELETE FROM prestadores WHERE cnpj = ?", (cnpj,))
        self._db.conn.commit()
        return cursor.rowcount > 0

    def _row_to_prestador(self, row) -> Prestador:
        return Prestador(
            cnpj=row["cnpj"],
            razao_social=row["razao_social"],
            ambiente=row["ambiente"],
            certificado_pfx=row["certificado_pfx"],
            certificado_senha=row["certificado_senha"],
            certificado_validade=row["certificado_validade"] or "",
            certificado_nome=row["certificado_nome"] or "",
        )
