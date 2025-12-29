import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({ 
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      console.error('Error de red:', error.message);
      return Promise.reject({
        message: 'Error de conexión con el servidor',
        error: error.message
      });
    }

    const { status, data } = error.response;
    
    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(data);
    }
    
    switch (status) {
      case 400:
        console.error('Error de validación:', data.error);
        break;
      case 403:
        console.error('Prohibido (Forbidden):', data.error);
        break;
      case 404:
        console.error('Recurso no encontrado:', data.error);
        break;
      case 500:
        console.error('Error del servidor:', data.error);
        break;
      default:
        console.error(`Error ${status}:`, data.error || error.message);
    }

    return Promise.reject(error.response.data);
  }
);


export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  verificarToken: () => api.get('/auth/verificar'),
  cambiarPassword: (id_empleado, data) => api.put(`/auth/cambiar-password/${id_empleado}`, data)
};

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

export const flotaAPI = {
  getAll: (params) => api.get('/flota', { params }),
  getById: (id) => api.get(`/flota/${id}`),
  getDisponibles: () => api.get('/flota/disponibles'),
  create: (data) => api.post('/flota', data),
  update: (id, data) => api.put(`/flota/${id}`, data),
  delete: (id) => api.delete(`/flota/${id}`),
};

export const proveedoresAPI = {
  getAll: (params) => api.get('/proveedores', { params }),
  getById: (id) => api.get(`/proveedores/${id}`),
  getByRuc: (ruc) => api.get(`/proveedores/ruc/${ruc}`),
  validarRUC: (ruc) => api.get(`/proveedores/validar-ruc/${ruc}`),
  create: (data) => api.post('/proveedores', data),
  update: (id, data) => api.put(`/proveedores/${id}`, data),
  delete: (id) => api.delete(`/proveedores/${id}`),
};

export const clientesAPI = {
  getAll: (params) => api.get('/clientes', { params }),
  getById: (id) => api.get(`/clientes/${id}`),
  getByRuc: (ruc) => api.get(`/clientes/ruc/${ruc}`),
  validarRUC: (ruc) => api.get(`/clientes/validar-ruc/${ruc}`),
  create: (data) => api.post('/clientes', data),
  update: (id, data) => api.put(`/clientes/${id}`, data),
  delete: (id) => api.delete(`/clientes/${id}`),
};

export const productosAPI = {
  getAll: (params) => api.get('/productos', { params }),
  getById: (id) => api.get(`/productos/${id}`),
  getAllConCosto: (params) => api.get('/productos/con-costo', { params }),
  getTiposInventario: () => api.get('/productos/tipos-inventario'),
  getCategorias: () => api.get('/productos/categorias'),
  create: (data) => api.post('/productos', data),
  update: (id, data) => api.put(`/productos/${id}`, data),
  delete: (id) => api.delete(`/productos/${id}`),
  
  getHistorialMovimientos: (id, params) => api.get(`/productos/${id}/historial-movimientos`, { params }),
  
  getRecetasByProducto: (id) => api.get(`/productos/${id}/recetas`),
  getDetalleReceta: (idReceta) => api.get(`/productos/recetas/${idReceta}/detalle`),
  createReceta: (data) => api.post('/productos/recetas', data),
  updateReceta: (idReceta, data) => api.put(`/productos/recetas/${idReceta}`, data),
  deleteReceta: (idReceta) => api.delete(`/productos/recetas/${idReceta}`),
  duplicarReceta: (idReceta, data) => api.post(`/productos/recetas/${idReceta}/duplicar`, data),
  
  createRecetaItem: (data) => api.post('/productos/recetas/items', data),
  updateRecetaItem: (id, data) => api.put(`/productos/recetas/items/${id}`, data),
  deleteRecetaItem: (id) => api.delete(`/productos/recetas/items/${id}`),
  calcularCUPDesdeReceta: (id) => api.get(`/productos/${id}/calcular-cup-receta`),
  getEvolucionCUP: (id) => api.get(`/productos/${id}/evolucion-cup`),
};

