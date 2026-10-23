import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Package, Boxes, RefreshCw, X, ExternalLink, Info, ShoppingCart, PackageCheck, Loader, Tag, Factory
} from 'lucide-react';
import { productosAPI } from '../../config/api';
import { usePermisos } from '../../context/PermisosContext';
import { usePagination } from '../../hooks/usePagination';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import PgDrawer from '../../components/UI/PgDrawer';
import PgPager from '../../components/UI/PgPager';
import { fmtMonto, incluye } from '../Maestros/formatoMaestros';
import { useResetPagina } from '../Maestros/useResetPagina';
import {
  ESTADOS_STOCK, ORDEN_ESTADOS_STOCK, estadoStock, BadgeEstadoStock, MedidorStock, fmtCantidad, fmtPeso
} from './estadosProductos';
import './Productos.css';

const esTerminado = (p) => Number(p.id_tipo_inventario) === 3 || p.tipo_inventario === 'Productos Terminados';

const num = (v) => parseFloat(v || 0) || 0;

function ListaProductosSimple() {
  const navigate = useNavigate();
  const { tienePermiso } = usePermisos();
  const verPrecios = tienePermiso('verPrecios');
  const verFicha = tienePermiso('productos');
  const busquedaRef = useRef(null);

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroStock, setFiltroStock] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [compromisos, setCompromisos] = useState({ loading: false, resumen: null });

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    if (!loading) busquedaRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (!detalle) return undefined;
    let vigente = true;
    setCompromisos({ loading: true, resumen: null });
    productosAPI.getCompromisos(detalle.id_producto)
      .then(res => { if (vigente) setCompromisos({ loading: false, resumen: res.data.resumen, ventas: res.data.data?.ventas || [] }); })
      .catch(() => { if (vigente) setCompromisos({ loading: false, resumen: null }); });
    return () => { vigente = false; };
  }, [detalle?.id_producto]);

  const cargarProductos = async ({ silencioso = false } = {}) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await productosAPI.getAll({ estado: 'Activo' });
      if (response.data.success) {
        setProductos((response.data.data || []).filter(esTerminado));
      } else {
        setError('No se pudieron cargar los productos');
      }
    } catch (err) {
      setError(err.error || 'Error de conexión al cargar productos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const termino = busqueda.trim().toLowerCase();
  const productosFiltrados = productos.filter(p => {
    if (filtroStock === 'con' && num(p.stock_actual) <= 0) return false;
    if (filtroStock && filtroStock !== 'con' && estadoStock(p) !== filtroStock) return false;
    if (!termino) return true;
    return incluye(p.nombre, termino) || incluye(p.codigo, termino) || incluye(p.categoria, termino);
  });

  const { currentItems, setCurrentPage, ...paginacion } = usePagination(productosFiltrados, { itemsPerPage: 25, storageKey: 'consulta_stock_pagina' });
  useResetPagina(setCurrentPage, [busqueda, filtroStock]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroStock('');
    busquedaRef.current?.focus();
  };

  if (loading) return <Loading variant="table" />;

  const conteo = productos.reduce((acc, p) => {
    const e = estadoStock(p);
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});
  const conStock = productos.filter(p => num(p.stock_actual) > 0).length;

  const kpis = [
    { id: 'con', label: 'Con stock', tono: 'is-success', icon: PackageCheck, valor: conStock, foot: `de ${productos.length} productos terminados` },
    { id: 'sin', label: ESTADOS_STOCK.sin.label, tono: ESTADOS_STOCK.sin.tono, icon: ESTADOS_STOCK.sin.icon, valor: conteo.sin || 0, foot: 'Sin existencias en almacén' },
    { id: 'bajo', label: ESTADOS_STOCK.bajo.label, tono: ESTADOS_STOCK.bajo.tono, icon: ESTADOS_STOCK.bajo.icon, valor: conteo.bajo || 0, foot: 'En o por debajo del mínimo' },
    { id: 'sobre', label: ESTADOS_STOCK.sobre.label, tono: ESTADOS_STOCK.sobre.tono, icon: ESTADOS_STOCK.sobre.icon, valor: conteo.sobre || 0, foot: 'Por encima del máximo' }
  ];

  const columnas = 4 + (verPrecios ? 1 : 0);

  const renderDrawer = () => {
    const p = detalle;
    const resumen = compromisos.resumen;
    const disponible = num(p.stock_actual) - num(resumen?.pendiente_ov);
    return (
      <PgDrawer
        eyebrow={<><Boxes size={12} /> Consulta de stock</>}
        title={p.nombre}
        badges={<><BadgeEstadoStock producto={p} /><span className="badge badge-secondary">{p.codigo}</span></>}
        onClose={() => setDetalle(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDetalle(null)}>Cerrar</button>
            {verFicha && (
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/productos/${p.id_producto}`)}>
                <ExternalLink size={16} /> Ver ficha completa
              </button>
            )}
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
          <h3 className="pg-section-title"><ShoppingCart size={14} /> Compromisos</h3>
          {compromisos.loading ? (
            <div className="pg-loading"><Loader size={20} className="animate-spin" /></div>
          ) : !resumen ? (
            <p className="pg-empty-line">No se pudo consultar lo comprometido en órdenes de venta.</p>
          ) : (
            <div className="pg-kv">
              <div><span>Pendiente de despacho</span><strong>{fmtCantidad(resumen.pendiente_ov)} {p.unidad_medida}</strong></div>
              <div><span>Reservado en OV</span><strong>{fmtCantidad(resumen.reservado_ov)} {p.unidad_medida}</strong></div>
              <div>
                <span>Disponible</span>
                <strong className={disponible < 0 ? 'pr-qty is-out' : 'pr-qty is-in'}>{fmtCantidad(disponible)} {p.unidad_medida}</strong>
              </div>
              <div><span><Factory size={11} className="pr-inline-icon" />En producción</span><strong>{fmtCantidad(resumen.en_produccion)} {p.unidad_medida}</strong></div>
              <div className="wide"><span>Órdenes de venta abiertas</span><strong>{compromisos.ventas?.length || 0}</strong></div>
            </div>
          )}
        </section>

        <section>
          <h3 className="pg-section-title"><Info size={14} /> Datos</h3>
          <div className="pg-kv">
            <div><span>Código</span><strong className="pg-code">{p.codigo}</strong></div>
            <div><span>Categoría</span><strong>{p.categoria || '—'}</strong></div>
            <div><span>Unidad</span><strong>{p.unidad_medida}{p.codigo_unidad_sunat ? ` · SUNAT ${p.codigo_unidad_sunat}` : ''}</strong></div>
            <div><span>Peso unitario</span><strong>{fmtPeso(p.peso_unitario)}</strong></div>
            {verPrecios && <div><span><Tag size={11} className="pr-inline-icon" />Precio de venta</span><strong>{fmtMonto(p.precio_venta)}</strong></div>}
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
          <h1 className="pg-title">Stock</h1>
          <p className="pg-subtitle">
            Existencias de <b>{productos.length}</b> productos terminados activos · <b>{conStock}</b> con stock disponible
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => cargarProductos({ silencioso: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        <div className="pg-kpis">
          {kpis.map(k => {
            const Icono = k.icon;
            const activo = filtroStock === k.id;
            return (
              <button key={k.id} type="button" className={`pg-kpi ${k.tono} ${activo ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroStock(activo ? '' : k.id)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{k.valor}</span>
                <span className="pg-kpi-foot">{activo ? 'Filtro activo · pulsa para quitar' : k.foot}</span>
              </button>
            );
          })}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="pr-stock-busqueda">Buscar producto</label>
                <Search size={14} />
                <input id="pr-stock-busqueda" ref={busquedaRef} type="search" className="form-input" placeholder="Nombre, código o categoría"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Estado de stock</span>
                <div className="pg-segmented" role="group" aria-label="Estado de stock">
                  <button type="button" className={!filtroStock ? 'active' : ''} aria-pressed={!filtroStock} onClick={() => setFiltroStock('')}>Todos</button>
                  {ORDEN_ESTADOS_STOCK.map(id => {
                    const cfg = ESTADOS_STOCK[id];
                    const Icono = cfg.icon;
                    const activo = filtroStock === id;
                    return (
                      <button key={id} type="button" className={activo ? 'active' : ''} aria-pressed={activo}
                        onClick={() => setFiltroStock(activo ? '' : id)}>
                        <Icono size={13} />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {(busqueda || filtroStock) && (
              <div className="pg-chips">
                <button type="button" className="btn btn-ghost btn-sm" onClick={limpiarFiltros}>
                  <X size={14} /> Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="pg-panel">
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><Boxes size={16} /> Productos terminados <span className="pg-count">{productosFiltrados.length}</span></h2>
            <span className="pg-panel-meta">Pulsa una fila para ver lo comprometido y el disponible</span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock disponible</th>
                  <th>Estado</th>
                  <th className="num">Mín · Máx</th>
                  {verPrecios && <th className="num">Precio venta</th>}
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={columnas}>
                      <div className="pg-empty">
                        <Search size={34} />
                        <strong>{productos.length === 0 ? 'No hay productos terminados activos' : 'Ningún producto coincide'}</strong>
                        <span>
                          {productos.length === 0
                            ? 'Cuando se registren productos terminados, su stock aparecerá aquí.'
                            : termino
                              ? `No encontramos "${busqueda.trim()}". Revisa el código o prueba con parte del nombre.`
                              : 'No hay productos en este estado de stock.'}
                        </span>
                        {productos.length > 0 && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={limpiarFiltros}><X size={14} /> Limpiar filtros</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : currentItems.map(p => (
                  <tr key={p.id_producto} className="is-clickable" onClick={() => setDetalle(p)}>
                    <td>
                      <span className="pg-cell-main">{p.nombre}</span>
                      <span className="pg-cell-sub"><span className="pg-code">{p.codigo}</span>{p.categoria ? ` · ${p.categoria}` : ''}</span>
                    </td>
                    <td>
                      <div className="pg-measure pr-measure">
                        <div className="pg-measure-top">
                          <b className="pr-stock-num">{fmtCantidad(p.stock_actual, 2)} <small>{p.unidad_medida}</small></b>
                        </div>
                        <MedidorStock producto={p} />
                      </div>
                    </td>
                    <td><BadgeEstadoStock producto={p} /></td>
                    <td className="num pg-muted">
                      {fmtCantidad(p.stock_minimo, 2)} · {num(p.stock_maximo) > 0 ? fmtCantidad(p.stock_maximo, 2) : '—'}
                    </td>
                    {verPrecios && <td className="num">{fmtMonto(p.precio_venta)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PgPager {...paginacion} setCurrentPage={setCurrentPage} sustantivo="productos" />
        </section>
      </div>

      {detalle && renderDrawer()}
    </div>
  );
}

export default ListaProductosSimple;
