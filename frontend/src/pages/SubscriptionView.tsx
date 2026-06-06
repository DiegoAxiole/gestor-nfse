import { useState, useEffect } from 'react'
import { buscarSubscription, cancelarSubscription, upgradeSubscription } from '../api'
import type { Subscription } from '../types'
import { CreditCard, AlertCircle, CheckCircle, ShieldCheck, Copy } from 'lucide-react'
import PlanComparison from '../components/PlanComparison'

export default function SubscriptionView() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [selectedPlano, setSelectedPlano] = useState('basico')
  const [selectedPeriodo, setSelectedPeriodo] = useState('mensal')
  const [selectedPayment, setSelectedPayment] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX')
  const [upgrading, setUpgrading] = useState(false)
  const [paymentLink, setPaymentLink] = useState('')

  const carregar = () => {
    setLoading(true)
    buscarSubscription()
      .then(res => setSub(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(carregar, [])

  const handleCancelar = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? O acesso será bloqueado ao final do período atual.')) return
    setCanceling(true)
    setError('')
    try {
      const res = await cancelarSubscription()
      setSub(res.data)
      setSuccess('Assinatura cancelada com sucesso.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCanceling(false)
    }
  }

  const handleUpgrade = async () => {
    setUpgrading(true)
    setError('')
    try {
      const res = await upgradeSubscription({
        plano: selectedPlano,
        periodo: selectedPeriodo,
        payment_method: selectedPayment,
      })
      setSub(res.data)
      setPaymentLink(res.data.payment_link || '')
      setSuccess('Assinatura criada! Aguarde a confirmação do pagamento.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpgrading(false)
    }
  }

  const copyPix = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink)
      setSuccess('Link copiado!')
      setTimeout(() => setSuccess(''), 2000)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><ShieldCheck className="w-3 h-3" />Ativo</span>
      case 'trialing': return <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><ShieldCheck className="w-3 h-3" />Trial</span>
      case 'pending': return <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><AlertCircle className="w-3 h-3" />Pendente</span>
      case 'canceled': return <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3 h-3" />Cancelado</span>
      default: return <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const progresso = sub ? Math.max(0, Math.min(100, Math.round(((30 - sub.diasRestantes) / 30) * 100))) : 0

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-indigo-400" />
        <h1 className="text-xl font-bold text-white">Assinatura</h1>
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {paymentLink && (
        <div className="bg-slate-900 border border-indigo-500/20 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-white">Pagamento Pendente</h2>
          <p className="text-xs text-slate-400">Clique no link abaixo para pagar:</p>
          <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-3 border border-slate-800">
            <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-xs underline truncate flex-1">
              {paymentLink}
            </a>
            <button onClick={copyPix} className="text-slate-400 hover:text-white p-1 cursor-pointer">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {sub && (
        <>
          {/* Current plan status card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</p>
                {getStatusBadge(sub.status)}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Plano</p>
                <p className="text-white text-sm font-bold mt-1">
                  {sub.plano === 'trial' ? 'Trial Gratuito' : sub.plano === 'basico' ? 'Básico' : sub.plano === 'profissional' ? 'Profissional' : sub.plano}
                </p>
              </div>
            </div>

            {(sub.status === 'trialing' || sub.status === 'active') && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Dias restantes</span>
                  <span className={`font-bold ${sub.diasRestantes <= 3 ? 'text-rose-400' : sub.diasRestantes <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {sub.diasRestantes} {sub.diasRestantes === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progresso > 80 ? 'bg-rose-500' : progresso > 50 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Início</p>
                <p className="text-white text-sm mt-1">{new Date(sub.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fim do período</p>
                <p className="text-white text-sm mt-1">{new Date(sub.periodo_fim).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {sub.cancelado_em && (
              <div className="pt-2 border-t border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cancelado em</p>
                <p className="text-rose-400 text-sm mt-1">{new Date(sub.cancelado_em).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </div>

          {/* Plan selection (only for trial/canceled) */}
          {(sub.status === 'trialing' || sub.status === 'canceled' || sub.status === 'pending') && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-white">Escolha seu plano</h2>
              <PlanComparison selected={selectedPlano} onSelect={setSelectedPlano} />

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Período</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'mensal', label: 'Mensal' },
                    { id: 'trimestral', label: 'Trimestral' },
                    { id: 'anual', label: 'Anual' },
                  ].map(p => (
                    <button key={p.id} onClick={() => setSelectedPeriodo(p.id)}
                      className={`p-3 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${selectedPeriodo === p.id ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Forma de pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'PIX' as const, label: 'Pix' },
                    { id: 'BOLETO' as const, label: 'Boleto' },
                    { id: 'CREDIT_CARD' as const, label: 'Cartão' },
                  ].map(p => (
                    <button key={p.id} onClick={() => setSelectedPayment(p.id)}
                      className={`p-3 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${selectedPayment === p.id ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleUpgrade} disabled={upgrading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-3 px-5 rounded-lg transition-all cursor-pointer"
              >
                {upgrading ? 'Aguarde...' : 'Assinar Agora'}
              </button>
            </div>
          )}

          {/* Cancel button */}
          {sub.status !== 'canceled' && sub.status !== 'pending' && (
            <button onClick={handleCancelar} disabled={canceling}
              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/30 text-xs font-bold py-2.5 px-5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {canceling ? 'Cancelando...' : 'Cancelar Assinatura'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
