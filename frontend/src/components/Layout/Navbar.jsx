import { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ordenesProduccionAPI } from '../../config/api';
import './Navbar.css';

function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState([]);
  const [showNotificaciones, setShowNotificaciones] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 120000);
    return () => clearInterval(interval);
  }, []);

  const cargarNotificaciones = async () => {
    try {
      setLoading(true);
      const response = await ordenesProduccionAPI.getAll({ 
        estado: 'Pendiente,En Proceso' 
      });
      
      if (response.data.success) {
        const ordenes = response.data.data || [];
        generarNotificaciones(ordenes);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const generarNotificaciones = (ordenes) => {
    const notifs = [];
    const ahora = new Date();

    ordenes.forEach(orden => {
        const fechaReferencia = orden.estado === 'En Proceso' ? orden.fecha_inicio : orden.fecha_creacion;
        const fechaDoc = new Date(fechaReferencia);

        if (orden.estado === 'Pendiente') {
            notifs.push({
                id: `p-${orden.id_orden}`,
                titulo: 'Orden en Espera',
                mensaje: `${orden.numero_orden}: ${orden.producto} está listo para iniciar.`,
                fecha: fechaDoc,
                id_orden: orden.id_orden,
                color: 'warning'
            });
        } else if (orden.estado === 'En Proceso') {
            notifs.push({
                id: `e-${orden.id_orden}`,
                titulo: 'Producción Activa',
                mensaje: `${orden.numero_orden}: Fabricando ${orden.producto}.`,
                fecha: fechaDoc,
                id_orden: orden.id_orden,
                color: 'info'
            });
        }
    });

    notifs.sort((a, b) => b.fecha - a.fecha);
    setNotificaciones(notifs.slice(0, 10));
  };

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
    navigate(`/produccion/ordenes/${notif.id_orden}`);
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
        {/* Notificaciones */}
        <div className="navbar-notifications-container">
          <button 
            className="navbar-icon-btn navbar-notifications-btn" 
            onClick={() => setShowNotificaciones(!showNotificaciones)}
          >
            <Bell size={20} />
            {notificaciones.length > 0 && (
              <span className="navbar-notifications-badge">
                {notificaciones.length}
              </span>
            )}
          </button>

          {/* Panel de Notificaciones */}
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

              <div className="navbar-notifications-body">
                {loading ? (
                  <div className="navbar-notifications-loading">
                    Cargando...
                  </div>
                ) : notificaciones.length === 0 ? (
                  <div className="navbar-notifications-empty">
                    <Bell size={48} className="text-gray-300" />
                    <p>No hay notificaciones nuevas</p>
                  </div>
                ) : (
                  notificaciones.map(notif => (
                    <div 
                      key={notif.id}
                      className={`navbar-notification-item navbar-notification-${notif.color}`}
                      onClick={() => handleNotificacionClick(notif)}
                    >
                      <div className="navbar-notification-content">
                        <h4>{notif.titulo}</h4>
                        <p>{notif.mensaje}</p>
                        <span className="navbar-notification-time">
                          {formatearTiempo(notif.fecha)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notificaciones.length > 0 && (
                <div className="navbar-notifications-footer">
                  <button 
                    onClick={() => {
                      navigate('/produccion/ordenes');
                      setShowNotificaciones(false);
                    }}
                  >
                    Ver todas las órdenes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Usuario */}
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

        {/* Logout - CAMBIADO onClick */}
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