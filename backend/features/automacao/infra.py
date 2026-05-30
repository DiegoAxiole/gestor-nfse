"""Implementação do repositório de agendamentos em SQLite."""

from shared.database import Database
from features.automacao.domain import Agendamento, AutomacaoLog


class AgendamentoRepositorySQLite:
    """Repositório de agendamentos usando SQLite."""

    def __init__(self, db: Database):
        """Inicializa o repositório.

        Args:
            db: Instância compartilhada de Database.
        """
        self._db = db

    def listar(self) -> list[Agendamento]:
        """Lista todos os agendamentos.

        Returns:
            Lista de Agendamento.
        """
        rows = self._db.conn.execute(
            "SELECT id, prestador_cnpj, intervalo_minutos, ativo, ultima_execucao, proxima_execucao FROM agendamentos ORDER BY id"
        ).fetchall()
        return [self._row_to_agendamento(r) for r in rows]

    def salvar(self, agendamento: Agendamento) -> int:
        """Persiste um novo agendamento e retorna seu ID.

        Args:
            agendamento: Agendamento a salvar.

        Returns:
            ID gerado.
        """
        cur = self._db.conn.execute(
            """INSERT INTO agendamentos (prestador_cnpj, intervalo_minutos, ativo, ultima_execucao, proxima_execucao)
               VALUES (?, ?, ?, ?, ?)""",
            (agendamento.prestador_cnpj, agendamento.intervalo_minutos,
             int(agendamento.ativo), agendamento.ultima_execucao, agendamento.proxima_execucao),
        )
        self._db.conn.commit()
        return cur.lastrowid

    def remover(self, id: int) -> bool:
        """Remove agendamento pelo ID.

        Args:
            id: ID do agendamento.

        Returns:
            True se removeu, False se não encontrado.
        """
        cursor = self._db.conn.execute("DELETE FROM agendamentos WHERE id = ?", (id,))
        self._db.conn.commit()
        return cursor.rowcount > 0

    def _row_to_agendamento(self, row) -> Agendamento:
        return Agendamento(
            id=row["id"],
            prestador_cnpj=row["prestador_cnpj"],
            intervalo_minutos=row["intervalo_minutos"],
            ativo=bool(row["ativo"]),
            ultima_execucao=row["ultima_execucao"],
            proxima_execucao=row["proxima_execucao"],
        )


class LogRepositorySQLite:
    """Repositório de logs de automação usando SQLite."""

    def __init__(self, db: Database):
        """Inicializa o repositório.

        Args:
            db: Instância compartilhada de Database.
        """
        self._db = db

    def listar(self, prestador_cnpj: str | None = None, limite: int = 50) -> list[AutomacaoLog]:
        """Lista logs com filtro opcional por CNPJ.

        Args:
            prestador_cnpj: Filtrar por CNPJ.
            limite: Máximo de registros.

        Returns:
            Lista de AutomacaoLog.
        """
        if prestador_cnpj:
            rows = self._db.conn.execute(
                "SELECT id, prestador_cnpj, tipo, mensagem, created_at FROM automacao_logs WHERE prestador_cnpj = ? ORDER BY id DESC LIMIT ?",
                (prestador_cnpj, limite),
            ).fetchall()
        else:
            rows = self._db.conn.execute(
                "SELECT id, prestador_cnpj, tipo, mensagem, created_at FROM automacao_logs ORDER BY id DESC LIMIT ?",
                (limite,),
            ).fetchall()
        return [self._row_to_log(r) for r in rows]

    def adicionar(self, log: AutomacaoLog) -> int:
        """Persiste um novo log.

        Args:
            log: Log a salvar.

        Returns:
            ID do log criado.
        """
        cur = self._db.conn.execute(
            "INSERT INTO automacao_logs (prestador_cnpj, tipo, mensagem) VALUES (?, ?, ?)",
            (log.prestador_cnpj, log.tipo, log.mensagem),
        )
        self._db.conn.commit()
        return cur.lastrowid

    def _row_to_log(self, row) -> AutomacaoLog:
        return AutomacaoLog(
            id=row["id"],
            prestador_cnpj=row["prestador_cnpj"],
            tipo=row["tipo"],
            mensagem=row["mensagem"],
            created_at=row["created_at"],
        )
