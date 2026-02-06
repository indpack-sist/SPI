import jwt from 'jsonwebtoken';

const PERMISOS_POR_ROL = {
  'Administrador': {
    ui: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: true,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: true
    },
    api: {
      dashboard: true,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: true,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: true
    }
  },
  'Calidad': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: false,
      entradas: true,
      salidas: true,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: true,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: false,
      entradas: true,
      salidas: true,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Comercial': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: true,
      productos: true,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: false
    }
  },
  'Ventas': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: true,
      solicitudesCredito: true,
      productos: true,
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: true,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: true,
      productos: true,
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: true,
      reportes: false
    }
  },
  'Produccion': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      outputs: true,
      transferencias: true,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Supervisor': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Operario': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: false,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: true,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Almacenero': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: false,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Logistica': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: true,
      proveedores: true,
      clientes: false,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      compras: true,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: true,
      entradas: true,
      salidas: true,
      transferencias: true,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      compras: true,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Conductor': {
    ui: {
      dashboard: false,
      empleados: false,
      flota: true,
      proveedores: false,
      clientes: false,
      solicitudesCredito: false,
      productos: false,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    },
    api: {
      empleados: false,
      flota: true,
      proveedores: false,
      clientes: true,
      solicitudesCredito: false,
      productos: false,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: false,
      ordenesVenta: false,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false
    }
  },
  'Administrativo': {
    ui: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: false,
      reportes: false
    },
    api: {
      dashboard: false,
      empleados: true,
      flota: true,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: true,
      consultarStock: false,
      entradas: false,
      salidas: false,
      transferencias: false,
      ordenesProduccion: false,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: false,
      reportes: false
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
    res.status(500).json({
      success: false,
      error: 'Error al obtener permisos'
    });
  }
};

export { PERMISOS_POR_ROL };