export const entradasAPI = {
  getAll: (params) => api.get('/inventario/movimientos-entradas', { params }),
  getById: (id) => api.get(`/inventario/movimientos-entradas/${id}`),
  create: (data) => api.post('/inventario/movimientos-entradas', data),
  update: (id, data) => api.put(`/inventario/movimientos-entradas/${id}`, data),
  delete: (id) => api.delete(`/inventario/movimientos-entradas/${id}`),
  
  createProductoRapido: (data) => api.post('/inventario/movimientos-entradas/producto-rapido', data),
  validarInventario: (data) => api.post('/inventario/movimientos-entradas/validar-inventario', data),
  crearProductoMultiInventario: (data) => api.post('/inventario/movimientos-entradas/crear-multi-inventario', data),
  
  generarPDF: (id) => api.get(`/inventario/movimientos-entradas/${id}/pdf`, { responseType: 'blob' }),
  
  getTiposInventario: () => api.get('/productos/tipos-inventario')
};


export const salidasAPI = {
  getAll: (params) => api.get('/inventario/movimientos-salidas', { params }),
  getById: (id) => api.get(`/inventario/movimientos-salidas/${id}`),
  getTiposMovimiento: () => api.get('/inventario/movimientos-salidas/tipos-movimiento'),
  create: (data) => api.post('/inventario/movimientos-salidas', data),
  update: (id, data) => api.put(`/inventario/movimientos-salidas/${id}`, data),
  delete: (id) => api.delete(`/inventario/movimientos-salidas/${id}`),
  
  generarPDF: (id) => api.get(`/inventario/movimientos-salidas/${id}/pdf`, { responseType: 'blob' }),
  
  getTiposInventario: () => api.get('/productos/tipos-inventario')
};

export const transferenciasAPI = {
  getAll: (params) => api.get('/inventario/transferencias', { params }),
  getById: (id) => api.get(`/inventario/transferencias/${id}`),
  create: (data) => api.post('/inventario/transferencias', data),
  delete: (id) => api.delete(`/inventario/transferencias/${id}`),
  
  getProductosDisponibles: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/inventario/transferencias/productos-disponibles?${queryString}`);
  },
  
  getResumenStock: () => api.get('/inventario/transferencias/resumen-stock'),
  
  generarPDF: (id) => api.get(`/inventario/transferencias/${id}/pdf`, { responseType: 'blob' }),
  
  getTiposInventario: () => api.get('/productos/tipos-inventario')
};

export const inventarioAPI = {
  getResumenStock: () => api.get('/inventario/transferencias/resumen-stock'),
};

export const dashboard = {
  getResumen: () => api.get('/dashboard/resumen'),
  
  getInventarioValorizado: (params) => api.get('/dashboard/inventario-valorizado', { params }),
  
  getProductosConCosto: () => api.get('/dashboard/productos-costo'),
  
  getEstadisticasMovimientos: (params) => api.get('/dashboard/estadisticas-movimientos', { params }),
  
  getTopProductos: (params) => api.get('/dashboard/top-productos', { params }),
  
  getTipoCambio: (params) => api.get('/dashboard/tipo-cambio', { params }),
  
 actualizarTipoCambio: (params) => api.get('/dashboard/tipo-cambio/actualizar', { params })
};

export const ordenesProduccionAPI = {
  getAll: (params) => api.get('/produccion/ordenes', { params }),
  getById: (id) => api.get(`/produccion/ordenes/${id}`),
  getConsumoMateriales: (id) => api.get(`/produccion/ordenes/${id}/consumo-materiales`),
  create: (data) => api.post('/produccion/ordenes', data),
  
  iniciar: (id, data) => api.post(`/produccion/ordenes/${id}/iniciar`, data),
  pausar: (id) => api.post(`/produccion/ordenes/${id}/pausar`),
  reanudar: (id) => api.post(`/produccion/ordenes/${id}/reanudar`),
  finalizar: (id, data) => api.post(`/produccion/ordenes/${id}/finalizar`, data),
  cancelar: (id) => api.post(`/produccion/ordenes/${id}/cancelar`),
  
  generarPDF: (id) => api.get(`/produccion/ordenes/${id}/pdf`, { 
    responseType: 'blob' 
  }),
  
  getNotificaciones: () => api.get('/produccion/ordenes/notificaciones')
};

export const cotizacionesAPI = {
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.prioridad) params.append('prioridad', filtros.prioridad);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/cotizaciones?${params.toString()}`);
  },

  getById: (id) => api.get(`/cotizaciones/${id}`),

  create: (data) => api.post('/cotizaciones', data),

  actualizarEstado: (id, estado) => api.put(`/cotizaciones/${id}/estado`, { estado }),

  actualizarPrioridad: (id, prioridad) => api.put(`/cotizaciones/${id}/prioridad`, { prioridad }),

  getEstadisticas: () => api.get('/cotizaciones/estadisticas'),

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

