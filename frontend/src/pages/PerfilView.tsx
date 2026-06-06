import { useState, useEffect, memo } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { OutletContext } from '../components/ProtectedLayout'
import { salvarConfigOpcoes, fetchConfigOpcoes, buscarTenant, atualizarTenant } from '../api'
import type { TenantProfile } from '../types'
import { AlertCircle, CheckCircle, User, Building2, Mail, Phone, MapPin, IdCard, Settings2, Eye, EyeOff } from 'lucide-react'

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
  const { onLgpdChange } = useOutletContext<OutletContext>()
  const [configOpcoes, setConfigOpcoes] = useState<{ ambiente: string; codigo_municipio: string; lgpd_ativo: boolean } | null>(null)

  useEffect(() => {
    Promise.all([
      buscarTenant(),
      fetchConfigOpcoes().catch(() => null),
    ])
      .then(([tenantRes, cfg]) => {
        setProfile(tenantRes.data)
        setEditData(tenantRes.data)
        if (cfg) setConfigOpcoes({ ambiente: cfg.ambiente, codigo_municipio: cfg.codigo_municipio, lgpd_ativo: cfg.lgpd_ativo })
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
      if (configOpcoes) {
        await salvarConfigOpcoes({
          ambiente: configOpcoes.ambiente,
          codigo_municipio: configOpcoes.codigo_municipio,
          lgpd_ativo: configOpcoes.lgpd_ativo,
        })
        onLgpdChange(configOpcoes.lgpd_ativo)
      }
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

  const handleConfigField = (field: 'ambiente' | 'codigo_municipio' | 'lgpd_ativo', value: string | boolean) => {
    setConfigOpcoes(prev => prev ? { ...prev, [field]: value } : null)
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

  const IconRow = memo(function IconRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-sm text-white truncate">{value}</p>
        </div>
      </div>
    )
  })

  return (
    <div className="max-w-4xl mx-auto p-6">
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {/* Header: icon + nome + badge + LGPD + buttons */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">{profile.nome}</h1>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-0.5 ${profile.tipo === 'PJ' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {profile.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {configOpcoes && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">LGPD</span>
                <button
                  type="button"
                  onClick={() => {
                    const novo = !configOpcoes.lgpd_ativo
                    handleConfigField('lgpd_ativo', novo)
                    onLgpdChange(novo)
                    salvarConfigOpcoes({ lgpd_ativo: novo }).catch(() => {})
                  }}
                  className={`relative w-9 h-5 rounded-full transition-all cursor-pointer shrink-0 ${configOpcoes.lgpd_ativo ? "bg-indigo-600" : "bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-all ${configOpcoes.lgpd_ativo ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button onClick={handleCancel} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap">
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap">
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile LGPD */}
        {configOpcoes && (
          <div className="sm:hidden flex items-center justify-between mt-3 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              {configOpcoes.lgpd_ativo ? <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
              <span className="text-[11px] font-semibold text-slate-300">Ocultar dados sensíveis</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const novo = !configOpcoes.lgpd_ativo
                handleConfigField('lgpd_ativo', novo)
                onLgpdChange(novo)
                salvarConfigOpcoes({ lgpd_ativo: novo }).catch(() => {})
              }}
              className={`relative w-9 h-5 rounded-full transition-all cursor-pointer shrink-0 ${configOpcoes.lgpd_ativo ? "bg-indigo-600" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-all ${configOpcoes.lgpd_ativo ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
        )}

        {/* Documento info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <IconRow icon={IdCard} label="Documento" value={formatDocumento(profile.tipo, profile.documento)} />
          <IconRow icon={User} label="Nome" value={profile.nome} />
          {profile.nome_fantasia ? (
            <IconRow icon={Building2} label="Nome Fantasia" value={profile.nome_fantasia} />
          ) : (
            <div />
          )}
          {profile.inscricao_estadual ? (
            <IconRow icon={IdCard} label="Inscrição Estadual" value={profile.inscricao_estadual} />
          ) : (
            <div />
          )}
        </div>

        {/* Contato + Endereço side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5 pt-4 border-t border-slate-800">
          {/* Contato */}
          <div>
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              Contato
            </h3>
            <div className="space-y-3">
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
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Endereço
            </h3>
            <div className="grid grid-cols-2 gap-3">
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

              <Field label="Número" value={profile.numero} editValue={editData.numero ?? ''} editing={editing} onChange={v => setEditField('numero', v)} placeholder="Número" />
              <Field label="Logradouro" value={profile.logradouro} editValue={editData.logradouro ?? ''} editing={editing} onChange={v => setEditField('logradouro', v)} placeholder="Logradouro" fullWidth />
              <Field label="Complemento" value={profile.complemento} editValue={editData.complemento ?? ''} editing={editing} onChange={v => setEditField('complemento', v)} placeholder="Complemento" />
              <Field label="Bairro" value={profile.bairro} editValue={editData.bairro ?? ''} editing={editing} onChange={v => setEditField('bairro', v)} placeholder="Bairro" />
              <Field label="Cidade" value={profile.cidade} editValue={editData.cidade ?? ''} editing={editing} onChange={v => setEditField('cidade', v)} placeholder="Cidade" />
              <Field label="UF" value={profile.uf} editValue={editData.uf ?? ''} editing={editing} onChange={v => setEditField('uf', v)} placeholder="UF" />
            </div>
          </div>
        </div>

        {/* Configurações Técnicas */}
        {configOpcoes && (
          <div className="mt-5 pt-4 border-t border-slate-800">
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
              Configurações Técnicas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Ambiente</label>
                {editing ? (
                  <select
                    value={configOpcoes.ambiente}
                    onChange={e => handleConfigField('ambiente', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="Homologacao">Homologação</option>
                    <option value="Producao">Produção</option>
                  </select>
                ) : (
                  <p className="text-sm text-white">{configOpcoes.ambiente === 'Homologacao' ? 'Homologação' : 'Produção'}</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Código Município (IBGE)</label>
                {editing ? (
                  <input
                    type="text"
                    value={configOpcoes.codigo_municipio}
                    onChange={e => handleConfigField('codigo_municipio', e.target.value.replace(/\D/g, ''))}
                    maxLength={7}
                    placeholder="0000000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                ) : (
                  <p className="text-sm text-white">{configOpcoes.codigo_municipio}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
