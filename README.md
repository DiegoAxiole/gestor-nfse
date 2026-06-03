# Gestor NFSe

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Gestão de Notas Fiscais de Serviço Eletrônica — frontend React + backend Express (Node.js) com integração SEFAZ.

Banco SQLite local (não precisa de servidor de banco). Portátil: não instala nada no sistema.

---

## Para usuários (instalação zero)

1. **Baixe** o arquivo `gestor-nfse-vX.X.X.zip` da seção [Releases](https://github.com/seu-usuario/gestor-nfse/releases)
2. **Extraia** em qualquer pasta
3. **Execute** `start.bat` (dois cliques)
4. O navegador abre em `http://localhost:8001`

Pronto. O Node.js portátil já vem dentro do zip. Nada é instalado no sistema.

---

## Para desenvolvedores

### Pré-requisitos

- [Node.js 22+](https://nodejs.org)
- Git

### Setup

```bash
git clone <seu-repositorio>
cd gestor-nfse
.\install.bat
```

O script baixa o Node.js portátil (se não tiver), instala dependências, compila e inicia.

### Manual

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run dev          # http://localhost:8001

# Frontend (terminal 2)
cd frontend
npm install
npm run dev          # http://localhost:3000 (proxy /api → :8001)
```

- **Dev**: http://localhost:3000 (hot-reload)
- **Prod**: http://localhost:8001 (backend serve frontend buildado)
- **API Docs**: http://localhost:8001/docs

---

## Publicar uma release

```cmd
scripts\build-release.bat
```

Gera `releases\gestor-nfse-vX.X.X.zip` com tudo incluso (backend compilado, frontend compilado, Node.js portátil, dependências de produção). Basta subir o zip no GitHub Releases.

---

## Estrutura

```
gestor-nfse/
├── backend/
│   ├── src/           TypeScript (Express + Prisma + rotas)
│   ├── dist/          Compilado + frontend buildado
│   ├── prisma/        Schema do banco
│   └── data/          SQLite (auto-criado na 1ª execução)
├── frontend/          React + TypeScript + Vite
├── scripts/           Utilitários (build-release.bat)
├── .tools/            Node.js portátil (baixado pelo install.bat)
├── start.bat          Iniciar servidor (modo produção)
└── install.bat        Setup completo (dev)
```
