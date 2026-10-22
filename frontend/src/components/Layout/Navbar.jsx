import { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut, X, ShoppingCart, Factory, Info, CheckCircle, AlertTriangle, XCircle, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificacionesAPI } from '../../config/api';
import './Navbar.css';

function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [showNotificaciones, setShowNotificaciones] = useState(false);
  const [socket, setSocket] = useState(null);
  const [toastNotificaciones, setToastNotificaciones] = useState([]);

  useEffect(() => {
    cargarNotificaciones();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const SOCKET_URL = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : 'http://localhost:3000';

    const crearSocket = () => {
      const token = localStorage.getItem('token');
      if (!token) return null;

      const s = io(SOCKET_URL, {
        auth: { token },
        withCredentials: true,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        forceNew: true
      });

      s.on('connect', () => {
        s.emit('identificar_usuario', user.id);
      });

      s.on('nueva_notificacion', (notif) => {
        setNotificaciones(prev => [notif, ...prev]);
        setNoLeidas(prev => prev + 1);
        setToastNotificaciones(prev => [notif, ...prev]);

        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = 800;
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
          console.error("No se pudo reproducir sonido");
        }
      });

      s.on('disconnect', (reason) => {
        console.log('WebSocket desconectado:', reason);
      });

      s.on('connect_error', (error) => {
        console.error('Error de conexion WebSocket:', error.message);
        if (error.message === 'TOKEN_INVALID' || error.message === 'TOKEN_EXPIRED') {
          s.auth = { token: localStorage.getItem('token') || '' };
        }
      });

      return s;
    };

    const newSocket = crearSocket();
    if (!newSocket) return;
    setSocket(newSocket);

    const handleVisibilidad = () => {
      if (document.visibilityState === 'visible' && !newSocket.connected) {
        newSocket.auth = { token: localStorage.getItem('token') || '' };
        newSocket.connect();
        cargarNotificaciones();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilidad);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilidad);
      newSocket.disconnect();
    };
  }, [user?.id]);

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
      setToastNotificaciones([]);
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
        setToastNotificaciones(prev => prev.filter(n => n.id_notificacion !== notif.id_notificacion));
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
      setToastNotificaciones(prev => prev.filter(n => n.id_notificacion !== notif.id_notificacion));
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
      case 'danger': return XCircle;
      case 'info': return Info;
      default: return Bell;
    }
  };

  const getEtiquetaTipo = (tipo) => {
    switch(tipo) {
      case 'success': return 'Aprobado';
      case 'warning': return 'Requiere atencion';
      case 'danger': return 'Rechazado';
      case 'info': return 'Informativo';
      default: return 'Sistema';
    }
  };

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
          <button
            className="navbar-icon-btn navbar-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

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
                      const tipoNotif = notif.tipo || 'info';
                      const Icono = getIconoNotificacion(tipoNotif);
                      return (
                        <div
                          key={notif.id_notificacion}
                          className={`navbar-notification-item ${notif.leido ? 'read' : 'unread'} notif-${tipoNotif}`}
                          onClick={(e) => handleNotificacionClick(notif, e)}
                        >
                          <div className={`navbar-notification-icon ${tipoNotif}`}>
                            <Icono size={18} strokeWidth={2.5} />
                          </div>
                          <div className="navbar-notification-content">
                            <div className="navbar-notification-meta">
                              <span className={`navbar-notification-tag tag-${tipoNotif}`}>
                                {getEtiquetaTipo(tipoNotif)}
                              </span>
                              <span className="navbar-notification-time">
                                {formatearTiempo(notif.fecha_creacion)}
                              </span>
                            </div>
                            <h4>{notif.titulo}</h4>
                            <p>{notif.mensaje}</p>
                          </div>
                          {!notif.leido && <div className={`navbar-notification-dot dot-${tipoNotif}`}></div>}
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
        {toastNotificaciones.map((notif) => {
            const tipoNotif = notif.tipo || 'info';
            const Icono = getIconoNotificacion(tipoNotif);
            return (
                <div
                    key={`toast-${notif.id_notificacion}`}
                    className={`notification-toast toast-${tipoNotif}`}
                    onClick={(e) => handleNotificacionClick(notif, e)}
                >
                    <div className={`toast-icon-wrapper toast-icon-${tipoNotif}`}>
                        <Icono size={20} strokeWidth={2.5} />
                    </div>
                    <div className="toast-content">
                        <span className={`toast-tag tag-${tipoNotif}`}>{getEtiquetaTipo(tipoNotif)}</span>
                        <h4 className="toast-title">{notif.titulo}</h4>
                        <p className="toast-message">{notif.mensaje}</p>
                    </div>
                    <button
                        className="toast-close-btn"
                        onClick={(e) => handleCloseToast(e, notif)}
                    >
                        <X size={16} />
                    </button>
                </div>
            );
        })}
      </div>
    </>
  );
}

export default Navbar;