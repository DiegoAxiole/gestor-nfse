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
    """Carrega e valida a configuração a partir de um arquivo TOML.

    Args:
        caminho: Caminho do arquivo config.toml.

    Returns:
        Config com todos os campos preenchidos.

    Raises:
        ValueError: Se o ambiente não for 'Homologacao' ou 'Producao'.
    """
    caminho = Path(caminho).resolve()
    with open(caminho, "rb") as f:
        dados = tomllib.load(f)

    ambiente = dados.get("geral", {}).get("ambiente", "Homologacao")
    if ambiente not in ("Homologacao", "Producao"):
        raise ValueError(f"Ambiente inválido: {ambiente}. Use 'Homologacao' ou 'Producao'.")

    sqlite_caminho = dados.get("data", {}).get("sqlite_caminho", "data/nfse.sqlite")
    sqlite_path = Path(sqlite_caminho)
    if not sqlite_path.is_absolute():
        sqlite_path = (caminho.parent / sqlite_path).resolve()

    codigo_municipio = dados.get("geral", {}).get("codigo_municipio", 1001058)
    certificado_caminho = dados.get("certificado", {}).get("caminho", "")
    certificado_senha = dados.get("certificado", {}).get("senha", "")

    config = Config(
        ambiente=ambiente,
        sqlite_caminho=str(sqlite_path),
        codigo_municipio=codigo_municipio,
        certificado_caminho=certificado_caminho,
        certificado_senha=certificado_senha,
        _base_dir=caminho.parent,
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
