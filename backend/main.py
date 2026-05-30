"""FastAPI application factory para NFSe API."""

import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from shared.config import carregar_config
from shared.database import Database
from shared.http_log import HTTPLogMiddleware
from shared.task_manager import TaskManager
from features.prestadores.infra import PrestadorRepositorySQLite
from features.prestadores.application import (
    CadastrarPrestadorUseCase, ListarPrestadoresUseCase,
    BuscarPrestadorUseCase, AtualizarPrestadorUseCase, RemoverPrestadorUseCase,
    UploadCertificadoUseCase,
)
from features.prestadores.routes import criar_router_prestadores
from features.distribuicao.infra import (
    UnimakeDistribuicaoAdapter, OperacaoRepositorySQLite, DocumentoRepositorySQLite as DistDocumentoRepo,
)
from features.distribuicao.application import ConsultarDistribuicaoUseCase
from features.distribuicao.routes import criar_router_distribuicao
from features.documentos.infra import DocumentoRepositorySQLite
from features.documentos.application import ListarDocumentosUseCase, BaixarXmlUseCase, BaixarPdfUseCase, BaixarZipUseCase
from features.documentos.routes import criar_router_documentos
from features.automacao.infra import AgendamentoRepositorySQLite, LogRepositorySQLite
from features.automacao.application import AgendarConsultaUseCase, ListarAgendamentosUseCase, RemoverAgendamentoUseCase, ListarLogsUseCase
from features.automacao.routes import criar_router_automacao
from features.operacoes.infra import OperacaoRepositorySQLite as OperacaoQueryRepo
from features.operacoes.application import ListarOperacoesUseCase, BuscarOperacaoUseCase
from features.operacoes.routes import criar_router_operacoes
from features.config.infra import ConfigRepositorySQLite
from features.config.application import ObterConfigUseCase, AtualizarConfigUseCase
from features.config.routes import criar_router_config


def create_app(config_path: str = "config.toml") -> FastAPI:
    """Factory que cria e configura a aplicação FastAPI.
    
    Args:
        config_path: Caminho do arquivo de configuração TOML.
        
    Returns:
        Instância configurada de FastAPI.
    """
    config = carregar_config(config_path)
    db = Database(config.sqlite_caminho)

    # Background task manager
    task_manager = TaskManager(db)
    orphans = task_manager.marcar_orphans_como_erro()
    if orphans:
        import logging
        logging.getLogger(__name__).warning(
            "%d task(s) órfãs marcadas como erro (servidor reiniciado)", orphans
        )
    task_manager.limpar_antigos(horas=24)

    # Repositories
    prestador_repo = PrestadorRepositorySQLite(db)
    operacao_repo = OperacaoRepositorySQLite(db)
    dist_doc_repo = DistDocumentoRepo(db)
    documento_repo = DocumentoRepositorySQLite(db)
    agendamento_repo = AgendamentoRepositorySQLite(db)
    log_repo = LogRepositorySQLite(db)
    operacao_query_repo = OperacaoQueryRepo(db)
    config_repo = ConfigRepositorySQLite(db)

    # Use Cases
    distribuicao_uc = ConsultarDistribuicaoUseCase(
        unimake=UnimakeDistribuicaoAdapter(),
        operacao_repo=operacao_repo,
        documento_repo=dist_doc_repo,
    )
    automacao_uc = AgendarConsultaUseCase(
        repo=agendamento_repo,
        prestador_repo=prestador_repo,
    )
    listar_operacoes_uc = ListarOperacoesUseCase(operacao_query_repo)
    buscar_operacao_uc = BuscarOperacaoUseCase(operacao_query_repo)
    obter_config_uc = ObterConfigUseCase(config_repo)
    atualizar_config_uc = AtualizarConfigUseCase(config_repo)

    # FastAPI app
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        db.fechar()

    app = FastAPI(title="NFSe API", version="0.2.0", lifespan=lifespan)
    app.state._db = db

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # HTTP log
    app.add_middleware(HTTPLogMiddleware)

    # Global exception handler
    @app.exception_handler(Exception)
    def handler_erro_inesperado(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"detail": f"Erro interno: {str(exc)}"},
        )

    # Health check
    @app.get("/health")
    def health_check():
        return {"status": "ok", "version": "0.2.0"}

    # Shared task polling endpoint
    from fastapi import APIRouter as TaskRouter
    task_router = TaskRouter(prefix="/api/v1/tasks", tags=["tasks"])

    @task_router.get("/{task_id}")
    def task_status(task_id: str):
        """Retorna o status atual de uma background task."""
        task = task_manager.buscar(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task não encontrada")
        resp = {
            "task_id": task["id"],
            "tipo": task["tipo"],
            "chave_acesso": task["chave_acesso"],
            "cnpj": task["cnpj"],
            "status": task["status"],
            "progresso": task["progresso"],
            "mensagem": task["mensagem"],
            "resultado": json.loads(task["resultado_json"]) if task["resultado_json"] else None,
            "mensagem_erro": task["erro_texto"],
            "criado_em": task["criado_em"],
            "atualizado_em": task["atualizado_em"],
        }
        return resp

    app.include_router(task_router)

    # Include routers
    app.include_router(criar_router_prestadores(
        cadastrar=CadastrarPrestadorUseCase(prestador_repo),
        listar=ListarPrestadoresUseCase(prestador_repo),
        buscar=BuscarPrestadorUseCase(prestador_repo),
        atualizar=AtualizarPrestadorUseCase(prestador_repo),
        remover=RemoverPrestadorUseCase(prestador_repo),
        upload_cert=UploadCertificadoUseCase(),
        codigo_municipio=config.codigo_municipio,
    ))
    app.include_router(criar_router_distribuicao(
        use_case=distribuicao_uc,
        prestador_repo=prestador_repo,
        task_manager=task_manager,
        codigo_municipio=config.codigo_municipio,
    ))
    app.include_router(criar_router_documentos(
        listar_uc=ListarDocumentosUseCase(documento_repo),
        baixar_xml_uc=BaixarXmlUseCase(documento_repo),
        baixar_pdf_uc=BaixarPdfUseCase(documento_repo),
        baixar_zip_uc=BaixarZipUseCase(documento_repo),
    ))
    app.include_router(criar_router_automacao(
        agendar_uc=automacao_uc,
        listar_uc=ListarAgendamentosUseCase(agendamento_repo),
        remover_uc=RemoverAgendamentoUseCase(agendamento_repo),
        logs_uc=ListarLogsUseCase(log_repo),
    ))
    app.include_router(criar_router_operacoes(
        listar_uc=listar_operacoes_uc,
        buscar_uc=buscar_operacao_uc,
    ))
    app.include_router(criar_router_config(
        obter_uc=obter_config_uc,
        atualizar_uc=atualizar_config_uc,
    ))

    # Serve frontend static files (deve ficar DEPOIS de todas as rotas de API)
    if os.path.exists("dist"):
        app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")

    return app


# Instância global para uvicorn
app = create_app()
