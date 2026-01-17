import { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut, X, ShoppingCart, Factory } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ordenesProduccionAPI } from '../../config/api';
import { useNotificacionesCompras } from './NotificacionesCompras';
import './Navbar.css';

function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [notificacionesProduccion, setNotificacionesProduccion] = useState([]);
  const { notificaciones: notificacionesCompras, loading: loadingCompras } = useNotificacionesCompras();
  const [showNotificaciones, setShowNotificaciones] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState('todas');

  useEffect(() => {
    cargarNotificacionesProduccion();
    const interval = setInterval(cargarNotificacionesProduccion, 120000);
    return () => clearInterval(interval);
  }, []);

  const cargarNotificacionesProduccion = async () => {
    try {
      setLoading(true);
      const response = await ordenesProduccionAPI.getAll({ 
        estado: 'Pendiente,En Proceso' 
      });
      
      if (response.data.success) {
        const ordenes = response.data.data || [];
        generarNotificacionesProduccion(ordenes);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones de producción:', error);
    } finally {
      setLoading(false);
    }
  };

  const generarNotificacionesProduccion = (ordenes) => {
    const notifs = [];
    ordenes.forEach(orden => {
      const fechaReferencia = orden.estado === 'En Proceso' ? orden.fecha_inicio : orden.fecha_creacion;
      const fechaDoc = new Date(fechaReferencia);

      if (orden.estado === 'Pendiente') {
        notifs.push({
          id: `p-${orden.id_orden}`,
          titulo: 'Orden en Espera',
          mensaje: `${orden.numero_orden}: ${orden.producto} está listo para iniciar.`,
          fecha: fechaDoc,
          link: `/produccion/ordenes/${orden.id_orden}`,
          tipo: 'warning',
          categoria: 'produccion'
        });
      } else if (orden.estado === 'En Proceso') {
        notifs.push({
          id: `e-${orden.id_orden}`,
          titulo: 'Producción Activa',
          mensaje: `${orden.numero_orden}: Fabricando ${orden.producto}.`,
          fecha: fechaDoc,
          link: `/produccion/ordenes/${orden.id_orden}`,
          tipo: 'info',
          categoria: 'produccion'
        });
      }
    });

    notifs.sort((a, b) => b.fecha - a.fecha);
    setNotificacionesProduccion(notifs.slice(0, 10));
  };

  const todasLasNotificaciones = [
    ...notificacionesProduccion.map(n => ({ ...n, categoria: 'produccion' })),
    ...notificacionesCompras.map(n => ({ ...n, categoria: 'compras', fecha: new Date() }))
  ];

  const notificacionesFiltradas = categoriaActiva === 'todas' 
    ? todasLasNotificaciones 
    : todasLasNotificaciones.filter(n => n.categoria === categoriaActiva);

  const totalNotificaciones = todasLasNotificaciones.length;
  const notificacionesComprasCant = notificacionesCompras.length;
  const notificacionesProduccionCant = notificacionesProduccion.length;

  const formatearTiempo = (fecha) => {
    const ahora = new Date();
    const diff = Math.floor((ahora - fecha) / 1000);

    if (diff < 60) return 'hace unos segundos';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    
    return fecha.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleNotificacionClick = (notif) => {
    navigate(notif.link);
    setShowNotificaciones(false);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      if (logout) {
        logout();
      }
      
      navigate('/login', { replace: true });
      window.location.href = '/login';
    } catch (error) {
      console.error('Error en logout:', error);
      window.location.href = '/login';
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-toggle" onClick={onToggleSidebar}>
          <Menu size={24} />
        </button>
        <h1 className="navbar-title">Sistema de Inventario y Producción</h1>
      </div>

      <div className="navbar-right">
        <div className="navbar-notifications-container">
          <button 
            className="navbar-icon-btn navbar-notifications-btn" 
            onClick={() => setShowNotificaciones(!showNotificaciones)}
          >
            <Bell size={20} />
            {totalNotificaciones > 0 && (
              <span className="navbar-notifications-badge">
                {totalNotificaciones}
              </span>
            )}
          </button>

          {showNotificaciones && (
            <div className="navbar-notifications-panel">
              <div className="navbar-notifications-header">
                <h3>Notificaciones</h3>
                <button 
                  className="navbar-notifications-close"
                  onClick={() => setShowNotificaciones(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="navbar-notifications-filters">
                <button 
                  className={`navbar-notification-filter ${categoriaActiva === 'todas' ? 'active' : ''}`}
                  onClick={() => setCategoriaActiva('todas')}
                >
                  Todas ({totalNotificaciones})
                </button>
                <button 
                  className={`navbar-notification-filter ${categoriaActiva === 'compras' ? 'active' : ''}`}
                  onClick={() => setCategoriaActiva('compras')}
                >
                  <ShoppingCart size={14} />
                  Compras ({notificacionesComprasCant})
                </button>
                <button 
                  className={`navbar-notification-filter ${categoriaActiva === 'produccion' ? 'active' : ''}`}
                  onClick={() => setCategoriaActiva('produccion')}
                >
                  <Factory size={14} />
                  Producción ({notificacionesProduccionCant})
                </button>
              </div>

              <div className="navbar-notifications-body">
                {(loading || loadingCompras) ? (
                  <div className="navbar-notifications-loading">
                    Cargando...
                  </div>
                ) : notificacionesFiltradas.length === 0 ? (
                  <div className="navbar-notifications-empty">
                    <Bell size={48} className="text-gray-300" />
                    <p>No hay notificaciones nuevas</p>
                  </div>
                ) : (
                  notificacionesFiltradas.map(notif => {
                    const Icono = notif.icono || Bell;
                    return (
                      <div 
                        key={notif.id}
                        className={`navbar-notification-item navbar-notification-${notif.tipo}`}
                        onClick={() => handleNotificacionClick(notif)}
                      >
                        <div className="navbar-notification-icon">
                          <Icono size={20} />
                        </div>
                        <div className="navbar-notification-content">
                          <h4>
                            {notif.titulo}
                            {notif.categoria && (
                              <span className={`navbar-notification-category ${notif.categoria}`}>
                                {notif.categoria === 'compras' ? 'Compras' : 'Producción'}
                              </span>
                            )}
                          </h4>
                          <p>{notif.mensaje}</p>
                          <span className="navbar-notification-time">
                            {formatearTiempo(notif.fecha)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {notificacionesFiltradas.length > 0 && (
                <div className="navbar-notifications-footer">
                  <button 
                    onClick={() => {
                      navigate(categoriaActiva === 'compras' ? '/compras' : '/produccion/ordenes');
                      setShowNotificaciones(false);
                    }}
                  >
                    Ver todas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="navbar-user">
          <User size={20} />
          <div className="navbar-user-info">
            <span className="navbar-user-name">
              {user?.nombre || 'Usuario'}
            </span>
            <span className="navbar-user-role">
              {user?.rol || 'Sin rol'}
            </span>
          </div>
        </div>

        <button 
          className="navbar-icon-btn navbar-logout" 
          onClick={handleLogout}
          title="Cerrar Sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}

export default Navbar;