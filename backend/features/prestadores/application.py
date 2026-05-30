"""Use cases para gestão de prestadores."""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12

from features.prestadores.domain import Prestador


class PrestadorRepository(Protocol):
    """Interface do repositório de prestadores."""

    def listar_todos(self) -> list[Prestador]:
        ...

    def buscar_por_cnpj(self, cnpj: str) -> Prestador | None:
        ...

    def salvar(self, prestador: Prestador) -> None:
        ...

    def atualizar(self, cnpj: str, dados: dict) -> Prestador | None:
        ...

    def remover(self, cnpj: str) -> bool:
        ...


@dataclass
class PrestadorInput:
    cnpj: str
    razao_social: str
    ambiente: str
    certificado_pfx: bytes
    certificado_senha: str
    certificado_nome: str = ""


AMBIENTES_VALIDOS = frozenset({"Homologacao", "Producao"})


def _extrair_validade_pfx(pfx_bytes: bytes, senha: str) -> str:
    """Extrai a data de validade de um certificado PFX.

    Args:
        pfx_bytes: Conteúdo binário do arquivo PFX.
        senha: Senha do certificado.

    Returns:
        Data de validade em ISO format, ou string vazia se não conseguir.
    """
    try:
        _, cert, _ = pkcs12.load_key_and_certificates(
            pfx_bytes, senha.encode() if senha else None
        )
        if cert is None:
            return ""
        validade = cert.not_valid_after_utc if hasattr(cert, 'not_valid_after_utc') else cert.not_valid_after
        if validade.tzinfo is None:
            validade = validade.replace(tzinfo=timezone.utc)
        return validade.isoformat()
    except Exception:
        return ""


class CadastrarPrestadorUseCase:
    """Cadastra um novo prestador."""

    def __init__(self, repo: PrestadorRepository):
        self._repo = repo

    def executar(self, input_data: PrestadorInput) -> Prestador:
        if self._repo.buscar_por_cnpj(input_data.cnpj) is not None:
            raise ValueError(f"CNPJ já cadastrado: {input_data.cnpj}")
        if input_data.ambiente not in AMBIENTES_VALIDOS:
            raise ValueError(
                f"Ambiente inválido: '{input_data.ambiente}'. Use 'Homologacao' ou 'Producao'."
            )
        validade = _extrair_validade_pfx(input_data.certificado_pfx, input_data.certificado_senha)
        prestador = Prestador(
            cnpj=input_data.cnpj,
            razao_social=input_data.razao_social,
            ambiente=input_data.ambiente,
            certificado_pfx=input_data.certificado_pfx,
            certificado_senha=input_data.certificado_senha,
            certificado_validade=validade,
            certificado_nome=input_data.certificado_nome,
        )
        self._repo.salvar(prestador)
        return prestador


class ListarPrestadoresUseCase:
    """Lista todos os prestadores cadastrados."""

    def __init__(self, repo: PrestadorRepository):
        self._repo = repo

    def executar(self) -> list[Prestador]:
        return self._repo.listar_todos()


class BuscarPrestadorUseCase:
    """Busca um prestador por CNPJ."""

    def __init__(self, repo: PrestadorRepository):
        self._repo = repo

    def executar(self, cnpj: str) -> Prestador:
        prestador = self._repo.buscar_por_cnpj(cnpj)
        if prestador is None:
            raise ValueError(f"Prestador não encontrado: {cnpj}")
        return prestador


class AtualizarPrestadorUseCase:
    """Atualiza dados de um prestador."""

    def __init__(self, repo: PrestadorRepository):
        self._repo = repo

    def executar(self, cnpj: str, dados: dict) -> Prestador:
        if "ambiente" in dados and dados["ambiente"] not in AMBIENTES_VALIDOS:
            raise ValueError(
                f"Ambiente inválido: '{dados['ambiente']}'. Use 'Homologacao' ou 'Producao'."
            )
        if "certificado_pfx" in dados:
            senha = dados.get("certificado_senha", "")
            dados["certificado_validade"] = _extrair_validade_pfx(dados["certificado_pfx"], senha)
        prestador = self._repo.atualizar(cnpj, dados)
        if prestador is None:
            raise ValueError(f"Prestador não encontrado: {cnpj}")
        return prestador


class RemoverPrestadorUseCase:
    """Remove um prestador."""

    def __init__(self, repo: PrestadorRepository):
        self._repo = repo

    def executar(self, cnpj: str) -> None:
        if not self._repo.remover(cnpj):
            raise ValueError(f"Prestador não encontrado: {cnpj}")


def _extrair_ou(cert: x509.Certificate, prefixo: str = "") -> str:
    """Extrai valor de um OU (Organizational Unit) do certificado.

    Args:
        cert: Certificado X.509.
        prefixo: Prefixo opcional esperado (ex: 'RFB' para 'OU=RFB42652361000162').

    Returns:
        Valor extraído ou string vazia.
    """
    for attr in cert.subject:
        if attr.oid._name == "organizational_unit_name":
            val = attr.value
            if prefixo and val.startswith(prefixo):
                return val.removeprefix(prefixo)
            elif not prefixo and val.isdigit():
                return val
    return ""


class UploadCertificadoUseCase:
    """Extrai dados de um certificado PFX enviado."""

    def executar(self, pfx_bytes: bytes, senha: str) -> dict:
        try:
            private_key, cert, extra_certs = pkcs12.load_key_and_certificates(
                pfx_bytes, senha.encode() if senha else None
            )
        except Exception as e:
            raise ValueError(f"Erro ao ler certificado: {e}")

        if cert is None:
            raise ValueError("Certificado não encontrado no arquivo PFX")

        validade = cert.not_valid_after_utc if hasattr(cert, 'not_valid_after_utc') else cert.not_valid_after
        if validade.tzinfo is None:
            validade = validade.replace(tzinfo=timezone.utc)

        dias_restantes = (validade - datetime.now(timezone.utc)).days

        cnpj_extraido = _extrair_ou(cert) or ""
        razao = ""
        for attr in cert.subject:
            if attr.oid._name == "common_name":
                razao = attr.value
                break

        emissor_parts = []
        for attr in cert.issuer:
            emissor_parts.append(f"{attr.oid._name}={attr.value}")
        emissor = ", ".join(emissor_parts)

        return {
            "data_validade": validade.isoformat(),
            "cnpj_extraido": cnpj_extraido,
            "razao_extraida": razao,
            "emissor": emissor,
            "dias_restantes": dias_restantes,
        }
