import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({ 
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ============================================
// INTERCEPTOR DE REQUEST - AGREGAR TOKEN
// ============================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// INTERCEPTOR DE RESPONSE - MANEJO DE ERRORES
// ============================================
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      console.error('❌ Error de red:', error.message);
      return Promise.reject({
        message: 'Error de conexión con el servidor',
        error: error.message
      });
    }

    const { status, data } = error.response;
    
    // ✅ MEJORADO: Manejo especial para 401 - Sesión expirada
    if (status === 401) {
      console.log('🔒 401 Unauthorized - Sesión expirada');
      
      // Limpiar todo el localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Evitar redirigir múltiples veces
      if (!window.location.pathname.includes('/login')) {
        console.log('🔄 Redirigiendo a login...');
        
        // Usar replace para evitar volver atrás
        window.location.replace('/login');
      }
      
      return Promise.reject({
        ...data,
        status: 401,
        sessionExpired: true
      });
    }
    
    switch (status) {
      case 400:
        console.error('⚠️ Error de validación:', data.error);
        break;
      case 403:
        console.error('🚫 Prohibido (Forbidden):', data.error);
        break;
      case 404:
        console.error('🔍 Recurso no encontrado:', data.error);
        break;
      case 500:
        console.error('💥 Error del servidor:', data.error);
        break;
      default:
        console.error(`❌ Error ${status}:`, data.error || error.message);
    }

    return Promise.reject(error.response.data);
  }
);

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  verificarToken: () => api.get('/auth/verificar'),
  cambiarPassword: (id_empleado, data) => api.put(`/auth/cambiar-password/${id_empleado}`, data)
};

// ============================================
// EMPLEADOS
// ============================================
export const empleadosAPI = {
  getAll: (params) => api.get('/empleados', { params }),
  getById: (id) => api.get(`/empleados/${id}`),
  getByRol: (rol) => api.get(`/empleados/rol/${rol}`),
  validarDNI: (dni) => api.get(`/empleados/validar-dni/${dni}`),
  validarEmail: (email) => api.get(`/empleados/validar-email/${encodeURIComponent(email)}`),
  create: (data) => api.post('/empleados', data),
  update: (id, data) => api.put(`/empleados/${id}`, data),
  delete: (id) => api.delete(`/empleados/${id}`),
};

// ============================================
// FLOTA
// ============================================
export const flotaAPI = {
  getAll: (params) => api.get('/flota', { params }),
  getById: (id) => api.get(`/flota/${id}`),
  getDisponibles: () => api.get('/flota/disponibles'),
  create: (data) => api.post('/flota', data),
  update: (id, data) => api.put(`/flota/${id}`, data),
  delete: (id) => api.delete(`/flota/${id}`),
};

// ============================================
// PROVEEDORES
// ============================================
export const proveedoresAPI = {
  getAll: (params) => api.get('/proveedores', { params }),
  getById: (id) => api.get(`/proveedores/${id}`),
  getByRuc: (ruc) => api.get(`/proveedores/ruc/${ruc}`),
  validarRUC: (ruc) => api.get(`/proveedores/validar-ruc/${ruc}`),
  create: (data) => api.post('/proveedores', data),
  update: (id, data) => api.put(`/proveedores/${id}`, data),
  delete: (id) => api.delete(`/proveedores/${id}`),
};

// ============================================
// CLIENTES
// ============================================
export const clientesAPI = {
  getAll: (params) => api.get('/clientes', { params }),
  getById: (id) => api.get(`/clientes/${id}`),
  getByRuc: (ruc) => api.get(`/clientes/ruc/${ruc}`),
  validarRUC: (ruc) => api.get(`/clientes/validar-ruc/${ruc}`),
  create: (data) => api.post('/clientes', data),
  update: (id, data) => api.put(`/clientes/${id}`, data),
  delete: (id) => api.delete(`/clientes/${id}`),
};

