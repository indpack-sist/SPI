import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, Eye, ClipboardCheck, RefreshCw, X, Package, Boxes, AlertTriangle,
  BookOpen, Ruler, Info, ExternalLink
} from 'lucide-react';
import { productosAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import { usePagination } from '../../hooks/usePagination';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import ModalConteoFisico from '../../components/Productos/ModalConteoFisico';
import { BadgeEstadoRegistro } from '../Maestros/estadosMaestros';
import { fmtMonto, incluye } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import {
  ESTADOS_STOCK, ORDEN_ESTADOS_STOCK, estadoStock, BadgeEstadoStock, MedidorStock,
  fmtCantidad, fmtPeso, esTipoVendible
} from './estadosProductos';
import './Productos.css';

const FORM_VACIO = {
  codigo: '',
  nombre: '',
  descripcion: '',
  id_categoria: '',
  id_tipo_inventario: '',
  unidad_medida: 'unidad',
  precio_venta: '0',
  peso_unitario: '',
  peso_unidad_display: 'kg',
  stock_minimo: '0',
  stock_maximo: '0',
  requiere_receta: false,
  estado: 'Activo'
};

const UNIDADES = [
  { valor: 'unidad', label: 'Unidad' },
  { valor: 'kg', label: 'Kilogramo (kg)' },
  { valor: 'g', label: 'Gramo (g)' },
  { valor: 'L', label: 'Litro (L)' },
  { valor: 'm', label: 'Metro (m)' },
  { valor: 'm2', label: 'Metro cuadrado (m²)' },
  { valor: 'm3', label: 'Metro cúbico (m³)' },
  { valor: 'mill', label: 'Millar (mill)' },
  { valor: 'bol', label: 'Bolsas (bol)' },
  { valor: 'caja', label: 'Cajas (caja)' }
];

const FILTROS_REGISTRO = [
  { id: '', label: 'Todos' },
  { id: 'Activo', label: 'Activos' },
  { id: 'Inactivo', label: 'Inactivos' }
];

const num = (v) => parseFloat(v || 0) || 0;

function Productos() {
  const navigate = useNavigate();
  const { tienePermiso } = usePermisos();
  const verPrecios = tienePermiso('verPrecios');

  const [productos, setProductos] = useState([]);
  const [tiposInventario, setTiposInventario] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [formData, setFormData] = useState(FORM_VACIO);

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStock, setFiltroStock] = useState('');
  const [filtroRegistro, setFiltroRegistro] = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState(false);

  const [modalConteoOpen, setModalConteoOpen] = useState(false);
  const [productoConteo, setProductoConteo] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [prodRes, tiposRes, categRes] = await Promise.all([
        productosAPI.getAllConCosto(),
        productosAPI.getTiposInventario(),
        productosAPI.getCategorias()
      ]);

      const lista = prodRes.data.data || [];
      setProductos(lista);
      setTiposInventario(tiposRes.data.data || []);
      setCategorias(categRes.data.data || []);
      setDetalle(prev => (prev ? lista.find(p => p.id_producto === prev.id_producto) || null : null));
    } catch (err) {
      setError(err.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const abrirModal = (producto = null) => {
    if (producto) {
      const pesoKg = num(producto.peso_unitario);
      const enGramos = pesoKg > 0 && pesoKg < 1;
      setEditando(producto);
      setFormData({
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        id_categoria: producto.id_categoria || '',
        id_tipo_inventario: producto.id_tipo_inventario,
        unidad_medida: producto.unidad_medida,
        precio_venta: producto.precio_venta ?? '0',
        peso_unitario: pesoKg > 0 ? String(enGramos ? pesoKg * 1000 : pesoKg) : '',
        peso_unidad_display: enGramos ? 'g' : 'kg',
        stock_minimo: producto.stock_minimo,
        stock_maximo: producto.stock_maximo,
        requiere_receta: !!producto.requiere_receta,
        estado: producto.estado
      });
    } else {
      setEditando(null);
      setFormData(FORM_VACIO);
    }
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const abrirModalConteo = (producto) => {
    setProductoConteo(producto);
    setModalConteoOpen(true);
  };

  const handleConteoSuccess = (data) => {
    const signo = data.diferencia > 0 ? '+' : '';
    setSuccess(`Ajuste ${data.tipo_ajuste.toLowerCase()} realizado: ${signo}${data.diferencia} ${productoConteo?.unidad_medida || ''}`);
    cargarDatos({ silencioso: true });
    setProductoConteo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const dataToSend = { ...formData };
    const peso = parseFloat(dataToSend.peso_unitario);
    dataToSend.peso_unitario = peso > 0 ? (dataToSend.peso_unidad_display === 'g' ? peso / 1000 : peso) : null;
    delete dataToSend.peso_unidad_display;
    if (!dataToSend.id_categoria) dataToSend.id_categoria = null;
    if (!verPrecios) delete dataToSend.precio_venta;

    try {
      if (editando) {
        await productosAPI.update(editando.id_producto, dataToSend);
        setSuccess('Producto actualizado exitosamente');
      } else {
        await productosAPI.create(dataToSend);
        setSuccess('Producto creado exitosamente');
      }
      cerrarModal();
      cargarDatos({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al guardar producto');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de desactivar este producto?')) return;

    try {
      setError(null);
      await productosAPI.delete(id);
      setSuccess('Producto desactivado exitosamente');
      cargarDatos({ silencioso: true });
    } catch (err) {
      setError(err.error || 'Error al desactivar producto');
    }
  };

  const termino = busqueda.trim().toLowerCase();
  const productosFiltrados = productos.filter(p => {
    if (filtroTipo && String(p.id_tipo_inventario) !== String(filtroTipo)) return false;
    if (filtroRegistro && p.estado !== filtroRegistro) return false;
    const estado = estadoStock(p);
    if (filtroStock && estado !== filtroStock) return false;
    if (filtroAlerta && estado !== 'sin' && estado !== 'bajo') return false;
    if (!termino) return true;
    return incluye(p.nombre, termino) || incluye(p.codigo, termino) || incluye(p.categoria, termino)
      || incluye(p.codigo_unidad_sunat, termino);
  });

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(productosFiltrados, { storageKey: 'productos_pagina' });
  useResetPagina(setCurrentPage, [busqueda, filtroTipo, filtroStock, filtroRegistro, filtroAlerta]);

  const hayFiltros = !!(busqueda || filtroTipo || filtroStock || filtroRegistro || filtroAlerta);
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroTipo('');
    setFiltroStock('');
    setFiltroRegistro('');
    setFiltroAlerta(false);
  };

  if (loading) return <Loading variant="table" />;

  const activos = productos.filter(p => p.estado === 'Activo');
  const conteoEstados = activos.reduce((acc, p) => {
    const e = estadoStock(p);
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});
  const enAlerta = (conteoEstados.sin || 0) + (conteoEstados.bajo || 0);
  const conteoTipos = tiposInventario.map(t => ({
    ...t,
    total: productos.filter(p => String(p.id_tipo_inventario) === String(t.id_tipo_inventario)).length
  }));

  const nombreTipo = (id) => tiposInventario.find(t => String(t.id_tipo_inventario) === String(id))?.nombre;
  const mostrarPrecioVenta = verPrecios && esTipoVendible(nombreTipo(formData.id_tipo_inventario));

  const columnas = 9 + (verPrecios ? 1 : 0);

  const renderDrawer = () => {
    const p = detalle;
    return (
      <PgDrawer
        eyebrow={<><Package size={12} /> {p.tipo_inventario}</>}
        title={p.nombre}
        badges={(
          <>
            <BadgeEstadoRegistro estado={p.estado} />
            <BadgeEstadoStock producto={p} />
            <span className="badge badge-secondary">{p.codigo}</span>
          </>
        )}
        onClose={() => setDetalle(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => abrirModalConteo(p)} disabled={p.estado === 'Inactivo'}>
              <ClipboardCheck size={16} /> Conteo físico
            </button>
            <button type="button" className="btn btn-outline" onClick={() => abrirModal(p)}>
              <Pencil size={16} /> Editar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/productos/${p.id_producto}`)}>
              <ExternalLink size={16} /> Ver ficha completa
            </button>
          </>
        )}
      >
        <section>
          <h3 className="pg-section-title"><Boxes size={14} /> Stock</h3>
          <div className="pr-stock-box">
            <div className="pr-stock-figure">
              <b>{fmtCantidad(p.stock_actual)}</b>
              <span>{p.unidad_medida}</span>
            </div>
            <MedidorStock producto={p} />
            <div className="pr-stock-scale">
              <span>Mínimo <b>{fmtCantidad(p.stock_minimo)}</b></span>
              <span>Máximo <b>{num(p.stock_maximo) > 0 ? fmtCantidad(p.stock_maximo) : '—'}</b></span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="pg-section-title"><Info size={14} /> Datos del producto</h3>
          <div className="pg-kv">
            <div><span>Código</span><strong className="pg-code">{p.codigo}</strong></div>
            <div><span>Categoría</span><strong>{p.categoria || '—'}</strong></div>
            <div><span>Unidad de medida</span><strong>{p.unidad_medida}</strong></div>
            <div><span>Unidad SUNAT</span><strong>{p.codigo_unidad_sunat || 'Sin código'}</strong></div>
            <div><span>Peso unitario</span><strong>{fmtPeso(p.peso_unitario)}</strong></div>
            <div><span>Receta (BOM)</span><strong>{p.requiere_receta ? 'Requiere receta' : 'No requiere'}</strong></div>
            {verPrecios && esTipoVendible(p.tipo_inventario) && (
              <div><span>Precio de venta</span><strong>{fmtMonto(p.precio_venta)}</strong></div>
            )}
            {p.descripcion && <div className="wide"><span>Descripción</span><strong>{p.descripcion}</strong></div>}
          </div>
        </section>
      </PgDrawer>
    );
  };

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Package size={13} /> Productos</span>
          <h1 className="pg-title">Catálogo</h1>
          <p className="pg-subtitle">
            <b>{productos.length}</b> productos · <b>{activos.length}</b> activos · <b>{enAlerta}</b> con stock bajo o sin stock
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => cargarDatos({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => abrirModal()}>
            <Plus size={16} /> Nuevo producto
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="pg-kpis">
          <button type="button" className={`pg-kpi is-accent ${filtroRegistro === 'Activo' && !filtroAlerta ? 'on' : ''}`}
            aria-pressed={filtroRegistro === 'Activo' && !filtroAlerta}
            onClick={() => { setFiltroAlerta(false); setFiltroRegistro(filtroRegistro === 'Activo' ? '' : 'Activo'); }}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Productos activos</span>
              <span className="pg-kpi-icon"><Package size={16} /></span>
            </div>
            <span className="pg-kpi-value">{activos.length}</span>
            <span className="pg-kpi-foot">de <b>{productos.length}</b> registrados · {productos.length - activos.length} inactivos</span>
          </button>

          <button type="button" className={`pg-kpi is-danger ${filtroAlerta ? 'on' : ''}`} aria-pressed={filtroAlerta}
            onClick={() => { setFiltroStock(''); setFiltroAlerta(!filtroAlerta); if (!filtroAlerta) setFiltroRegistro('Activo'); }}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Stock bajo o sin stock</span>
              <span className="pg-kpi-icon"><AlertTriangle size={16} /></span>
            </div>
            <span className="pg-kpi-value">{enAlerta}</span>
            <span className="pg-kpi-foot">
              {filtroAlerta ? 'Filtro activo · pulsa para quitar' : <><b>{conteoEstados.sin || 0}</b> sin stock · <b>{conteoEstados.bajo || 0}</b> bajo mínimo</>}
            </span>
          </button>

          <button type="button" className={`pg-kpi is-info ${filtroStock === 'sobre' ? 'on' : ''}`} aria-pressed={filtroStock === 'sobre'}
            onClick={() => { setFiltroAlerta(false); setFiltroStock(filtroStock === 'sobre' ? '' : 'sobre'); }}>
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Sobre stock</span>
              <span className="pg-kpi-icon"><Boxes size={16} /></span>
            </div>
            <span className="pg-kpi-value">{conteoEstados.sobre || 0}</span>
            <span className="pg-kpi-foot">Por encima del máximo definido</span>
          </button>
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="pr-cat-busqueda">Buscar</label>
                <Search size={14} />
                <input id="pr-cat-busqueda" type="search" className="form-input" placeholder="Nombre, código, categoría o unidad SUNAT"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Estado de stock</span>
                <div className="pg-segmented" role="group" aria-label="Estado de stock">
                  <button type="button" className={!filtroStock && !filtroAlerta ? 'active' : ''} aria-pressed={!filtroStock && !filtroAlerta}
                    onClick={() => { setFiltroStock(''); setFiltroAlerta(false); }}>Todos</button>
                  {ORDEN_ESTADOS_STOCK.map(id => {
                    const cfg = ESTADOS_STOCK[id];
                    const Icono = cfg.icon;
                    const activo = filtroStock === id;
                    return (
                      <button key={id} type="button" className={activo ? 'active' : ''} aria-pressed={activo}
                        onClick={() => { setFiltroAlerta(false); setFiltroStock(activo ? '' : id); }}>
                        <Icono size={13} />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Registro</span>
                <div className="pg-segmented" role="group" aria-label="Estado del registro">
                  {FILTROS_REGISTRO.map(f => (
                    <button key={f.id || 'todos'} type="button" className={filtroRegistro === f.id ? 'active' : ''}
                      aria-pressed={filtroRegistro === f.id} onClick={() => setFiltroRegistro(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="pg-chips" role="group" aria-label="Tipo de inventario">
              <button type="button" className={`pg-chip ${!filtroTipo ? 'on' : ''}`} aria-pressed={!filtroTipo} onClick={() => setFiltroTipo('')}>
                Todos los tipos <b>{productos.length}</b>
              </button>
              {conteoTipos.map(t => {
                const activo = String(filtroTipo) === String(t.id_tipo_inventario);
                return (
                  <button key={t.id_tipo_inventario} type="button" className={`pg-chip ${activo ? 'on' : ''}`} aria-pressed={activo}
                    onClick={() => setFiltroTipo(activo ? '' : t.id_tipo_inventario)}>
                    {t.nombre} <b>{t.total}</b>
                  </button>
                );
              })}
              {hayFiltros && (
                <>
                  <span className="pg-chip-sep" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={limpiarFiltros}>
                    <X size={14} /> Limpiar filtros
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><Package size={16} /> Productos <span className="pg-count">{productosFiltrados.length}</span></h2>
            <span className="pg-panel-meta">Pulsa una fila para ver el detalle rápido</span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Estado de stock</th>
                  <th className="num">Peso unit.</th>
                  {verPrecios && <th className="num">Precio venta</th>}
                  <th>Receta</th>
                  <th>Registro</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={columnas}>
                      <div className="pg-empty">
                        <Package size={34} />
                        <strong>{productos.length === 0 ? 'Aún no hay productos registrados' : 'Ningún producto coincide con los filtros'}</strong>
                        <span>
                          {productos.length === 0
                            ? 'Registra el primer producto para empezar a controlar su stock.'
                            : 'Prueba con otro término de búsqueda o quita algún filtro.'}
                        </span>
                        {productos.length === 0 ? (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirModal()}><Plus size={14} /> Nuevo producto</button>
                        ) : (
                          <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : currentItems.map(p => (
                  <tr key={p.id_producto} className={`is-clickable ${p.estado !== 'Activo' ? 'pr-row-off' : ''}`} onClick={() => setDetalle(p)}>
                    <td>
                      <span className="pg-cell-main">{p.nombre}</span>
                      <span className="pg-cell-sub"><span className="pg-code">{p.codigo}</span>{p.categoria ? ` · ${p.categoria}` : ''}</span>
                    </td>
                    <td><span className="pr-tipo">{p.tipo_inventario}</span></td>
                    <td className="nowrap">
                      <span className="pg-cell-main">{p.unidad_medida}</span>
                      <span className="pg-cell-sub">SUNAT {p.codigo_unidad_sunat || '—'}</span>
                    </td>
                    <td>
                      <div className="pg-measure pr-measure">
                        <div className="pg-measure-top">
                          <b>{fmtCantidad(p.stock_actual)} <small>{p.unidad_medida}</small></b>
                        </div>
                        <MedidorStock producto={p} />
                        <span className="pg-measure-note">
                          mín {fmtCantidad(p.stock_minimo)}{num(p.stock_maximo) > 0 ? ` · máx ${fmtCantidad(p.stock_maximo)}` : ''}
                        </span>
                      </div>
                    </td>
                    <td><BadgeEstadoStock producto={p} /></td>
                    <td className="num">{fmtPeso(p.peso_unitario)}</td>
                    {verPrecios && (
                      <td className="num">{esTipoVendible(p.tipo_inventario) ? fmtMonto(p.precio_venta) : <span className="pg-muted">—</span>}</td>
                    )}
                    <td>
                      {p.requiere_receta ? (
                        <span className={`pg-tag ${Number(p.total_recetas) > 0 ? 'is-accent' : 'is-warning'}`}>
                          <BookOpen size={11} />
                          {Number(p.total_recetas) > 0 ? `${p.total_recetas} receta${Number(p.total_recetas) === 1 ? '' : 's'}` : 'Sin receta'}
                        </span>
                      ) : <span className="pg-muted">No requiere</span>}
                    </td>
                    <td><BadgeEstadoRegistro estado={p.estado} /></td>
                    <td className="center" onClick={(e) => e.stopPropagation()}>
                      <div className="pg-rowactions">
                        <button type="button" className="pg-iconbtn" title="Conteo físico" aria-label={`Conteo físico de ${p.nombre}`}
                          disabled={p.estado === 'Inactivo'} onClick={() => abrirModalConteo(p)}>
                          <ClipboardCheck size={15} />
                        </button>
                        <button type="button" className="pg-iconbtn" title="Ver ficha completa" aria-label={`Ver ficha de ${p.nombre}`}
                          onClick={() => navigate(`/productos/${p.id_producto}`)}>
                          <Eye size={15} />
                        </button>
                        <button type="button" className="pg-iconbtn" title="Editar" aria-label={`Editar ${p.nombre}`} onClick={() => abrirModal(p)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="pg-iconbtn is-danger" title="Desactivar" aria-label={`Desactivar ${p.nombre}`}
                          disabled={p.estado === 'Inactivo'} onClick={() => handleDelete(p.id_producto)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="productos" />
        </section>
      </div>

      {detalle && !modalOpen && !modalConteoOpen && renderDrawer()}

      <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? 'Editar producto' : 'Nuevo producto'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-codigo">Código *</label>
              <input id="pr-f-codigo" type="text" className="form-input" value={formData.codigo} required placeholder="MP-001"
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-tipo">Tipo de inventario *</label>
              <select id="pr-f-tipo" className="form-select" value={formData.id_tipo_inventario} required
                onChange={(e) => setFormData({ ...formData, id_tipo_inventario: e.target.value })}>
                <option value="">Seleccione...</option>
                {tiposInventario.map(tipo => (
                  <option key={tipo.id_tipo_inventario} value={tipo.id_tipo_inventario}>{tipo.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-f-nombre">Nombre *</label>
              <input id="pr-f-nombre" type="text" className="form-input" value={formData.nombre} required placeholder="Nombre del producto"
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
            </div>

            <div className="form-group is-full">
              <label className="form-label" htmlFor="pr-f-desc">Descripción</label>
              <textarea id="pr-f-desc" className="form-textarea" rows={3} value={formData.descripcion}
                placeholder="Descripción detallada del producto"
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-cat">Categoría</label>
              <select id="pr-f-cat" className="form-select" value={formData.id_categoria}
                onChange={(e) => setFormData({ ...formData, id_categoria: e.target.value })}>
                <option value="">Sin categoría</option>
                {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-unidad">Unidad de medida *</label>
              <select id="pr-f-unidad" className="form-select" value={formData.unidad_medida} required
                onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}>
                {UNIDADES.map(u => <option key={u.valor} value={u.valor}>{u.label}</option>)}
              </select>
              {editando && (
                <small className="pg-hint"><Ruler size={12} />Unidad SUNAT: {editando.codigo_unidad_sunat || 'sin código asignado'}</small>
              )}
            </div>

            {mostrarPrecioVenta && (
              <div className="form-group">
                <label className="form-label" htmlFor="pr-f-precio">Precio de venta (PEN)</label>
                <input id="pr-f-precio" type="number" step="0.01" className="form-input" value={formData.precio_venta} placeholder="0.00"
                  onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-peso">Peso por unidad</label>
              <div className="pr-inline">
                <input id="pr-f-peso" type="number" step="0.001" min="0" className="form-input" value={formData.peso_unitario} placeholder="0.000"
                  onChange={(e) => setFormData({ ...formData, peso_unitario: e.target.value })} />
                <select className="form-select" aria-label="Unidad de peso" value={formData.peso_unidad_display}
                  onChange={(e) => setFormData({ ...formData, peso_unidad_display: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </div>
              <small className="pg-hint">Opcional. Se usa en cotizaciones y órdenes de venta.</small>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-min">Stock mínimo</label>
              <input id="pr-f-min" type="number" step="0.001" className="form-input" value={formData.stock_minimo} placeholder="0"
                onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-max">Stock máximo</label>
              <input id="pr-f-max" type="number" step="0.001" className="form-input" value={formData.stock_maximo} placeholder="0"
                onChange={(e) => setFormData({ ...formData, stock_maximo: e.target.value })} />
              <small className="pg-hint">Con 0 no se marca sobre stock.</small>
            </div>

            <div className="form-group">
              <label className="pg-check">
                <input type="checkbox" checked={formData.requiere_receta}
                  onChange={(e) => setFormData({ ...formData, requiere_receta: e.target.checked })} />
                <div>
                  <span>Requiere receta (BOM)</span>
                  <small>Producto fabricado con una o más recetas.</small>
                </div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pr-f-estado">Estado *</label>
              <select id="pr-f-estado" className="form-select" value={formData.estado} required
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="pr-form-actions">
            <button type="button" className="btn btn-outline" onClick={cerrarModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {editando ? <><Pencil size={16} /> Actualizar producto</> : <><Plus size={16} /> Crear producto</>}
            </button>
          </div>
        </form>
      </Modal>

      <ModalConteoFisico
        isOpen={modalConteoOpen}
        onClose={() => {
          setModalConteoOpen(false);
          setProductoConteo(null);
        }}
        producto={productoConteo}
        onSuccess={handleConteoSuccess}
      />
    </div>
  );
}

export default Productos;
