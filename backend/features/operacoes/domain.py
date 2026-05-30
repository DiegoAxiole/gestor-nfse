from dataclasses import dataclass


@dataclass
class Operacao:
    id: int
    prestador_cnpj: str
    tipo: str
    nsu_consultado: str
    ultimo_nsu: str
    status: str
    qtd_documentos: int
    xml_request: str | None
    xml_response: str | None
    xml_erro: str | None
    created_at: str
