import jwt from 'jsonwebtoken';

const PERMISOS_POR_ROL = {
  'Administrador': {
    ui: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: true,
      cuentasPago: true,
      pagosCobranzas: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: true,
      pagosCobranzas: true
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
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: true,
      pagosCobranzas: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: true,
      pagosCobranzas: true
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
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: false,
      cuentasPago: true,
      pagosCobranzas: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: true,
      pagosCobranzas: true
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
      consultarStock: true, // NUEVO
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: false,
      empleados: true,    
      flota: true,        
      proveedores: true,  
      clientes: true,
      productos: true,
      consultarStock: true, // NUEVO
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    }
  },
  'Produccion': {
    ui: {
      dashboard: false,
      empleados: false,       
      flota: false,           
      proveedores: false,     
      clientes: false,        
      productos: true,
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: false,
      empleados: true,        
      flota: true,           
      proveedores: true,      
      clientes: true,         
      productos: true,
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    }
  },
  'Supervisor': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      productos: false, // <-- CAMBIO IMPORTANTE: No ve el módulo completo
      consultarStock: true, // <-- CAMBIO IMPORTANTE: Sí ve el listado simple
      entradas: false,
      salidas: false,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: false,
      empleados: true,      
      flota: true,          
      proveedores: true,    
      clientes: true,       
      productos: true, // API en true para poder consultar datos, pero UI restringida
      consultarStock: true, // NUEVO
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
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
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: false,
      empleados: true,      
      flota: false,
      proveedores: false,
      clientes: false,
      productos: true,
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
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
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: false,
      empleados: true,      
      flota: true,          
      proveedores: true,    
      clientes: true,       
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: false,
      guiasTransportista: false,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
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
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: false,
      pagosCobranzas: false
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
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
    },
    dashboard: false,
    api: {
      empleados: false,
      flota: true,
      proveedores: false,
      clientes: true,
      productos: false,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: false,
      cuentasPago: false,
      pagosCobranzas: false
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
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: false,
      pagosCobranzas: false
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      guiasRemision: true,
      guiasTransportista: true,
      ordenesCompra: true,
      cuentasPago: false,
      pagosCobranzas: false
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
      
      // LOG TEMPORAL PARA DEPURAR (Puedes eliminarlo después)
      if (!permisos.api[modulo]) {
        console.log(`[AUTH] Acceso denegado. Rol: ${rol}, Modulo solicitado: ${modulo}, Permisos:`, permisos.api);
        
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
        permisos: permisos.ui, 
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