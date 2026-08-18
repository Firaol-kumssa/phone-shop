import { Navigate, Outlet } from 'react-router-dom';
import { session } from '@/services/api';

export function ProtectedRoute() {
  return session.token() ? <Outlet /> : <Navigate to="/login" replace />;
}
