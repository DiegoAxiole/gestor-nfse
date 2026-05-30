# Gestor NFSe

Gestão de Notas Fiscais de Serviço Eletrônica.

## Estrutura

- `frontend/` — React + TypeScript + Vite
- `backend/` — Python + FastAPI + uv

## Setup

```bash
# Backend
cd backend
uv sync
uv run uvicorn main:app --port 8001

# Frontend
cd frontend
npm install
npm run dev
```
