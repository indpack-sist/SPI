import jwt from 'jsonwebtoken';

const PERMISOS_POR_ROL = {
  'Administrador': {
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
  'Gerencia': {
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
  'Comercial': {
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
    cotizaciones: true,
    ordenesVenta: true,
    guiasRemision: true,
    guiasTransportista: true,
    ordenesCompra: true
  },
  'Ventas': {
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
  'Jefe de Produccion': {
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
  'Supervisor': {
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
  'Operario': {
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
  'Almacenero': {
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
  'Logistica': {
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
  'Conductor': {
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
  'Administrativo': {
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
      
      if (!permisos[modulo]) {
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
    
    const permisos = PERMISOS_POR_ROL[rol] || {};
    
    res.json({
      success: true,
      data: {
        rol,
        permisos
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