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
      incidencias: true,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: true,
      seguimientoVentas: true,
      prospectos: true,
      verPrecios: true,
      verFinanzasVentas: true,
      facturacion: true
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
      incidencias: true,
      cotizaciones: true,
      ordenesVenta: true,
      compras: true,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: true,
      seguimientoVentas: true,
      prospectos: true,
      facturacion: true
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
      incidencias: true,
      cotizaciones: false,
      ordenesVenta: true,
      seguimientoVentas: false,
      compras: true,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false,
      verPrecios: false,
      verFinanzasVentas: false
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
      incidencias: true,
      cotizaciones: false,
      ordenesVenta: true,
      seguimientoVentas: false,
      compras: true,
      cuentasPago: false,
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
      prospectos: true,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: true,
      reportes: false,
      verFinanzasVentas: true,
      // Vista de solo lectura de la Facturación Electrónica (SEE): ver/descargar
      // PDF, XML y CDR de comprobantes/guías ya emitidos. NO emite ni da de baja.
      facturacionConsulta: true
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
      prospectos: true,
      compras: false,
      cuentasPago: true,
      pagosCobranzas: true,
      listasPrecios: true,
      reportes: true,
      facturacionConsulta: true
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
      reportes: false,
      verFinanzasVentas: true,
      facturacionConsulta: true
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
      reportes: false,
      facturacionConsulta: true
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
      incidencias: true,
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
      incidencias: true,
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
      incidencias: true,
      cotizaciones: false,
      ordenesVenta: true,
      compras: false,
      cuentasPago: false,
      pagosCobranzas: false,
      listasPrecios: false,
      reportes: false,
      verPrecios: false,
      verFinanzasVentas: false
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
      incidencias: true,
      cotizaciones: false,
      ordenesVenta: true,
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
      reportes: true,
      verFinanzasVentas: true,
      facturacion: true
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
      reportes: true,
      facturacion: true
    }
  },
  'Cobranzas': {
    ui: {
      dashboard: true,
      empleados: false,
      flota: false,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: false,
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
      reportes: true,
      verPrecios: true,
      verFinanzasVentas: true
    },
    api: {
      dashboard: true,
      empleados: false,
      flota: false,
      proveedores: true,
      clientes: true,
      solicitudesCredito: false,
      productos: false,
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
      reportes: true
    }
  }
};

export const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No se proporcionó token de autenticación',
        code: 'TOKEN_MISSING'
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
        error: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Error al verificar token'
    });
  }
};

// Acepta uno o varios módulos: el acceso se concede si el rol tiene CUALQUIERA
// de ellos (útil para endpoints que sirven tanto al permiso pleno como al de
// solo lectura, p. ej. 'facturacion' o 'facturacionConsulta').
export const verificarPermiso = (...modulos) => {
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
      if (!modulos.some((m) => permisos.api[m])) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permiso para acceder a este módulo',
          modulo: modulos.join(' | '),
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