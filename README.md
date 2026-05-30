# Gestor NFSe

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Gestão de Notas Fiscais de Serviço Eletrônica — frontend React + backend FastAPI com integração Unimake SEFAZ.

## Setup automático (recomendado)

Abra o PowerShell como administrador e execute:

```powershell
.\setup.ps1
```

O script detecta e instala tudo que precisa (Node.js, Python, dependências), exibindo o progresso de cada etapa. Zero dor de cabeça.

Depois da instalação, para iniciar o projeto:

```powershell
.\start.ps1
```

Isso sobe o backend e o frontend automaticamente e abre o navegador.

## Setup manual

Pré-requisitos: [Node.js 20+](https://nodejs.org), Python 3.12+ com [uv](https://docs.astral.sh/uv/#installation).

```bash
# Backend
cd backend
uv sync
cp config.toml.example config.toml   # edite com seus dados
uv run uvicorn main:app --host 127.0.0.1 --port 8001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

- **App**: http://localhost:3000
- **API Docs**: http://localhost:8001/docs

## Produção

```bash
cd frontend
npm run build         # gera backend/dist/
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
