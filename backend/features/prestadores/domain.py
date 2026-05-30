"""Entidade Prestador do domínio NFSe."""

from dataclasses import dataclass


@dataclass
class Prestador:
    """Prestador de serviço cadastrado no sistema.

    Attributes:
        cnpj: CNPJ sem formatação (14 dígitos).
        razao_social: Razão social do prestador.
        ambiente: 'Homologacao' ou 'Producao'.
        certificado_pfx: Conteúdo binário do arquivo PFX.
        certificado_senha: Senha do certificado digital.
        certificado_validade: Data de validade do certificado (ISO).
        certificado_nome: Nome original do arquivo do certificado.
    """
    cnpj: str
    razao_social: str
    ambiente: str
    certificado_pfx: bytes
    certificado_senha: str
    certificado_validade: str = ""
    certificado_nome: str = ""
