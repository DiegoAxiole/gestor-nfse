"""Gerencia conexão SQLite e migração automática do schema."""

import sqlite3
from pathlib import Path


class Database:
    """Gerencia conexão SQLite e migração automática do schema."""

    def __init__(self, path: str | Path = "data/nfse.sqlite"):
        """Abre conexão SQLite e cria as tabelas se não existirem.

        Args:
            path: Caminho do arquivo SQLite.
        """
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._criar_tabelas()
        self._migrar()

    def _migrar(self) -> None:
        """Adiciona colunas novas em tabelas existentes (migração segura)."""
        migracoes = [
            "ALTER TABLE prestadores ADD COLUMN certificado_validade TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE prestadores ADD COLUMN certificado_nome TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE documentos ADD COLUMN data_emissao TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE documentos ADD COLUMN emissao_dh TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE background_tasks ADD COLUMN tipo TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE configuracoes ADD COLUMN lgpd_ativo INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE configuracoes ADD COLUMN cnpj TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE configuracoes ADD COLUMN razao_social TEXT NOT NULL DEFAULT ''",
        ]
        for sql in migracoes:
            try:
                self._conn.execute(sql)
            except sqlite3.OperationalError:
                pass
        self._conn.commit()
        self._backfill_datas()

    def _backfill_datas(self) -> None:
        """Preenche data_emissao e emissao_dh de documentos existentes vazios."""
        import xml.etree.ElementTree as ET

        rows = self._conn.execute(
            "SELECT chave_acesso, xml_nfse FROM documentos WHERE data_emissao = '' AND xml_nfse != ''"
        ).fetchall()
        ns = {"ns0": "http://www.sped.fazenda.gov.br/nfse"}
        for row in rows:
            try:
                root = ET.fromstring(row["xml_nfse"])
                dcompet = root.findtext(".//ns0:dCompet", "", ns)
                dh_emi = root.findtext(".//ns0:dhEmi", "", ns)
                if dcompet or dh_emi:
                    self._conn.execute(
                        "UPDATE documentos SET data_emissao = ?, emissao_dh = ? WHERE chave_acesso = ?",
                        (dcompet, dh_emi, row["chave_acesso"]),
                    )
            except Exception:
                pass
        if rows:
            self._conn.commit()

    def _criar_tabelas(self) -> None:
        """Cria as tabelas do schema se não existirem."""
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS prestadores (
                cnpj                TEXT PRIMARY KEY,
                razao_social        TEXT NOT NULL,
                ambiente            TEXT NOT NULL CHECK (ambiente IN ('Homologacao','Producao')),
                certificado_pfx     BLOB NOT NULL,
                certificado_senha   TEXT NOT NULL,
                certificado_validade TEXT NOT NULL DEFAULT '',
                certificado_nome    TEXT NOT NULL DEFAULT '',
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS operacoes (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                prestador_cnpj      TEXT NOT NULL REFERENCES prestadores(cnpj) ON DELETE CASCADE,
                tipo                TEXT NOT NULL,
                nsu_consultado      TEXT NOT NULL,
                ultimo_nsu          TEXT NOT NULL,
                status              TEXT NOT NULL,
                qtd_documentos      INTEGER NOT NULL DEFAULT 0,
                xml_request         TEXT,
                xml_response        TEXT,
                xml_erro            TEXT,
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_operacoes_prestador ON operacoes(prestador_cnpj);
            CREATE INDEX IF NOT EXISTS idx_operacoes_status ON operacoes(status);
            CREATE INDEX IF NOT EXISTS idx_operacoes_created ON operacoes(created_at);

            CREATE TABLE IF NOT EXISTS documentos (
                chave_acesso        TEXT PRIMARY KEY,
                prestador_cnpj      TEXT NOT NULL REFERENCES prestadores(cnpj) ON DELETE CASCADE,
                operacao_id         INTEGER NOT NULL REFERENCES operacoes(id) ON DELETE CASCADE,
                nsu                 TEXT NOT NULL,
                xml_nfse            TEXT NOT NULL,
                pdf_blob            BLOB,
                data_emissao        TEXT NOT NULL DEFAULT '',
                emissao_dh          TEXT NOT NULL DEFAULT '',
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_documentos_prestador ON documentos(prestador_cnpj);

            CREATE TABLE IF NOT EXISTS automacao_logs (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                prestador_cnpj      TEXT NOT NULL REFERENCES prestadores(cnpj) ON DELETE CASCADE,
                tipo                TEXT NOT NULL,
                mensagem            TEXT NOT NULL,
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_automacao_logs_prestador ON automacao_logs(prestador_cnpj);
            CREATE INDEX IF NOT EXISTS idx_automacao_logs_created ON automacao_logs(created_at);

            CREATE TABLE IF NOT EXISTS agendamentos (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                prestador_cnpj      TEXT NOT NULL REFERENCES prestadores(cnpj) ON DELETE CASCADE,
                tipo                TEXT NOT NULL DEFAULT 'consulta_distribuicao',
                intervalo_minutos   INTEGER NOT NULL DEFAULT 60,
                ativo               INTEGER NOT NULL DEFAULT 1,
                ultima_execucao     TEXT,
                proxima_execucao    TEXT,
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS configuracoes (
                id                  INTEGER PRIMARY KEY CHECK (id = 1),
                ambiente            TEXT NOT NULL DEFAULT 'Homologacao',
                codigo_municipio    INTEGER NOT NULL DEFAULT 1001058,
                certificado_caminho TEXT NOT NULL DEFAULT '',
                certificado_senha   TEXT NOT NULL DEFAULT '',
                lgpd_ativo          INTEGER NOT NULL DEFAULT 0,
                cnpj                TEXT NOT NULL DEFAULT '',
                razao_social        TEXT NOT NULL DEFAULT '',
                atualizada_em       TEXT
            );

            CREATE TABLE IF NOT EXISTS background_tasks (
                id                  TEXT PRIMARY KEY,
                tipo                TEXT NOT NULL DEFAULT '',
                chave_acesso        TEXT,
                cnpj                TEXT,
                status              TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','processing','completed','error')),
                progresso           INTEGER NOT NULL DEFAULT 0,
                mensagem            TEXT NOT NULL DEFAULT '',
                resultado_json      TEXT,
                erro_texto          TEXT,
                criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
                atualizado_em       TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_status ON background_tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_tipo_status ON background_tasks(tipo, status);
            CREATE INDEX IF NOT EXISTS idx_tasks_criado ON background_tasks(criado_em);
        """)
        self._conn.commit()

    @property
    def conn(self) -> sqlite3.Connection:
        """Retorna a conexão SQLite ativa."""
        return self._conn

    def fechar(self) -> None:
        """Fecha a conexão com o banco de dados."""
        self._conn.close()
