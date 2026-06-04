# Frontend: Autenticação + Multi-tenant

## Objetivo

Adaptar o frontend React do Gestor NFSe para funcionar com o novo backend PostgreSQL + JWT multi-tenant. Adicionar login, cadastro, proteção de rotas e injeção automática de token nas requisições.

## Abordagem

React Router + Auth Context (escolhida pelo usuário entre 3 opções).

## Estrutura de novos arquivos

```
frontend/src/
├── auth/
│   ├── AuthContext.tsx       # Context + Provider + hook useAuth
│   ├── LoginPage.tsx         # Tela de login (/login)
│   └── CadastroPage.tsx      # Tela de cadastro (/cadastrar)
├── components/
│   ├── ProtectedRoute.tsx    # Redireciona para /login se não autenticado
│   └── ProtectedLayout.tsx   # Layout com sidebar + <Outlet />
```

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `main.tsx` | Envolver `<App>` com `<BrowserRouter>` + `<AuthProvider>` |
| `App.tsx` | Virar só `<Routes>` — login, cadastro, rotas protegidas |
| `api.ts` | `requestJson` / `requestBlob` / `requestText` injetam `Authorization: Bearer` do localStorage; 401 dispara logout |
| `index.html` | Trocar title para "Gestor NFSe" |

## AuthContext

```typescript
interface AuthState {
  token: string
  tenantId: number
  usuarioId: number
  email: string
}
```

- Provider lê token do `localStorage` na inicialização
- `login(email, senha)` → `POST /api/v1/auth/login` → salva token no state + localStorage
- `cadastrar(nome, slug, email, senha)` → `POST /api/v1/auth/cadastrar` → salva token
- `logout()` → limpa state + localStorage → redireciona para `/login`
- Payload do JWT decodificado para extrair `tenantId`, `usuarioId`, `email`
- Token expirado tratado via 401 no `api.ts` (não no frontend — o backend rejeita)

## Rotas

```
/login              → LoginPage          (público)
/cadastrar          → CadastroPage       (público)
/                   → DashboardView      (protegido)
/documentos         → DocumentosView     (protegido)
/empresas           → EmpresasView       (protegido)
/download-lote      → DownloadLoteView   (protegido)
/gerar-danfe        → GerarDanfeView     (protegido)
/historico          → HistoricoView      (protegido)
/configuracoes      → ConfiguracoesView  (protegido)
```

Todas as rotas protegidas usam `<ProtectedRoute>` que renderiza `<Navigate to="/login" />` se `auth === null`.

## Layout

**LoginPage / CadastroPage:** páginas isoladas, sem sidebar, com card centralizado.

**ProtectedLayout:** contém a sidebar (menu vira `<NavLink>` baseado em pathname) e o `<Outlet />` para renderizar a página ativa. O fetch inicial (`Promise.all` de empresas, documentos, operações, config) roda aqui.

**Menu items existentes** mantidos (Dashboard, Documentos, Gestão de Empresas, Exportar XMLs, Gerar DANFSe, Histórico NSU, Configuração). Ícones e labels idênticos.

## api.ts — injeção de token

```typescript
const token = localStorage.getItem('token')
const headers: Record<string, string> = { 'Content-Type': 'application/json' }
if (token) headers['Authorization'] = `Bearer ${token}`
```

Em caso de `res.status === 401`:
```typescript
localStorage.removeItem('token')
window.location.href = '/login'
```

Nenhuma outra função adaptadora do `api.ts` é alterada.

## Dados globais

O estado atual (`empresas`, `docs`, `ops`, `config`) sai do `App.tsx` monólito e vai para `ProtectedLayout.tsx` com `useEffect` + `useState` (ou um contexto simples se necessário). O fetch inicial permanece igual.

## Nada se perde

Todos os componentes existentes (DashboardView, DocumentosView, EmpresasView, DownloadLoteView, GerarDanfeView, HistoricoView, ConfiguracoesView, DanfseView, AccordionGroup, hooks, services) permanecem **intactos** — só recebem os mesmos dados de antes via props, vindos agora do ProtectedLayout.

## Não faz parte deste escopo

- Gestão de usuários (CRUD de usuários dentro do tenant)
- Troca de tenant
- Recuperação de senha
- Testes automatizados
