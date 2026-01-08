import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Package, Copy, Star, Clock, CheckCircle, XCircle, History, TrendingUp, TrendingDown, ArrowRightLeft, Factory, AlertTriangle, Info } from 'lucide-react';
import { productosAPI } from '../../config/api';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import './ProductoDetalle.css';

function ProductoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [producto, setProducto] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);
  const [detalleReceta, setDetalleReceta] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [historialMovimientos, setHistorialMovimientos] = useState([]);
  const [filtroTipoMovimiento, setFiltroTipoMovimiento] = useState('');
  const [tabActiva, setTabActiva] = useState('recetas');
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalRecetaOpen, setModalRecetaOpen] = useState(false);
  const [modalInsumoOpen, setModalInsumoOpen] = useState(false);
  const [editandoReceta, setEditandoReceta] = useState(null);
  const [editandoInsumo, setEditandoInsumo] = useState(null);
  const [cupCalculado, setCupCalculado] = useState(null);
  const [evolucionCUP, setEvolucionCUP] = useState(null);
  const [formReceta, setFormReceta] = useState({
    id_producto_terminado: id,
    nombre_receta: '',
    descripcion: '',
    version: '',
    es_principal: false,
    rendimiento_unidades: '1',
    tiempo_produccion_minutos: '0',
    notas: ''
  });

  const [formInsumo, setFormInsumo] = useState({
    id_receta_producto: '',
    id_insumo: '',
    cantidad_requerida: '',
    unidad_medida: '',
    orden_agregado: '0',
    es_critico: false,
    notas: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [id]);

  useEffect(() => {
    if (recetaSeleccionada) {
      cargarDetalleReceta(recetaSeleccionada.id_receta_producto);
    }
  }, [recetaSeleccionada]);

  useEffect(() => {
    if (tabActiva === 'historial' && historialMovimientos.length === 0) {
      cargarHistorialMovimientos();
    }
  }, [tabActiva]);

  const cargarDatos = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const [prodRes, recetasRes, insumosRes] = await Promise.all([
      productosAPI.getById(id),
      productosAPI.getRecetasByProducto(id),
      productosAPI.getAll({ estado: 'Activo' })
    ]);
    
    setProducto(prodRes.data.data);
    
    const recetasData = recetasRes.data.data || [];
    setRecetas(recetasData);
    
    const insumosFiltrados = (insumosRes.data.data || []).filter(p => 
      p.id_tipo_inventario == 1 || p.id_tipo_inventario == 2
    );
    setInsumosDisponibles(insumosFiltrados);

    if (recetasData.length > 0) {
      const principal = recetasData.find(r => r.es_principal);
      setRecetaSeleccionada(principal || recetasData[0]);
    } else {
      setRecetaSeleccionada(null);
      setDetalleReceta([]);
    }

    await calcularCUPDesdeReceta();
    await cargarEvolucionCUP();
  } catch (err) {
    console.error('Error cargando datos:', err);
    setError(err.error || 'Error al cargar datos del producto');
  } finally {
    setLoading(false);
  }
};
const cargarEvolucionCUP = async () => {
  try {
    const response = await productosAPI.getEvolucionCUP(id);
    if (response.data.success) {
      setEvolucionCUP(response.data);
    }
  } catch (err) {
    console.error('Error al cargar evolución CUP:', err);
  }
};
const getTendenciaIcono = (tendencia) => {
  if (tendencia === 'sube') return <TrendingUp size={14} className="text-danger" />;
  if (tendencia === 'baja') return <TrendingDown size={14} className="text-success" />;
  return null;
};
  const calcularCUPDesdeReceta = async () => {
    try {
      const response = await productosAPI.calcularCUPDesdeReceta(id);
      if (response.data.success) {
        setCupCalculado(response.data);
      }
    } catch (err) {
      console.error('Error al calcular CUP:', err);
    }
  };

  const cargarHistorialMovimientos = async (tipoFiltro = '') => {
    try {
      setLoadingHistorial(true);
      setError(null);
      
      const params = tipoFiltro ? { tipo_movimiento: tipoFiltro } : {};
      const response = await productosAPI.getHistorialMovimientos(id, params);
      
      setHistorialMovimientos(response.data.data || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError(err.error || 'Error al cargar historial de movimientos');
    } finally {
      setLoadingHistorial(false);
    }
  };

  const cargarDetalleReceta = async (idReceta) => {
    try {
      const response = await productosAPI.getDetalleReceta(idReceta);
      setDetalleReceta(response.data.data || []);
    } catch (err) {
      console.error('Error cargando detalle:', err);
      setError(err.error || 'Error al cargar detalle de receta');
      setDetalleReceta([]);
    }
  };

  const abrirModalReceta = (receta = null) => {
    if (receta) {
      setEditandoReceta(receta);
      setFormReceta({
        id_producto_terminado: id,
        nombre_receta: receta.nombre_receta,
        descripcion: receta.descripcion || '',
        version: receta.version || '',
        es_principal: receta.es_principal,
        es_activa: receta.es_activa !== undefined ? receta.es_activa : true,
        rendimiento_unidades: receta.rendimiento_unidades,
        tiempo_produccion_minutos: receta.tiempo_produccion_minutos || 0,
        notas: receta.notas || ''
      });
    } else {
      setEditandoReceta(null);
      setFormReceta({
        id_producto_terminado: id,
        nombre_receta: '',
        descripcion: '',
        version: '',
        es_principal: recetas.length === 0,
        es_activa: true,
        rendimiento_unidades: '1',
        tiempo_produccion_minutos: '0',
        notas: ''
      });
    }
    setModalRecetaOpen(true);
  };

  const cerrarModalReceta = () => {
    setModalRecetaOpen(false);
    setEditandoReceta(null);
  };

  const handleSubmitReceta = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editandoReceta) {
        await productosAPI.updateReceta(editandoReceta.id_receta_producto, formReceta);
        setSuccess('Receta actualizada exitosamente');
      } else {
        await productosAPI.createReceta(formReceta);
        setSuccess('Receta creada exitosamente');
      }
      cerrarModalReceta();
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al guardar receta');
    }
  };

  const handleDeleteReceta = async (idReceta) => {
    if (!confirm('¿Está seguro de eliminar esta receta? Se eliminarán todos sus insumos.')) return;

    try {
      setError(null);
      await productosAPI.deleteReceta(idReceta);
      setSuccess('Receta eliminada exitosamente');
      setRecetaSeleccionada(null);
      setDetalleReceta([]);
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al eliminar receta');
    }
  };

  const handleDuplicarReceta = async (idReceta) => {
    const nuevoNombre = prompt('Ingrese el nombre para la nueva receta:');
    if (!nuevoNombre) return;

    try {
      setError(null);
      await productosAPI.duplicarReceta(idReceta, { nuevo_nombre: nuevoNombre });
      setSuccess('Receta duplicada exitosamente');
      cargarDatos();
    } catch (err) {
      setError(err.error || 'Error al duplicar receta');
    }
  };

  const abrirModalInsumo = (item = null) => {
    if (!recetaSeleccionada) {
      setError('Debe seleccionar una receta primero');
      return;
    }

    if (item) {
      setEditandoInsumo(item);
      setFormInsumo({
        id_receta_producto: recetaSeleccionada.id_receta_producto,
        id_insumo: item.id_insumo,
        cantidad_requerida: item.cantidad_requerida,
        unidad_medida: item.unidad_medida,
        orden_agregado: item.orden_agregado || 0,
        es_critico: item.es_critico,
        notas: item.notas || ''
      });
    } else {
      setEditandoInsumo(null);
      setFormInsumo({
        id_receta_producto: recetaSeleccionada.id_receta_producto,
        id_insumo: '',
        cantidad_requerida: '',
        unidad_medida: 'unidad',
        orden_agregado: '0',
        es_critico: false,
        notas: ''
      });
    }
    setModalInsumoOpen(true);
  };

  const cerrarModalInsumo = () => {
    setModalInsumoOpen(false);
    setEditandoInsumo(null);
  };

  const handleInsumoChange = (e) => {
    const insumoId = e.target.value;
    const insumo = insumosDisponibles.find(i => i.id_producto == insumoId);
    
    setFormInsumo({
      ...formInsumo,
      id_insumo: insumoId,
      unidad_medida: insumo ? insumo.unidad_medida : 'unidad'
    });
  };

  const handleSubmitInsumo = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editandoInsumo) {
        await productosAPI.updateRecetaItem(editandoInsumo.id_detalle, formInsumo);
        setSuccess('Insumo actualizado en la receta');
      } else {
        await productosAPI.createRecetaItem(formInsumo);
        setSuccess('Insumo agregado a la receta');
      }
      cerrarModalInsumo();
      cargarDetalleReceta(recetaSeleccionada.id_receta_producto);
    } catch (err) {
      setError(err.error || 'Error al guardar insumo');
    }
  };

  const handleDeleteInsumo = async (idDetalle) => {
    if (!confirm('¿Está seguro de eliminar este insumo de la receta?')) return;

    try {
      setError(null);
      await productosAPI.deleteRecetaItem(idDetalle);
      setSuccess('Insumo eliminado de la receta');
      cargarDetalleReceta(recetaSeleccionada.id_receta_producto);
    } catch (err) {
      setError(err.error || 'Error al eliminar insumo');
    }
  };

  const handleFiltroMovimiento = (tipo) => {
    setFiltroTipoMovimiento(tipo);
    cargarHistorialMovimientos(tipo);
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolos = { 'PEN': 'S/', 'USD': '$', 'EUR': '€' };
    return `${simbolos[moneda] || 'S/'} ${parseFloat(valor || 0).toFixed(2)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calcularCostoTotal = () => {
    return detalleReceta.reduce((sum, item) => sum + parseFloat(item.costo_total_insumo || 0), 0);
  };

  const getTipoMovimientoConfig = (tipo) => {
    const configs = {
      'entrada': { icono: TrendingUp, color: 'text-success', bg: 'bg-success', texto: 'Entrada' },
      'salida': { icono: TrendingDown, color: 'text-danger', bg: 'bg-danger', texto: 'Salida' },
      'transferencia_entrada': { icono: ArrowRightLeft, color: 'text-primary', bg: 'bg-primary', texto: 'Transfer. Entrada' },
      'transferencia_salida': { icono: ArrowRightLeft, color: 'text-warning', bg: 'bg-warning', texto: 'Transfer. Salida' },
      'produccion_consumo': { icono: Factory, color: 'text-purple', bg: 'bg-purple', texto: 'Consumo Prod.' }
    };
    return configs[tipo] || configs['entrada'];
  };

  const columnsInsumos = [
  { 
    header: '#', 
    accessor: 'orden_agregado',
    width: '70px',
    align: 'center',
    render: (value) => {
      const orden = parseInt(value || 0);
      return orden > 0 ? (
        <span className="orden-badge">{orden}</span>
      ) : (
        <span className="orden-vacio">-</span>
      );
    }
  },
  { 
    header: 'Código', 
    accessor: 'codigo_insumo', 
    width: '120px',
    render: (value) => <span className="codigo-text">{value}</span>
  },
  { 
    header: 'Insumo / Material', 
    accessor: 'insumo',
    render: (value, row) => (
      <div className="insumo-cell">
        <div className="insumo-nombre">{value}</div>
        {row.es_critico === 1 && (
          <span className="badge badge-warning badge-critico">
            <AlertTriangle size={12} />
            Crítico
          </span>
        )}
        {row.notas && (
          <div className="insumo-notas">{row.notas}</div>
        )}
      </div>
    )
  },
  {
    header: 'Cantidad Requerida',
    accessor: 'cantidad_requerida',
    align: 'right',
    width: '160px',
    render: (value, row) => (
      <div className="cantidad-cell">
        <div className="cantidad-valor">{parseFloat(value).toFixed(4)}</div>
        <div className="cantidad-unidad">{row.unidad_medida}</div>
      </div>
    )
  },
  {
    header: 'CUP',
    accessor: 'costo_unitario_promedio',
    align: 'right',
    width: '110px',
    render: (value) => {
      const cup = parseFloat(value || 0);
      return (
        <div className="cup-cell">
          {cup > 0 ? (
            formatearMoneda(value)
          ) : (
            <span className="cup-sin-valor">Sin CUP</span>
          )}
        </div>
      );
    }
  },
  {
    header: 'Costo Total',
    accessor: 'costo_total_insumo',
    align: 'right',
    width: '120px',
    render: (value) => (
      <div className="costo-total-cell">
        {formatearMoneda(value)}
      </div>
    )
  },
  {
    header: 'Stock Disponible',
    accessor: 'stock_actual',
    align: 'right',
    width: '140px',
    render: (value, row) => {
      const stock = parseFloat(value);
      const requerido = parseFloat(row.cantidad_requerida);
      const suficiente = stock >= requerido;
      
      return (
        <div className="stock-cell">
          <div className={`stock-valor ${suficiente ? 'stock-suficiente' : 'stock-insuficiente'}`}>
            {stock.toFixed(2)} {row.unidad_medida}
          </div>
          {!suficiente && (
            <div className="stock-alerta">
              <AlertTriangle size={12} />
              Insuficiente
            </div>
          )}
        </div>
      );
    }
  },
  {
    header: 'Acciones',
    accessor: 'id_detalle',
    width: '120px',
    align: 'center',
    render: (value, row) => (
      <div className="acciones-cell">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => abrirModalInsumo(row)}
          title="Editar insumo"
        >
          <Edit size={14} />
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => handleDeleteInsumo(value)}
          title="Eliminar insumo"
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }
];

  const columnsHistorial = [
    {
      header: 'Fecha',
      accessor: 'fecha_movimiento',
      width: '150px',
      render: (value) => (
        <span className="fecha-text">{formatearFecha(value)}</span>
      )
    },
    {
      header: 'Tipo',
      accessor: 'tipo_movimiento',
      width: '180px',
      render: (value) => {
        const config = getTipoMovimientoConfig(value);
        const Icono = config.icono;
        return (
          <div className="tipo-movimiento-cell">
            <Icono size={16} className={config.color} />
            <span>{config.texto}</span>
          </div>
        );
      }
    },
    {
      header: 'Inventario/Origen',
      accessor: 'inventario',
      width: '160px',
      render: (value) => <span className="inventario-text">{value}</span>
    },
    {
      header: 'Destino/Detalle',
      accessor: 'destino',
      render: (value, row) => (
        <div className="destino-cell">
          <div className="destino-principal">{value || row.proveedor || '-'}</div>
          {row.documento_soporte && (
            <div className="destino-documento">Doc: {row.documento_soporte}</div>
          )}
        </div>
      )
    },
    {
      header: 'Cantidad',
      accessor: 'cantidad',
      align: 'right',
      width: '110px',
      render: (value) => (
        <div className="cantidad-historial">{parseFloat(value).toFixed(2)}</div>
      )
    },
    {
      header: 'Moneda',
      accessor: 'moneda',
      align: 'center',
      width: '90px',
      render: (value) => {
        const colores = {
          'PEN': 'badge-primary',
          'USD': 'badge-success',
          'EUR': 'badge-warning'
        };
        return <span className={`badge ${colores[value] || 'badge-secondary'}`}>{value}</span>;
      }
    },
    {
      header: 'Costo Unit.',
      accessor: 'costo_unitario',
      align: 'right',
      width: '110px',
      render: (value, row) => (
        <div className="costo-unitario-text">{formatearMoneda(value, row.moneda)}</div>
      )
    },
    {
      header: 'Costo Total',
      accessor: 'costo_total',
      align: 'right',
      width: '120px',
      render: (value, row) => (
        <div className="costo-total-historial">{formatearMoneda(value, row.moneda)}</div>
      )
    },
    {
      header: 'Registrado Por',
      accessor: 'registrado_por',
      width: '140px',
      render: (value) => <span className="registrado-text">{value || '-'}</span>
    }
  ];

  if (loading) {
    return <Loading message="Cargando producto..." />;
  }

  if (!producto) {
    return (
      <div>
        <Alert type="error" message="Producto no encontrado" />
        <button className="btn btn-outline mt-3" onClick={() => navigate('/productos')}>
          Volver a Productos
        </button>
      </div>
    );
  }

  return (
    <div className="producto-detalle-container">
      <button className="btn btn-outline mb-4" onClick={() => navigate('/productos')}>
        <ArrowLeft size={20} />
        Volver a Productos
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* ✅ SECCIÓN 1: INFORMACIÓN DEL PRODUCTO - VERSIÓN CORREGIDA */}
      <div className="seccion-info-producto">
        <div className="seccion-header">
          <Package size={24} />
          <h2>Información del Producto</h2>
        </div>

        <div className="info-producto-grid">
          {/* Card Datos Básicos */}
          <div className="info-card">
            <div className="info-card-header">
              <h3>Datos Básicos</h3>
            </div>
            <div className="info-card-body">
              <div className="info-row">
                <span className="info-label">Código:</span>
                <span className="info-value codigo-badge">{producto.codigo}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Nombre:</span>
                <span className="info-value">{producto.nombre}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Tipo de Inventario:</span>
                <span className="info-value badge badge-primary">{producto.tipo_inventario}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Categoría:</span>
                <span className="info-value">{producto.categoria || '-'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Unidad de Medida:</span>
                <span className="info-value">{producto.unidad_medida}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Estado:</span>
                <span className={`badge ${producto.estado === 'Activo' ? 'badge-success' : 'badge-secondary'}`}>
                  {producto.estado}
                </span>
              </div>
            </div>
          </div>

          {/* Card Stock */}
          <div className="info-card">
            <div className="info-card-header">
              <h3>Stock</h3>
            </div>
            <div className="info-card-body">
              <div className="stock-principal">
                <span className="stock-label">Stock Actual</span>
                <div className="stock-valor-grande">
                  {parseFloat(producto.stock_actual).toFixed(2)}
                  <span className="stock-unidad">{producto.unidad_medida}</span>
                </div>
              </div>
              <div className="info-row">
                <span className="info-label">Stock Mínimo:</span>
                <span className="info-value">{parseFloat(producto.stock_minimo).toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Stock Máximo:</span>
                <span className="info-value">{parseFloat(producto.stock_maximo).toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Valor en Stock:</span>
                <span className="info-value valor-destacado">
                  {formatearMoneda(
                    parseFloat(producto.stock_actual) * 
                    (cupCalculado?.cup_calculado || parseFloat(producto.costo_unitario_promedio || 0))
                  )}
                </span>
              </div>
            </div>
          </div>


<div className="info-card">
  <div className="info-card-header">
    <h3>Costos y Precios</h3>
  </div>
  <div className="info-card-body">
    {/* CUP */}
    {cupCalculado?.cup_calculado > 0 ? (
      <div className="cup-principal">
        <span className="cup-label">
          {cupCalculado?.origen === 'promedio_ponderado' && 'CUP Promedio Ponderado'}
          {cupCalculado?.origen === 'receta_teorica' && 'CUP Teórico (Receta)'}
          {!cupCalculado?.origen && 'Costo Unitario Promedio'}
        </span>
        <div className="cup-valor-grande">
          {formatearMoneda(cupCalculado.cup_calculado)}
        </div>
        
        {/* Indicador de Promedio Ponderado */}
        {cupCalculado?.origen === 'promedio_ponderado' && (
          <>
            <div className="cup-info success">
              <CheckCircle size={14} />
              <span>
                Promedio de {cupCalculado.detalle?.total_producciones} producción(es) 
                • {cupCalculado.detalle?.cantidad_total_producida.toFixed(2)} unidades totales
              </span>
            </div>

            {/* Tabla de Evolución del CUP */}
            {evolucionCUP?.evolucion?.length > 0 && (
              <details className="cup-desglose" open>
                <summary>Evolución del CUP por Producción</summary>
                <div className="cup-evolucion-tabla">
                  <table>
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Receta</th>
                        <th>Cant.</th>
                        <th>CUP Prod.</th>
                        <th>Cant. Acum.</th>
                        <th>CUP Acumulado</th>
                        <th>Tendencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evolucionCUP.evolucion.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className="font-mono font-bold">{item.numero_orden}</span>
                            <div className="text-xs text-muted">
                              {new Date(item.fecha).toLocaleDateString('es-PE')}
                            </div>
                          </td>
                          <td>
                            <span className="text-sm">{item.receta}</span>
                          </td>
                          <td className="text-right">
                            <span className="font-medium">{item.cantidad}</span>
                          </td>
                          <td className="text-right">
                            <span className="font-mono">{formatearMoneda(item.cup_produccion)}</span>
                          </td>
                          <td className="text-right">
                            <span className="font-bold">{item.cantidad_acumulada}</span>
                          </td>
                          <td className="text-right">
                            <span className="font-bold text-primary">
                              {formatearMoneda(item.cup_acumulado)}
                            </span>
                          </td>
                          <td className="text-center">
                            {item.tendencia !== 'igual' && (
                              <span className={`cup-tendencia ${item.tendencia}`}>
                                {getTendenciaIcono(item.tendencia)}
                                {item.diferencia !== 0 && formatearMoneda(Math.abs(item.diferencia))}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="5" className="text-right font-bold">
                          CUP ACTUAL:
                        </td>
                        <td className="text-right">
                          <span className="text-lg font-bold text-primary">
                            {formatearMoneda(evolucionCUP.cup_actual)}
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
        
        {/* Indicador de Receta Teórica */}
        {cupCalculado?.origen === 'receta_teorica' && (
          <div className="cup-info warning">
            <Info size={14} />
            <span>
              Cálculo teórico desde receta "{cupCalculado.receta_usada}" 
              (aún no hay producciones con costo)
            </span>
          </div>
        )}
        
        {/* Advertencia de insumos sin CUP */}
        {cupCalculado?.insumos_sin_cup && (
          <div className="cup-advertencia">
            <AlertTriangle size={14} />
            <span>Algunos insumos sin CUP registrado</span>
          </div>
        )}
      </div>
    ) : (
      <div className="cup-sin-valor-card">
        <div className="cup-sin-valor-icon">
          <AlertTriangle size={32} />
        </div>
        <div className="cup-sin-valor-texto">
          <strong>Sin CUP Calculado</strong>
          {cupCalculado?.origen === 'sin_datos' ? (
            <p>No hay receta principal ni producciones registradas</p>
          ) : cupCalculado?.tiene_receta_principal === false ? (
            <p>Configure una receta principal activa para calcular el costo</p>
          ) : cupCalculado?.insumos_sin_cup ? (
            <p>Los insumos de la receta no tienen costos registrados</p>
          ) : (
            <p>Aún no se ha registrado el costo promedio</p>
          )}
        </div>
      </div>
    )}

    {/* Precio de Venta */}
    <div className="info-row mt-3">
      <span className="info-label">Precio Venta:</span>
      <span className="info-value">{formatearMoneda(producto.precio_venta)}</span>
    </div>

    {/* ✅ MÁRGENES CORREGIDOS */}
    {cupCalculado?.cup_calculado > 0 && producto.precio_venta > 0 && (
      <>
        <div className="info-row">
          <span className="info-label">Margen Unitario:</span>
          <span className="info-value valor-exito">
            {formatearMoneda(parseFloat(producto.precio_venta) - cupCalculado.cup_calculado)}
          </span>
        </div>
        
        {/* Margen Bruto (Gross Margin) - Estándar Contable */}
        <div className="info-row">
          <span className="info-label">
            Margen Bruto:
            <span className="info-tooltip" title="(Precio - Costo) / Precio × 100">ⓘ</span>
          </span>
          <span className="info-value valor-destacado">
            {(((parseFloat(producto.precio_venta) - cupCalculado.cup_calculado) / parseFloat(producto.precio_venta)) * 100).toFixed(2)}%
          </span>
        </div>
        
        {/* Markup - Información Adicional */}
        <div className="info-row">
          <span className="info-label text-muted">
            Markup:
            <span className="info-tooltip" title="(Precio - Costo) / Costo × 100">ⓘ</span>
          </span>
          <span className="info-value text-muted">
            {(((parseFloat(producto.precio_venta) - cupCalculado.cup_calculado) / cupCalculado.cup_calculado) * 100).toFixed(2)}%
          </span>
        </div>
      </>
    )}

    {/* Valor en Stock */}
    {cupCalculado?.cup_calculado > 0 && (
      <div className="info-row">
        <span className="info-label">Valor en Stock:</span>
        <span className="info-value valor-destacado">
          {formatearMoneda(parseFloat(producto.stock_actual) * cupCalculado.cup_calculado)}
        </span>
      </div>
    )}
  </div>
</div>

          {/* Card Recetas */}
          <div className="info-card">
            <div className="info-card-header">
              <h3>Recetas</h3>
            </div>
            <div className="info-card-body">
              <div className="info-row">
                <span className="info-label">Requiere Receta:</span>
                <span className={`badge ${producto.requiere_receta ? 'badge-primary' : 'badge-secondary'}`}>
                  {producto.requiere_receta ? 'Sí' : 'No'}
                </span>
              </div>
              {producto.requiere_receta && (
                <>
                  <div className="info-row">
                    <span className="info-label">Total Recetas:</span>
                    <span className="info-value badge badge-info">{recetas.length}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Receta Principal:</span>
                    <span className="info-value">
                      {recetas.find(r => r.es_principal)?.nombre_receta || (
                        <span className="text-warning">No definida</span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Descripción (si existe) */}
        {producto.descripcion && (
          <div className="descripcion-producto">
            <h4>Descripción</h4>
            <p>{producto.descripcion}</p>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: TABS DE RECETAS E HISTORIAL */}
      <div className="seccion-tabs">
        <div className="tabs-header">
          <button
            className={`tab-button ${tabActiva === 'recetas' ? 'active' : ''}`}
            onClick={() => setTabActiva('recetas')}
          >
            <Package size={20} />
            <span>Recetas (BOM)</span>
          </button>
          <button
            className={`tab-button ${tabActiva === 'historial' ? 'active' : ''}`}
            onClick={() => setTabActiva('historial')}
          >
            <History size={20} />
            <span>Historial de Movimientos</span>
          </button>
        </div>

        <div className="tabs-content">
          {/* CONTENIDO TAB RECETAS */}
          {tabActiva === 'recetas' && producto.requiere_receta && (
            <div className="tab-recetas-content">
              <div className="seccion-header">
                <div>
                  <h2>Gestión de Recetas</h2>
                  {recetas.length > 0 && (
                    <p className="seccion-subtitulo">
                      Total: {recetas.length} receta(s) configurada(s)
                    </p>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => abrirModalReceta()}>
                  <Plus size={20} />
                  Nueva Receta
                </button>
              </div>

              {recetas.length > 0 ? (
                <div className="recetas-container">
                  {/* Tabs de Recetas */}
                  <div className="recetas-tabs-container">
                    <div className="recetas-tabs">
                      {recetas.map(receta => {
                        const esSeleccionada = recetaSeleccionada?.id_receta_producto === receta.id_receta_producto;
                        
                        return (
                          <button
                            key={receta.id_receta_producto}
                            className={`receta-tab ${esSeleccionada ? 'active' : ''}`}
                            onClick={() => setRecetaSeleccionada(receta)}
                          >
                            <div className="receta-tab-header">
                              {receta.es_principal === 1 && (
    <Star size={14} fill="currentColor" className="receta-star" />
  )}
                              <span className="receta-tab-nombre">{receta.nombre_receta}</span>
                              {receta.es_activa ? (
                                <CheckCircle size={14} className="receta-icono-activo" />
                              ) : (
                                <XCircle size={14} className="receta-icono-inactivo" />
                              )}
                            </div>
                            <div className="receta-tab-info">
                              {receta.total_insumos || 0} insumo(s)
                            </div>
                            <div className="receta-tab-costo">
                              {formatearMoneda(receta.costo_total_materiales || 0)}
                            </div>
                            {receta.version && (
                              <div className="receta-tab-version">v{receta.version}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalle de Receta Seleccionada */}
                  {recetaSeleccionada && (
                    <div className="receta-detalle-container">
                      {/* Encabezado de Receta */}
                      <div className="receta-detalle-header">
                        <div className="receta-detalle-info">
                          <div className="receta-titulo-badges">
                            <h3>{recetaSeleccionada.nombre_receta}</h3>
                            <div className="receta-badges">
                              {recetaSeleccionada.es_principal === 1 && (
                                <span className="badge badge-warning">
                                  <Star size={12} fill="currentColor" />
                                  Principal
                                </span>
                              )}
                              {recetaSeleccionada.es_activa ? (
                                <span className="badge badge-success">
                                  <CheckCircle size={12} />
                                  Activa
                                </span>
                              ) : (
                                <span className="badge badge-danger">
                                  <XCircle size={12} />
                                  Inactiva
                                </span>
                              )}
                              {recetaSeleccionada.version && recetaSeleccionada.version !== '0' && recetaSeleccionada.version !== 0 && (
                                <span className="badge badge-info">
                                  v{recetaSeleccionada.version}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {recetaSeleccionada.descripcion && (
                            <p className="receta-descripcion">{recetaSeleccionada.descripcion}</p>
                          )}

                          {/* Métricas de Receta */}
                          <div className="receta-metricas">
                            <div className="metrica-card">
                              <div className="metrica-label">Rendimiento</div>
                              <div className="metrica-valor">
                                {recetaSeleccionada.rendimiento_unidades}
                                <span className="metrica-unidad">{producto.unidad_medida}</span>
                              </div>
                            </div>
                            
                            <div className="metrica-card">
                              <div className="metrica-label">Tiempo</div>
                              <div className="metrica-valor">
                                <Clock size={16} />
                                {recetaSeleccionada.tiempo_produccion_minutos}
                                <span className="metrica-unidad">min</span>
                              </div>
                            </div>
                            
                            <div className="metrica-card">
                              <div className="metrica-label">Insumos</div>
                              <div className="metrica-valor">
                                <Package size={16} />
                                {recetaSeleccionada.total_insumos || 0}
                              </div>
                            </div>
                            
                            <div className="metrica-card destacado">
                              <div className="metrica-label">Costo Materiales</div>
                              <div className="metrica-valor">
                                {formatearMoneda(recetaSeleccionada.costo_total_materiales || 0)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Acciones de Receta */}
                        <div className="receta-detalle-acciones">
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => abrirModalReceta(recetaSeleccionada)}
                            title="Editar receta"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleDuplicarReceta(recetaSeleccionada.id_receta_producto)}
                            title="Duplicar receta"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteReceta(recetaSeleccionada.id_receta_producto)}
                            title="Eliminar receta"
                            disabled={recetas.length === 1 && recetaSeleccionada.es_principal}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Lista de Insumos */}
                      <div className="insumos-section">
                        <div className="insumos-header">
                          <div>
                            <h4>Insumos y Materiales</h4>
                            <p>Componentes necesarios para producir este producto</p>
                          </div>
                          <button
                            className="btn btn-primary"
                            onClick={() => abrirModalInsumo()}
                          >
                            <Plus size={18} />
                            Agregar Insumo
                          </button>
                        </div>

                        {detalleReceta.length > 0 ? (
                          <>
                            <div className="insumos-tabla-container">
                              <Table
                                columns={columnsInsumos}
                                data={detalleReceta}
                                emptyMessage="No hay insumos en esta receta"
                              />
                            </div>
                            
                            {/* Resumen de Costos */}
                            <div className="costos-resumen">
                              <div className="costo-card">
                                <div className="costo-icono">
                                  <Package size={24} />
                                </div>
                                <div className="costo-info">
                                  <div className="costo-label">Total de Insumos</div>
                                  <div className="costo-valor">{detalleReceta.length}</div>
                                  <div className="costo-descripcion">componente(s)</div>
                                </div>
                              </div>
                              
                              <div className="costo-card destacado">
                                <div className="costo-icono">
                                  <TrendingUp size={24} />
                                </div>
                                <div className="costo-info">
                                  <div className="costo-label">Costo Total Materiales</div>
                                  <div className="costo-valor">{formatearMoneda(calcularCostoTotal())}</div>
                                  <div className="costo-descripcion">
                                    para {recetaSeleccionada.rendimiento_unidades} {producto.unidad_medida}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="costo-card">
                                <div className="costo-icono">
                                  <Info size={24} />
                                </div>
                                <div className="costo-info">
                                  <div className="costo-label">Costo por Unidad</div>
                                  <div className="costo-valor">
                                    {formatearMoneda(calcularCostoTotal() / (recetaSeleccionada.rendimiento_unidades || 1))}
                                  </div>
                                  <div className="costo-descripcion">por 1 {producto.unidad_medida}</div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="empty-state">
                            <Package size={64} className="empty-icon" />
                            <h3>No hay insumos configurados</h3>
                            <p>Esta receta aún no tiene materiales. Agregue los insumos necesarios para la producción.</p>
                            <button className="btn btn-primary" onClick={() => abrirModalInsumo()}>
                              <Plus size={20} />
                              Agregar Primer Insumo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <Package size={64} className="empty-icon" />
                  <h3>No hay recetas configuradas</h3>
                  <p>Este producto requiere receta. Cree la primera receta con sus materiales e insumos.</p>
                  <button className="btn btn-primary" onClick={() => abrirModalReceta()}>
                    <Plus size={20} />
                    Crear Primera Receta
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO TAB HISTORIAL */}
          {tabActiva === 'historial' && (
            <div className="tab-historial-content">
              <div className="historial-header">
                <div>
                  <h2>Historial de Movimientos</h2>
                  <p>Trazabilidad completa del producto con distinción por moneda</p>
                </div>
                
                <div className="historial-filtros">
                  <button
                    className={`btn btn-sm ${!filtroTipoMovimiento ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleFiltroMovimiento('')}
                  >
                    Todos
                  </button>
                  <button
                    className={`btn btn-sm ${filtroTipoMovimiento === 'entrada' ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => handleFiltroMovimiento('entrada')}
                  >
                    Entradas
                  </button>
                  <button
                    className={`btn btn-sm ${filtroTipoMovimiento === 'salida' ? 'btn-danger' : 'btn-outline'}`}
                    onClick={() => handleFiltroMovimiento('salida')}
                  >
                    Salidas
                  </button>
                  <button
                    className={`btn btn-sm ${filtroTipoMovimiento === 'transferencia' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleFiltroMovimiento('transferencia')}
                  >
                    Transferencias
                  </button>
                  <button
                    className={`btn btn-sm ${filtroTipoMovimiento === 'produccion' ? 'btn-warning' : 'btn-outline'}`}
                    onClick={() => handleFiltroMovimiento('produccion')}
                  >
                    Producción
                  </button>
                </div>
              </div>

              {loadingHistorial ? (
                <Loading message="Cargando historial..." />
              ) : historialMovimientos.length > 0 ? (
                <div className="historial-tabla-container">
                  <Table
                    columns={columnsHistorial}
                    data={historialMovimientos}
                    emptyMessage="No hay movimientos registrados"
                  />
                </div>
              ) : (
                <div className="empty-state">
                  <History size={64} className="empty-icon" />
                  <h3>No hay movimientos registrados</h3>
                  <p>Este producto aún no tiene movimientos en el historial.</p>
                </div>
              )}
            </div>
          )}

          {/* SI NO REQUIERE RECETA */}
          {tabActiva === 'recetas' && !producto.requiere_receta && (
            <div className="empty-state">
              <Package size={64} className="empty-icon" />
              <h3>Este producto no requiere recetas</h3>
              <p>Los productos de reventa y materia prima no utilizan recetas de producción.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALES (mantener los mismos) */}
      {/* Modal Receta */}
      <Modal
        isOpen={modalRecetaOpen}
        onClose={cerrarModalReceta}
        title={editandoReceta ? '✏️ Editar Receta' : '➕ Nueva Receta'}
        size="md"
      >
        <form onSubmit={handleSubmitReceta}>
          <div className="form-group">
            <label className="form-label">Nombre de la Receta *</label>
            <input
              type="text"
              className="form-input"
              value={formReceta.nombre_receta}
              onChange={(e) => setFormReceta({ ...formReceta, nombre_receta: e.target.value })}
              required
              placeholder="Ej: Receta Estándar, Receta Premium, Receta Económica"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-textarea"
              value={formReceta.descripcion}
              onChange={(e) => setFormReceta({ ...formReceta, descripcion: e.target.value })}
              placeholder="Descripción de la receta (opcional)"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Versión</label>
              <input
                type="text"
                className="form-input"
                value={formReceta.version}
                onChange={(e) => setFormReceta({ ...formReceta, version: e.target.value })}
                placeholder="v1.0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rendimiento (unidades) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                value={formReceta.rendimiento_unidades}
                onChange={(e) => setFormReceta({ ...formReceta, rendimiento_unidades: e.target.value })}
                placeholder="1.00"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tiempo de Producción (minutos)</label>
            <input
              type="number"
              min="0"
              className="form-input"
              value={formReceta.tiempo_produccion_minutos}
              onChange={(e) => setFormReceta({ ...formReceta, tiempo_produccion_minutos: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="form-group">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={formReceta.es_principal}
                onChange={(e) => setFormReceta({ ...formReceta, es_principal: e.target.checked })}
              />
              <span>⭐ Marcar como Receta Principal</span>
            </label>
            <small className="text-muted">La receta principal se usará por defecto en producción</small>
          </div>

          {editandoReceta && (
            <div className="form-group">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  checked={formReceta.es_activa}
                  onChange={(e) => setFormReceta({ ...formReceta, es_activa: e.target.checked })}
                />
                <span>✅ Receta Activa</span>
              </label>
              <small className="text-muted">Solo las recetas activas se pueden usar en producción</small>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              className="form-textarea"
              value={formReceta.notas}
              onChange={(e) => setFormReceta({ ...formReceta, notas: e.target.value })}
              placeholder="Notas adicionales (opcional)"
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={cerrarModalReceta}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editandoReceta ? 'Actualizar' : 'Crear'} Receta
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Insumo */}
      <Modal
        isOpen={modalInsumoOpen}
        onClose={cerrarModalInsumo}
        title={editandoInsumo ? '✏️ Editar Insumo' : '➕ Agregar Insumo a Receta'}
        size="md"
      >
        <form onSubmit={handleSubmitInsumo}>
          <div className="form-group">
            <label className="form-label">Insumo / Material *</label>
            <select
              className="form-select"
              value={formInsumo.id_insumo}
              onChange={handleInsumoChange}
              required
              disabled={editandoInsumo}
            >
              <option value="">Seleccione un insumo...</option>
              {insumosDisponibles.map(insumo => (
                <option key={insumo.id_producto} value={insumo.id_producto}>
                  {insumo.codigo} - {insumo.nombre} (Stock: {parseFloat(insumo.stock_actual).toFixed(2)} {insumo.unidad_medida})
                </option>
              ))}
            </select>
            <small className="text-muted">Solo se muestran productos de Materia Prima e Insumos</small>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Cantidad Requerida *</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                className="form-input"
                value={formInsumo.cantidad_requerida}
                onChange={(e) => setFormInsumo({ ...formInsumo, cantidad_requerida: e.target.value })}
                required
                placeholder="0.0000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unidad de Medida *</label>
              <input
                type="text"
                className="form-input"
                value={formInsumo.unidad_medida}
                readOnly
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Orden de Agregado</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formInsumo.orden_agregado}
                onChange={(e) => setFormInsumo({ ...formInsumo, orden_agregado: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="form-checkbox-label" style={{ marginTop: '1.5rem' }}>
                <input
                  type="checkbox"
                  checked={formInsumo.es_critico}
                  onChange={(e) => setFormInsumo({ ...formInsumo, es_critico: e.target.checked })}
                />
                <span>⚠️ Insumo Crítico</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              className="form-textarea"
              value={formInsumo.notas}
              onChange={(e) => setFormInsumo({ ...formInsumo, notas: e.target.value })}
              placeholder="Notas adicionales sobre este insumo (opcional)"
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={cerrarModalInsumo}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editandoInsumo ? 'Actualizar' : 'Agregar'} Insumo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProductoDetalle;