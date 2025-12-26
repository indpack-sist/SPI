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
    
    const data = response.data;
    
    if (!data.success || !data.data) {
      throw new Error('Respuesta del servidor no válida');
    }
    
    const { token, usuario } = data.data;
    
    // ✅ CORREGIDO: Expandir el objeto completo
    console.log('Usuario del backend:', usuario); // Para debug
    
    // Guardar token
    localStorage.setItem('token', token);
    
    // ✅ Mapear TODOS los campos del usuario
    const userData = {
      id: usuario.id_empleado,
      nombre: usuario.nombre_completo,
      email: usuario.email,
      cargo: usuario.cargo,
      rol: usuario.rol,  // ← Asegúrate que venga del backend
      dni: usuario.dni
    };
    
    console.log('Usuario guardado:', userData);
    
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error en login:', error);
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