# AGENTS.md - Gestor NFSe

## Commands
- Build: `npm run build` (frontend) / `dotnet build` (backend if applicable)
- Test: `npm test` (frontend) / `dotnet test` (backend if applicable)
- Lint: `npm run lint` (frontend)
- Typecheck: `npm run typecheck` (frontend)

## Architecture
- **Frontend**: React/TypeScript in `frontend/`
- **Backend**: Python/FastAPI in `backend/` (uv venv)
- **Database**: SQLite at `backend/data/nfse.sqlite` (via DBHub MCP, id: `gestor-nfse`)
