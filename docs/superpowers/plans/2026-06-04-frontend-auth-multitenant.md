# Frontend Auth + Multi-tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login, cadastro, JWT token injection, route protection, and React Router to the Gestor NFSe frontend.

**Architecture:** React Router wraps the app with an AuthProvider context. Unauthenticated users see LoginPage or CadastroPage. Authenticated users see ProtectedLayout (sidebar + data fetching + `<Outlet />`) which renders the existing views via routes.

**Tech Stack:** React 19 + TypeScript + Vite + react-router-dom v7 + Tailwind CSS v4 + lucide-react

---

### Task 1: Install react-router-dom + pre-flight typecheck

**Files:**
- Modify: `frontend/package.json`
- Run: `frontend/` npm install

- [ ] **Step 1: Install react-router-dom**

```bash
cd frontend
npm install react-router-dom
```

- [ ] **Step 2: Run pre-flight typecheck to confirm clean slate**

```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add react-router-dom dependency"
```

---

### Task 2: Create auth/AuthContext.tsx

**Files:**
- Create: `frontend/src/auth/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext with login, cadastrar, logout**

```typescript
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BASE } from '../api'

interface AuthState {
  token: string
  tenantId: number
  usuarioId: number
  email: string
}

interface AuthContextType {
  auth: AuthState | null
  login: (email: string, senha: string) => Promise<void>
  cadastrar: (nome: string, slug: string, email: string, senha: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function decodePayload(token: string): { tenantId: number; usuarioId: number; email: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { tenantId: payload.tenantId, usuarioId: payload.usuarioId, email: payload.email }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const token = localStorage.getItem('token')
    if (!token) return null
    const payload = decodePayload(token)
    if (!payload) return null
    return { token, ...payload }
  })

