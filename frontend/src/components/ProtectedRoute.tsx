import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Spinner';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
