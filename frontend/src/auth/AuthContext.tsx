import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE = '/api/v1'

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
