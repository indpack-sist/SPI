import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../config/api';

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
  const { user } = useAuth();

  const cargarPermisos = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCargando(false);
        return;
      }

      console.log('🔍 Usuario de AuthContext:', user);
      console.log('🔍 Rol del usuario:', user?.rol);

      if (user?.rol) {
        setRol(user.rol);
      }

      const response = await api.get('/auth/permisos');
      const data = response.data;
      
      console.log('📦 Respuesta de permisos:', data);
      
      if (data.success) {
        console.log('✅ Permisos cargados:', data.data.permisos);
        console.log('✅ Rol desde backend:', data.data.rol);
        setPermisos(data.data.permisos);
        setRol(data.data.rol);
      }
    } catch (error) {
      console.error('❌ Error al cargar permisos:', error);
      // Se conservan los últimos permisos ante fallos temporales. El interceptor
      // central se ocupa del vencimiento real de la sesión.
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (user) {
      console.log('👤 Usuario cambió, cargando permisos...');
      cargarPermisos();
    }
  }, [user]);

  const tienePermiso = (modulo) => {
    if (!permisos) {
      console.log(`⚠️ Sin permisos cargados para verificar: ${modulo}`);
      return false;
    }
    const tiene = permisos[modulo] === true;
    console.log(`🔐 Verificando permiso [${modulo}]: ${tiene ? '✅' : '❌'}`);
    return tiene;
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
