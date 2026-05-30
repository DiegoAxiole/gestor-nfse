"""Inicialização DLL Unimake, certificado digital e ServiceBase.

Dependências externas: clr (pythonnet), Unimake.Business.DFe.dll,
Unimake.Unidanfe.dll.
"""

import os
import tempfile
from pathlib import Path

import clr

_INICIALIZADO = False


def inicializar_dll() -> None:
    """Adiciona as referências das DLLs Unimake no CLR (executado uma vez)."""
    global _INICIALIZADO
    if _INICIALIZADO:
        return
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    clr.AddReference(os.path.join(base, 'dll', 'Unimake.DFe', 'Unimake.Business.DFe.dll'))
    clr.AddReference(os.path.join(base, 'dll', 'Unimake.UniDANFe', 'Unimake.Unidanfe.dll'))
    _INICIALIZADO = True


def carregar_pfx(caminho: str | Path, senha: str):
    """Carrega certificado digital A1 a partir de arquivo PFX/P12.

    Args:
        caminho: Caminho do arquivo .pfx ou .p12.
        senha: Senha do certificado.

    Returns:
        Objeto CertificadoDigital carregado.
    """
    inicializar_dll()
    from Unimake.Business.Security import CertificadoDigital
    oCertificado = CertificadoDigital()
    return oCertificado.CarregarCertificadoDigitalA1(str(caminho), senha)


class ServiceBase:
    """Classe base para serviços NFSe (configura DLL + certificado).

    Subclasse deve definir _servico.
    """

    def __init__(self, config, certificado_pfx_bytes: bytes, certificado_senha: str, ambiente: str, codigo_municipio: int):
        """Inicializa com certificado vindo de bytes (BLOB do DB).

        Args:
            config: Config da aplicação.
            certificado_pfx_bytes: Conteúdo do PFX (BLOB do DB).
            certificado_senha: Senha do certificado.
            ambiente: 'Homologacao' ou 'Producao'.
            codigo_municipio: Código IBGE do município.
        """
        self._config = config
        self._cert_pfx_bytes = certificado_pfx_bytes
        self._cert_senha = certificado_senha
        self._ambiente = ambiente
        self._codigo_municipio = codigo_municipio
        self._carregar_dll()

    def _carregar_dll(self) -> None:
        inicializar_dll()
        from Unimake.Business.DFe.Servicos import Configuracao, TipoDFe, TipoAmbiente

        with tempfile.NamedTemporaryFile(suffix=".pfx", delete=False) as f:
            f.write(self._cert_pfx_bytes)
            temp_path = f.name

        try:
            certificado = carregar_pfx(temp_path, self._cert_senha)
        finally:
            os.unlink(temp_path)

        self._cfg_base = Configuracao()
        self._cfg_base.TipoDFe = TipoDFe.NFSe
        self._cfg_base.CertificadoDigital = certificado
        self._cfg_base.TipoAmbiente = (
            TipoAmbiente.Homologacao if self._ambiente == "Homologacao"
            else TipoAmbiente.Producao
        )
        self._cfg_base.Servico = self._servico
        self._cfg_base.SchemaVersao = "1.01"
        self._cfg_base.CodigoMunicipio = self._codigo_municipio

    @property
    def _servico(self):
        raise NotImplementedError
