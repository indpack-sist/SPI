import { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut, X, ShoppingCart, Factory, Info, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificacionesAPI } from '../../config/api';
import './Navbar.css';

function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [showNotificaciones, setShowNotificaciones] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 60000);
    return () => clearInterval(interval);
  }, []);

  const cargarNotificaciones = async () => {
    try {
      setLoading(true);
      const response = await notificacionesAPI.getAll();
      if (response.data.success) {
        setNotificaciones(response.data.data);
        setNoLeidas(response.data.no_leidas);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarTodasComoLeidas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas();
      cargarNotificaciones();
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  const handleNotificacionClick = async (notif) => {
    if (!notif.leido) {
      try {
        await notificacionesAPI.marcarLeida(notif.id_notificacion);
        setNoLeidas(prev => Math.max(0, prev - 1));
        setNotificaciones(prev => prev.map(n => 
          n.id_notificacion === notif.id_notificacion ? { ...n, leido: 1 } : n
        ));
      } catch (error) {
        console.error('Error al marcar notificación:', error);
      }
    }
    
    setShowNotificaciones(false);
    if (notif.ruta_destino) {
      navigate(notif.ruta_destino);
    }
  };

  const formatearTiempo = (fecha) => {
    const fechaObj = new Date(fecha);
    const ahora = new Date();
    const diff = Math.floor((ahora - fechaObj) / 1000);

    if (diff < 60) return 'hace unos segundos';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    
    return fechaObj.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getIconoNotificacion = (tipo) => {
    switch(tipo) {
      case 'success': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'info': return Info;
      default: return Bell;
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
            {noLeidas > 0 && (
              <span className="navbar-notifications-badge">
                {noLeidas}
              </span>
            )}
          </button>

          {showNotificaciones && (
            <div className="navbar-notifications-panel">
              <div className="navbar-notifications-header">
                <h3>Notificaciones</h3>
                <div className="flex gap-2">
                  {noLeidas > 0 && (
                    <button 
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={marcarTodasComoLeidas}
                    >
                      Marcar todo leído
                    </button>
                  )}
                  <button 
                    className="navbar-notifications-close"
                    onClick={() => setShowNotificaciones(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="navbar-notifications-body">
                {loading && notificaciones.length === 0 ? (
                  <div className="navbar-notifications-loading">
                    Cargando...
                  </div>
                ) : notificaciones.length === 0 ? (
                  <div className="navbar-notifications-empty">
                    <Bell size={48} className="text-gray-300" />
                    <p>No hay notificaciones</p>
                  </div>
                ) : (
                  notificaciones.map(notif => {
                    const Icono = getIconoNotificacion(notif.tipo);
                    return (
                      <div 
                        key={notif.id_notificacion}
                        className={`navbar-notification-item ${notif.leido ? 'read' : 'unread'}`}
                        onClick={() => handleNotificacionClick(notif)}
                      >
                        <div className={`navbar-notification-icon ${notif.tipo || 'info'}`}>
                          <Icono size={20} />
                        </div>
                        <div className="navbar-notification-content">
                          <h4>{notif.titulo}</h4>
                          <p>{notif.mensaje}</p>
                          <span className="navbar-notification-time">
                            {formatearTiempo(notif.fecha_creacion)}
                          </span>
                        </div>
                        {!notif.leido && <div className="navbar-notification-dot"></div>}
                      </div>
                    );
                  })
                )}
              </div>
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