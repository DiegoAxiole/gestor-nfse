import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './auth/LoginPage'
import CadastroPage from './auth/CadastroPage'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedLayout from './components/ProtectedLayout'
import DashboardView from './components/DashboardView'
import DocumentosView from './pages/DocumentosView'
import EmpresasView from './pages/EmpresasView'
import DownloadLoteView from './pages/DownloadLoteView'
import GerarDanfeView from './pages/GerarDanfeView'
import HistoricoView from './pages/HistoricoView'
import ConfiguracoesView from './pages/ConfiguracoesView'
import PerfilView from './pages/PerfilView'
import UsuariosView from './pages/UsuariosView'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastrar" element={<CadastroPage />} />
      <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
        <Route index element={<DashboardView />} />
        <Route path="documentos" element={<DocumentosView />} />
        <Route path="empresas" element={<EmpresasView />} />
        <Route path="download-lote" element={<DownloadLoteView />} />
        <Route path="gerar-danfe" element={<GerarDanfeView />} />
        <Route path="historico" element={<HistoricoView />} />
        <Route path="configuracoes" element={<ConfiguracoesView />} />
        <Route path="usuarios" element={<UsuariosView />} />
        <Route path="perfil" element={<PerfilView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
