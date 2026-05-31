# Gestor NFSe

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Gestão de Notas Fiscais de Serviço Eletrônica — frontend React + backend FastAPI com integração Unimake SEFAZ.

## Instalação única (recomendado)

Abra o Explorer na pasta do projeto e **dê dois cliques em `install.bat`**. Ou pelo terminal:

```cmd
.\install.bat
```

O script detecta o que falta, baixa tudo (Node.js portátil, Python 3.12 via uv, dependências), compila o frontend, inicia os servidores e abre o navegador. Um clique, zero configuração, zero admin necessário.

## Setup manual (etapas separadas)

Para instalar sem iniciar os servidores, use `setup.bat`; para iniciar depois, use `start.bat`.

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
