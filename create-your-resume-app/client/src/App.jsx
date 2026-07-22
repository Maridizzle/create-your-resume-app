import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Input from './pages/Input';
import ClientsList from './pages/ClientsList';
import ChatPlaceholder from './pages/ChatPlaceholder';
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
              <ChatPlaceholder />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/input" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
