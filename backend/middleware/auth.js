import jwt from 'jsonwebtoken';

// Sistema de permisos de dos niveles:
// - ui: Lo que el usuario VE en el sidebar
// - api: Lo que el usuario PUEDE CONSUMIR de la API (para llenar selects, combos, etc.)

const PERMISOS_POR_ROL = {
  'Administrador': {
    ui: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    }
  },
  'Gerencia': {
    ui: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    }
  },
  'Comercial': {
    ui: {
      dashboard: true,
      empleados: false,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    }
  },
  'Ventas': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: true,
      productos: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: false,
      ordenesCompra: false
    },
    api: {
      dashboard: false,
      empleados: true,    // Acceso interno para selects
      flota: true,        // Acceso interno para selects
      proveedores: true,  // Acceso interno para selects
      clientes: true,
      productos: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: false,
      ordenesCompra: false
    }
  },
  'Produccion': {
    ui: {
      dashboard: false,
      empleados: false,       // NO visible en menú
      flota: false,           // NO visible en menú
      proveedores: false,     // NO visible en menú
      clientes: false,        // NO visible en menú
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    },
    api: {
      dashboard: false,
      empleados: true,        // TRUE: Para cargar "Registrado Por"
      flota: true,            // TRUE: Para cargar vehículos en Salidas/Guías
      proveedores: true,      // TRUE: Para cargar proveedores en Entradas
      clientes: true,         // TRUE: Para cargar clientes en Salidas/Ordenes
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    }
  },
  'Supervisor': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    },
    api: {
      dashboard: false,
      empleados: true,      // Acceso interno
      flota: true,          // Acceso interno
      proveedores: true,    // Acceso interno
      clientes: true,       // Acceso interno
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    }
  },
  'Operario': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      productos: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    },
    api: {
      dashboard: false,
      empleados: true,      // Acceso interno por si acaso
      flota: false,
      proveedores: false,
      clientes: false,
      productos: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    }
  },
  'Almacenero': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    },
    api: {
      dashboard: false,
      empleados: true,      // Necesario para selects
      flota: true,          // Necesario para selects
      proveedores: true,    // Necesario para selects
      clientes: true,       // Necesario para selects
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false
    }
  },
  'Logistica': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: true,
      proveedores: true,
      clientes: false,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    }
  },
  'Conductor': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: true,
      proveedores: false,
      clientes: false,
      productos: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: false
    },
    dashboard: false,
    api: {
      empleados: false,
      flota: true,
      proveedores: false,
      clientes: true,
      productos: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: false
    }
  },
  'Administrativo': {
    ui: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true
    }
  }
};

export const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No se proporcionó token de autenticación'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'indpack-secret-key-2025');
    
    req.user = decoded;
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Error al verificar token'
    });
  }
};

export const verificarPermiso = (modulo) => {
  return (req, res, next) => {
    try {
      const { rol } = req.user;
      
      if (!rol) {
        return res.status(403).json({
          success: false,
          error: 'Usuario sin rol asignado'
        });
      }
      
      const permisos = PERMISOS_POR_ROL[rol];
      
      if (!permisos) {
        return res.status(403).json({
          success: false,
          error: 'Rol no reconocido'
        });
      }
      
      // ✅ CORRECCIÓN: Verifica el permiso en 'api', no en 'ui'
      if (!permisos.api[modulo]) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permiso para acceder a este módulo',
          modulo: modulo,
          rol: rol
        });
      }
      
      next();
      
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar permisos'
      });
    }
  };
};

export const obtenerPermisos = (req, res) => {
  try {
    const { rol } = req.user;
    
    const permisos = PERMISOS_POR_ROL[rol] || { ui: {}, api: {} };
    
    res.json({
      success: true,
      data: {
        rol,
        permisos: permisos.ui, // El frontend usa esto para pintar el menú
        permisosApi: permisos.api
      }
    });
    
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener permisos'
    });
  }
};

export { PERMISOS_POR_ROL };