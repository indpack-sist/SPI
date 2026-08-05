import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Search, X, Eye, Clock, PlayCircle, Factory,
  CheckCircle, XCircle, Package, Calendar, RefreshCcw
} from 'lucide-react';
import Table from '../../components/UI/Table';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { ordenesVentaAPI } from '../../config/api';

/**
 * Vista de SOLO seguimiento de despachos para el rol Calidad.
 * Muestra cliente / producto / cantidades / despachos / pendientes,
 * sin ningún dato financiero (precios, totales, pagos, facturación).
 */
function SeguimientoVentas() {
  const navigate = useNavigate();

  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState(() => sessionStorage.getItem('seg_busqueda') || '');
  const [fechaInicio, setFechaInicio] = useState(() => sessionStorage.getItem('seg_fecha_inicio') || '');
  const [fechaFin, setFechaFin] = useState(() => sessionStorage.getItem('seg_fecha_fin') || '');
  const [filtroEstado, setFiltroEstado] = useState(() => sessionStorage.getItem('seg_estado') || '');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    sessionStorage.setItem('seg_busqueda', busqueda);
    sessionStorage.setItem('seg_fecha_inicio', fechaInicio);
    sessionStorage.setItem('seg_fecha_fin', fechaFin);
    sessionStorage.setItem('seg_estado', filtroEstado);
  }, [busqueda, fechaInicio, fechaFin, filtroEstado]);

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin, filtroEstado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const filtros = {};
      if (filtroEstado) filtros.estado = [filtroEstado];
      if (fechaInicio) filtros.fecha_inicio = fechaInicio;
      if (fechaFin) filtros.fecha_fin = fechaFin;

      const response = await ordenesVentaAPI.getAll(filtros);
      if (response.data.success) {
        setOrdenes(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar el seguimiento de órdenes');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFechaInicio('');
    setFechaFin('');
    setFiltroEstado('');
    setCurrentPage(1);
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

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

  const ordenesFiltradas = ordenes.filter(orden => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      orden.numero_orden?.toLowerCase().includes(term) ||
      orden.cliente?.toLowerCase().includes(term) ||
      orden.ruc_cliente?.toLowerCase().includes(term) ||
      orden.comercial?.toLowerCase().includes(term)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const columns = [
    {
      header: 'Orden',
      accessor: 'numero_orden',
      width: '150px',
      render: (value, row) => (
        <div>
          <div className="font-mono font-bold text-mist">{value}</div>
          <div className="text-[10px] text-wire uppercase tracking-wider">
            {formatearFechaVisual(row.fecha_emision)}
          </div>
        </div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      render: (value, row) => (
        <div>
          <div className="font-medium text-mist">{value}</div>
          <div className="text-xs text-wire">RUC: {row.ruc_cliente || '-'}</div>
        </div>
      )
    },
    {
      header: 'Vendedor',
      accessor: 'comercial',
      width: '160px',
      render: (value) => <div className="text-xs text-mist">{value || 'Sin asignar'}</div>
    },
    {
      header: 'Ítems',
      accessor: 'total_items',
      width: '90px',
      align: 'center',
      render: (value) => (
        <span className="inline-flex items-center gap-1 text-mist font-bold">
          <Package size={14} className="text-wire" /> {value || 0}
        </span>
      )
    },
    {
      header: 'Despachos',
      accessor: 'total_despachos',
      width: '110px',
      align: 'center',
      render: (value) => {
        const n = Number(value || 0);
        return (
          <span className={`inline-flex items-center gap-1 font-bold ${n > 0 ? 'text-primary' : 'text-wire'}`}>
            <Truck size={14} /> {n}
          </span>
        );
      }
    },
    {
      header: 'Estado',
      accessor: 'estado',
      width: '140px',
      align: 'center',
      render: (value) => {
        const config = getEstadoConfig(value);
        const Icono = config.icono;
        return (
          <span className={`badge ${config.clase} text-[10px]`}>
            <Icono size={12} /> {config.texto}
          </span>
        );
      }
    },
    {
      header: '',
      accessor: 'id_orden_venta',
      width: '70px',
      align: 'center',
      render: (value) => (
        <button
          className="btn btn-xs btn-primary p-1.5"
          onClick={(e) => { e.stopPropagation(); navigate(`/ventas/seguimiento/${value}`); }}
          title="Ver seguimiento"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  return (
    <div className="p-4 md:p-6 page-ordenes-venta">
      <style dangerouslySetInnerHTML={{__html: `
        .page-ordenes-venta, .page-ordenes-venta .card { background-color: var(--carbon) !important; color: var(--mist) !important; }
        .page-ordenes-venta .form-input, .page-ordenes-venta input {
          background-color: var(--carbon-mid) !important; border: 1px solid var(--steel) !important; color: var(--white) !important; font-family: inherit !important;
        }
        .page-ordenes-venta .table-container { background-color: var(--carbon) !important; border: 1px solid var(--border) !important; border-radius: 6px !important; }
      `}} />

      {loading && <Loading message="Cargando seguimiento..." />}

      <div className={`transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-primary/10 rounded-lg"><Truck size={28} className="text-primary" /></div>
              <span className="uppercase font-barlow text-white">Seguimiento de Despachos</span>
            </h1>
            <p className="text-[0.7rem] text-wire uppercase tracking-[0.2em] mt-1">
              Pedido · Despachado · Pendiente por orden de venta
            </p>
          </div>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        <div className="card mb-4 bg-carbon-mid border border-steel/30 shadow-xl">
          <div className="card-body p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire" />
                <input
                  type="text"
                  className="form-input w-full pl-10 h-11"
                  placeholder="Buscar por N° orden, cliente, RUC o vendedor..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="form-input text-xs h-11 px-3"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="En Espera">En Espera</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Atendido por Producción">Atendido por Producción</option>
                  <option value="Despacho Parcial">Despacho Parcial</option>
                  <option value="Despachada">Despachada</option>
                  <option value="Entregada">Entregada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
                <input type="date" className="form-input text-xs h-11 w-36" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                <input type="date" className="form-input text-xs h-11 w-36" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                <button onClick={limpiarFiltros} className="btn btn-outline border-steel text-danger hover:bg-danger/10 h-11 px-3" title="Limpiar filtros"><X size={18} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-2xl">
          <div className="card-header flex items-center justify-between border-b border-steel/20">
            <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              Órdenes <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">{ordenesFiltradas.length}</span>
            </h2>
            <div className="text-[0.6rem] font-bold text-wire uppercase tracking-widest">Mostrando {currentItems.length} registros</div>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <Table
                columns={columns}
                data={currentItems}
                emptyMessage="No hay órdenes con los filtros aplicados"
                onRowClick={(row) => navigate(`/ventas/seguimiento/${row.id_orden_venta}`)}
              />
            </div>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-carbon-mid border-t border-steel/30 flex items-center justify-center gap-3">
              <button className="btn btn-outline border-steel h-10 px-4 font-black text-[0.7rem] tracking-widest" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>ANTERIOR</button>
              <span className="text-sm font-black text-mist tracking-widest">{currentPage} / {totalPages}</span>
              <button className="btn btn-outline border-steel h-10 px-4 font-black text-[0.7rem] tracking-widest" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>SIGUIENTE</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeguimientoVentas;
