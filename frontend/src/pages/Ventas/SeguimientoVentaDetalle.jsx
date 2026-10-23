import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, Package, PackageCheck, CalendarDays, Clock, CheckCircle, XCircle, MapPin
} from 'lucide-react';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesVentaAPI } from '../../config/api';
import { BadgeEstadoOrden, configTipoEntrega } from './estadosVentas';
import './Ventas.css';

function SeguimientoVentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [orden, setOrden] = useState(null);
  const [despachos, setDespachos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ordenRes, salidasRes] = await Promise.all([
        ordenesVentaAPI.getById(id),
        ordenesVentaAPI.getSalidas(id).catch(() => ({ data: { data: [] } }))
      ]);
      if (ordenRes.data.success) {
        setOrden(ordenRes.data.data);
      } else {
        setError('No se pudo cargar la orden');
      }
      setDespachos(salidasRes.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar el detalle');
    } finally {
      setLoading(false);
    }
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const formatearNumero = (valor) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(parseFloat(valor || 0));

  if (loading) {
    return (
      <div className="pg-page vt-page">
        <Loading variant="detail" />
      </div>
    );
  }

  const detalle = orden?.detalle || [];
  const totalPedido = detalle.reduce((a, i) => a + parseFloat(i.cantidad || 0), 0);
  const totalDespachado = detalle.reduce((a, i) => a + parseFloat(i.cantidad_despachada || 0), 0);
  const totalPendiente = Math.max(0, totalPedido - totalDespachado);
  const avanceTotal = totalPedido > 0 ? Math.min(100, (totalDespachado / totalPedido) * 100) : 0;
  const despachosActivos = despachos.filter(d => d.estado !== 'Anulado').length;
  const tipoEntrega = configTipoEntrega(orden?.tipo_entrega);

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <button type="button" onClick={() => navigate('/ventas/seguimiento')} className="btn btn-ghost btn-sm vt-back">
            <ArrowLeft size={15} /> Volver al seguimiento
          </button>
          <span className="pg-eyebrow"><Truck size={13} /> Seguimiento de despacho</span>
          <h1 className="pg-title">{orden?.numero_orden || 'Orden de venta'}</h1>
          {orden && (
            <p className="pg-subtitle">
              <b>{orden.cliente}</b> · RUC {orden.ruc_cliente || '—'} · Emitida {formatearFechaVisual(orden.fecha_emision)} · Vendedor <b>{orden.comercial || 'Sin vendedor'}</b>
            </p>
          )}
        </div>
        {orden && (
          <div className="pg-actions">
            <BadgeEstadoOrden estado={orden.estado} />
          </div>
        )}
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {orden && (
          <>
            <div className="pg-kpis">
              <div className="pg-kpi">
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">Pedido</span>
                  <span className="pg-kpi-icon"><Package size={16} /></span>
                </div>
                <span className="pg-kpi-value">{formatearNumero(totalPedido)}</span>
                <span className="pg-kpi-foot"><b>{detalle.length}</b> productos en la orden</span>
              </div>
              <div className="pg-kpi is-accent">
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">Despachado</span>
                  <span className="pg-kpi-icon"><PackageCheck size={16} /></span>
                </div>
                <span className="pg-kpi-value">{formatearNumero(totalDespachado)}</span>
                <div className="pg-meter" title={`${avanceTotal.toFixed(0)}% despachado`}>
                  <span style={{ width: `${avanceTotal}%` }} />
                </div>
                <span className="pg-kpi-foot"><b>{avanceTotal.toFixed(0)}%</b> del pedido</span>
              </div>
              <div className={`pg-kpi ${totalPendiente > 0.0001 ? 'is-warning' : 'is-success'}`}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">Pendiente</span>
                  <span className="pg-kpi-icon">{totalPendiente > 0.0001 ? <Clock size={16} /> : <CheckCircle size={16} />}</span>
                </div>
                <span className="pg-kpi-value">{formatearNumero(totalPendiente)}</span>
                <span className="pg-kpi-foot">{totalPendiente > 0.0001 ? 'Por despachar' : 'Pedido completo'}</span>
              </div>
              <div className="pg-kpi is-info">
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">Despachos</span>
                  <span className="pg-kpi-icon"><Truck size={16} /></span>
                </div>
                <span className="pg-kpi-value">{despachosActivos}</span>
                <span className="pg-kpi-foot">{despachos.length - despachosActivos > 0 ? <><b>{despachos.length - despachosActivos}</b> anulados</> : 'Registrados para esta orden'}</span>
              </div>
            </div>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><MapPin size={16} /> Entrega y transporte</h2>
              </div>
              <div className="pg-panel-body">
                <div className="pg-kv">
                  <div><span>Tipo de entrega</span><strong>{tipoEntrega ? tipoEntrega.label : '—'}</strong></div>
                  <div><span>Fecha estimada</span><strong>{formatearFechaVisual(orden.fecha_entrega_estimada)}</strong></div>
                  <div><span>Fecha de entrega</span><strong>{orden.fecha_entrega_real ? formatearFechaVisual(orden.fecha_entrega_real) : 'Sin registrar'}</strong></div>
                  <div><span>Conductor</span><strong>{orden.conductor_nombre || orden.transporte_conductor || '—'}</strong></div>
                  <div><span>Vehículo</span><strong>{orden.vehiculo_placa_interna || orden.transporte_placa || '—'}</strong></div>
                  {orden.transporte_nombre && <div><span>Transportista</span><strong>{orden.transporte_nombre}</strong></div>}
                  <div className="wide"><span>Dirección de entrega</span><strong>{orden.direccion_entrega || '—'}</strong></div>
                </div>
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Package size={16} /> Productos <span className="pg-count">{detalle.length}</span></h2>
              </div>
              <div className="pg-table-wrap">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Pedido</th>
                      <th className="num">Despachado</th>
                      <th className="num">Pendiente</th>
                      <th>Avance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.length > 0 ? detalle.map((row, idx) => {
                      const pend = row.cantidad_pendiente != null
                        ? parseFloat(row.cantidad_pendiente)
                        : parseFloat(row.cantidad || 0) - parseFloat(row.cantidad_despachada || 0);
                      const pedido = parseFloat(row.cantidad || 0);
                      const desp = parseFloat(row.cantidad_despachada || 0);
                      const pct = pedido > 0 ? Math.min(100, (desp / pedido) * 100) : 0;
                      const colorMeter = pct >= 99.99 ? 'var(--success)' : pct > 0 ? 'var(--accent)' : 'var(--steel)';
                      return (
                        <tr key={row.id_detalle || idx}>
                          <td>
                            <span className="pg-cell-main">{row.producto || row.descripcion_manual || 'Producto'}</span>
                            <span className="pg-cell-sub">{row.codigo_producto || 'S/C'}{row.unidad_medida ? ` · ${row.unidad_medida}` : ''}</span>
                          </td>
                          <td className="num">{formatearNumero(row.cantidad)}</td>
                          <td className="num"><b>{formatearNumero(row.cantidad_despachada)}</b></td>
                          <td className="num" style={{ color: pend > 0.0001 ? 'var(--warning)' : 'var(--success)' }}>
                            <b>{formatearNumero(pend)}</b>
                          </td>
                          <td>
                            <div className="vt-progress">
                              <div className="pg-meter" style={{ '--meter-c': colorMeter }} title={`${pct.toFixed(0)}% despachado`}>
                                <span style={{ width: `${pct}%` }} />
                              </div>
                              <small>{pct.toFixed(0)}%</small>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={5}>
                          <div className="pg-empty">
                            <Package size={28} />
                            <strong>Esta orden no tiene productos</strong>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><Truck size={16} /> Despachos <span className="pg-count">{despachos.length}</span></h2>
              </div>
              <div className="pg-panel-body">
                {despachos.length === 0 ? (
                  <div className="pg-empty">
                    <Truck size={28} />
                    <strong>Aún no se registran despachos</strong>
                    <span>Cuando almacén registre una salida para esta orden aparecerá aquí con sus productos.</span>
                  </div>
                ) : (
                  <ul className="vt-despachos">
                    {despachos.map((d) => {
                      const productos = d.productos || [];
                      const anulado = d.estado === 'Anulado';
                      return (
                        <li key={d.id_salida} className={`vt-despacho ${anulado ? 'is-void' : ''}`}>
                          <div className="vt-despacho-head">
                            <div>
                              <span className="vt-despacho-icon"><Truck size={16} /></span>
                              <div>
                                <span className="pg-cell-main">Despacho #{d.numero_salida || d.id_salida}</span>
                                <span className="pg-cell-sub"><CalendarDays size={11} />{formatearFechaVisual(d.fecha_salida)}</span>
                              </div>
                            </div>
                            <div>
                              <span className="pg-tag"><Package size={11} />{productos.length || d.total_items || 0} ítem(s)</span>
                              <span className={`badge ${anulado ? 'badge-danger' : 'badge-success'}`}>
                                {anulado ? <XCircle size={11} /> : <CheckCircle size={11} />}
                                {anulado ? 'Anulado' : 'Activo'}
                              </span>
                            </div>
                          </div>

                          {productos.length === 0 ? (
                            <p className="vt-despacho-empty">Sin detalle de productos para este despacho.</p>
                          ) : (
                            <ul className="vt-despacho-items">
                              {productos.map((p, idx) => (
                                <li key={`${d.id_salida}-${p.id_producto}-${idx}`}>
                                  <div>
                                    <span className="pg-cell-main">{p.producto || `Producto ${p.id_producto}`}</span>
                                    {p.codigo_producto && <span className="pg-cell-sub">{p.codigo_producto}</span>}
                                  </div>
                                  <span className="vt-despacho-qty">
                                    {formatearNumero(p.cantidad)}
                                    {p.unidad_medida && <small>{p.unidad_medida}</small>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default SeguimientoVentaDetalle;
