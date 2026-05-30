"""Carregamento da configuração da aplicação a partir de arquivo TOML e SQLite."""

import tomllib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Config:
    """Configurações carregadas do config.toml."""
    ambiente: str
    sqlite_caminho: str = "data/nfse.sqlite"
    codigo_municipio: int = 1001058
    certificado_caminho: str = ""
    certificado_senha: str = ""
    _base_dir: Path = field(default=None, repr=False)


def carregar_config(caminho: str | Path) -> Config:
    """Carrega a configuração a partir de um arquivo TOML (opcional).

    Se o arquivo não existir, usa valores padrão — o usuário pode
    configurar tudo via frontend depois.

    Args:
        caminho: Caminho do arquivo config.toml.

    Returns:
        Config com todos os campos preenchidos.

    Raises:
        ValueError: Se o ambiente não for 'Homologacao' ou 'Producao'.
    """
    caminho = Path(caminho).resolve()
    base_dir = caminho.parent

    if caminho.exists():
        with open(caminho, "rb") as f:
            dados = tomllib.load(f)

        ambiente = dados.get("geral", {}).get("ambiente", "Homologacao")
        if ambiente not in ("Homologacao", "Producao"):
            raise ValueError(f"Ambiente inválido: {ambiente}. Use 'Homologacao' ou 'Producao'.")

        sqlite_caminho = dados.get("data", {}).get("sqlite_caminho", "data/nfse.sqlite")
        codigo_municipio = dados.get("geral", {}).get("codigo_municipio", 1001058)
        certificado_caminho = dados.get("certificado", {}).get("caminho", "")
        certificado_senha = dados.get("certificado", {}).get("senha", "")
    else:
        ambiente = "Homologacao"
        sqlite_caminho = "data/nfse.sqlite"
        codigo_municipio = 1001058
        certificado_caminho = ""
        certificado_senha = ""

    sqlite_path = Path(sqlite_caminho)
    if not sqlite_path.is_absolute():
        sqlite_path = (base_dir / sqlite_path).resolve()

    config = Config(
        ambiente=ambiente,
        sqlite_caminho=str(sqlite_path),
        codigo_municipio=codigo_municipio,
        certificado_caminho=certificado_caminho,
        certificado_senha=certificado_senha,
        _base_dir=base_dir,
    )

    from shared.database import Database
    db_seed = Database(config.sqlite_caminho)
    row = db_seed.conn.execute("SELECT 1 FROM configuracoes WHERE id = 1").fetchone()
    if row is None:
        db_seed.conn.execute(
            "INSERT INTO configuracoes (id, ambiente, codigo_municipio, certificado_caminho, certificado_senha) "
            "VALUES (1, ?, ?, ?, ?)",
            (ambiente, codigo_municipio, certificado_caminho, certificado_senha),
        )
        db_seed.conn.commit()
    db_seed.fechar()

    return config
