import { Navigate } from 'react-router-dom';
import { usePermisos } from '../context/PermisosContext';

export const RedirectToFirstAvailable = () => {
  // Asegúrate de que tu Context provea 'rol' (lo agregué a la desestructuración)
  const { puedeAcceder, cargando, rol } = usePermisos();

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // --- 1. Reglas de Prioridad Específicas por Rol ---
  
  // Si es Supervisor -> Órdenes de Producción
  if (rol === 'Supervisor' && puedeAcceder('ordenesProduccion')) {
    return <Navigate to="/produccion/ordenes" replace />;
  }

  // Si es Comercial -> Cotizaciones
  if (rol === 'Comercial' && puedeAcceder('cotizaciones')) {
    return <Navigate to="/ventas/cotizaciones" replace />;
  }

  // Si es Administrativo -> Órdenes de Venta
  if (rol === 'Administrativo' && puedeAcceder('ordenesVenta')) {
    return <Navigate to="/ventas/ordenes" replace />;
  }

  // --- 2. Lista de Prioridad General (Fallback para otros roles) ---
  const rutas = [
    { path: '/dashboard', modulo: 'dashboard' },
    { path: '/productos', modulo: 'productos' },
    { path: '/produccion/ordenes', modulo: 'ordenesProduccion' }, // Subí prioridad
    { path: '/ventas/cotizaciones', modulo: 'cotizaciones' },     // Subí prioridad
    { path: '/ventas/ordenes', modulo: 'ordenesVenta' },          // Subí prioridad
    { path: '/inventario/entradas', modulo: 'entradas' },
    { path: '/inventario/salidas', modulo: 'salidas' },
    { path: '/inventario/transferencias', modulo: 'transferencias' },
    { path: '/empleados', modulo: 'empleados' },
    { path: '/flota', modulo: 'flota' },
    { path: '/proveedores', modulo: 'proveedores' },
    { path: '/clientes', modulo: 'clientes' },
    { path: '/ventas/guias-remision', modulo: 'guiasRemision' },
    { path: '/ventas/guias-transportista', modulo: 'guiasTransportista' },
    { path: '/compras', modulo: 'compras' },
    { path: '/finanzas/cuentas-pago', modulo: 'cuentasPago' },
    { path: '/reportes/sire', modulo: 'reportes' }
  ];

  const primeraRutaDisponible = rutas.find(ruta => puedeAcceder(ruta.modulo));

  if (!primeraRutaDisponible) {
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
            Sin Acceso a Módulos
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Tu rol no tiene permisos para acceder a ningún módulo del sistema.
            Contacta al administrador.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  console.log('Redirigiendo a:', primeraRutaDisponible.path);
  return <Navigate to={primeraRutaDisponible.path} replace />;
};