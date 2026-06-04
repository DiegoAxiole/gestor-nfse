import { useState, useEffect, memo } from 'react'
import { buscarTenant, atualizarTenant } from '../api'
import type { TenantProfile } from '../types'
import { AlertCircle, CheckCircle } from 'lucide-react'

const FIELDS_UPDATABLE: (keyof TenantProfile)[] = [
  'nome_fantasia', 'inscricao_estadual', 'email_contato',
  'telefone_celular', 'whatsapp', 'telefone_fixo',
  'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
]

function formatCNPJ(value: string): string {
  const clean = value.replace(/\D/g, '')
  if (clean.length !== 14) return value
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatCPF(value: string): string {
  const clean = value.replace(/\D/g, '')
  if (clean.length !== 11) return value
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function formatDocumento(tipo: string, documento: string): string {
  if (tipo === 'PJ') return formatCNPJ(documento)
  if (tipo === 'PF') return formatCPF(documento)
  return documento
}

function formatPhone(value: string | null): string {
  if (!value) return '-'
  const d = value.replace(/\D/g, '')
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7)
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6)
  return value
}

function formatCep(value: string | null): string {
  if (!value) return '-'
  const d = value.replace(/\D/g, '')
  if (d.length === 8) return d.slice(0, 5) + '-' + d.slice(5)
  return value
}

interface FieldProps {
  label: string
  value: string | null
  editValue?: string
  editing?: boolean
  onChange?: (v: string) => void
  placeholder?: string
  fullWidth?: boolean
  type?: string
}

const Field = memo(function Field({ label, value, editValue, editing, onChange, placeholder, fullWidth, type }: FieldProps) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      {editing && onChange !== undefined ? (
        <input
          type={type || 'text'}
          value={editValue ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      ) : (
        <p className="text-sm text-white">{value ?? '-'}</p>
      )}
    </div>
  )
})

export default function PerfilView() {
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [editData, setEditData] = useState<Partial<TenantProfile>>({})
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cepError, setCepError] = useState('')

  useEffect(() => {
    buscarTenant()
      .then(res => {
        setProfile(res.data)
        setEditData(res.data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const body: Record<string, unknown> = {}
      for (const key of FIELDS_UPDATABLE) {
        const val = editData[key]
        if (val !== undefined) body[key] = val
      }
      const res = await atualizarTenant(body as Partial<TenantProfile>)
      setProfile(res.data)
      setEditData(res.data)
      setEditing(false)
      setSuccess('Perfil atualizado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData(profile ?? {})
    setEditing(false)
    setCepError('')
  }

  const handleCepBlur = async () => {
    const cep = editData.cep?.replace(/\D/g, '')
    if (!cep || cep.length !== 8) return
    setCepError('')
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
      clearTimeout(id)
      const data = await res.json()
      if (!data.erro) {
        setEditData(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }))
      } else {
        setCepError('CEP não encontrado')
        setTimeout(() => setCepError(''), 4000)
      }
    } catch {
      setCepError('Erro ao consultar CEP')
      setTimeout(() => setCepError(''), 4000)
    }
  }

  const setEditField = (field: keyof TenantProfile, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center">
        <p className="text-sm text-rose-400">Erro ao carregar perfil</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">Perfil do Tenant</h1>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={handleCancel} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer">
                Editar
              </button>
            )}
          </div>
        </div>

        <h2 className="text-sm font-bold text-white mt-6 mb-3">Identificação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Tipo</label>
            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-md ${profile.tipo === 'PJ' ? 'bg-indigo-600' : 'bg-emerald-600'} text-white`}>
              {profile.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Documento</label>
            <p className="text-sm text-white">{formatDocumento(profile.tipo, profile.documento)}</p>
          </div>

          <Field label="Nome" value={profile.nome} editValue={editData.nome} editing={editing} onChange={v => setEditField('nome', v)} placeholder="Nome" fullWidth />
        </div>

        <h2 className="text-sm font-bold text-white mt-6 mb-3">Contato</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="E-mail" value={profile.email_contato} editValue={editData.email_contato ?? ''} editing={editing} onChange={v => setEditField('email_contato', v)} placeholder="email@exemplo.com" type="email" />
          <Field label="Celular" value={formatPhone(profile.telefone_celular)} editValue={editData.telefone_celular ?? ''} editing={editing} onChange={v => setEditField('telefone_celular', v)} placeholder="(11) 99999-9999" />

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">WhatsApp</label>
            {editing ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editData.whatsapp ?? false} onChange={e => setEditData(prev => ({ ...prev, whatsapp: e.target.checked }))} className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500/50 focus:ring-2" />
                <span className="text-sm text-white">Mesmo número do celular</span>
              </label>
            ) : (
              <p className="text-sm text-white">{profile.whatsapp ? 'Sim' : 'Não'}</p>
            )}
          </div>

          <Field label="Telefone Fixo" value={formatPhone(profile.telefone_fixo)} editValue={editData.telefone_fixo ?? ''} editing={editing} onChange={v => setEditField('telefone_fixo', v)} placeholder="(11) 3333-3333" />
        </div>

        <h2 className="text-sm font-bold text-white mt-6 mb-3">Endereço</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">CEP</label>
            {editing ? (
              <div>
                <input type="text" value={editData.cep ?? ''} onChange={e => setEditField('cep', e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                {cepError && <p className="text-[11px] text-rose-400 mt-1">{cepError}</p>}
              </div>
            ) : (
              <p className="text-sm text-white">{formatCep(profile.cep)}</p>
            )}
          </div>

          <Field label="Logradouro" value={profile.logradouro} editValue={editData.logradouro ?? ''} editing={editing} onChange={v => setEditField('logradouro', v)} placeholder="Logradouro" />
          <Field label="Número" value={profile.numero} editValue={editData.numero ?? ''} editing={editing} onChange={v => setEditField('numero', v)} placeholder="Número" />
          <Field label="Complemento" value={profile.complemento} editValue={editData.complemento ?? ''} editing={editing} onChange={v => setEditField('complemento', v)} placeholder="Complemento" />
          <Field label="Bairro" value={profile.bairro} editValue={editData.bairro ?? ''} editing={editing} onChange={v => setEditField('bairro', v)} placeholder="Bairro" />
          <Field label="Cidade" value={profile.cidade} editValue={editData.cidade ?? ''} editing={editing} onChange={v => setEditField('cidade', v)} placeholder="Cidade" />
          <Field label="UF" value={profile.uf} editValue={editData.uf ?? ''} editing={editing} onChange={v => setEditField('uf', v)} placeholder="UF" />
        </div>
      </div>
    </div>
  )
}
