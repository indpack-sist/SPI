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
      
      if (response.data.success) {
        setUser(response.data.data);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    } catch (error) {
      console.error('Error al verificar autenticación:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CAMBIO AQUÍ: Recibir email y password por separado
  const login = async (email, password) => {
  try {
    const credentials = { email, password };
    const response = await authAPI.login(credentials);
    
    console.log('Respuesta completa del backend:', response.data); // ← Para debug
    
    // Manejar diferentes estructuras de respuesta
    const data = response.data;
    
    // Extraer token
    const token = data.token || data.data?.token;
    if (!token) {
      throw new Error('No se recibió token del servidor');
    }
    
    // Extraer empleado (puede venir en diferentes estructuras)
    const empleado = data.empleado || data.data?.empleado || data.user || data.data;
    
    if (!empleado || !empleado.id_empleado) {
      console.error('Estructura de respuesta:', data);
      throw new Error('Estructura de respuesta del servidor no válida');
    }
    
    // Guardar token
    localStorage.setItem('token', token);
    
    // Crear objeto user
    const userData = {
      id: empleado.id_empleado,
      nombre: empleado.nombre_completo || empleado.nombre,
      email: empleado.email,
      cargo: empleado.cargo || 'Sin cargo',
      rol: empleado.rol || 'usuario'
    };
    
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error completo en login:', error);
    console.error('Response data:', error.response?.data);
    
    return { 
      success: false, 
      error: error.response?.data?.error || error.message || 'Error al iniciar sesión' 
    };
  }
};


  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      navigate('/login', { replace: true });
      
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error('Error en logout:', error);
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