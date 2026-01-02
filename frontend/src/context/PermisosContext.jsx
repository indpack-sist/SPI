import { createContext, useContext, useState, useEffect } from 'react';

const PermisosContext = createContext();

export const usePermisos = () => {
  const context = useContext(PermisosContext);
  if (!context) {
    throw new Error('usePermisos debe ser usado dentro de PermisosProvider');
  }
  return context;
};

export const PermisosProvider = ({ children }) => {
  const [permisos, setPermisos] = useState(null);
  const [rol, setRol] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarPermisos = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCargando(false);
        return;
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const response = await fetch(`${API_URL}/auth/permisos`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar permisos');
      }

      const data = await response.json();
      
      if (data.success) {
        setPermisos(data.data.permisos);
        setRol(data.data.rol);
      }
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      setPermisos(null);
      setRol(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPermisos();
  }, []);

  const tienePermiso = (modulo) => {
    if (!permisos) return false;
    return permisos[modulo] === true;
  };

  const puedeAcceder = (modulos) => {
    if (!Array.isArray(modulos)) {
      return tienePermiso(modulos);
    }
    return modulos.some(modulo => tienePermiso(modulo));
  };

  const actualizarPermisos = () => {
    cargarPermisos();
  };

  return (
    <PermisosContext.Provider
      value={{
        permisos,
        rol,
        cargando,
        tienePermiso,
        puedeAcceder,
        actualizarPermisos
      }}
    >
      {children}
    </PermisosContext.Provider>
  );
};

export const ConPermiso = ({ modulo, modulos, children, fallback = null }) => {
  const { puedeAcceder, cargando } = usePermisos();

  if (cargando) {
    return fallback;
  }

  const modulosAVerificar = modulos || [modulo];
  
  if (!puedeAcceder(modulosAVerificar)) {
    return fallback;
  }

  return <>{children}</>;
};