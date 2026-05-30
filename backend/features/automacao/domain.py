"""Entidades do domínio de automação de consultas."""

from dataclasses import dataclass


@dataclass
class Agendamento:
    """Agendamento de consulta periódica."""
    id: int | None
    prestador_cnpj: str
    intervalo_minutos: int
    ativo: bool
    ultima_execucao: str | None
    proxima_execucao: str | None


@dataclass
class AutomacaoLog:
    """Log de execução de automação."""
    id: int | None
    prestador_cnpj: str
    tipo: str
    mensagem: str
    created_at: str | None = None
