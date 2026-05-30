from dataclasses import dataclass
from typing import Protocol

from features.operacoes.domain import Operacao


class OperacaoQueryPort(Protocol):
    def listar(self, cnpj: str | None = None, limite: int = 50, offset: int = 0) -> list[Operacao]:
        ...

    def buscar_por_id(self, id: int) -> Operacao | None:
        ...


@dataclass
class OperacoesPaginadas:
    operacoes: list[Operacao] = None
    total: int = 0


class ListarOperacoesUseCase:
    def __init__(self, repo: OperacaoQueryPort):
        self._repo = repo

    def executar(self, cnpj: str | None = None, limite: int = 50, offset: int = 0) -> OperacoesPaginadas:
        operacoes = self._repo.listar(cnpj=cnpj, limite=limite, offset=offset)
        return OperacoesPaginadas(operacoes=operacoes)


class BuscarOperacaoUseCase:
    def __init__(self, repo: OperacaoQueryPort):
        self._repo = repo

    def executar(self, id: int) -> Operacao:
        op = self._repo.buscar_por_id(id)
        if op is None:
            raise ValueError(f"Operação não encontrada: {id}")
        return op
