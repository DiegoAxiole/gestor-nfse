import { useState, type FormEvent } from 'react'
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

  const handleSubmit = async (e: FormEvent) => {
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
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Identificador</label>
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
