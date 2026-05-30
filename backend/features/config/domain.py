from dataclasses import dataclass


@dataclass
class Configuracao:
    ambiente: str
    codigo_municipio: int
    certificado_caminho: str
    certificado_senha: str = ""
    lgpd_ativo: bool = False
    cnpj: str = ""
    razao_social: str = ""
