# AGENTS.md — Gestor NFSe

## Commands

| Layer | Command | Notes |
|-------|---------|-------|
| Backend | `cd backend && uv sync` | Python 3.12, deps in `pyproject.toml` |
| Backend | `cd backend && uv run uvicorn main:app --host 127.0.0.1 --port 8001` | Global `app = create_app()` in `main.py` |
| Backend | `cd backend && uv run pytest` | Optional `[dev]` dep — `tests/` is gitignored |
| Frontend | `cd frontend && npm install && npm run dev` | Vite on port 3000, `/api` proxy → `http://localhost:8001` |
| Frontend | `cd frontend && npm run lint` | `tsc --noEmit` only (no style linter) |
| Frontend | `cd frontend && npm run build` | Outputs to `backend/dist/` (served by FastAPI) |
| Root | `.\install.bat` **(recomendado)** | One-click: instala Node 22, uv, Python 3.12, deps, build, start servers, open browser |
| Root | `.\setup.bat` / `.\setup.ps1` | Legacy: install deps only (no server start) |
| Root | `.\start.bat` / `.\start.ps1` | Legacy: start servers only |

No test suite is set up. Backend has `pytest` as optional `[dev]` dep; `tests/` is gitignored.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind v4 (`@tailwindcss/vite`) in `frontend/`
  - SPA: `frontend/src/main.tsx` → `App.tsx` → 6 pages in `frontend/src/pages/`
  - `@/` path alias maps to `frontend/` (not `frontend/src/`)
  - Components in `frontend/src/components/`, services in `frontend/src/services/`
- **Backend**: Python/FastAPI in `backend/`, managed via `uv`
  - Feature modules under `backend/features/`: `prestadores/`, `distribuicao/`, `documentos/`, `automacao/`, `operacoes/`, `config/`
  - Each feature: `routes.py` → `application.py` (use cases) → `infra.py` (repositories)
  - Shared utilities in `backend/shared/`: `config.py`, `database.py`, `dll.py` (Unimake), `task_manager.py`, `http_log.py`, `validators.py`
  - App factory `create_app()` in `main.py`; global singleton `app = create_app()` for uvicorn
  - All API routes under prefix `/api/v1/`
  - Background tasks use `threading.Thread` (not asyncio), poll via `GET /api/v1/tasks/{id}`
- **Database**: SQLite at `backend/data/nfse.sqlite` (auto-created, auto-migrated). WAL mode + foreign keys ON.
- **DLL bridge**: Unimake NFSe via `pythonnet` CLR — **Windows-only**. DLLs in `backend/dll/`.

## Conventions

- **Portuguese** for all business layer code (routes, use cases, repos, error messages). English for config/framework files.
- `.gitattributes`: LF for source files, CRLF for `.bat`/`.ps1`, binary for `.dll`/`.db`/`.sqlite`.
- `backend/config.toml` has placeholder values (no `.example` file exists) — edit in place.
- `npm run lint` is type-check only (`tsc --noEmit`, `tsconfig.json` has `"noEmit": true`). No ESLint/Biome.
- Frontend scripts `npm run stop` / `npm run restart` delegate to `.bat` files in `frontend/scripts/`.
- `opencode.jsonc` configures `dbhub` MCP pointing at the SQLite database.
- License: MIT.
