import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
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

        <form onSubmit={handleSubmit} autoComplete="on" className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">
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
              name="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="seu@email.com"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Senha</label>
            <div className="relative">
              <input
                type={showSenha ? 'text' : 'password'}
                name="senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-10 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowSenha(!showSenha)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
