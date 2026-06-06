import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LayoutDashboard, Printer, History, FileCode2, Menu, X, ShieldCheck, AlertCircle, FolderDown, LogOut, User, Users, CreditCard } from 'lucide-react'
import type { Documento, Operacao, Empresa, Subscription } from '../types'
import * as api from '../api'
import { formatCurrency } from '../utils'
import { useAuth } from '../auth/AuthContext'

export interface OutletContext {
  docs: Documento[]
  ops: Operacao[]
  empresas: Empresa[]
  activeEmpresaId: string
  activeEmpresa: Empresa | undefined
  lgpdAtivo: boolean
  selectedChave: string
  onNavigate: (tab: string) => void
  onSetActiveEmpresa: (id: string) => void
  onSetActive: (id: string) => void
  onEmpresaSelecionada: (id: string) => void
  onEmpresaAtualizada: () => Promise<void>
  onAddOperation: (op: Operacao) => void
  onAddDocuments: (docs: Documento[]) => void
  onLgpdChange: (ativo: boolean) => void
  onViewXml: (chave: string) => void
  onGenerateDanfe: (chave: string) => void
  triggerToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export default function ProtectedLayout() {
  const { logout, isAdmin, auth } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedChave, setSelectedChave] = useState<string>('')
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [state, setState] = useState<{
    docs: Documento[]; ops: Operacao[]; empresas: Empresa[]; activeEmpresaId: string
  }>({
    docs: [], ops: [], empresas: [], activeEmpresaId: '',
  })
  const [lgpdAtivo, setLgpdAtivo] = useState(false)

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    api.buscarSubscription().then(r => setSubscription(r.data)).catch(() => {})
    api.fetchLgpdAtivo().then(setLgpdAtivo).catch(() => {})
    Promise.all([
      api.fetchEmpresas(), api.fetchDocumentos(), api.fetchOperacoes(),
    ].map(p => p.catch(() => []))).then(([empresas, docs, ops]) => {
      setState(prev => ({ ...prev, empresas, docs, ops }))
    }).catch(() => {})
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

  const handleLgpdChange = (ativo: boolean) => {
    setLgpdAtivo(ativo)
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
      historico: '/historico', usuarios: '/usuarios', assinatura: '/assinatura', perfil: '/perfil',
    }
    navigate(routeMap[tab] || '/')
    setMobileMenuOpen(false)
  }

  const activeEmpresa = state.empresas.find(e => e.id === state.activeEmpresaId) || state.empresas[0]

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { id: 'documentos', label: 'Documentos', path: '/documentos', icon: FileCode2 },
    { id: 'empresas', label: 'Gestao de Empresas', path: '/empresas', icon: ShieldCheck },
    { id: 'download_lote', label: 'Exportar XMLs (ZIP)', path: '/download-lote', icon: FolderDown },
    { id: 'gerar', label: 'Gerar DANFSe', path: '/gerar-danfe', icon: Printer },
    { id: 'historico', label: 'Historico NSU', path: '/historico', icon: History },
    ...(isAdmin ? [{ id: 'usuarios' as const, label: 'Usuários', path: '/usuarios' as const, icon: Users }] : []),
    { id: 'assinatura', label: 'Assinatura', path: '/assinatura', icon: CreditCard },
    { id: 'perfil', label: 'Perfil', path: '/perfil', icon: User },
  ]

  const outletContext = {
    ...state, activeEmpresa, lgpdAtivo,
    onNavigate: handleNavigation,
    onSetActiveEmpresa: handleSetActiveEmpresa,
    onSetActive: handleSetActiveEmpresa,
    onEmpresaSelecionada: handleSetActiveEmpresa,
    onEmpresaAtualizada: handleEmpresaAtualizada,
    onAddOperation: handleAddOperation,
    onAddDocuments: handleAddDocuments,
    onLgpdChange: handleLgpdChange,
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
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-950 text-slate-300 border-r border-slate-900 p-5 shrink-0 select-none">
          {auth && (
            <div className="flex items-center gap-2.5 px-2 py-3 border-b border-slate-900">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/20 shrink-0">
                {auth.email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{auth.email}</p>
                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${isAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/50 text-slate-400'}`}>
                  {isAdmin ? 'Admin' : 'Operador'}
                </span>
              </div>
            </div>
          )}
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

        {/* MOBILE HEADER */}
        <header className="lg:hidden w-full bg-slate-950 border-b border-slate-900 h-16 flex items-center justify-between px-4 text-white shrink-0 absolute top-0 left-0 z-40 select-none">
          <div className="flex items-center gap-2 min-w-0">
            {auth && (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {auth.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-white truncate">{auth.email}</span>
              </>
            )}
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* MOBILE MENU */}
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

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto pt-20 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {subscription?.status === 'trialing' && subscription.diasRestantes <= 7 && subscription.diasRestantes > 0 && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Seu trial expira em <strong>{subscription.diasRestantes}</strong> {subscription.diasRestantes === 1 ? 'dia' : 'dias'}. <NavLink to="/assinatura" className="underline font-bold ml-1">Fazer upgrade</NavLink>
              </div>
            )}
            {subscription?.status === 'canceled' && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Assinatura cancelada. <NavLink to="/assinatura" className="underline font-bold ml-1">Ver detalhes</NavLink>
              </div>
            )}
            {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && subscription.diasRestantes <= 0 && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Assinatura expirada. <NavLink to="/assinatura" className="underline font-bold ml-1">Renovar</NavLink>
              </div>
            )}
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>
    </div>
  )
}
