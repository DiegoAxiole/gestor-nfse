from shared.database import Database
from features.config.domain import Configuracao


class ConfigRepositorySQLite:
    def __init__(self, db: Database):
        self._db = db

    def carregar(self) -> Configuracao:
        row = self._db.conn.execute(
            "SELECT ambiente, codigo_municipio, certificado_caminho, certificado_senha, "
            "lgpd_ativo, cnpj, razao_social FROM configuracoes WHERE id = 1"
        ).fetchone()
        if row is None:
            return Configuracao(ambiente="Homologacao", codigo_municipio=1001058, certificado_caminho="")
        return Configuracao(
            ambiente=row["ambiente"],
            codigo_municipio=row["codigo_municipio"],
            certificado_caminho=row["certificado_caminho"],
            certificado_senha=row["certificado_senha"] or "",
            lgpd_ativo=bool(row["lgpd_ativo"]),
            cnpj=row["cnpj"] or "",
            razao_social=row["razao_social"] or "",
        )

    def salvar(self, config: Configuracao) -> None:
        existing = self._db.conn.execute(
            "SELECT 1 FROM configuracoes WHERE id = 1"
        ).fetchone()
        if existing:
            self._db.conn.execute(
                "UPDATE configuracoes SET ambiente = ?, codigo_municipio = ?, "
                "certificado_caminho = ?, certificado_senha = ?, lgpd_ativo = ?, "
                "cnpj = ?, razao_social = ?, atualizada_em = datetime('now') WHERE id = 1",
                (config.ambiente, config.codigo_municipio,
                 config.certificado_caminho, config.certificado_senha,
                 int(config.lgpd_ativo), config.cnpj, config.razao_social),
            )
        else:
            self._db.conn.execute(
                "INSERT INTO configuracoes (id, ambiente, codigo_municipio, certificado_caminho, "
                "certificado_senha, lgpd_ativo, cnpj, razao_social) "
                "VALUES (1, ?, ?, ?, ?, ?, ?, ?)",
                (config.ambiente, config.codigo_municipio,
                 config.certificado_caminho, config.certificado_senha,
                 int(config.lgpd_ativo), config.cnpj, config.razao_social),
            )
        self._db.conn.commit()
