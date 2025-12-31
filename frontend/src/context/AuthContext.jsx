import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../config/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    verificarAutenticacion();
  }, []);

  const verificarAutenticacion = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Verificar si el token es válido
      const response = await authAPI.verificarToken();
      
      if (response.data.success && response.data.data) {
        const usuario = response.data.data;
        
        // ✅ VALIDAR que el usuario tenga rol
        if (!usuario.rol) {
          console.error('❌ Usuario sin rol recibido del backend');
          limpiarSesion();
          return;
        }
        
        // Mapear datos del usuario
        const userData = {
          id: usuario.id_empleado,
          nombre: usuario.nombre_completo,
          email: usuario.email,
          cargo: usuario.cargo,
          rol: usuario.rol,
          dni: usuario.dni
        };
        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Token inválido
        limpiarSesion();
      }
    } catch (error) {
      console.error('❌ Error al verificar autenticación:', error);
      
      // ✅ Si es 401, la sesión expiró
      if (error.response?.status === 401) {
        console.log('🔒 Sesión expirada - redirigiendo a login');
        limpiarSesion();
        navigate('/login', { replace: true });
      } else {
        // Otro error, limpiar de todas formas
        limpiarSesion();
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Limpiar sesión de forma consistente
  const limpiarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const login = async (email, password) => {
    try {
      const credentials = { email, password };
      const response = await authAPI.login(credentials);
      
      const data = response.data;
      
      if (!data.success || !data.data) {
        throw new Error('Respuesta del servidor no válida');
      }
      
      const { token, usuario } = data.data;
      
      console.log('👤 Usuario del backend:', usuario);
      
      // ✅ VALIDAR que el usuario tenga rol ANTES de guardar
      if (!usuario.rol) {
        console.error('❌ Usuario sin rol - login rechazado');
        return {
          success: false,
          error: 'Usuario sin rol asignado. Contacte al administrador.'
        };
      }
      
      // Guardar token
      localStorage.setItem('token', token);
      
      // Mapear datos del usuario
      const userData = {
        id: usuario.id_empleado,
        nombre: usuario.nombre_completo,
        email: usuario.email,
        cargo: usuario.cargo,
        rol: usuario.rol,
        dni: usuario.dni
      };
      
      console.log('✅ Usuario guardado:', userData);
      
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Error al iniciar sesión' 
      };
    }
  };

  const logout = () => {
    try {
      console.log('🚪 Cerrando sesión...');
      limpiarSesion();
      navigate('/login', { replace: true });
      
      // Forzar recarga para limpiar cualquier estado residual
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error('❌ Error en logout:', error);
      limpiarSesion();
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  
  return context;
}