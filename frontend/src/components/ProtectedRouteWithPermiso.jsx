import { Navigate } from 'react-router-dom';
import { usePermisos } from '../context/PermisosContext';

export const ProtectedRoute = ({ children, modulo, modulos, requiredRoles }) => {
  const { puedeAcceder, cargando, rol } = usePermisos();
  const token = localStorage.getItem('token');

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Verificación de Permiso de Módulo (si aplica)
  const modulosAVerificar = modulos || (modulo ? [modulo] : []);
  if (modulosAVerificar.length > 0 && !puedeAcceder(modulosAVerificar)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Acceso Denegado
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            No tienes permisos para acceder a este módulo.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Verificación específica de Rol (si se pasa la prop requiredRoles)
  if (requiredRoles && requiredRoles.length > 0) {
    const userRoleLower = (rol || '').toLowerCase();
    const hasRole = requiredRoles.some(r => r.toLowerCase() === userRoleLower);
    
    // El Administrador siempre debería poder ver todo, así que lo incluimos por defecto
    const isOwnerOrAdmin = ['administrador', 'admin', 'gerencia', 'gerente'].includes(userRoleLower);

    if (!hasRole && !isOwnerOrAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-carbon page-ordenes-venta">
          <div className="max-w-md w-full bg-carbon-light border border-steel rounded-lg shadow-2xl p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger/20 mb-4 border border-danger/50">
              <svg className="h-6 w-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-mist uppercase tracking-widest mb-2">
              Acceso Restringido
            </h3>
            <p className="text-sm text-wire mb-6">
              Este módulo es exclusivo para el rol de Supervisor de Planta.
            </p>
            <button
              onClick={() => window.history.back()}
              className="btn btn-outline border-steel text-mist"
            >
              Regresar
            </button>
          </div>
        </div>
      );
    }
  }

  return children;
};