import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, Package, User, Calendar, Clock, PlayCircle,
  Factory, CheckCircle, XCircle, Hash
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesVentaAPI } from '../../config/api';

/**
 * Detalle de SOLO seguimiento (rol Calidad): cantidades pedidas, despachadas
 * y pendientes por producto, más el historial de despachos. Sin precios.
 */
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

  const getEstadoConfig = (estado) => {
    const configs = {
      'En Espera': { icono: Clock, clase: 'badge-warning', texto: 'En Espera' },
      'En Proceso': { icono: PlayCircle, clase: 'badge-info', texto: 'En Proceso' },
      'Atendido por Producción': { icono: Factory, clase: 'badge-primary', texto: 'Atendido' },
      'Despacho Parcial': { icono: Truck, clase: 'badge-warning', texto: 'Desp. Parcial' },
      'Despachada': { icono: Truck, clase: 'badge-primary', texto: 'Despachada' },
      'Entregada': { icono: CheckCircle, clase: 'badge-success', texto: 'Entregada' },
      'Cancelada': { icono: XCircle, clase: 'badge-danger', texto: 'Cancelada' }
    };
    return configs[estado] || configs['En Espera'];
  };

  const columnasProductos = [
    {
      header: 'Producto',
      accessor: 'producto',
      render: (value, row) => (
        <div>
          <div className="font-medium text-mist">{value || row.descripcion_manual || 'Producto'}</div>
          <div className="text-[10px] text-wire font-mono uppercase tracking-wider">
            {row.codigo_producto || 'S/C'}{row.unidad_medida ? ` · ${row.unidad_medida}` : ''}
          </div>
        </div>
      )
    },
    {
      header: 'Pedido',
      accessor: 'cantidad',
      width: '110px',
      align: 'right',
      render: (value) => <span className="font-bold text-mist">{formatearNumero(value)}</span>
    },
    {
      header: 'Despachado',
      accessor: 'cantidad_despachada',
      width: '120px',
      align: 'right',
      render: (value) => <span className="font-bold text-primary">{formatearNumero(value)}</span>
    },
    {
      header: 'Pendiente',
      accessor: 'cantidad_pendiente',
      width: '120px',
      align: 'right',
      render: (value, row) => {
        const pend = value != null
          ? parseFloat(value)
          : parseFloat(row.cantidad || 0) - parseFloat(row.cantidad_despachada || 0);
        return (
          <span className={`font-bold ${pend > 0.0001 ? 'text-warning' : 'text-success'}`}>
            {formatearNumero(pend)}
          </span>
        );
      }
    },
    {
      header: 'Avance',
      accessor: 'id_detalle',
      width: '160px',
      render: (value, row) => {
        const pedido = parseFloat(row.cantidad || 0);
        const desp = parseFloat(row.cantidad_despachada || 0);
        const pct = pedido > 0 ? Math.min(100, (desp / pedido) * 100) : 0;
        return (
          <div>
            <div className="w-full bg-carbon-mid rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${pct >= 99.99 ? 'bg-success' : pct > 0 ? 'bg-primary' : 'bg-steel'}`}
                style={{ width: `${pct}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-wire mt-1 text-right">{pct.toFixed(0)}%</div>
          </div>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-6 page-ordenes-venta">
        <style dangerouslySetInnerHTML={{__html: `.page-ordenes-venta { background-color: var(--carbon) !important; }`}} />
        <Loading message="Cargando seguimiento..." />
      </div>
    );
  }

  const detalle = orden?.detalle || [];
  const totalPedido = detalle.reduce((a, i) => a + parseFloat(i.cantidad || 0), 0);
  const totalDespachado = detalle.reduce((a, i) => a + parseFloat(i.cantidad_despachada || 0), 0);
  const totalPendiente = Math.max(0, totalPedido - totalDespachado);
  const estadoConfig = getEstadoConfig(orden?.estado);
  const EstadoIcono = estadoConfig.icono;

  return (
    <div className="p-4 md:p-6 page-ordenes-venta">
      <style dangerouslySetInnerHTML={{__html: `
        .page-ordenes-venta, .page-ordenes-venta .card { background-color: var(--carbon) !important; color: var(--mist) !important; }
        .page-ordenes-venta .table-container { background-color: var(--carbon) !important; border: 1px solid var(--border) !important; border-radius: 6px !important; }
      `}} />

      <button
        onClick={() => navigate('/ventas/seguimiento')}
        className="btn btn-outline border-steel text-mist mb-4 h-10 px-4 flex items-center gap-2 font-black text-[0.7rem] tracking-widest"
      >
        <ArrowLeft size={16} /> VOLVER
      </button>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {orden && (
        <>
          {/* Cabecera */}
          <div className="card mb-4 bg-carbon-mid border border-steel/30 shadow-xl">
            <div className="card-body p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Hash size={16} className="text-primary" />
                    <span className="font-mono text-lg font-black text-white">{orden.numero_orden}</span>
                    <span className={`badge ${estadoConfig.clase} text-[10px] ml-2`}>
                      <EstadoIcono size={12} /> {estadoConfig.texto}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-mist mt-2">
                    <User size={16} className="text-wire" />
                    <span className="font-bold">{orden.cliente}</span>
                    <span className="text-xs text-wire">· RUC: {orden.ruc_cliente || '-'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-wire mt-2">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {formatearFechaVisual(orden.fecha_emision)}</span>
                    <span className="flex items-center gap-1"><User size={14} /> {orden.comercial || 'Sin vendedor'}</span>
                  </div>
                </div>

                {/* Resumen de cantidades (sin precios) */}
                <div className="flex gap-3">
                  <div className="text-center px-4 py-2 bg-carbon border border-steel/40 rounded-lg">
                    <div className="text-[0.5rem] font-black text-wire uppercase tracking-widest">Pedido</div>
                    <div className="text-lg font-black text-mist">{formatearNumero(totalPedido)}</div>
                  </div>
                  <div className="text-center px-4 py-2 bg-carbon border border-steel/40 rounded-lg">
                    <div className="text-[0.5rem] font-black text-wire uppercase tracking-widest">Despachado</div>
                    <div className="text-lg font-black text-primary">{formatearNumero(totalDespachado)}</div>
                  </div>
                  <div className="text-center px-4 py-2 bg-carbon border border-steel/40 rounded-lg">
                    <div className="text-[0.5rem] font-black text-wire uppercase tracking-widest">Pendiente</div>
                    <div className={`text-lg font-black ${totalPendiente > 0.0001 ? 'text-warning' : 'text-success'}`}>{formatearNumero(totalPendiente)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Productos */}
          <div className="card shadow-2xl mb-4">
            <div className="card-header flex items-center gap-2 border-b border-steel/20">
              <Package size={18} className="text-primary" />
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Productos</h2>
            </div>
            <div className="card-body p-0">
              <div className="table-container">
                <Table
                  columns={columnasProductos}
                  data={detalle}
                  emptyMessage="Esta orden no tiene productos"
                />
              </div>
            </div>
          </div>

          {/* Despachos */}
          <div className="card shadow-2xl">
            <div className="card-header flex items-center gap-2 border-b border-steel/20">
              <Truck size={18} className="text-primary" />
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                Despachos <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs ml-1">{despachos.length}</span>
              </h2>
            </div>
            <div className="card-body p-4">
              {despachos.length === 0 ? (
                <div className="text-center text-wire py-6 text-sm">Aún no se registran despachos para esta orden.</div>
              ) : (
                <div className="space-y-3">
                  {despachos.map((d) => {
                    const productos = d.productos || [];
                    return (
                      <div key={d.id_salida} className="bg-carbon-mid border border-steel/30 rounded-lg overflow-hidden">
                        {/* Cabecera del despacho */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-steel/20 bg-carbon/40">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg"><Truck size={18} className="text-primary" /></div>
                            <div>
                              <div className="font-bold text-mist">Despacho #{d.numero_salida || d.id_salida}</div>
                              <div className="text-xs text-wire flex items-center gap-1">
                                <Calendar size={12} /> {formatearFechaVisual(d.fecha_salida)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-xs text-mist">
                              <Package size={14} className="text-wire" /> {productos.length || d.total_items || 0} ítem(s)
                            </span>
                            <span className={`badge text-[10px] ${d.estado === 'Anulado' ? 'badge-danger' : 'badge-success'}`}>
                              {d.estado === 'Anulado' ? 'Anulado' : 'Activo'}
                            </span>
                          </div>
                        </div>

                        {/* Productos y cantidades despachadas en este despacho */}
                        {productos.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-wire">Sin detalle de productos para este despacho.</div>
                        ) : (
                          <ul className="divide-y divide-steel/15">
                            {productos.map((p, idx) => (
                              <li key={`${d.id_salida}-${p.id_producto}-${idx}`} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Package size={14} className="text-wire shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm text-mist font-medium truncate">{p.producto || `Producto ${p.id_producto}`}</div>
                                    {p.codigo_producto && (
                                      <div className="text-[10px] text-wire font-mono uppercase tracking-wider">{p.codigo_producto}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                  <span className="font-bold text-primary">{formatearNumero(p.cantidad)}</span>
                                  {p.unidad_medida && (
                                    <span className="text-[10px] text-wire ml-1 uppercase">{p.unidad_medida}</span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SeguimientoVentaDetalle;
