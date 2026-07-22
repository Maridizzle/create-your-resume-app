import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Input from './pages/Input';
import ClientsList from './pages/ClientsList';
import Chat from './pages/Chat';
import Checklist from './pages/Checklist';
import Link from './pages/Link';
import Results from './pages/Results';
import Output from './pages/Output';
import AuthGuard from './components/AuthGuard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/input"
          element={
            <AuthGuard>
              <Input />
            </AuthGuard>
          }
        />
        <Route
          path="/clients"
          element={
            <AuthGuard>
              <ClientsList />
            </AuthGuard>
          }
        />
        <Route
          path="/clients/:id/chat"
          element={
            <AuthGuard>
              <Chat />
            </AuthGuard>
          }
        />
        <Route
          path="/clients/:id/checklist"
          element={
            <AuthGuard>
              <Checklist />
            </AuthGuard>
          }
        />
        <Route
          path="/clients/:id/link"
          element={
            <AuthGuard>
              <Link />
            </AuthGuard>
          }
        />
        <Route
          path="/clients/:id/results"
          element={
            <AuthGuard>
              <Results />
            </AuthGuard>
          }
        />
        <Route
          path="/clients/:id/output"
          element={
            <AuthGuard>
              <Output />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/input" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
