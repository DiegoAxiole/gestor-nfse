import type {
  Prestador, PrestadorInput,
  UltimoNsuResponse,
  TaskStatus, TaskIniciada,
  DocumentosPaginados,
  Agendamento, AgendamentoInput, AutomacaoLog,
  HealthCheck,
} from './api-types'

import type { Empresa, Operacao, ConfigToml, Documento as RichDocumento, TenantProfile, LoginResponse, CadastroResponse, CadastroData, UsuarioPerfil } from './types'
import { parseNfseXml } from './services/xml-parser'

export const BASE = '/api/v1'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

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

export const api = {
  // Health
  health: (): Promise<HealthCheck> =>
    requestJson('/health'),

  // Prestadores
  listarPrestadores: (): Promise<Prestador[]> =>
    requestJson('/prestadores'),

  cadastrarPrestador: (input: PrestadorInput): Promise<Prestador> => {
    const fd = new FormData()
    fd.append('cnpj', input.cnpj)
    fd.append('razao_social', input.razao_social)
    fd.append('ambiente', input.ambiente)
    fd.append('certificado_pfx', input.certificado_pfx)
    fd.append('certificado_senha', input.certificado_senha)
    return fetch(`${BASE}/prestadores`, { method: 'POST', body: fd, headers: getAuthHeaders() }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.detail) })
      return r.json()
    })
  },

  buscarPrestador: (cnpj: string): Promise<Prestador> =>
    requestJson(`/prestadores/${cnpj}`),

  atualizarPrestador: (cnpj: string, dados: {
    razao_social?: string
    ambiente?: string
    certificado_pfx?: File
    certificado_senha?: string
  }): Promise<Prestador> => {
    const fd = new FormData()
    if (dados.razao_social !== undefined) fd.append('razao_social', dados.razao_social)
    if (dados.ambiente !== undefined) fd.append('ambiente', dados.ambiente)
    if (dados.certificado_pfx !== undefined) fd.append('certificado_pfx', dados.certificado_pfx)
    if (dados.certificado_senha !== undefined) fd.append('certificado_senha', dados.certificado_senha)
    return fetch(`${BASE}/prestadores/${cnpj}`, { method: 'PUT', body: fd, headers: getAuthHeaders() }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.detail) })
      return r.json()
    })
  },

  removerPrestador: (cnpj: string): Promise<void> =>
    requestJson(`/prestadores/${cnpj}`, { method: 'DELETE' }),

  // Distribuição
  consultarDistribuicao: (body: {
    cnpj: string
    nsu?: string
    tipo_nsu?: string
  }): Promise<TaskIniciada> =>
    requestJson('/distribuicao/consultar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  ultimoNsu: (cnpj: string): Promise<UltimoNsuResponse> =>
    requestJson(`/distribuicao/ultimo-nsu?cnpj=${encodeURIComponent(cnpj)}`),

  // Tasks (background polling)
  buscarTask: (taskId: string): Promise<TaskStatus> =>
    requestJson(`/tasks/${taskId}`),

  // Documentos
  listarDocumentos: (params?: {
    cnpj?: string
    inicio?: string
    fim?: string
    page?: number
    page_size?: number
    tem_pdf?: boolean
  }): Promise<DocumentosPaginados> => {
    const qs = new URLSearchParams()
    if (params?.cnpj) qs.set('cnpj', params.cnpj)
    if (params?.inicio) qs.set('inicio', params.inicio)
    if (params?.fim) qs.set('fim', params.fim)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    if (params?.tem_pdf !== undefined) qs.set('tem_pdf', String(params.tem_pdf))
    const q = qs.toString()
    return requestJson(`/documentos${q ? `?${q}` : ''}`)
  },

  baixarXml: (chaveAcesso: string): Promise<string> =>
    requestText(`/documentos/${chaveAcesso}/xml`),

  baixarPdf: (chaveAcesso: string): Promise<Blob> =>
    requestBlob(`/documentos/${chaveAcesso}/pdf`),

  // Automação
  agendar: (body: AgendamentoInput): Promise<Agendamento> =>
    requestJson('/automacao/agendar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listarAgendamentos: (): Promise<Agendamento[]> =>
    requestJson('/automacao/agendamentos'),

  removerAgendamento: (id: number): Promise<void> =>
    requestJson(`/automacao/agendamentos/${id}`, { method: 'DELETE' }),

  listarLogs: (params?: {
    prestador_cnpj?: string
    limite?: number
  }): Promise<AutomacaoLog[]> => {
    const qs = new URLSearchParams()
    if (params?.prestador_cnpj) qs.set('prestador_cnpj', params.prestador_cnpj)
    if (params?.limite) qs.set('limite', String(params.limite))
    const q = qs.toString()
    return requestJson(`/automacao/logs${q ? `?${q}` : ''}`)
  },
}

// Funções adaptadoras — views chamam estas via import * as api
// Importam o módulo inteiro e acessam as funções pelo nome.

export async function fetchEmpresas(): Promise<Empresa[]> {
  const prestadores = await requestJson<any[]>('/prestadores')
  return prestadores.map(p => ({
    id: p.cnpj,
    cnpj: p.cnpj,
    razao_social: p.razao_social,
    ambiente: p.ambiente,
    certificado_caminho: p.certificado_nome ?? '',
    validade_fim: p.certificado_validade ?? '',
    codigo_municipio: p.codigo_municipio ?? '3550308',
  }))
}

export async function fetchDocumentos(pageSize = 500): Promise<RichDocumento[]> {
  const allDocs: RichDocumento[] = [];
  let page = 1;
  while (true) {
    const result = await requestJson<any>(`/documentos?page=${page}&page_size=${pageSize}`)
    const docs = (result.documentos ?? []).map((d: any) => {
      const xml = d.xml_nfse ?? ''
      const parsed = xml ? parseNfseXml(xml) : null
      return {
        chave_acesso: d.chave_acesso,
        nsu: d.nsu,
        prestador_cnpj: d.prestador_cnpj,
        xml_nfse: xml,
        data_importacao: d.created_at ?? '',
        data_emissao: d.data_emissao ?? '',
        emissao_dh: d.emissao_dh ?? '',
        valor_servicos: parsed?.valor_servicos ?? 0,
        prestador_nome: parsed?.prestador_nome ?? '',
        tomador_nome: parsed?.tomador_nome ?? '',
        tomador_cnpj: parsed?.tomador_cnpj ?? '',
        numero_nota: parsed?.numero_nota ?? '',
        tem_pdf: d.tem_pdf ?? false,
      }
    })
    allDocs.push(...docs)
    if (allDocs.length >= result.total || docs.length === 0) break
    page++
  }
  return allDocs
}

export async function fetchOperacoes(): Promise<Operacao[]> {
  const list = await requestJson<any[]>('/operacoes')
  return list.map(o => ({
    id: String(o.id),
    data: o.created_at ?? '',
    tipo: o.tipo ?? 'DISTRIBUICAO',
    nsu_consultado: o.nsu_consultado ?? null,
    ultimo_nsu: o.ultimo_nsu ?? '',
    status: o.status ?? 'ERRO',
    xml_request: o.prestador_cnpj
      ? `<NFSe><CNPJ>${o.prestador_cnpj}</CNPJ></NFSe>`
      : '',
    xml_response: '',
    lote_dfe_count: o.qtd_documentos ?? 0,
  }))
}

export async function fetchConfig(): Promise<ConfigToml> {
  const cfg = await requestJson<any>('/config')
  return {
    prestador: {
      cnpj: cfg.cnpj ?? '',
      razao_social: cfg.razao_social ?? '',
    },
    certificado: { caminho: cfg.certificado_caminho ?? '', senha_mascarada: cfg.certificado_senha_mascarada ?? '' },
    geral: { ambiente: cfg.ambiente ?? 'Homologacao', codigo_municipio: cfg.codigo_municipio ?? '3550308' },
    lgpd_ativo: cfg.lgpd_ativo ?? false,
  }
}

export async function saveConfigToml(data: ConfigToml): Promise<void> {
  await requestJson('/config', {
    method: 'PUT',
    body: JSON.stringify({
      cnpj: data.prestador.cnpj,
      razao_social: data.prestador.razao_social,
      ambiente: data.geral.ambiente,
      codigo_municipio: data.geral.codigo_municipio,
      certificado_caminho: data.certificado.caminho || undefined,
      certificado_senha: data.certificado.senha_mascarada === '****' ? undefined : data.certificado.senha_mascarada,
      lgpd_ativo: data.lgpd_ativo ?? false,
    }),
  })
}

export interface DocumentosPaginatedResult {
  documentos: RichDocumento[]
  total: number
}

export async function buscarDocumentosPaginated(params: {
  cnpj?: string
  inicio?: string
  fim?: string
  page?: number
  page_size?: number
  tem_pdf?: boolean
}): Promise<DocumentosPaginatedResult> {
  const result = await api.listarDocumentos(params) as any
  const documentos = (result.documentos ?? []).map((d: any) => {
    const xml = d.xml_nfse ?? ''
    const parsed = xml ? parseNfseXml(xml) : null
    return {
      chave_acesso: d.chave_acesso,
      nsu: d.nsu,
      prestador_cnpj: d.prestador_cnpj,
      xml_nfse: xml,
      data_importacao: d.created_at ?? '',
      data_emissao: d.data_emissao ?? '',
      emissao_dh: d.emissao_dh ?? '',
      valor_servicos: parsed?.valor_servicos ?? 0,
      prestador_nome: parsed?.prestador_nome ?? '',
      tomador_nome: parsed?.tomador_nome ?? '',
      tomador_cnpj: parsed?.tomador_cnpj ?? '',
      numero_nota: parsed?.numero_nota ?? '',
      tem_pdf: d.tem_pdf ?? false,
    }
  })
  return { documentos, total: result.total ?? documentos.length }
}

// --- Views (DashboardView, EmpresasView, DownloadLoteView) ---

export async function consultarDistribuicao(cnpj: string): Promise<TaskIniciada> {
  return api.consultarDistribuicao({ cnpj })
}

export async function buscarTask(taskId: string): Promise<TaskStatus> {
  return api.buscarTask(taskId)
}

export async function pollTask(taskId: string, intervalMs = 2000): Promise<TaskStatus> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const task = await api.buscarTask(taskId)
        if (task.status === "completed" || task.status === "error") {
          clearInterval(handle)
          resolve(task)
        }
      } catch (err: any) {
        clearInterval(handle)
        reject(err)
      }
    }
    const handle = setInterval(poll, intervalMs)
    poll()
  })
}

