import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './UI/Loading';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading message="Verificando sesión..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;