  const login = async (email: string, senha: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'Erro no login' }))
      throw new Error(body.detail)
    }
    const data = await res.json()
    const payload = decodePayload(data.token)
    if (!payload) throw new Error('Token invalido')
    const authData = { token: data.token, ...payload }
    localStorage.setItem('token', data.token)
    setAuth(authData)
    navigate('/')
  }

  const cadastrar = async (nome: string, slug: string, email: string, senha: string) => {
    const res = await fetch(`${BASE}/auth/cadastrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, slug, email, senha }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'Erro no cadastro' }))
      throw new Error(body.detail)
    }
    const data = await res.json()
    const payload = decodePayload(data.token)
    if (!payload) throw new Error('Token invalido')
    const authData = { token: data.token, ...payload }
    localStorage.setItem('token', data.token)
    setAuth(authData)
    navigate('/')
  }

  const logout = () => {
    localStorage.removeItem('token')
    setAuth(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ auth, login, cadastrar, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/auth/AuthContext.tsx
git commit -m "feat: create AuthContext with login/cadastrar/logout"
```

---

### Task 3: Update api.ts — inject Authorization header + handle 401

**Files:**
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Add `BASE` as named export and add `getAuthHeaders` helper**

Replace the `const BASE = '/api/v1'` line to also export it:

```typescript
export const BASE = '/api/v1'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}
```

- [ ] **Step 2: Update `requestJson` to inject token and handle 401**

Replace the `requestJson` function:

```typescript
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...getAuthHeaders() }
  const res = await fetch(`${BASE}${path}`, { headers, ...init })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Sessao expirada')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}
```

- [ ] **Step 3: Update `requestBlob` and `requestText` similarly**

```typescript
async function requestBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, { headers: getAuthHeaders() })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Sessao expirada')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.blob()
}

async function requestText(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { headers: getAuthHeaders() })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Sessao expirada')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.text()
}
```

- [ ] **Step 4: Add auth headers to all raw fetch calls (FormData uploads)**

These raw `fetch()` calls bypass `requestJson` because they use FormData. Add auth headers to each:

**`cadastrarPrestador` (line 61):**
```typescript
    return fetch(`${BASE}/prestadores`, { method: 'POST', body: fd, headers: getAuthHeaders() }).then(r => {
```

**`atualizarPrestador` (line 81):**
```typescript
    return fetch(`${BASE}/prestadores/${cnpj}`, { method: 'PUT', body: fd, headers: getAuthHeaders() }).then(r => {
```

**`createEmpresa` (line 328):**
```typescript
  await fetch(`${BASE}/prestadores`, { method: 'POST', body: fd, headers: getAuthHeaders() }).then(r => {
```

**`updateEmpresa` (line 339):**
```typescript
  await fetch(`${BASE}/prestadores/${cnpj}`, { method: 'PUT', body: fd, headers: getAuthHeaders() }).then(r => {
```

**`uploadCertificado` (line 351):**
```typescript
  const res = await fetch(`${BASE}/prestadores/upload-certificado`, { method: 'POST', body: fd, headers: getAuthHeaders() })
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat: add JWT token injection and 401 handling to api.ts"
```

---

### Task 4: Create auth/LoginPage.tsx

**Files:**
- Create: `frontend/src/auth/LoginPage.tsx`

- [ ] **Step 1: Create LoginPage**

```typescript
import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, senha)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-md bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/10">
            <span className="text-white text-sm font-bold">NFSe</span>
          </div>
          <span className="text-lg font-bold text-white">Gestor NFSe</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">
          <h1 className="text-sm font-bold text-white text-center">Entrar</h1>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-900/50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Nao tem conta?{' '}
            <Link to="/cadastrar" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/auth/LoginPage.tsx
git commit -m "feat: create LoginPage"
```

---

### Task 5: Create auth/CadastroPage.tsx

**Files:**
- Create: `frontend/src/auth/CadastroPage.tsx`

- [ ] **Step 1: Create CadastroPage**

```typescript
import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function CadastroPage() {
  const { cadastrar } = useAuth()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await cadastrar(nome, slug, email, senha)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-md bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/10">
            <span className="text-white text-sm font-bold">NFSe</span>
          </div>
          <span className="text-lg font-bold text-white">Gestor NFSe</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">
          <h1 className="text-sm font-bold text-white text-center">Criar Conta</h1>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-900/50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nome do Tenant</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Minha Empresa" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Slug</label>
            <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="minha-empresa" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="seu@email.com" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer">
            {loading ? 'Criando...' : 'Criar Conta'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Ja tem conta?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/auth/CadastroPage.tsx
git commit -m "feat: create CadastroPage"
```

---

### Task 6: Create components/ProtectedRoute.tsx

**Files:**
- Create: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Create ProtectedRoute**

```typescript
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { auth } = useAuth()
  if (!auth) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ProtectedRoute.tsx
git commit -m "feat: create ProtectedRoute component"
```

---

### Task 7: Create components/ProtectedLayout.tsx

**Files:**
- Create: `frontend/src/components/ProtectedLayout.tsx`

- [ ] **Step 1: Create ProtectedLayout with sidebar, data fetching, and Outlet**

This component replaces the main body of the old App.tsx (everything inside the outer div). It keeps the same sidebar UI, data fetching, state manipulation handlers, and toast system.

```typescript
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LayoutDashboard, Printer, History, FileCode2, Settings2, Menu, X, ShieldCheck, AlertCircle, FolderDown, LogOut } from 'lucide-react'
import type { Documento, Operacao, ConfigToml, Empresa } from '../types'
import * as api from '../api'
import { formatCurrency } from '../utils'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedLayout() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedChave, setSelectedChave] = useState<string>('')
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [state, setState] = useState<{
    docs: Documento[]; ops: Operacao[]; config: ConfigToml; empresas: Empresa[]; activeEmpresaId: string
  }>({
    docs: [], ops: [], config: { prestador: { cnpj: '', razao_social: '' }, certificado: { caminho: '', senha_mascarada: '' }, geral: { ambiente: 'Homologacao', codigo_municipio: '' } },
    empresas: [], activeEmpresaId: '',
  })

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    Promise.all([
      api.fetchEmpresas(), api.fetchDocumentos(), api.fetchOperacoes(), api.fetchConfig(),
    ]).then(([empresas, docs, ops, config]) => {
      setState(prev => ({ ...prev, empresas, docs, ops, config }))
    }).catch(err => {
      triggerToast(`Erro ao carregar dados: ${err.message}`, 'error')
    })
  }, [])

  const handleSetActiveEmpresa = (id: string) => {
    setState(prev => {
      const active = prev.empresas.find(e => e.id === id)
      if (active) triggerToast(`Empresa ativa alterada para: ${active.razao_social}`, 'info')
      return { ...prev, activeEmpresaId: id }
    })
  }

  const handleEmpresaAtualizada = async () => {
    try {
      const empresas = await api.fetchEmpresas()
      setState(prev => ({ ...prev, empresas }))
    } catch (err: any) {
      triggerToast(err.message || 'Erro ao atualizar lista de empresas', 'error')
    }
  }

  const handleAddOperation = (newOp: Operacao) => {
    setState(prev => ({ ...prev, ops: [newOp, ...prev.ops] }))
    if (newOp.status === 'SUCESSO') {
      triggerToast(`Consulta com sucesso! Proximo NSU: ${newOp.ultimo_nsu}. Registrado dFe.`, 'success')
    } else {
      triggerToast(`Rejeicao SEFAZ: Consulta retornou erro ou rejeicao. Verifique o historico.`, 'error')
    }
  }

  const handleAddDocuments = (newDocs: Documento[]) => {
    setState(prev => {
      const currentDocs = [...prev.docs]
      newDocs.forEach(newDoc => {
        const idx = currentDocs.findIndex(d => d.chave_acesso === newDoc.chave_acesso)
        if (idx !== -1) {
          currentDocs[idx] = { ...currentDocs[idx], ...newDoc, tem_pdf: currentDocs[idx].tem_pdf || newDoc.tem_pdf }
        } else {
          currentDocs.unshift(newDoc)
        }
      })
      return { ...prev, docs: currentDocs }
    })
    if (newDocs.length > 0) {
      triggerToast(`Novo documento fiscal importado! Nota ${newDocs[0].numero_nota} no valor de ${formatCurrency(newDocs[0].valor_servicos)}`, 'success')
    }
  }

  const handleSaveConfig = async (newConfig: ConfigToml) => {
    setState(prev => ({ ...prev, config: newConfig }))
    await api.saveConfigToml(newConfig)
    triggerToast('Arquivo config.toml de credenciamento do Unimake salvo!', 'success')
  }

  const handleResetDatabase = () => {
    setState({
      docs: [], ops: [],
      config: { prestador: { cnpj: '', razao_social: '' }, certificado: { caminho: '', senha_mascarada: '' }, geral: { ambiente: 'Homologacao', codigo_municipio: '' } },
      empresas: [], activeEmpresaId: '',
    })
    triggerToast('Dados limpos! Notas e historico de consultas redefinidos.', 'info')
  }

  const handleViewXmlPage = (chave: string) => {
    const doc = state.docs.find(d => d.chave_acesso === chave)
    if (!doc) { triggerToast('Nota fiscal nao localizada no microbanco local.', 'error'); return }
    const blob = new Blob([doc.xml_nfse], { type: 'text/xml' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `NFSe_${doc.numero_nota}_Chave_${doc.chave_acesso}.xml`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    triggerToast(`XML da Nota ${doc.numero_nota} baixado com sucesso!`, 'success')
  }

  const handleGenerateDanfePage = (chave: string) => {
    setSelectedChave(chave)
    navigate('/gerar-danfe')
    setMobileMenuOpen(false)
  }

  const handleNavigation = (tab: string) => {
    const routeMap: Record<string, string> = {
      dashboard: '/', documentos: '/documentos', empresas: '/empresas',
      download_lote: '/download-lote', gerar: '/gerar-danfe',
      historico: '/historico', configuracoes: '/configuracoes',
    }
    navigate(routeMap[tab] || '/')
    setMobileMenuOpen(false)
  }

  const activeEmpresa = state.empresas.find(e => e.id === state.activeEmpresaId) || state.empresas[0]
  const lgpdAtivo = state.config.lgpd_ativo ?? false

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { id: 'documentos', label: 'Documentos', path: '/documentos', icon: FileCode2 },
    { id: 'empresas', label: 'Gestao de Empresas', path: '/empresas', icon: ShieldCheck },
    { id: 'download_lote', label: 'Exportar XMLs (ZIP)', path: '/download-lote', icon: FolderDown },
    { id: 'gerar', label: 'Gerar DANFSe', path: '/gerar-danfe', icon: Printer },
    { id: 'historico', label: 'Historico NSU', path: '/historico', icon: History },
    { id: 'configuracoes', label: 'Configuracao Toml', path: '/configuracoes', icon: Settings2 },
  ]

  const outletContext = {
    ...state, activeEmpresa, lgpdAtivo,
    onNavigate: handleNavigation,
    onSetActiveEmpresa: handleSetActiveEmpresa,
    onSetActive: handleSetActiveEmpresa,          // alias for EmpresasView
    onEmpresaSelecionada: handleSetActiveEmpresa, // alias for EmpresasView
    onEmpresaAtualizada: handleEmpresaAtualizada,
    onAddOperation: handleAddOperation,
    onAddDocuments: handleAddDocuments,
    onSaveConfig: handleSaveConfig,
    onResetDatabase: handleResetDatabase,
    onViewXml: handleViewXmlPage,
    onGenerateDanfe: handleGenerateDanfePage,
    selectedChave,
    triggerToast,
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col antialiased selection:bg-indigo-500/30">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className={`p-4 rounded-xl shadow-2xl border text-xs font-semibold flex items-start gap-2.5 ${toast.type === 'success' ? 'bg-slate-900 border-indigo-500/30 text-white shadow-indigo-500/5' : toast.type === 'error' ? 'bg-rose-950 border-rose-900 text-rose-200 shadow-rose-950/20' : 'bg-slate-900 border-slate-850 text-slate-200 shadow-slate-950/30'}`}>
              {toast.type === 'success' ? <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${toast.type === 'error' ? 'text-rose-400' : 'text-indigo-400'}`} />}
              <div className="flex-1">{toast.message}</div>
              <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 p-0.5 cursor-pointer text-[10px]">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 relative">
        <aside className="hidden lg:flex flex-col w-64 bg-slate-950 text-slate-300 border-r border-slate-900 p-5 shrink-0 select-none">
          <div className="flex items-center gap-2.5 px-2 py-4 border-b border-slate-900">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/10">
              <span className="text-white text-sm font-bold">NFSe</span>
            </div>
          </div>
          <nav className="mt-6 flex-1 space-y-1">
            {menuItems.map(item => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${isActive ? 'bg-slate-900 text-white shadow-xs border border-slate-800 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900/50'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
          <div className="pt-4 border-t border-slate-900">
            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-900/50 transition-all cursor-pointer">
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </aside>

        <header className="lg:hidden w-full bg-slate-950 border-b border-slate-900 h-16 flex items-center justify-between px-4 text-white shrink-0 absolute top-0 left-0 z-40 select-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center font-extrabold text-white text-sm">NFSe</div>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden absolute top-16 left-0 right-0 z-35 bg-slate-950 border-b border-slate-900 overflow-hidden shadow-xl"
            >
              <nav className="p-4 space-y-1">
                {menuItems.map(item => {
                  const Icon = item.icon
                  return (
                    <NavLink key={item.id} to={item.path} end={item.path === '/'} onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${isActive ? 'bg-slate-900 text-white font-bold border border-slate-850' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`
                      }
                    >
                      <Icon className="w-4 h-4 text-slate-500" />
                      {item.label}
                    </NavLink>
                  )
                })}
                <button onClick={() => { logout(); setMobileMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-slate-900 cursor-pointer">
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto pt-20 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ProtectedLayout.tsx
git commit -m "feat: create ProtectedLayout with sidebar, data, and Outlet"
```

---

### Task 8: Refactor App.tsx to use Routes

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire file with just routes:

```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './auth/LoginPage'
import CadastroPage from './auth/CadastroPage'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedLayout from './components/ProtectedLayout'
import DashboardView from './components/DashboardView'
import DocumentosView from './pages/DocumentosView'
import EmpresasView from './pages/EmpresasView'
import DownloadLoteView from './pages/DownloadLoteView'
import GerarDanfeView from './pages/GerarDanfeView'
import HistoricoView from './pages/HistoricoView'
import ConfiguracoesView from './pages/ConfiguracoesView'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastrar" element={<CadastroPage />} />
      <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
        <Route index element={<DashboardView />} />
        <Route path="documentos" element={<DocumentosView />} />
        <Route path="empresas" element={<EmpresasView />} />
        <Route path="download-lote" element={<DownloadLoteView />} />
        <Route path="gerar-danfe" element={<GerarDanfeView />} />
        <Route path="historico" element={<HistoricoView />} />
        <Route path="configuracoes" element={<ConfiguracoesView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor: App.tsx uses React Router with auth routes"
```

---

### Task 9: Update main.tsx — wrap with BrowserRouter + AuthProvider

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Wrap App with BrowserRouter and AuthProvider**

```typescript
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "refactor: wrap app with BrowserRouter and AuthProvider"
```

---

### Task 10: Update view components to use outlet context

**Files:**
- Modify: `frontend/src/components/DashboardView.tsx`
- Modify: `frontend/src/pages/DocumentosView.tsx`
- Modify: `frontend/src/pages/EmpresasView.tsx`
- Modify: `frontend/src/pages/DownloadLoteView.tsx`
- Modify: `frontend/src/pages/GerarDanfeView.tsx`
- Modify: `frontend/src/pages/HistoricoView.tsx`
- Modify: `frontend/src/pages/ConfiguracoesView.tsx`

Each view currently receives props from the parent. Now that they're rendered via `<Outlet />` inside `<Routes>`, they need to get their data from `useOutletContext()`.

- [ ] **Step 1: Add `useOutletContext` import and extract data**

Each view file needs two changes:

**A)** Add import at top of file:
```typescript
import { useOutletContext } from 'react-router-dom'
```

**B)** At the start of the component function, destructure needed data from context:
```typescript
const context = useOutletContext<{
  docs: any[]; ops: any[]; empresas: any[]; config: any;
  activeEmpresa: any; lgpdAtivo: boolean;
  selectedChave: string;
  onNavigate: (tab: string) => void;
  onSetActiveEmpresa: (id: string) => void;
  onEmpresaAtualizada: () => Promise<void>;
  onAddOperation: (op: any) => void;
  onAddDocuments: (docs: any[]) => void;
  onSaveConfig: (config: any) => Promise<void>;
  onResetDatabase: () => void;
  onViewXml: (chave: string) => void;
  onGenerateDanfe: (chave: string) => void;
}>()
```

Then replace `props.X` references with `context.X`.

Detailed changes per view:

**DashboardView** — previously received: `docs, ops, empresas, config, activeEmpresa, lgpdAtivo, onNavigate, onSetActiveEmpresa, onAddOperation, onAddDocuments`
```typescript
import { useOutletContext } from 'react-router-dom'

export default function DashboardView() {
  const { docs, ops, empresas, config, activeEmpresa, lgpdAtivo, onNavigate, onSetActiveEmpresa, onAddOperation, onAddDocuments } = useOutletContext<any>()
  // ... rest stays the same, change `props.X` to `X`
```

**DocumentosView** — previously received: `empresas, lgpdAtivo, onViewXml, onGenerateDanfe`
```typescript
import { useOutletContext } from 'react-router-dom'
// ...
const { empresas, lgpdAtivo, onViewXml, onGenerateDanfe } = useOutletContext<any>()
```

**EmpresasView** — previously received: `empresas, activeEmpresaId, lgpdAtivo, onSetActive, onEmpresaAtualizada, onEmpresaSelecionada`
```typescript
import { useOutletContext } from 'react-router-dom'
// ...
const { empresas, activeEmpresaId, lgpdAtivo, onSetActive, onEmpresaAtualizada, onEmpresaSelecionada } = useOutletContext<any>()
```

**DownloadLoteView** — previously received: `docs, empresas, lgpdAtivo`
```typescript
import { useOutletContext } from 'react-router-dom'
// ...
const { docs, empresas, lgpdAtivo } = useOutletContext<any>()
```

**GerarDanfeView** — previously received: `docs, empresas, activeEmpresaId, selectedChave, lgpdAtivo, onViewXml`
```typescript
import { useOutletContext } from 'react-router-dom'
// ...
const { docs, empresas, activeEmpresaId, selectedChave, lgpdAtivo, onViewXml } = useOutletContext<any>()
```

**HistoricoView** — previously received: `ops, empresas, lgpdAtivo, onViewXml`
```typescript
import { useOutletContext } from 'react-router-dom'
// ...
const { ops, empresas, lgpdAtivo, onViewXml } = useOutletContext<any>()
```

**ConfiguracoesView** — previously received: `config, onSaveConfig, onResetDatabase`
```typescript
import { useOutletContext } from 'react-router-dom'
// ...
const { config, onSaveConfig, onResetDatabase } = useOutletContext<any>()
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/DashboardView.tsx frontend/src/pages/DocumentosView.tsx frontend/src/pages/EmpresasView.tsx frontend/src/pages/DownloadLoteView.tsx frontend/src/pages/GerarDanfeView.tsx frontend/src/pages/HistoricoView.tsx frontend/src/pages/ConfiguracoesView.tsx
git commit -m "refactor: views use useOutletContext instead of props"
```

---

### Task 11: Update index.html title

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Change title from "My Google AI Studio App" to "Gestor NFSe"**

```html
<title>Gestor NFSe</title>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "chore: update page title to Gestor NFSe"
```

---

### Task 12: Typecheck + build verification

- [ ] **Step 1: Run typecheck**

```bash
cd frontend && npm run lint
```
Expected: 0 errors. Fix any type issues found.

- [ ] **Step 2: Run build**

```bash
cd frontend && npm run build
```
Expected: build completes with no errors, outputs to `backend/public/`.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: typecheck and build fixes"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Start backend + frontend**

Terminal 1 (backend):
```bash
cd backend
$env:DATABASE_URL = 'postgresql://postgres.ezechzescmczbgejctwr:w6z1r8986225@aws-1-sa-east-1.pooler.supabase.com:6543/postgres'
$env:JWT_SECRET = 'segredo-local-dev'
npx tsx src/index.ts
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

- [ ] **Step 2: Open http://localhost:3000 — should see login page**

- [ ] **Step 3: Login with admin@gestornfse.com / admin123 — should redirect to dashboard**

- [ ] **Step 4: Navigate to each page — documentos, empresas, download-lote, gerar-danfe, historico, configuracoes**

- [ ] **Step 5: Click "Sair" — should redirect to /login**

- [ ] **Step 6: Test /cadastrar — create a new account and verify it works**
