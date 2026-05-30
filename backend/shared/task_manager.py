"""Gerenciamento de background tasks com persistência em SQLite.

Uso:
    task_manager = TaskManager(db)
    task_id = task_manager.iniciar("consultar_distribuicao", fn=my_async_func, ...)
    status = task_manager.buscar(task_id)
    task_manager.limpar_antigos()
"""
import json
import logging
import threading
import uuid
from collections.abc import Callable
from datetime import datetime, timezone

from shared.database import Database

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[int, str], None]


class TaskRepository:
    """Persistência da tabela background_tasks."""

    def __init__(self, db: Database):
        self._db = db

    def criar(self, tipo: str, chave_acesso: str = "", cnpj: str = "") -> str:
        """Cria uma nova task com status 'pending' e retorna o ID."""
        task_id = str(uuid.uuid4())
        agora = datetime.now(timezone.utc).isoformat()
        self._db.conn.execute(
            """INSERT INTO background_tasks
               (id, tipo, chave_acesso, cnpj, status, progresso, mensagem,
                resultado_json, erro_texto, criado_em, atualizado_em)
               VALUES (?, ?, ?, ?, 'pending', 0, '', NULL, NULL, ?, ?)""",
            (task_id, tipo, chave_acesso, cnpj, agora, agora),
        )
        self._db.conn.commit()
        return task_id

    def atualizar(self, task_id: str, **kwargs) -> None:
        """Atualiza campos de uma task."""
        campos = []
        valores = []
        for key, value in kwargs.items():
            campos.append(f"{key} = ?")
            valores.append(value)
        campos.append("atualizado_em = ?")
        valores.append(datetime.now(timezone.utc).isoformat())
        valores.append(task_id)
        self._db.conn.execute(
            f"UPDATE background_tasks SET {', '.join(campos)} WHERE id = ?",
            valores,
        )
        self._db.conn.commit()

    def buscar(self, task_id: str) -> dict | None:
        """Retorna uma task pelo ID."""
        row = self._db.conn.execute(
            "SELECT * FROM background_tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return dict(row) if row else None

    def task_ativa(self, tipo: str, chave_acesso: str) -> dict | None:
        """Retorna task ativa (processing/pending) para mesma chave."""
        row = self._db.conn.execute(
            """SELECT * FROM background_tasks
               WHERE tipo = ? AND chave_acesso = ?
               AND status IN ('pending', 'processing')
               ORDER BY criado_em DESC LIMIT 1""",
            (tipo, chave_acesso),
        ).fetchone()
        return dict(row) if row else None

    def limpar_antigos(self, horas: int = 24) -> int:
        """Remove tasks completed/error mais antigas que N horas."""
        try:
            from datetime import timedelta
            limite = (datetime.now(timezone.utc) - timedelta(hours=horas)).isoformat()
            removidos = self._db.conn.execute(
                """DELETE FROM background_tasks
                   WHERE status IN ('completed', 'error')
                   AND atualizado_em < ?""",
                (limite,),
            ).rowcount
            if removidos:
                self._db.conn.commit()
            return removidos
        except Exception:
            return 0

    def marcar_orphans_como_erro(self) -> int:
        """Tasks em 'processing' ao iniciar servidor — morreram com o processo."""
        try:
            agora = datetime.now(timezone.utc).isoformat()
            afetados = self._db.conn.execute(
                """UPDATE background_tasks
                   SET status = 'error', erro_texto = 'Servidor reiniciado enquanto a task estava em execução',
                       atualizado_em = ?
                   WHERE status = 'processing'""",
                (agora,),
            ).rowcount
            if afetados:
                self._db.conn.commit()
            return afetados
        except Exception:
            logger.warning("Não foi possível marcar orphans (banco pode estar bloqueado)")
            return 0


class TaskManager:
    """Orquestra execução de tarefas em background com progresso."""

    def __init__(self, db: Database):
        self._repo = TaskRepository(db)

    def _make_callback(self, task_id: str) -> ProgressCallback:
        """Cria um callback que persiste progresso no banco."""
        def callback(progresso: int, mensagem: str):
            self._repo.atualizar(
                task_id,
                status="processing",
                progresso=progresso,
                mensagem=mensagem,
            )
        return callback

    def _executar_wrapper(self, task_id: str, fn, callback: ProgressCallback):
        """Wrapper que executa a função e captura resultado/erro."""
        try:
            resultado = fn(callback)
            self._repo.atualizar(
                task_id,
                status="completed",
                progresso=100,
                mensagem="Concluído",
                resultado_json=json.dumps(resultado) if resultado else None,
            )
        except Exception as e:
            logger.error("Task %s falhou: %s", task_id, e, exc_info=True)
            self._repo.atualizar(
                task_id,
                status="error",
                erro_texto=str(e),
            )

    def iniciar(self, tipo: str, chave_acesso: str, cnpj: str, fn) -> tuple[str, bool]:
        """Inicia uma task em background.

        Args:
            tipo: 'consultar_distribuicao' etc.
            chave_acesso: Chave de acesso da NFS-e.
            cnpj: CNPJ do prestador.
            fn: Função que recebe (progress_callback) e retorna dict ou None.

        Returns:
            Tupla (task_id, is_nova). is_nova=False se já existia task ativa.
        """
        existente = self._repo.task_ativa(tipo, chave_acesso)
        if existente:
            return existente["id"], False

        task_id = self._repo.criar(tipo, chave_acesso, cnpj)

        callback = self._make_callback(task_id)

        thread = threading.Thread(
            target=self._executar_wrapper,
            args=(task_id, fn, callback),
            daemon=True,
        )
        thread.start()

        return task_id, True

    def buscar(self, task_id: str) -> dict | None:
        """Retorna estado atual da task."""
        return self._repo.buscar(task_id)

    def limpar_antigos(self, horas: int = 24) -> int:
        """Remove tasks antigas."""
        return self._repo.limpar_antigos(horas)

    def marcar_orphans_como_erro(self) -> int:
        """Tasks órfãs de processos mortos."""
        return self._repo.marcar_orphans_como_erro()
