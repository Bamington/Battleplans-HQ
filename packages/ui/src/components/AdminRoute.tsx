import { Navigate } from 'react-router-dom';
import { useIsAdmin } from '../hooks/useIsAdmin';

interface Props {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: Props) {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
