"""FastAPI router para gestão de prestadores."""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from shared.validators import validar_cnpj

from features.prestadores.application import (
    CadastrarPrestadorUseCase,
    ListarPrestadoresUseCase,
    BuscarPrestadorUseCase,
    AtualizarPrestadorUseCase,
    RemoverPrestadorUseCase,
    PrestadorInput,
    UploadCertificadoUseCase,
)


def criar_router_prestadores(
    cadastrar: CadastrarPrestadorUseCase,
    listar: ListarPrestadoresUseCase,
    buscar: BuscarPrestadorUseCase,
    atualizar: AtualizarPrestadorUseCase,
    remover: RemoverPrestadorUseCase,
    upload_cert: UploadCertificadoUseCase | None = None,
    codigo_municipio: int = 1001058,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/prestadores", tags=["prestadores"])

    def _response(p) -> dict:
        return {
            "cnpj": p.cnpj,
            "razao_social": p.razao_social,
            "ambiente": p.ambiente,
            "codigo_municipio": str(codigo_municipio),
            "certificado_validade": p.certificado_validade or None,
            "certificado_nome": p.certificado_nome or None,
        }

    @router.get("")
    def listar_prestadores():
        """Lista todos os prestadores cadastrados."""
        return [_response(p) for p in listar.executar()]

    @router.post("", status_code=201)
    def cadastrar_prestador(
        cnpj: str = Form(...),
        razao_social: str = Form(...),
        ambiente: str = Form(...),
        certificado_pfx: UploadFile = File(...),
        certificado_senha: str = Form(...),
        certificado_nome: str = Form(""),
    ):
        """Cadastra um novo prestador com certificado digital."""
        if not validar_cnpj(cnpj):
            raise HTTPException(status_code=422, detail="CNPJ inválido: deve ter 14 dígitos")
        try:
            input_data = PrestadorInput(
                cnpj=cnpj,
                razao_social=razao_social,
                ambiente=ambiente,
                certificado_pfx=certificado_pfx.file.read(),
                certificado_senha=certificado_senha,
                certificado_nome=certificado_nome or certificado_pfx.filename or "",
            )
            p = cadastrar.executar(input_data)
            return _response(p)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    @router.get("/{cnpj}")
    def buscar_prestador(cnpj: str):
        """Busca um prestador por CNPJ."""
        try:
            p = buscar.executar(cnpj)
            return _response(p)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    @router.put("/{cnpj}")
    def atualizar_prestador(
        cnpj: str,
        razao_social: str | None = Form(None),
        ambiente: str | None = Form(None),
        certificado_pfx: UploadFile | None = File(None),
        certificado_senha: str | None = Form(None),
        certificado_nome: str | None = Form(None),
    ):
        """Atualiza dados de um prestador."""
        dados = {}
        if razao_social is not None:
            dados["razao_social"] = razao_social
        if ambiente is not None:
            dados["ambiente"] = ambiente
        if certificado_pfx is not None:
            dados["certificado_pfx"] = certificado_pfx.file.read()
            dados["certificado_nome"] = certificado_nome or certificado_pfx.filename or ""
        if certificado_senha is not None:
            dados["certificado_senha"] = certificado_senha
        try:
            p = atualizar.executar(cnpj, dados)
            return _response(p)
        except ValueError as e:
            if "Ambiente inválido" in str(e):
                raise HTTPException(status_code=422, detail=str(e))
            raise HTTPException(status_code=404, detail=str(e))

    @router.delete("/{cnpj}")
    def remover_prestador(cnpj: str):
        """Remove um prestador."""
        try:
            remover.executar(cnpj)
            return {"ok": True}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    @router.post("/upload-certificado")
    def upload_certificado(
        certificado_pfx: UploadFile = File(...),
        senha: str = Form(...),
        cnpj: str | None = Form(None),
    ):
        """Extrai dados de um certificado PFX enviado.

        CNPJ é opcional: se não informado, o backend extrai do próprio certificado.
        """
        if upload_cert is None:
            raise HTTPException(status_code=501, detail="Funcionalidade não disponível")
        try:
            dados = upload_cert.executar(certificado_pfx.file.read(), senha)
            dados["caminho_arquivo"] = ""
            if cnpj and validar_cnpj(cnpj):
                dados["cnpj"] = cnpj
            return dados
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    return router