// ============================================
// PRODUCTOS
// ============================================
export const productosAPI = {
  getAll: (params) => api.get('/productos', { params }),
  getById: (id) => api.get(`/productos/${id}`),
  getAllConCosto: (params) => api.get('/productos/con-costo', { params }),
  getTiposInventario: () => api.get('/productos/tipos-inventario'),
  getCategorias: () => api.get('/productos/categorias'),
  create: (data) => api.post('/productos', data),
  update: (id, data) => api.put(`/productos/${id}`, data),
  delete: (id) => api.delete(`/productos/${id}`),
  
  // Historial de movimientos
  getHistorialMovimientos: (id, params) => api.get(`/productos/${id}/historial-movimientos`, { params }),
  
  // Recetas
  getRecetasByProducto: (id) => api.get(`/productos/${id}/recetas`),
  getDetalleReceta: (idReceta) => api.get(`/productos/recetas/${idReceta}/detalle`),
  createReceta: (data) => api.post('/productos/recetas', data),
  updateReceta: (idReceta, data) => api.put(`/productos/recetas/${idReceta}`, data),
  deleteReceta: (idReceta) => api.delete(`/productos/recetas/${idReceta}`),
  duplicarReceta: (idReceta, data) => api.post(`/productos/recetas/${idReceta}/duplicar`, data),
  
  // Items de receta
  createRecetaItem: (data) => api.post('/productos/recetas/items', data),
  updateRecetaItem: (id, data) => api.put(`/productos/recetas/items/${id}`, data),
  deleteRecetaItem: (id) => api.delete(`/productos/recetas/items/${id}`),
  calcularCUPDesdeReceta: (id) => api.get(`/productos/${id}/calcular-cup-receta`),
  getEvolucionCUP: (id) => api.get(`/productos/${id}/evolucion-cup`),
};

// ============================================
// ENTRADAS
// ============================================
export const entradasAPI = {
  getAll: (params) => api.get('/inventario/movimientos-entradas', { params }),
  getById: (id) => api.get(`/inventario/movimientos-entradas/${id}`),
  create: (data) => api.post('/inventario/movimientos-entradas', data),
  update: (id, data) => api.put(`/inventario/movimientos-entradas/${id}`, data),
  delete: (id) => api.delete(`/inventario/movimientos-entradas/${id}`),
  
  // Funciones específicas
  createProductoRapido: (data) => api.post('/inventario/movimientos-entradas/producto-rapido', data),
  validarInventario: (data) => api.post('/inventario/movimientos-entradas/validar-inventario', data),
  crearProductoMultiInventario: (data) => api.post('/inventario/movimientos-entradas/crear-multi-inventario', data),
  
  // PDF
  generarPDF: (id) => api.get(`/inventario/movimientos-entradas/${id}/pdf`, { responseType: 'blob' }),
  
  // Tipos de inventario
  getTiposInventario: () => api.get('/productos/tipos-inventario')
};

// ============================================
// SALIDAS
// ============================================
export const salidasAPI = {
  getAll: (params) => api.get('/inventario/movimientos-salidas', { params }),
  getById: (id) => api.get(`/inventario/movimientos-salidas/${id}`),
  getTiposMovimiento: () => api.get('/inventario/movimientos-salidas/tipos-movimiento'),
  create: (data) => api.post('/inventario/movimientos-salidas', data),
  update: (id, data) => api.put(`/inventario/movimientos-salidas/${id}`, data),
  delete: (id) => api.delete(`/inventario/movimientos-salidas/${id}`),
  
  // PDF
  generarPDF: (id) => api.get(`/inventario/movimientos-salidas/${id}/pdf`, { responseType: 'blob' }),
  
  // Tipos de inventario
  getTiposInventario: () => api.get('/productos/tipos-inventario')
};

