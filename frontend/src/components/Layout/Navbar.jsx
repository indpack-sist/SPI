import { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut, X, ShoppingCart, Factory, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { notificacionesAPI } from '../../config/api';
import './Navbar.css';

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:3000';

function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [showNotificaciones, setShowNotificaciones] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    cargarNotificaciones();
  }, []);

  useEffect(() => {
    if (user?.id_empleado) {
      console.log('Conectando WebSocket a:', SOCKET_URL);
      console.log('ID Empleado:', user.id_empleado);
      
      const newSocket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('WebSocket conectado, emitiendo identificar_usuario');
        newSocket.emit('identificar_usuario', user.id_empleado);
      });

      newSocket.on('nueva_notificacion', (notif) => {
        console.log('Nueva notificación recibida:', notif);
        setNotificaciones(prev => [notif, ...prev]);
        setNoLeidas(prev => prev + 1);
        
        try {
          const audio = new Audio('/assets/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {
          console.error("No se pudo reproducir audio");
        }
      });

      newSocket.on('disconnect', () => {
        console.log('WebSocket desconectado');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Error de conexión WebSocket:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const cargarNotificaciones = async () => {
    try {
      const response = await notificacionesAPI.getAll();
      if (response.data.success) {
        setNotificaciones(response.data.data);
        setNoLeidas(response.data.no_leidas);
      }
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    }
  };

  const marcarTodasComoLeidas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas();
      setNotificaciones(prev => prev.map(n => ({ ...n, leido: 1 })));
      setNoLeidas(0);
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  const handleNotificacionClick = async (notif, e) => {
    if (!notif.leido) {
      try {
        await notificacionesAPI.marcarLeida(notif.id_notificacion);
        setNotificaciones(prev => prev.map(n => 
          n.id_notificacion === notif.id_notificacion ? { ...n, leido: 1 } : n
        ));
        setNoLeidas(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error al marcar notificación:', error);
      }
    }
    
    setShowNotificaciones(false);
    
    if (notif.ruta_destino && (!e || e.target.closest('.toast-close-btn') === null)) {
      navigate(notif.ruta_destino);
    }
  };

  const handleCloseToast = async (e, notif) => {
    e.stopPropagation();
    try {
      await notificacionesAPI.marcarLeida(notif.id_notificacion);
      setNotificaciones(prev => prev.map(n => 
        n.id_notificacion === notif.id_notificacion ? { ...n, leido: 1 } : n
      ));
      setNoLeidas(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const formatearTiempo = (fecha) => {
    const fechaObj = new Date(fecha);
    const ahora = new Date();
    const diff = Math.floor((ahora - fechaObj) / 1000);

    if (diff < 60) return 'hace unos segundos';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return fechaObj.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  const handleLogout = () => {
    if (socket) socket.disconnect();
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (logout) logout();
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
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return Bell;
    }
  };

  const notificacionesActivas = notificaciones.filter(n => !n.leido);

  return (
    <>
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
                <span className="navbar-notifications-badge">{noLeidas}</span>
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
                    <button className="navbar-notifications-close" onClick={() => setShowNotificaciones(false)}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="navbar-notifications-body">
                  {notificaciones.length === 0 ? (
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
                          onClick={(e) => handleNotificacionClick(notif, e)}
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
              <span className="navbar-user-name">{user?.nombre || 'Usuario'}</span>
              <span className="navbar-user-role">{user?.rol || 'Sin rol'}</span>
            </div>
          </div>

          <button className="navbar-icon-btn navbar-logout" onClick={handleLogout} title="Cerrar Sesión">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="notification-toast-container">
        {notificacionesActivas.map((notif) => {
            const Icono = getIconoNotificacion(notif.tipo);
            return (
                <div 
                    key={`toast-${notif.id_notificacion}`} 
                    className={`notification-toast toast-${notif.tipo || 'info'}`}
                    onClick={(e) => handleNotificacionClick(notif, e)}
                >
                    <div className="toast-icon">
                        <Icono size={24} />
                    </div>
                    <div className="toast-content">
                        <h4 className="toast-title">{notif.titulo}</h4>
                        <p className="toast-message">{notif.mensaje}</p>
                        <span className="toast-time">{formatearTiempo(notif.fecha_creacion)}</span>
                    </div>
                    <button 
                        className="toast-close-btn"
                        onClick={(e) => handleCloseToast(e, notif)}
                    >
                        <X size={18} />
                    </button>
                </div>
            );
        })}
      </div>
    </>
  );
}

export default Navbar;