export const ordenesVentaAPI = {
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.prioridad) params.append('prioridad', filtros.prioridad);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/ordenes-venta?${params.toString()}`);
  },

  getById: (id) => api.get(`/ordenes-venta/${id}`),

  create: (data) => api.post('/ordenes-venta', data),

  actualizarEstado: (id, estado, fecha_entrega_real = null) => 
    api.put(`/ordenes-venta/${id}/estado`, { estado, fecha_entrega_real }),

  actualizarPrioridad: (id, prioridad) => 
    api.put(`/ordenes-venta/${id}/prioridad`, { prioridad }),

  actualizarProgreso: (id, detalle) => 
    api.put(`/ordenes-venta/${id}/progreso`, { detalle }),

  getEstadisticas: () => api.get('/ordenes-venta/estadisticas'),

  descargarPDF: async (id) => {
    const response = await fetch(`${API_URL}/ordenes-venta/${id}/pdf`, {
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
    link.download = `orden-venta-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

export const guiasRemisionAPI = {
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/guias-remision?${params.toString()}`);
  },

  getById: (id) => api.get(`/guias-remision/${id}`),

  create: (data) => api.post('/guias-remision', data),

  despachar: (id, fecha_despacho = null) => 
    api.post(`/guias-remision/${id}/despachar`, { fecha_despacho }),

  marcarEntregada: (id, fecha_entrega = null) => 
    api.post(`/guias-remision/${id}/entregar`, { fecha_entrega }),

  actualizarEstado: (id, estado) => 
    api.put(`/guias-remision/${id}/estado`, { estado }),

  getEstadisticas: () => api.get('/guias-remision/estadisticas'),

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


export const guiasTransportistaAPI = {
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/guias-transportista?${params.toString()}`);
  },

  getById: (id) => api.get(`/guias-transportista/${id}`),

  create: (data) => api.post('/guias-transportista', data),

  actualizarEstado: (id, estado) => 
    api.put(`/guias-transportista/${id}/estado`, { estado }),

  getTransportistasFrecuentes: () => api.get('/guias-transportista/transportistas-frecuentes'),
  getConductoresFrecuentes: () => api.get('/guias-transportista/conductores-frecuentes'),
  getVehiculosFrecuentes: () => api.get('/guias-transportista/vehiculos-frecuentes'),

  getEstadisticas: () => api.get('/guias-transportista/estadisticas'),

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

export const ordenesCompraAPI = {
  getAll: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    
    return api.get(`/ordenes-compra?${params.toString()}`);
  },

  getById: (id) => api.get(`/ordenes-compra/${id}`),

  create: (data) => api.post('/ordenes-compra', data),

  actualizarEstado: (id, estado) => 
    api.put(`/ordenes-compra/${id}/estado`, { estado }),

  recibirOrden: (id, datos) => 
    api.post(`/ordenes-compra/${id}/recibir`, datos),

  getProductosPorProveedor: (id_proveedor) => 
    api.get(`/ordenes-compra/proveedor/${id_proveedor}/productos`),

  getEstadisticas: () => api.get('/ordenes-compra/estadisticas'),

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

api.dashboard = dashboard;

export { api };
export default api;