// ============================================
// TRANSFERENCIAS
// ============================================
export const transferenciasAPI = {
  getAll: (params) => api.get('/inventario/transferencias', { params }),
  getById: (id) => api.get(`/inventario/transferencias/${id}`),
  create: (data) => api.post('/inventario/transferencias', data),
  delete: (id) => api.delete(`/inventario/transferencias/${id}`),
  
  // Productos disponibles para transferir
  getProductosDisponibles: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/inventario/transferencias/productos-disponibles?${queryString}`);
  },
  
  // Resumen de stock
  getResumenStock: () => api.get('/inventario/transferencias/resumen-stock'),
  
  // PDF
  generarPDF: (id) => api.get(`/inventario/transferencias/${id}/pdf`, { responseType: 'blob' }),
  
  // Tipos de inventario
  getTiposInventario: () => api.get('/productos/tipos-inventario')
};

// ============================================
// INVENTARIO
// ============================================
export const inventarioAPI = {
  getResumenStock: () => api.get('/inventario/transferencias/resumen-stock'),
};

// ============================================
// ✅ DASHBOARD - CORREGIDO
// ============================================
export const dashboard = {
  // Resumen general (NO consume API - usa cache)
  getResumen: () => api.get('/dashboard/resumen'),
  
  // Inventario valorizado
  getInventarioValorizado: (params) => api.get('/dashboard/inventario-valorizado', { params }),
  
  // Productos con costo
  getProductosConCosto: () => api.get('/dashboard/productos-costo'),
  
  // Estadísticas de movimientos
  getEstadisticasMovimientos: (params) => api.get('/dashboard/estadisticas-movimientos', { params }),
  
  // Top productos
  getTopProductos: (params) => api.get('/dashboard/top-productos', { params }),
  
  // ✅ CORREGIDO: Tipo de cambio desde cache (NO consume token)
  getTipoCambio: (params) => api.get('/dashboard/tipo-cambio', { params }),
  
  // ✅ CORREGIDO: Actualizar tipo de cambio MANUALMENTE (CONSUME TOKEN)
  // Endpoint debe coincidir con el backend: /dashboard/tipo-cambio/actualizar
  actualizarTipoCambio: (params) => api.get('/dashboard/tipo-cambio/actualizar', { params })
};

// ============================================
// ÓRDENES DE PRODUCCIÓN
// ============================================
export const ordenesProduccionAPI = {
  getAll: (params) => api.get('/produccion/ordenes', { params }),
  getById: (id) => api.get(`/produccion/ordenes/${id}`),
  getConsumoMateriales: (id) => api.get(`/produccion/ordenes/${id}/consumo-materiales`),
  create: (data) => api.post('/produccion/ordenes', data),
  
  // Control de flujo de producción
  iniciar: (id, data) => api.post(`/produccion/ordenes/${id}/iniciar`, data),
  pausar: (id) => api.post(`/produccion/ordenes/${id}/pausar`),
  reanudar: (id) => api.post(`/produccion/ordenes/${id}/reanudar`),
  finalizar: (id, data) => api.post(`/produccion/ordenes/${id}/finalizar`, data),
  cancelar: (id) => api.post(`/produccion/ordenes/${id}/cancelar`),
  
  // PDF
  generarPDF: (id) => api.get(`/produccion/ordenes/${id}/pdf`, { 
    responseType: 'blob' 
  }),
  
  // Notificaciones
  getNotificaciones: () => api.get('/produccion/ordenes/notificaciones')
};

// ============================================
// ✅ COTIZACIONES - ACTUALIZADO
// ============================================
export const cotizacionesAPI = {
  // Listar cotizaciones
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.prioridad) params.append('prioridad', filtros.prioridad);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/cotizaciones?${params.toString()}`);
  },

  // Obtener por ID
  getById: (id) => api.get(`/cotizaciones/${id}`),

  // Crear cotización
  create: (data) => api.post('/cotizaciones', data),

  // ✅ ACTUALIZADO: Cambiar estado (ahora usa PUT en lugar de PATCH)
  actualizarEstado: (id, estado) => api.put(`/cotizaciones/${id}/estado`, { estado }),

  // ✅ NUEVO: Actualizar prioridad
  actualizarPrioridad: (id, prioridad) => api.put(`/cotizaciones/${id}/prioridad`, { prioridad }),

  // ✅ NUEVO: Obtener estadísticas
  getEstadisticas: () => api.get('/cotizaciones/estadisticas'),

  // Descargar PDF
  descargarPDF: async (id) => {
    const response = await fetch(`${API_URL}/cotizaciones/${id}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/pdf',
      }
    });
    
    if (!response.ok) throw new Error('Error al descargar PDF');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cotizacion-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

// ============================================
// ✅ ÓRDENES DE VENTA - ACTUALIZADO
// ============================================
export const ordenesVentaAPI = {
  // Listar órdenes
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.prioridad) params.append('prioridad', filtros.prioridad);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/ordenes-venta?${params.toString()}`);
  },

  // Obtener por ID
  getById: (id) => api.get(`/ordenes-venta/${id}`),

  // Crear orden
  create: (data) => api.post('/ordenes-venta', data),

  // Actualizar estado
  actualizarEstado: (id, estado, fecha_entrega_real = null) => 
    api.put(`/ordenes-venta/${id}/estado`, { estado, fecha_entrega_real }),

  // Actualizar prioridad
  actualizarPrioridad: (id, prioridad) => 
    api.put(`/ordenes-venta/${id}/prioridad`, { prioridad }),

  // Actualizar progreso
  actualizarProgreso: (id, detalle) => 
    api.put(`/ordenes-venta/${id}/progreso`, { detalle }),

  // Obtener estadísticas
  getEstadisticas: () => api.get('/ordenes-venta/estadisticas'),

  // ✅ DESCARGAR PDF (simplificado usando axios)
  descargarPDF: (id) => api.get(`/ordenes-venta/${id}/pdf`, {
    responseType: 'blob'  // ← Importante: indica que la respuesta es binaria
  })
};

