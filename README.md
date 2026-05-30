# Gestor NFSe

Gestão de Notas Fiscais de Serviço Eletrônica — frontend React + backend FastAPI com integração Unimake SEFAZ.

## Pré-requisitos

- Python 3.12+ — instale com [uv](https://docs.astral.sh/uv/#installation)
- Node.js 20+
- Certificado Digital A1 (NFSe) — opcional para homologação

## Setup

```bash
# 1. Backend
cd gestor_nfse/backend
uv sync
cp config.toml.example config.toml
# Edite config.toml com seus dados (CNPJ, certificado, ambiente)
uv run uvicorn main:app --host 0.0.0.0 --port 8001

# 2. Frontend (outro terminal)
cd gestor_nfse/frontend
npm install
npm run dev
```

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8001/docs

## Produção

```bash
cd gestor_nfse/frontend
npm run build
```
O backend serve o frontend buildado em http://localhost:8001.

## Estrutura

```
frontend/          React + TypeScript + Vite
backend/
├── main.py        FastAPI app
├── features/      Módulos (prestadores, distribuição, documentos, automação)
├── shared/        Utilitários (config, database, DLL)
├── dll/           Bibliotecas Unimake
└── data/          SQLite (gerado automaticamente)
```
