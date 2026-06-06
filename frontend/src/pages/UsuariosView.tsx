import { useState, useEffect, type FormEvent } from 'react'
import { listarUsuarios, criarUsuario, alterarPapelUsuario, removerUsuario } from '../api'
import type { UsuarioPerfil } from '../types'
import { useAuth } from '../auth/AuthContext'
import { AlertCircle, CheckCircle, UserPlus, Trash2, Shield, Eye, EyeOff } from 'lucide-react'

export default function UsuariosView() {
  const { auth } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState<'admin' | 'operador'>('operador')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [saving, setSaving] = useState(false)

  const carregar = () => {
    setLoading(true)
    listarUsuarios()
      .then(res => setUsuarios(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(carregar, [])

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await criarUsuario({ email, nome: nome || undefined, papel, senha })
      setUsuarios(prev => [...prev, res.data])
      setEmail(''); setNome(''); setPapel('operador'); setSenha('')
      setShowForm(false)
      setSuccess('Usuário criado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAlterarPapel = async (id: number, novoPapel: string) => {
    try {
      const res = await alterarPapelUsuario(id, novoPapel)
      setUsuarios(prev => prev.map(u => u.id === id ? res.data : u))
      setSuccess('Papel atualizado!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemover = async (id: number) => {
    if (id === auth?.usuarioId) {
      setError('Você não pode remover o próprio usuário')
      return
    }
    if (!confirm('Remover este usuário?')) return
    try {
      await removerUsuario(id)
      setUsuarios(prev => prev.filter(u => u.id !== id))
      setSuccess('Usuário removido!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">Usuários</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCriar} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-white">Novo Usuário</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nome</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Papel</label>
              <select value={papel} onChange={e => setPapel(e.target.value as 'admin' | 'operador')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Senha *</label>
              <div className="relative">
                <input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-10 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required minLength={6} />
                <button type="button" onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer">{saving ? 'Criando...' : 'Criar'}</button>
          </div>
        </form>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <td className="px-4 py-3">Nome</td>
              <td className="px-4 py-3">Email</td>
              <td className="px-4 py-3">Papel</td>
              <td className="px-4 py-3">Criado em</td>
              <td className="px-4 py-3 text-right">Ações</td>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className={`border-b border-slate-800/50 ${u.id === auth?.usuarioId ? 'bg-indigo-950/20' : ''}`}>
                <td className="px-4 py-3 text-white">{u.nome || '-'}</td>
                <td className="px-4 py-3 text-slate-300">{u.email}</td>
                <td className="px-4 py-3">
                  {u.id === auth?.usuarioId ? (
                    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${u.papel === 'admin' ? 'bg-indigo-600/20 text-indigo-300' : 'bg-slate-700/50 text-slate-300'}`}>
                      {u.papel === 'admin' ? 'Admin' : 'Operador'}
                    </span>
                  ) : (
                    <select
                      value={u.papel}
                      onChange={e => handleAlterarPapel(u.id, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded text-[11px] px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="operador">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-[11px]">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== auth?.usuarioId && (
                    <button onClick={() => handleRemover(u.id)} className="text-rose-400 hover:text-rose-300 transition-all cursor-pointer" title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {usuarios.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Nenhum usuário encontrado</p>
        )}
      </div>
    </div>
  )
}