export async function downloadZip(cnpj: string, inicio: string, fim: string): Promise<Blob> {
  const qs = new URLSearchParams({ cnpj, inicio, fim })
  return requestBlob(`/documentos/download-zip?${qs}`)
}

export async function deleteEmpresa(cnpj: string): Promise<void> {
  await requestJson(`/prestadores/${cnpj}`, { method: 'DELETE' })
}

export async function createEmpresa(data: Empresa, certPfx?: File): Promise<void> {
  const fd = toFormData(data)
  if (certPfx) fd.append('certificado_pfx', certPfx)
  await fetch(`${BASE}/prestadores`, { method: 'POST', body: fd, headers: getAuthHeaders() }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail) })
  })
}

export async function updateEmpresa(cnpj: string, data: Empresa, certPfx?: File): Promise<void> {
  const fd = new FormData()
  fd.append('razao_social', data.razao_social)
  fd.append('ambiente', data.ambiente)
  if (data.certificado_senha) fd.append('certificado_senha', data.certificado_senha)
  if (certPfx) fd.append('certificado_pfx', certPfx)
  await fetch(`${BASE}/prestadores/${cnpj}`, { method: 'PUT', body: fd, headers: getAuthHeaders() }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail) })
  })
}

export async function uploadCertificado(
  cnpj: string, file: File, senha: string
): Promise<{ caminho_arquivo?: string; data_validade?: string; cnpj_extraido?: string; razao_extraida?: string }> {
  const fd = new FormData()
  if (cnpj) fd.append('cnpj', cnpj)
  fd.append('certificado_pfx', file)
  fd.append('senha', senha)
  const res = await fetch(`${BASE}/prestadores/upload-certificado`, { method: 'POST', body: fd, headers: getAuthHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function login(email: string, senha: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  })
}

export async function cadastrar(data: CadastroData): Promise<CadastroResponse> {
  return requestJson<CadastroResponse>('/auth/cadastrar', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function buscarTenant(): Promise<{ data: TenantProfile }> {
  return requestJson<{ data: TenantProfile }>('/tenant', { method: 'GET' })
}

export async function atualizarTenant(data: Partial<TenantProfile>): Promise<{ data: TenantProfile }> {
  return requestJson<{ data: TenantProfile }>('/tenant', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function listarUsuarios(): Promise<{ data: UsuarioPerfil[] }> {
  return requestJson<{ data: UsuarioPerfil[] }>('/usuarios')
}

export async function criarUsuario(data: { email: string; nome?: string; papel: string; senha: string }): Promise<{ data: UsuarioPerfil }> {
  return requestJson<{ data: UsuarioPerfil }>('/usuarios', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function alterarPapelUsuario(usuarioId: number, papel: string): Promise<{ data: UsuarioPerfil }> {
  return requestJson<{ data: UsuarioPerfil }>(`/usuarios/${usuarioId}/papel`, {
    method: 'PATCH',
    body: JSON.stringify({ papel }),
  })
}

export async function removerUsuario(usuarioId: number): Promise<void> {
  await requestJson<void>(`/usuarios/${usuarioId}`, { method: 'DELETE' })
}

function toFormData(data: Empresa): FormData {
  const fd = new FormData()
  fd.append('cnpj', data.cnpj)
  fd.append('razao_social', data.razao_social)
  fd.append('ambiente', data.ambiente)
  if (data.certificado_senha) fd.append('certificado_senha', data.certificado_senha)
  return fd
}
