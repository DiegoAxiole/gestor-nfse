# AGENTS.md — Gestor NFSe

NFSe manager: **Express (Node.js) backend** + **React frontend**. Prisma + SQLite.

## Project structure

```
frontend/          React 19 + TypeScript + Vite 6 + Tailwind CSS v4
backend/
├── src/
│   ├── index.ts        Express entrypoint
│   ├── app.ts          Express app factory
│   ├── config.ts       TOML config loader
│   ├── validators.ts   CNPJ / chave de acesso validation
│   ├── modules/        Route modules (prestadores, config, distribuicao, documentos, operacoes, automacao, tasks)
│   └── shared/         Prisma client, error handler
├── prisma/             Prisma schema + migrations
├── data/               SQLite DB (auto-created on first run)
├── dist/               TypeScript compile output (tsc)
├── public/             Frontend build output (Vite)
└── node_modules/
```

## Commands

| Context | Command |
|---------|---------|
| Backend deps | `npm install` (in `backend/`) |
| Prisma generate | `npx prisma generate` (in `backend/`) |
| Backend dev | `npm run dev` (runs `tsx watch src/index.ts`) |
| Backend build | `npm run build` (runs `tsc`, outputs to `backend/dist/`) |
| Backend prod | `npm run start` (`node dist/index.js`) |
| Typecheck | `npm run typecheck` (runs `tsc --noEmit`) |
| Frontend deps | `npm install` (in `frontend/`) |
| Frontend dev | `npm run dev` (port 3000, proxies `/api` → `:8001`) |
| Frontend build | `npm run build` (Vite, outputs to `backend/public/`) |
| Frontend typecheck | `npm run lint` (runs `tsc --noEmit`) |
| One-click install | `install.bat` (downloads portable Node, installs deps, builds, starts) |
| Start server | `start.bat` (auto-runs npm install + build if needed) |

## API

All routes under `/api/v1/`. Docs at `http://localhost:8001/docs` (auto-generated).

- **Prestadores**: CRUD at `/api/v1/prestadores` (multipart/form-data with PFX cert)
- **Distribuição**: `POST /api/v1/distribuicao/consultar` (returns task_id for polling)
- **Tasks**: `GET /api/v1/tasks/{task_id}` (poll background task status)
- **Documentos**: `GET /api/v1/documentos`, `GET .../{chave}/xml|pdf`, `GET .../download-zip`
- **Automação**: `POST /api/v1/automacao/agendar`, `GET/DELETE /.../agendamentos`, `GET /.../logs`
- **Operações**: `GET /api/v1/operacoes`
- **Config**: `GET/PUT /api/v1/config`
- **Health**: `GET /health`

## Database

- SQLite via Prisma ORM
- PFX certificates stored as BLOBs in `prestadores` table
- Background tasks polled by frontend via `GET /tasks/{id}`

## Key conventions

- Routes use **dependency injection** via factory functions (`criarRouter*`) — receive `DatabaseManager` instance
- CNPJ validation (14 digits) via `validators.ts`
- `config.toml` is gitignored; no `.example` file
- Frontend uses `@/` import alias → `frontend/`
- LGPD (data privacy) masking in `frontend/src/utils.ts`
- Certificate upload uses `multipart/form-data` (not JSON)
- SEFAZ integration via `vendor/consulta-nfse-api-node`
- No tests exist