// ============================================
// ✅ GUÍAS DE REMISIÓN - ACTUALIZADO
// ============================================
export const guiasRemisionAPI = {
  // Listar guías
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/guias-remision?${params.toString()}`);
  },

  // Obtener por ID
  getById: (id) => api.get(`/guias-remision/${id}`),

  // Crear guía
  create: (data) => api.post('/guias-remision', data),

  // ✅ NUEVO: Despachar guía (GENERA SALIDAS AUTOMÁTICAS)
  despachar: (id, fecha_despacho = null) => 
    api.post(`/guias-remision/${id}/despachar`, { fecha_despacho }),

  // ✅ NUEVO: Marcar como entregada
  marcarEntregada: (id, fecha_entrega = null) => 
    api.post(`/guias-remision/${id}/entregar`, { fecha_entrega }),

  // ✅ ACTUALIZADO: Actualizar estado (ahora usa PUT en lugar de PATCH)
  actualizarEstado: (id, estado) => 
    api.put(`/guias-remision/${id}/estado`, { estado }),

  // ✅ NUEVO: Obtener estadísticas
  getEstadisticas: () => api.get('/guias-remision/estadisticas'),

  // Descargar PDF
  descargarPDF: async (id) => {
    const response = await fetch(`${API_URL}/guias-remision/${id}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/pdf',
      }
    });
    
    if (!response.ok) throw new Error('Error al descargar PDF');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guia-remision-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

// ============================================
// ✅ GUÍAS DE TRANSPORTISTA - ACTUALIZADO
// ============================================
export const guiasTransportistaAPI = {
  // Listar guías
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/guias-transportista?${params.toString()}`);
  },

  // Obtener por ID
  getById: (id) => api.get(`/guias-transportista/${id}`),

  // Crear guía
  create: (data) => api.post('/guias-transportista', data),

  // ✅ ACTUALIZADO: Actualizar estado (ahora usa PUT en lugar de PATCH)
  actualizarEstado: (id, estado) => 
    api.put(`/guias-transportista/${id}/estado`, { estado }),

  // Catálogos de frecuentes
  getTransportistasFrecuentes: () => api.get('/guias-transportista/transportistas-frecuentes'),
  getConductoresFrecuentes: () => api.get('/guias-transportista/conductores-frecuentes'),
  getVehiculosFrecuentes: () => api.get('/guias-transportista/vehiculos-frecuentes'),

  // ✅ NUEVO: Obtener estadísticas
  getEstadisticas: () => api.get('/guias-transportista/estadisticas'),

  // Descargar PDF
  descargarPDF: async (id) => {
    const response = await fetch(`${API_URL}/guias-transportista/${id}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/pdf',
      }
    });
    
    if (!response.ok) throw new Error('Error al descargar PDF');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guia-transportista-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

// ============================================
// ✅ ÓRDENES DE COMPRA - ACTUALIZADO
// ============================================
export const ordenesCompraAPI = {
  // Listar órdenes
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/ordenes-compra?${params.toString()}`);
  },

  // Obtener por ID
  getById: (id) => api.get(`/ordenes-compra/${id}`),

  // Crear orden
  create: (data) => api.post('/ordenes-compra', data),

  // ✅ ACTUALIZADO: Actualizar estado (ahora usa PUT en lugar de PATCH)
  actualizarEstado: (id, estado) => 
    api.put(`/ordenes-compra/${id}/estado`, { estado }),

  // ✅ ACTUALIZADO: Recibir orden (GENERA ENTRADAS Y ACTUALIZA CUP)
  recibirOrden: (id, datos) => 
    api.post(`/ordenes-compra/${id}/recibir`, datos),

  // Obtener productos por proveedor (historial)
  getProductosPorProveedor: (id_proveedor) => 
    api.get(`/ordenes-compra/proveedor/${id_proveedor}/productos`),

  // ✅ NUEVO: Obtener estadísticas
  getEstadisticas: () => api.get('/ordenes-compra/estadisticas'),

  // Descargar PDF
  descargarPDF: async (id) => {
    const response = await fetch(`${API_URL}/ordenes-compra/${id}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/pdf',
      }
    });
    
    if (!response.ok) throw new Error('Error al descargar PDF');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orden-compra-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

// Asignar dashboard al objeto api
api.dashboard = dashboard;

export { api };
export default api;