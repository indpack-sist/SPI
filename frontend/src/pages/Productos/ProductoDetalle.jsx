import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Package, Copy, Star, Clock, CheckCircle, XCircle, History, Factory,
  AlertTriangle, Info, Boxes, ShoppingCart, ShieldAlert, FileText, FileSpreadsheet, BookOpen,
  ChevronRight, CalendarDays, PackageCheck, TrendingUp, TrendingDown, Loader, Layers
} from 'lucide-react';
import { productosAPI, inventarioAPI, incidenciasAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgPager from '../../components/UI/PgPager';
import { BadgeEstadoRegistro } from '../Maestros/estadosMaestros';
import { fmtFecha, fmtMonto, haceTexto } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import { BadgeEstadoProduccion } from '../Produccion/estadosProduccion';
import { getEstadoBadge } from '../Calidad/Incidencias';
import {
  BadgeEstadoStock, MedidorStock, TagMovimiento, configMovimiento, FILTROS_MOVIMIENTO,
  fmtCantidad, fmtCosto, fmtPeso, esTipoVendible
} from './estadosProductos';
import './Productos.css';

const FORM_RECETA_VACIO = {
  nombre_receta: '',
  descripcion: '',
  version: '',
  es_principal: false,
  es_activa: true,
  rendimiento_unidades: '1',
  tiempo_produccion_minutos: '0',
  notas: ''
};

const GRUPOS_MOVIMIENTO = {
  entrada: ['entrada'],
  salida: ['salida', 'devolucion_anulacion'],
  transferencia: ['transferencia_entrada', 'transferencia_salida'],
  produccion: ['produccion_consumo'],
  ajuste: ['ajuste']
};

const num = (v) => parseFloat(v || 0) || 0;

const ajusteComoMovimiento = (a) => ({
  tipo_movimiento: 'ajuste',
  id_movimiento: `aj-${a.id_ajuste}`,
  fecha_movimiento: a.fecha_ajuste,
  inventario: a.tipo_inventario || 'Conteo físico',
  destino: a.motivo || 'Conteo físico',
  documento_soporte: null,
  detalle_ajuste: `Sistema ${fmtCantidad(a.stock_sistema)} → físico ${fmtCantidad(a.stock_fisico)}`,
  cantidad: a.diferencia,
  registrado_por: a.usuario_ajuste,
  observaciones: a.observaciones,
  estado: 'Activo'
});

function ProductoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tienePermiso } = usePermisos();
  const verPrecios = tienePermiso('verPrecios');
  const verIncidencias = tienePermiso('incidencias');
  const verOrdenesProduccion = tienePermiso('ordenesProduccion');
  const verOrdenesVenta = tienePermiso('ordenesVenta');

  const [producto, setProducto] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);
  const [detalleReceta, setDetalleReceta] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [movimientos, setMovimientos] = useState({ loading: true, data: [] });
  const [compromisos, setCompromisos] = useState({ loading: true, data: null, resumen: null });
  const [incidencias, setIncidencias] = useState({ loading: true, data: [] });
  const [filtroMovimiento, setFiltroMovimiento] = useState('');
  const [tabActiva, setTabActiva] = useState('movimientos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalRecetaOpen, setModalRecetaOpen] = useState(false);
  const [modalInsumoOpen, setModalInsumoOpen] = useState(false);
  const [editandoReceta, setEditandoReceta] = useState(null);
  const [editandoInsumo, setEditandoInsumo] = useState(null);
  const [repDesde, setRepDesde] = useState('');
  const [repHasta, setRepHasta] = useState('');
  const [generando, setGenerando] = useState('');

  const [formReceta, setFormReceta] = useState({ ...FORM_RECETA_VACIO, id_producto_terminado: id });

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
    cargarMovimientos();
    cargarCompromisos();
    cargarIncidencias();
  }, [id]);

  useEffect(() => {
    if (recetaSeleccionada) {
      cargarDetalleReceta(recetaSeleccionada.id_receta_producto);
    }
  }, [recetaSeleccionada]);

  const cargarDatos = async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setLoading(true);
      setError(null);

      const [prodRes, recetasRes, insumosRes] = await Promise.all([
        productosAPI.getById(id),
        productosAPI.getRecetasByProducto(id),
        productosAPI.getAll({ estado: 'Activo' })
      ]);

      const prod = prodRes.data.data;
      setProducto(prod);
      if (!silencioso) setTabActiva(prod?.requiere_receta ? 'recetas' : 'movimientos');

      const recetasData = recetasRes.data.data || [];
      setRecetas(recetasData);

      setInsumosDisponibles((insumosRes.data.data || []).filter(p =>
        p.id_tipo_inventario == 1 || p.id_tipo_inventario == 2
      ));

      if (recetasData.length > 0) {
        setRecetaSeleccionada(prev => {
          const vigente = prev && recetasData.find(r => r.id_receta_producto === prev.id_receta_producto);
          return vigente || recetasData.find(r => r.es_principal) || recetasData[0];
        });
      } else {
        setRecetaSeleccionada(null);
        setDetalleReceta([]);
      }
    } catch (err) {
      setError(err.error || 'Error al cargar datos del producto');
    } finally {
      setLoading(false);
    }
  };

  const cargarMovimientos = async () => {
    setMovimientos(prev => ({ ...prev, loading: true }));
    try {
      const [movRes, ajRes] = await Promise.all([
        productosAPI.getHistorialMovimientos(id),
        productosAPI.ajustes.getPorProducto(id, { limit: 200 }).catch(() => ({ data: { data: [] } }))
      ]);
      const ajustes = (ajRes.data.data || []).map(ajusteComoMovimiento);
      const lista = [...(movRes.data.data || []), ...ajustes]
        .sort((a, b) => new Date(b.fecha_movimiento) - new Date(a.fecha_movimiento));
      setMovimientos({ loading: false, data: lista });
    } catch (err) {
      setMovimientos({ loading: false, data: [] });
      setError(err.error || 'Error al cargar el historial de movimientos');
    }
  };

  const cargarCompromisos = async () => {
    setCompromisos(prev => ({ ...prev, loading: true }));
    try {
      const res = await productosAPI.getCompromisos(id);
      setCompromisos({ loading: false, data: res.data.data, resumen: res.data.resumen });
    } catch {
      setCompromisos({ loading: false, data: null, resumen: null });
    }
  };

  const cargarIncidencias = async () => {
    if (!verIncidencias) {
      setIncidencias({ loading: false, data: [] });
      return;
    }
    setIncidencias(prev => ({ ...prev, loading: true }));
    try {
      const res = await incidenciasAPI.getPorProducto(id);
      setIncidencias({ loading: false, data: res.data.data || [] });
    } catch {
      setIncidencias({ loading: false, data: [] });
    }
  };

  const cargarDetalleReceta = async (idReceta) => {
    try {
      const response = await productosAPI.getDetalleReceta(idReceta);
      setDetalleReceta(response.data.data || []);
    } catch (err) {
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
        es_principal: !!receta.es_principal,
        es_activa: receta.es_activa !== undefined ? !!receta.es_activa : true,
        rendimiento_unidades: receta.rendimiento_unidades,
        tiempo_produccion_minutos: receta.tiempo_produccion_minutos || 0,
        notas: receta.notas || ''
      });
    } else {
      setEditandoReceta(null);
      setFormReceta({ ...FORM_RECETA_VACIO, id_producto_terminado: id, es_principal: recetas.length === 0 });
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
      cargarDatos({ silencioso: true });
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
      cargarDatos({ silencioso: true });
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
      cargarDatos({ silencioso: true });
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
        es_critico: !!item.es_critico,
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

  const descargar = async (clave) => {
    if (repDesde && repHasta && repDesde > repHasta) {
      setError('La fecha "Desde" no puede ser mayor que la fecha "Hasta".');
      return;
    }
    const params = { fecha_inicio: repDesde || undefined, fecha_fin: repHasta || undefined };
    try {
      setGenerando(clave);
      setError(null);
      if (clave === 'prod-pdf') await productosAPI.descargarReportePDF(id, params);
      if (clave === 'prod-xlsx') await productosAPI.descargarReporteXLSX(id, params);
      if (clave === 'kardex-pdf') await inventarioAPI.descargarKardexPDF({ ...params, id_tipo_inventario: producto.id_tipo_inventario });
      if (clave === 'kardex-xlsx') await inventarioAPI.descargarKardexXLSX({ ...params, id_tipo_inventario: producto.id_tipo_inventario });
    } catch (err) {
      setError(err.message || 'Error al generar el reporte');
    } finally {
      setGenerando('');
    }
  };

  const movimientosFiltrados = filtroMovimiento
    ? movimientos.data.filter(m => GRUPOS_MOVIMIENTO[filtroMovimiento]?.includes(m.tipo_movimiento))
    : movimientos.data;
  const { currentItems: movimientosPagina, setCurrentPage: setPaginaMov, ...paginacionMov } =
    usePagination(movimientosFiltrados, { itemsPerPage: 15 });
  useResetPagina(setPaginaMov, [filtroMovimiento, id]);

  if (loading) return <Loading variant="detail" />;

  if (!producto) {
    return (
      <div className="pg-page">
        <div className="pg-panel">
          <div className="pg-empty">
            <Package size={34} />
            <strong>Producto no encontrado</strong>
            <span>Puede que el enlace sea antiguo o que el producto haya sido eliminado.</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/productos')}>
              <ArrowLeft size={14} /> Volver al catálogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unidad = producto.unidad_medida;
  const resumen = compromisos.resumen;
  const pendienteOV = num(resumen?.pendiente_ov);
  const disponible = num(producto.stock_actual) - pendienteOV;
  const vendible = esTipoVendible(producto.tipo_inventario);
  const opsActivas = compromisos.data?.produccion || [];
  const opsConsumo = compromisos.data?.consumo || [];
  const ovsPendientes = compromisos.data?.ventas || [];
  const incidenciasAbiertas = incidencias.data.filter(i => !['Cerrada', 'Anulada'].includes(i.estado));
  const costoTotalReceta = detalleReceta.reduce((sum, item) => sum + num(item.costo_total_insumo), 0);
  const columnasMov = 6 + (verPrecios ? 2 : 0);
  const columnasInsumos = 5 + (verPrecios ? 1 : 0);

  const enlace = (tienePermisoRuta, ruta, etiqueta) => (tienePermisoRuta ? (
    <button type="button" className="pg-iconbtn" title={`Abrir ${etiqueta}`} aria-label={`Abrir ${etiqueta}`} onClick={() => navigate(ruta)}>
      <ChevronRight size={15} />
    </button>
  ) : null);

  return (
    <div className="pg-page">
      <div className="pr-topbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/productos')}>
          <ArrowLeft size={16} /> Catálogo
        </button>
      </div>

      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Package size={13} /> {producto.tipo_inventario}</span>
          <h1 className="pg-title">{producto.nombre}</h1>
          <p className="pg-subtitle">
            <span className="pg-code">{producto.codigo}</span>
            {producto.categoria ? <> · {producto.categoria}</> : null} · {unidad} · SUNAT <b>{producto.codigo_unidad_sunat || '—'}</b>
          </p>
          <div className="pg-drawer-badges">
            <BadgeEstadoRegistro estado={producto.estado} />
            <BadgeEstadoStock producto={producto} />
            {producto.requiere_receta ? (
              <span className="badge badge-secondary"><BookOpen size={11} />{Number(producto.total_recetas) || 0} receta(s) activa(s)</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          <div className="pg-kpi is-accent">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Stock actual</span>
              <span className="pg-kpi-icon"><Boxes size={16} /></span>
            </div>
            <span className="pg-kpi-value">{fmtCantidad(producto.stock_actual)} <small>{unidad}</small></span>
            <MedidorStock producto={producto} />
            <span className="pg-kpi-foot">
              mín <b>{fmtCantidad(producto.stock_minimo)}</b> · máx <b>{num(producto.stock_maximo) > 0 ? fmtCantidad(producto.stock_maximo) : '—'}</b>
            </span>
          </div>
          <div className="pg-kpi is-warning">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Pendiente de despacho</span>
              <span className="pg-kpi-icon"><ShoppingCart size={16} /></span>
            </div>
            <span className="pg-kpi-value">{compromisos.loading ? '…' : fmtCantidad(pendienteOV)} <small>{unidad}</small></span>
            <span className="pg-kpi-foot">
              {ovsPendientes.length} OV · reservado <b>{fmtCantidad(resumen?.reservado_ov)}</b>
            </span>
          </div>
          <div className={`pg-kpi ${disponible < 0 ? 'is-danger' : 'is-success'}`}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Disponible</span>
              <span className="pg-kpi-icon"><PackageCheck size={16} /></span>
            </div>
            <span className="pg-kpi-value">{compromisos.loading ? '…' : fmtCantidad(disponible)} <small>{unidad}</small></span>
            <span className="pg-kpi-foot">{disponible < 0 ? 'Faltante frente a lo pendiente en OV' : 'Stock menos lo pendiente en OV'}</span>
          </div>
          <div className="pg-kpi is-info">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">{opsConsumo.length > 0 && opsActivas.length === 0 ? 'Comprometido en producción' : 'En producción'}</span>
              <span className="pg-kpi-icon"><Factory size={16} /></span>
            </div>
            <span className="pg-kpi-value">
              {compromisos.loading ? '…' : fmtCantidad(opsConsumo.length > 0 && opsActivas.length === 0 ? resumen?.consumo_op : resumen?.en_produccion)} <small>{unidad}</small>
            </span>
            <span className="pg-kpi-foot">
              <b>{opsActivas.length}</b> OP por producir · <b>{opsConsumo.length}</b> OP lo consumen
            </span>
          </div>
        </div>

        <div className="pg-grid pg-grid-2">
          <div className="pg-stack">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Info size={16} /> Datos del producto</h2>
              </div>
              <div className="pg-panel-body">
                <div className="pg-kv">
                  <div><span>Código</span><strong className="pg-code">{producto.codigo}</strong></div>
                  <div><span>Tipo de inventario</span><strong>{producto.tipo_inventario}</strong></div>
                  <div><span>Categoría</span><strong>{producto.categoria || '—'}</strong></div>
                  <div><span>Unidad de medida</span><strong>{unidad}</strong></div>
                  <div><span>Unidad SUNAT</span><strong>{producto.codigo_unidad_sunat || 'Sin código'}</strong></div>
                  <div><span>Peso unitario</span><strong>{fmtPeso(producto.peso_unitario)}</strong></div>
                  <div><span>Receta principal</span><strong>{producto.receta_principal || (producto.requiere_receta ? 'Sin definir' : 'No requiere')}</strong></div>
                  <div><span>Estado</span><strong>{producto.estado}</strong></div>
                  {verPrecios && vendible && <div><span>Precio de venta</span><strong>{fmtMonto(producto.precio_venta)}</strong></div>}
                  {producto.descripcion && <div className="wide"><span>Descripción</span><strong>{producto.descripcion}</strong></div>}
                </div>
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Layers size={16} /> Compromisos</h2>
                <span className="pg-panel-meta">Órdenes de producción y de venta abiertas</span>
              </div>
              <div className="pg-panel-body pg-stack">
                {compromisos.loading ? (
                  <div className="pg-loading"><Loader size={20} className="animate-spin" /></div>
                ) : !compromisos.data ? (
                  <p className="pg-empty-line">No se pudieron cargar los compromisos de este producto.</p>
                ) : (
                  <>
                    <div>
                      <h3 className="pg-section-title"><Factory size={14} /> Órdenes de producción en curso</h3>
                      {opsActivas.length === 0 && opsConsumo.length === 0 ? (
                        <p className="pg-empty-line">No hay órdenes de producción abiertas para este producto.</p>
                      ) : (
                        <ul className="pg-list">
                          {opsActivas.map(op => (
                            <li key={`p-${op.id_orden}`}>
                              <span className="pg-code">{op.numero_orden}</span>
                              <BadgeEstadoProduccion estado={op.estado} />
                              <span className="pg-muted">
                                {fmtCantidad(op.cantidad_producida)} / {fmtCantidad(op.cantidad_planificada)} {unidad}
                              </span>
                              <span className="pg-list-push">
                                {op.supervisor && <span className="pg-muted">{op.supervisor}</span>}
                                {enlace(verOrdenesProduccion, `/produccion/ordenes/${op.id_orden}`, op.numero_orden)}
                              </span>
                            </li>
                          ))}
                          {opsConsumo.map(op => (
                            <li key={`c-${op.id_orden}`}>
                              <span className="pg-code">{op.numero_orden}</span>
                              <BadgeEstadoProduccion estado={op.estado} />
                              <span className="pg-tag is-accent"><TrendingDown size={11} />Consume {fmtCantidad(op.cantidad_requerida)} {unidad}</span>
                              <span className="pg-list-push">
                                <span className="pg-muted">{op.producto_terminado}</span>
                                {enlace(verOrdenesProduccion, `/produccion/ordenes/${op.id_orden}`, op.numero_orden)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="pg-section-title"><ShoppingCart size={14} /> Pendiente de despacho en órdenes de venta</h3>
                      {ovsPendientes.length === 0 ? (
                        <p className="pg-empty-line">No hay órdenes de venta con saldo pendiente de este producto.</p>
                      ) : (
                        <ul className="pg-list">
                          {ovsPendientes.map(ov => (
                            <li key={ov.id_orden_venta}>
                              <span className="pg-code">{ov.numero_orden}</span>
                              <span className="pg-tag">{ov.estado}</span>
                              <span><b>{fmtCantidad(ov.pendiente)}</b> <span className="pg-muted">de {fmtCantidad(ov.cantidad)} {unidad}</span></span>
                              {num(ov.reservada) > 0 && <span className="pg-tag is-info"><PackageCheck size={11} />Reservado {fmtCantidad(ov.reservada)}</span>}
                              <span className="pg-list-push">
                                <span className="pg-muted pr-ellipsis">{ov.cliente || '—'}</span>
                                {ov.fecha_entrega_estimada && <span className="pg-muted"><CalendarDays size={12} />{fmtFecha(ov.fecha_entrega_estimada)}</span>}
                                {enlace(verOrdenesVenta, `/ventas/ordenes/${ov.id_orden_venta}`, ov.numero_orden)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="pg-stack">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><FileText size={16} /> Reportes</h2>
              </div>
              <div className="pg-panel-body pg-stack">
                <div className="pr-dates">
                  <div className="pg-field">
                    <label className="pg-field-label" htmlFor="pr-rep-desde">Desde</label>
                    <input id="pr-rep-desde" type="date" className="form-input" value={repDesde} onChange={(e) => setRepDesde(e.target.value)} />
                  </div>
                  <div className="pg-field">
                    <label className="pg-field-label" htmlFor="pr-rep-hasta">Hasta</label>
                    <input id="pr-rep-hasta" type="date" className="form-input" value={repHasta} onChange={(e) => setRepHasta(e.target.value)} />
                  </div>
                </div>
                <div className="pr-report">
                  <div>
                    <strong>Producción vs despacho</strong>
                    <span>Reporte de este producto en el rango elegido.</span>
                  </div>
                  <div className="pr-report-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={!!generando} onClick={() => descargar('prod-pdf')}>
                      {generando === 'prod-pdf' ? <Loader size={14} className="animate-spin" /> : <FileText size={14} />} PDF
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={!!generando} onClick={() => descargar('prod-xlsx')}>
                      {generando === 'prod-xlsx' ? <Loader size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
                    </button>
                  </div>
                </div>
                <div className="pr-report">
                  <div>
                    <strong>Kardex · {producto.tipo_inventario}</strong>
                    <span>Kardex del tipo de inventario de este producto.</span>
                  </div>
                  <div className="pr-report-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={!!generando} onClick={() => descargar('kardex-pdf')}>
                      {generando === 'kardex-pdf' ? <Loader size={14} className="animate-spin" /> : <FileText size={14} />} PDF
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={!!generando} onClick={() => descargar('kardex-xlsx')}>
                      {generando === 'kardex-xlsx' ? <Loader size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {verIncidencias && (
              <section className="pg-panel">
                <div className="pg-panel-head">
                  <h2 className="pg-panel-title">
                    <ShieldAlert size={16} /> Incidencias de calidad <span className="pg-count">{incidencias.data.length}</span>
                  </h2>
                  {incidenciasAbiertas.length > 0 && <span className="pg-panel-meta">{incidenciasAbiertas.length} abiertas</span>}
                </div>
                <div className="pg-panel-body">
                  {incidencias.loading ? (
                    <div className="pg-loading"><Loader size={20} className="animate-spin" /></div>
                  ) : incidencias.data.length === 0 ? (
                    <p className="pg-empty-line">Este producto no tiene incidencias de calidad registradas.</p>
                  ) : (
                    <ul className="pg-list">
                      {incidencias.data.slice(0, 6).map(inc => {
                        const cfg = getEstadoBadge(inc.estado);
                        const Icono = cfg.icono;
                        return (
                          <li key={inc.id_incidencia} className={inc.estado === 'Anulada' ? 'is-void' : ''}>
                            <span className="pg-code">{inc.codigo}</span>
                            <span className={`badge ${cfg.bg}`}><Icono size={11} />{inc.estado}</span>
                            {inc.severidad && (
                              <span className={`pg-tag ${inc.severidad === 'Crítica' ? 'is-danger' : inc.severidad === 'Mayor' ? 'is-warning' : ''}`}>
                                <AlertTriangle size={11} />{inc.severidad}
                              </span>
                            )}
                            <span className="pg-list-push">
                              <span className="pg-muted">{inc.tipo_nombre || inc.origen_deteccion}</span>
                              <span className="pg-muted">{haceTexto(inc.fecha_deteccion)}</span>
                              {enlace(true, `/calidad/incidencias/${inc.id_incidencia}`, inc.codigo)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {incidencias.data.length > 6 && (
                    <button type="button" className="btn btn-ghost btn-sm pr-more" onClick={() => navigate('/calidad/incidencias-por-producto')}>
                      Ver las {incidencias.data.length} incidencias <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <div className="pg-segmented" role="tablist" aria-label="Secciones del producto">
              <button type="button" role="tab" aria-selected={tabActiva === 'movimientos'} className={tabActiva === 'movimientos' ? 'active' : ''}
                onClick={() => setTabActiva('movimientos')}>
                <History size={14} /> Movimientos
              </button>
              <button type="button" role="tab" aria-selected={tabActiva === 'recetas'} className={tabActiva === 'recetas' ? 'active' : ''}
                onClick={() => setTabActiva('recetas')}>
                <BookOpen size={14} /> Recetas (BOM)
              </button>
            </div>
            {tabActiva === 'movimientos' && (
              <span className="pg-panel-meta">Entradas, salidas, transferencias, consumo en producción y ajustes por conteo físico</span>
            )}
            {tabActiva === 'recetas' && producto.requiere_receta && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModalReceta()}>
                <Plus size={14} /> Nueva receta
              </button>
            )}
          </div>

          {tabActiva === 'movimientos' && (
            <>
              <div className="pr-tabbar">
                <div className="pg-chips" role="group" aria-label="Tipo de movimiento">
                  {FILTROS_MOVIMIENTO.map(f => {
                    const total = f.id ? movimientos.data.filter(m => GRUPOS_MOVIMIENTO[f.id].includes(m.tipo_movimiento)).length : movimientos.data.length;
                    return (
                      <button key={f.id || 'todos'} type="button" className={`pg-chip ${filtroMovimiento === f.id ? 'on' : ''}`}
                        aria-pressed={filtroMovimiento === f.id} onClick={() => setFiltroMovimiento(f.id)}>
                        {f.label} <b>{total}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pg-table-wrap">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Inventario / origen</th>
                      <th>Destino / detalle</th>
                      <th className="num">Cantidad</th>
                      {verPrecios && <th className="num">Costo unit.</th>}
                      {verPrecios && <th className="num">Costo total</th>}
                      <th>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.loading ? (
                      <tr><td colSpan={columnasMov}><div className="pg-loading"><Loader size={20} className="animate-spin" /></div></td></tr>
                    ) : movimientosPagina.length === 0 ? (
                      <tr>
                        <td colSpan={columnasMov}>
                          <div className="pg-empty">
                            <History size={34} />
                            <strong>{movimientos.data.length === 0 ? 'Sin movimientos registrados' : 'No hay movimientos de este tipo'}</strong>
                            <span>
                              {movimientos.data.length === 0
                                ? 'Las entradas, salidas, transferencias y ajustes de este producto aparecerán aquí.'
                                : 'Elige otro tipo de movimiento para ver el historial.'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : movimientosPagina.map((m, idx) => {
                      const anulado = m.estado === 'Anulado';
                      const signo = m.tipo_movimiento === 'ajuste' ? Math.sign(num(m.cantidad)) : configMovimiento(m.tipo_movimiento).signo;
                      const cantidad = Math.abs(num(m.cantidad));
                      return (
                        <tr key={`${m.tipo_movimiento}-${m.id_movimiento}-${idx}`} className={anulado ? 'pr-row-off' : ''}>
                          <td className="nowrap">{fmtFecha(m.fecha_movimiento)}</td>
                          <td>
                            <TagMovimiento tipo={m.tipo_movimiento} />
                            {anulado && <span className="pg-tags"><span className="pg-tag is-danger"><XCircle size={11} />Anulado</span></span>}
                          </td>
                          <td>{m.inventario || '—'}</td>
                          <td>
                            <span className="pg-cell-main pr-ellipsis">{m.destino || m.proveedor || '—'}</span>
                            {m.documento_soporte && <span className="pg-cell-sub">Doc: {m.documento_soporte}</span>}
                            {m.detalle_ajuste && <span className="pg-cell-sub">{m.detalle_ajuste}</span>}
                          </td>
                          <td className={`num pr-qty ${signo > 0 ? 'is-in' : signo < 0 ? 'is-out' : ''}`}>
                            {signo > 0 ? <TrendingUp size={12} /> : signo < 0 ? <TrendingDown size={12} /> : null}
                            {signo > 0 ? '+' : signo < 0 ? '−' : ''}{fmtCantidad(cantidad)}
                          </td>
                          {verPrecios && <td className="num">{m.costo_unitario != null ? fmtCosto(m.costo_unitario, m.moneda) : '—'}</td>}
                          {verPrecios && <td className="num">{m.costo_total != null ? fmtMonto(m.costo_total, m.moneda) : '—'}</td>}
                          <td>{m.registrado_por || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PgPager {...paginacionMov} setCurrentPage={setPaginaMov} sustantivo="movimientos" />
            </>
          )}

          {tabActiva === 'recetas' && !producto.requiere_receta && (
            <div className="pg-empty">
              <BookOpen size={34} />
              <strong>Este producto no requiere recetas</strong>
              <span>Los productos de reventa, materias primas e insumos no usan recetas de producción. Puedes activarlo editando el producto en el catálogo.</span>
            </div>
          )}

          {tabActiva === 'recetas' && producto.requiere_receta && recetas.length === 0 && (
            <div className="pg-empty">
              <BookOpen size={34} />
              <strong>No hay recetas configuradas</strong>
              <span>Este producto requiere receta. Crea la primera con sus materiales e insumos.</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModalReceta()}>
                <Plus size={14} /> Crear primera receta
              </button>
            </div>
          )}

          {tabActiva === 'recetas' && producto.requiere_receta && recetas.length > 0 && (
            <div className="pr-recetas">
              <div className="pr-receta-list" role="listbox" aria-label="Recetas">
                {recetas.map(receta => {
                  const activa = recetaSeleccionada?.id_receta_producto === receta.id_receta_producto;
                  return (
                    <button key={receta.id_receta_producto} type="button" role="option" aria-selected={activa}
                      className={`pr-receta ${activa ? 'on' : ''}`} onClick={() => setRecetaSeleccionada(receta)}>
                      <span className="pr-receta-name">
                        {!!receta.es_principal && <Star size={13} className="pr-star" />}
                        {receta.nombre_receta}
                      </span>
                      <span className="pr-receta-meta">
                        {receta.es_activa
                          ? <span className="pr-ok"><CheckCircle size={12} />Activa</span>
                          : <span className="pr-off"><XCircle size={12} />Inactiva</span>}
                        <span>{receta.total_insumos || 0} insumo(s)</span>
                        {receta.version && <span>v{receta.version}</span>}
                      </span>
                      {verPrecios && <span className="pr-receta-cost">{fmtMonto(receta.costo_total_materiales)}</span>}
                    </button>
                  );
                })}
              </div>

              {recetaSeleccionada && (
                <div className="pr-receta-detalle">
                  <div className="pr-receta-head">
                    <div>
                      <h3 className="pr-receta-title">{recetaSeleccionada.nombre_receta}</h3>
                      <div className="pg-drawer-badges">
                        {!!recetaSeleccionada.es_principal && <span className="badge badge-warning"><Star size={11} />Principal</span>}
                        {recetaSeleccionada.es_activa
                          ? <span className="badge badge-success"><CheckCircle size={11} />Activa</span>
                          : <span className="badge badge-danger"><XCircle size={11} />Inactiva</span>}
                        {recetaSeleccionada.version && <span className="badge badge-info">v{recetaSeleccionada.version}</span>}
                      </div>
                      {recetaSeleccionada.descripcion && <p className="pr-receta-desc">{recetaSeleccionada.descripcion}</p>}
                    </div>
                    <div className="pg-rowactions">
                      <button type="button" className="pg-iconbtn" title="Editar receta" aria-label="Editar receta" onClick={() => abrirModalReceta(recetaSeleccionada)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="pg-iconbtn" title="Duplicar receta" aria-label="Duplicar receta"
                        onClick={() => handleDuplicarReceta(recetaSeleccionada.id_receta_producto)}>
                        <Copy size={15} />
                      </button>
                      <button type="button" className="pg-iconbtn is-danger" title="Eliminar receta" aria-label="Eliminar receta"
                        disabled={recetas.length === 1 && !!recetaSeleccionada.es_principal}
                        onClick={() => handleDeleteReceta(recetaSeleccionada.id_receta_producto)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="pg-kv">
                    <div><span>Rendimiento</span><strong>{fmtCantidad(recetaSeleccionada.rendimiento_unidades)} {unidad}</strong></div>
                    <div><span>Tiempo de producción</span><strong><Clock size={12} className="pr-inline-icon" />{recetaSeleccionada.tiempo_produccion_minutos || 0} min</strong></div>
                    <div><span>Insumos</span><strong>{detalleReceta.length}</strong></div>
                    {verPrecios && <div><span>Costo materiales</span><strong>{fmtMonto(costoTotalReceta)}</strong></div>}
                  </div>

                  <div className="pr-subhead">
                    <h3 className="pg-section-title"><Package size={14} /> Insumos y materiales</h3>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirModalInsumo()}>
                      <Plus size={14} /> Agregar insumo
                    </button>
                  </div>

                  <div className="pg-table-wrap pr-bordered">
                    <table className="pg-table">
                      <thead>
                        <tr>
                          <th className="center">#</th>
                          <th>Insumo / material</th>
                          <th className="num">Cantidad</th>
                          {verPrecios && <th className="num">Costo total</th>}
                          <th className="num">Stock disponible</th>
                          <th className="center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleReceta.length === 0 ? (
                          <tr>
                            <td colSpan={columnasInsumos}>
                              <div className="pg-empty">
                                <Package size={34} />
                                <strong>Esta receta aún no tiene insumos</strong>
                                <span>Agrega los materiales necesarios para producir el producto.</span>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModalInsumo()}>
                                  <Plus size={14} /> Agregar primer insumo
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : detalleReceta.map(item => {
                          const stock = num(item.stock_actual);
                          const suficiente = stock >= num(item.cantidad_requerida);
                          const orden = parseInt(item.orden_agregado || 0, 10);
                          return (
                            <tr key={item.id_detalle}>
                              <td className="center">{orden > 0 ? <span className="pg-count">{orden}</span> : <span className="pg-muted">—</span>}</td>
                              <td>
                                <span className="pg-cell-main">{item.insumo}</span>
                                <span className="pg-cell-sub"><span className="pg-code">{item.codigo_insumo}</span></span>
                                {(!!item.es_critico || item.notas) && (
                                  <span className="pg-tags">
                                    {!!item.es_critico && <span className="pg-tag is-warning"><AlertTriangle size={11} />Crítico</span>}
                                    {item.notas && <span className="pg-tag">{item.notas}</span>}
                                  </span>
                                )}
                              </td>
                              <td className="num">{fmtCantidad(item.cantidad_requerida)} <span className="pg-muted">{item.unidad_medida}</span></td>
                              {verPrecios && <td className="num">{fmtMonto(item.costo_total_insumo)}</td>}
                              <td className="num">
                                <span className={`pr-qty ${suficiente ? 'is-in' : 'is-out'}`}>{fmtCantidad(stock)} {item.unidad_medida}</span>
                                {!suficiente && <span className="pg-tags"><span className="pg-tag is-danger"><AlertTriangle size={11} />Insuficiente</span></span>}
                              </td>
                              <td className="center">
                                <div className="pg-rowactions">
                                  <button type="button" className="pg-iconbtn" title="Editar insumo" aria-label={`Editar ${item.insumo}`} onClick={() => abrirModalInsumo(item)}>
                                    <Pencil size={15} />
                                  </button>
                                  <button type="button" className="pg-iconbtn is-danger" title="Eliminar insumo" aria-label={`Eliminar ${item.insumo}`}
                                    onClick={() => handleDeleteInsumo(item.id_detalle)}>
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {recetaSeleccionada.notas && (
                    <p className="pg-hint"><Info size={12} />Notas: {recetaSeleccionada.notas}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={modalRecetaOpen} onClose={cerrarModalReceta} title={editandoReceta ? 'Editar receta' : 'Nueva receta'} size="md">
        <form onSubmit={handleSubmitReceta}>
          <div className="pg-form-grid">
            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-r-nombre">Nombre de la receta *</label>
              <input id="pr-r-nombre" type="text" className="form-input" value={formReceta.nombre_receta} required
                placeholder="Ej: Receta estándar, Receta premium"
                onChange={(e) => setFormReceta({ ...formReceta, nombre_receta: e.target.value })} />
            </div>

            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-r-desc">Descripción</label>
              <textarea id="pr-r-desc" className="form-textarea" rows={2} value={formReceta.descripcion}
                placeholder="Descripción de la receta (opcional)"
                onChange={(e) => setFormReceta({ ...formReceta, descripcion: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-r-version">Versión</label>
              <input id="pr-r-version" type="text" className="form-input" value={formReceta.version} placeholder="v1.0"
                onChange={(e) => setFormReceta({ ...formReceta, version: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-r-rend">Rendimiento (unidades) *</label>
              <input id="pr-r-rend" type="number" step="0.01" min="0.01" className="form-input" value={formReceta.rendimiento_unidades}
                placeholder="1.00" required
                onChange={(e) => setFormReceta({ ...formReceta, rendimiento_unidades: e.target.value })} />
            </div>

            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-r-tiempo">Tiempo de producción (minutos)</label>
              <input id="pr-r-tiempo" type="number" min="0" className="form-input" value={formReceta.tiempo_produccion_minutos} placeholder="0"
                onChange={(e) => setFormReceta({ ...formReceta, tiempo_produccion_minutos: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="pg-check">
                <input type="checkbox" checked={formReceta.es_principal}
                  onChange={(e) => setFormReceta({ ...formReceta, es_principal: e.target.checked })} />
                <div>
                  <span>Receta principal</span>
                  <small>Se usa por defecto en producción.</small>
                </div>
              </label>
            </div>

            {editandoReceta && (
              <div className="form-group">
                <label className="pg-check">
                  <input type="checkbox" checked={formReceta.es_activa}
                    onChange={(e) => setFormReceta({ ...formReceta, es_activa: e.target.checked })} />
                  <div>
                    <span>Receta activa</span>
                    <small>Solo las activas se pueden usar en producción.</small>
                  </div>
                </label>
              </div>
            )}

            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-r-notas">Notas</label>
              <textarea id="pr-r-notas" className="form-textarea" rows={3} value={formReceta.notas} placeholder="Notas adicionales (opcional)"
                onChange={(e) => setFormReceta({ ...formReceta, notas: e.target.value })} />
            </div>
          </div>

          <div className="pr-form-actions">
            <button type="button" className="btn btn-outline" onClick={cerrarModalReceta}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editandoReceta ? 'Actualizar' : 'Crear'} receta</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalInsumoOpen} onClose={cerrarModalInsumo} title={editandoInsumo ? 'Editar insumo' : 'Agregar insumo a la receta'} size="md">
        <form onSubmit={handleSubmitInsumo}>
          <div className="pg-form-grid">
            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-i-insumo">Insumo / material *</label>
              <select id="pr-i-insumo" className="form-select" value={formInsumo.id_insumo} onChange={handleInsumoChange} required disabled={!!editandoInsumo}>
                <option value="">Seleccione un insumo...</option>
                {insumosDisponibles.map(insumo => (
                  <option key={insumo.id_producto} value={insumo.id_producto}>
                    {insumo.codigo} - {insumo.nombre} (Stock: {fmtCantidad(insumo.stock_actual)} {insumo.unidad_medida})
                  </option>
                ))}
              </select>
              <small className="pg-hint">Solo se muestran productos de materia prima e insumos.</small>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-i-cant">Cantidad requerida *</label>
              <input id="pr-i-cant" type="number" step="0.0001" min="0.0001" className="form-input" value={formInsumo.cantidad_requerida}
                required placeholder="0.0000"
                onChange={(e) => setFormInsumo({ ...formInsumo, cantidad_requerida: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-i-unidad">Unidad de medida</label>
              <input id="pr-i-unidad" type="text" className="form-input pr-readonly" value={formInsumo.unidad_medida} readOnly />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-i-orden">Orden de agregado</label>
              <input id="pr-i-orden" type="number" min="0" className="form-input" value={formInsumo.orden_agregado} placeholder="0"
                onChange={(e) => setFormInsumo({ ...formInsumo, orden_agregado: e.target.value })} />
            </div>

            <div className="form-group pr-check-cell">
              <label className="pg-check">
                <input type="checkbox" checked={formInsumo.es_critico}
                  onChange={(e) => setFormInsumo({ ...formInsumo, es_critico: e.target.checked })} />
                <div>
                  <span>Insumo crítico</span>
                  <small>Se resalta en la receta y en producción.</small>
                </div>
              </label>
            </div>

            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-i-notas">Notas</label>
              <textarea id="pr-i-notas" className="form-textarea" rows={3} value={formInsumo.notas}
                placeholder="Notas adicionales sobre este insumo (opcional)"
                onChange={(e) => setFormInsumo({ ...formInsumo, notas: e.target.value })} />
            </div>
          </div>

          <div className="pr-form-actions">
            <button type="button" className="btn btn-outline" onClick={cerrarModalInsumo}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editandoInsumo ? 'Actualizar' : 'Agregar'} insumo</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProductoDetalle;
