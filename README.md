# Gestor NFSe

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Gestão de Notas Fiscais de Serviço Eletrônica — frontend React + backend Express (Node.js) com integração SEFAZ.

Banco PostgreSQL via Drizzle ORM (Supabase).

---

## Para desenvolvedores

### Pré-requisitos

- [Node.js 22+](https://nodejs.org)
- PostgreSQL (ou Supabase)
- Git

### Setup

```bash
git clone <seu-repositorio>
cd gestor-nfse
cd backend && npm install
cd ../frontend && npm install
```

Configure as variáveis de ambiente no `backend/.env`:

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/gestor_nfse
JWT_SECRET=seu-segredo-aqui
AMBIENTE=Homologacao
CODIGO_MUNICIPIO=1001058
```

Sincronize o schema e crie o admin:

```bash
cd backend
npm run db:push
npm run seed
```

### Dev

```bash
# Backend (terminal 1)
cd backend
npm run dev          # http://localhost:8001

# Frontend (terminal 2)
cd frontend
npm run dev          # http://localhost:3000 (proxy /api → :8001)
```

- **Dev**: http://localhost:3000 (hot-reload)
- **Prod**: http://localhost:8001 (backend serve frontend buildado)

---

## Estrutura

```
gestor-nfse/
├── backend/
│   ├── src/           TypeScript (Express + Drizzle + rotas)
│   ├── dist/          Compilado
│   └── public/        Frontend buildado (gerado pelo Vite)
├── frontend/          React 19 + TypeScript + Vite 6 + Tailwind CSS v4
├── dev.bat            Iniciar servidores dev (Windows)
├── dev.ps1            Iniciar servidor único (PowerShell)
└── AGENTS.md          Instruções para agentes OpenCode
```

---

## Publicar uma release

O CI gera releases automaticamente ao criar uma tag `v*`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Veja `.github/workflows/release.yml`.
