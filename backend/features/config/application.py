from typing import Protocol

from features.config.domain import Configuracao


class ConfigRepositoryPort(Protocol):
    def carregar(self) -> Configuracao:
        ...

    def salvar(self, config: Configuracao) -> None:
        ...


class ObterConfigUseCase:
    def __init__(self, repo: ConfigRepositoryPort):
        self._repo = repo

    def executar(self) -> Configuracao:
        return self._repo.carregar()


class AtualizarConfigUseCase:
    def __init__(self, repo: ConfigRepositoryPort):
        self._repo = repo

    def executar(self, dados: dict) -> Configuracao:
        config = self._repo.carregar()
        if "ambiente" in dados:
            config.ambiente = dados["ambiente"]
        if "codigo_municipio" in dados:
            config.codigo_municipio = int(dados["codigo_municipio"])
        if "certificado_caminho" in dados:
            config.certificado_caminho = dados["certificado_caminho"]
        if "certificado_senha" in dados:
            config.certificado_senha = dados["certificado_senha"]
        if "lgpd_ativo" in dados:
            config.lgpd_ativo = bool(dados["lgpd_ativo"])
        if "cnpj" in dados:
            config.cnpj = dados["cnpj"]
        if "razao_social" in dados:
            config.razao_social = dados["razao_social"]
        self._repo.salvar(config)
        return config
