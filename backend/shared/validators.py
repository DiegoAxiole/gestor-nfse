"""Validadores compartilhados entre features."""
import re

CNPJ_PATTERN = re.compile(r"^\d{14}$")
CHAVE_ACESSO_PATTERN = re.compile(r"^\d{44}$")
CHAVE_ACESSO_NACIONAL_PATTERN = re.compile(r"^\d{50}$")


def validar_cnpj(cnpj: str) -> bool:
    return bool(CNPJ_PATTERN.match(cnpj))


def validar_chave_acesso(chave: str) -> bool:
    """Valida formato da chave de acesso (44 dígitos municipal ou 50 dígitos nacional).

    Args:
        chave: String da chave de acesso.

    Returns:
        True se o formato é válido.
    """
    return bool(CHAVE_ACESSO_PATTERN.match(chave)) or bool(CHAVE_ACESSO_NACIONAL_PATTERN.match(chave))
