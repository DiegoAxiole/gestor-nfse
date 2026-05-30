# Gestor NFSe

Gestão de Notas Fiscais de Serviço Eletrônica — frontend React + backend FastAPI com integração Unimake SEFAZ.

## Pré-requisitos

- **Python 3.12+** com [uv](https://docs.astral.sh/uv/#installation)
- **Node.js 20+** com npm
- **Certificado Digital A1** (NFSe) — opcional para testes em homologação

## Setup rápido

```bash
# 1. Backend — instalar dependências
cd backend
uv sync
cp config.toml.example config.toml   # edite com seus dados

# 2. Backend — iniciar servidor
uv run uvicorn main:app --host 0.0.0.0 --port 8001

# 3. Frontend (outro terminal) — modo dev
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:3000` (frontend) e `http://localhost:8001/docs` (API Swagger).

## Produção

```bash
cd frontend
npm run build       # gera backend/dist/
```

O backend serve o frontend buildado em `http://localhost:8001`.

## Estrutura

```
frontend/          React + TypeScript + Vite
backend/
├── main.py        FastAPI app
├── features/      Módulos (prestadores, distribuição, documentos, etc.)
├── shared/        Utilitários (config, database, DLL)
├── dll/           Bibliotecas Unimake (runtime)
└── data/          Banco SQLite (gerado em runtime)
```
