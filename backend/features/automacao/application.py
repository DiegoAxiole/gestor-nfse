"""Use cases para automação de consultas."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol

from features.automacao.domain import Agendamento, AutomacaoLog


class AgendamentoRepositoryPort(Protocol):
    """Port para persistência de agendamentos."""

    def listar(self) -> list[Agendamento]:
        """Lista todos os agendamentos.

        Returns:
            Lista de Agendamento.
        """
        ...

    def salvar(self, agendamento: Agendamento) -> int:
        """Persiste um novo agendamento.

        Args:
            agendamento: Agendamento a salvar.

        Returns:
            ID do agendamento criado.
        """
        ...

    def remover(self, id: int) -> bool:
        """Remove um agendamento pelo ID.

        Args:
            id: ID do agendamento.

        Returns:
            True se removeu, False se não encontrado.
        """
        ...


class PrestadorQueryPort(Protocol):
    """Port para consulta de prestador."""

    def buscar_por_cnpj(self, cnpj: str) -> object | None:
        """Busca prestador por CNPJ.

        Args:
            cnpj: CNPJ do prestador.

        Returns:
            Objeto prestador ou None.
        """
        ...


@dataclass
class AgendarInput:
    """Input para agendamento de consulta.

    Attributes:
        prestador_cnpj: CNPJ do prestador.
        intervalo_minutos: Intervalo entre consultas em minutos.
    """

    prestador_cnpj: str
    intervalo_minutos: int = 60


class AgendarConsultaUseCase:
    """Agenda consultas periódicas de distribuição."""

    def __init__(self, repo: AgendamentoRepositoryPort, prestador_repo: PrestadorQueryPort):
        """Inicializa o use case.

        Args:
            repo: Repositório de agendamentos.
            prestador_repo: Repositório de prestadores.
        """
        self._repo = repo
        self._prestador_repo = prestador_repo

    def executar(self, input_data: AgendarInput) -> Agendamento:
        if self._prestador_repo.buscar_por_cnpj(input_data.prestador_cnpj) is None:
            raise ValueError(f"Prestador não encontrado: {input_data.prestador_cnpj}")
        if input_data.intervalo_minutos <= 0:
            raise ValueError("intervalo_minutos deve ser maior que zero")
        agora = datetime.now(timezone.utc).isoformat()
        proxima = (datetime.now(timezone.utc) + timedelta(minutes=input_data.intervalo_minutos)).isoformat()
        agendamento = Agendamento(
            id=None,
            prestador_cnpj=input_data.prestador_cnpj,
            intervalo_minutos=input_data.intervalo_minutos,
            ativo=True,
            ultima_execucao=None,
            proxima_execucao=proxima,
        )
        agendamento.id = self._repo.salvar(agendamento)
        return agendamento


class ListarAgendamentosUseCase:
    """Lista todos os agendamentos."""

    def __init__(self, repo: AgendamentoRepositoryPort):
        """Inicializa o use case.

        Args:
            repo: Repositório de agendamentos.
        """
        self._repo = repo

    def executar(self) -> list[Agendamento]:
        """Lista todos os agendamentos.

        Returns:
            Lista de Agendamento.
        """
        return self._repo.listar()


class RemoverAgendamentoUseCase:
    """Remove um agendamento."""

    def __init__(self, repo: AgendamentoRepositoryPort):
        """Inicializa o use case.

        Args:
            repo: Repositório de agendamentos.
        """
        self._repo = repo

    def executar(self, id: int) -> None:
        """Remove um agendamento pelo ID.

        Args:
            id: ID do agendamento.

        Raises:
            ValueError: Se agendamento não encontrado.
        """
        if not self._repo.remover(id):
            raise ValueError(f"Agendamento não encontrado: {id}")


class LogRepositoryPort(Protocol):
    """Port para persistência de logs de automação."""

    def listar(self, prestador_cnpj: str | None = None, limite: int = 50) -> list[AutomacaoLog]:
        """Lista logs com filtro opcional por CNPJ.

        Args:
            prestador_cnpj: Filtrar por CNPJ.
            limite: Máximo de registros.

        Returns:
            Lista de AutomacaoLog.
        """
        ...

    def adicionar(self, log: AutomacaoLog) -> int:
        """Persiste um novo log.

        Args:
            log: Log a salvar.

        Returns:
            ID do log criado.
        """
        ...


class ListarLogsUseCase:
    """Lista logs de execução da automação."""

    def __init__(self, repo: LogRepositoryPort):
        """Inicializa o use case.

        Args:
            repo: Repositório de logs.
        """
        self._repo = repo

    def executar(self, prestador_cnpj: str | None = None, limite: int = 50) -> list[AutomacaoLog]:
        """Lista logs de execução.

        Args:
            prestador_cnpj: Filtrar por CNPJ (opcional).
            limite: Máximo de registros (default: 50).

        Returns:
            Lista de AutomacaoLog.
        """
        return self._repo.listar(prestador_cnpj=prestador_cnpj, limite=limite)
