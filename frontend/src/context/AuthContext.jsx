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

      const response = await authAPI.verificarToken();
      
      if (response.data.success && response.data.data) {
        const usuario = response.data.data.usuario;
        
        console.log('✅ Usuario verificado desde backend:', usuario);
        console.log('✅ Rol del usuario verificado:', usuario.rol);
        
        if (!usuario.rol) {
          console.error('❌ Usuario sin rol recibido del backend');
          limpiarSesion();
          return;
        }
        
        const userData = {
          id: usuario.id_empleado,
          nombre: usuario.nombre_completo,
          email: usuario.email,
          cargo: usuario.cargo,
          rol: usuario.rol,
          dni: usuario.dni
        };
        
        console.log('✅ Usuario guardado en estado:', userData);
        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        limpiarSesion();
      }
    } catch (error) {
      console.error('❌ Error al verificar autenticación:', error);
      
      if (error.response?.status === 401) {
        console.log('🔒 Sesión expirada - redirigiendo a login');
        limpiarSesion();
        navigate('/login', { replace: true });
      } else {
        limpiarSesion();
      }
    } finally {
      setLoading(false);
    }
  };

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
      
      console.log('📦 Respuesta completa del backend:', data.data);
      console.log('👤 Usuario del backend:', usuario);
      console.log('🎭 Rol del usuario:', usuario.rol);
      
      if (!usuario.rol) {
        console.error('❌ Usuario sin rol - login rechazado');
        return {
          success: false,
          error: 'Usuario sin rol asignado. Contacte al administrador.'
        };
      }
      
      localStorage.setItem('token', token);
      
      const userData = {
        id: usuario.id_empleado,
        nombre: usuario.nombre_completo,
        email: usuario.email,
        cargo: usuario.cargo,
        rol: usuario.rol,
        dni: usuario.dni
      };
      
      console.log('💾 Guardando usuario en estado:', userData);
      console.log('💾 Rol que se guardará:', userData.rol);
      
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      console.log('✅ Usuario final guardado:', userData);
      console.log('✅ Estado de user después de setUser:', userData);
      
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