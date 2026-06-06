import { Check, X } from 'lucide-react'

interface PlanData {
  id: string
  nome: string
  preco: string
  prestadores: number | string
  documentos: number | string
  usuarios: number
  danfse: boolean
  loteZip: boolean
  destaque?: boolean
}

const PLANOS: PlanData[] = [
  {
    id: 'basico',
    nome: 'Básico',
    preco: 'R$ 29/mês',
    prestadores: 2,
    documentos: '100/mês',
    usuarios: 3,
    danfse: true,
    loteZip: false,
    destaque: true,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 'R$ 79/mês',
    prestadores: 10,
    documentos: '2.000/mês',
    usuarios: 10,
    danfse: true,
    loteZip: true,
  },
]

interface Props {
  selected?: string
  onSelect?: (id: string) => void
}

export default function PlanComparison({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PLANOS.map(plan => (
        <button
          key={plan.id}
          onClick={() => onSelect?.(plan.id)}
          className={`p-6 rounded-xl border-2 text-left transition-all cursor-pointer ${
            selected === plan.id
              ? 'border-indigo-500 bg-indigo-600/10'
              : 'border-slate-800 bg-slate-900 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-bold">{plan.nome}</h3>
            {plan.destaque && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                Popular
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-white mb-4">{plan.preco}</p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              {plan.danfse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-slate-300">DANFSe</span>
            </li>
            <li className="flex items-center gap-2">
              {plan.loteZip ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-slate-300">Download ZIP</span>
            </li>
            <li className="text-slate-400">Até {plan.prestadores} prestadores</li>
            <li className="text-slate-400">Até {plan.documentos} documentos</li>
            <li className="text-slate-400">Até {plan.usuarios} usuários</li>
          </ul>
        </button>
      ))}
    </div>
  )
}
