import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Eye, Download, Filter, FileText, Search, RefreshCw, Calendar, CalendarDays,
  DollarSign, Edit, Copy, ExternalLink, CheckCircle2,
  ArrowUpDown, RefreshCcw, AlertTriangle, Clock, ArrowRightLeft
} from 'lucide-react';
import Pagination from '../../components/UI/Pagination';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { cotizacionesAPI, tipoCambioAPI } from '../../config/api';
import { BadgeEstadoCotizacion, configEstadoCotizacion } from './estadosVentas';
import { diasDesde } from '../Maestros/formatoMaestros';
import './Ventas.css';

const TC_SESSION_KEY = 'indpack_tipo_cambio';

function Cotizaciones() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [ordenAscendente, setOrdenAscendente] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [resumen, setResumen] = useState(null);
  const itemsPerPage = 50;
  const tablaRef = useRef(null);
  const requestIdRef = useRef(0);
  const firmaFiltrosRef = useRef(null);

  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);
  const [mostrarConversion, setMostrarConversion] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const estado = params.get('estado');
    const search = params.get('busqueda');
    if (estado) setFiltroEstado(estado);
    if (search) setBusqueda(search);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300);
    return () => clearTimeout(timeout);
  }, [busqueda]);

  useEffect(() => {
    const firma = JSON.stringify([filtroEstado, busquedaAplicada, ordenAscendente]);
    const primeraVez = firmaFiltrosRef.current === null;
    const firmaCambio = !primeraVez && firma !== firmaFiltrosRef.current;

    if (firmaCambio && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    const soloPagina = !primeraVez && !firmaCambio;
    firmaFiltrosRef.current = firma;
    cargarDatos(!primeraVez, soloPagina);
    cargarTCDesdeSession();
  }, [filtroEstado, busquedaAplicada, ordenAscendente, currentPage]);

  useEffect(() => {
    const paginaGuardada = sessionStorage.getItem('cotizaciones_pagina');
    if (paginaGuardada) {
      setCurrentPage(parseInt(paginaGuardada));
      sessionStorage.removeItem('cotizaciones_pagina');
      setTimeout(() => {
        tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [cotizaciones]);

  const cargarTCDesdeSession = () => {
    try {
      const cached = localStorage.getItem(TC_SESSION_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const fechaCache = new Date(new Date(data.timestamp).toLocaleString('en-US', { timeZone: 'America/Lima' }));
        if (
          ahora.getFullYear() === fechaCache.getFullYear() &&
          ahora.getMonth() === fechaCache.getMonth() &&
          ahora.getDate() === fechaCache.getDate()
        ) {
          setTipoCambio(data);
        } else {
          localStorage.removeItem(TC_SESSION_KEY);
        }
      }
    } catch (e) {
      console.error('Error leyendo TC de sesión:', e);
    }
  };

  const actualizarTipoCambio = async () => {
    setLoadingTC(true);
    setError(null);
    try {
      const response = await tipoCambioAPI.actualizar();
      if (response.data.valido) {
        const tcData = {
          compra: response.data.compra,
          venta: response.data.venta,
          promedio: response.data.promedio,
          fecha: response.data.fecha,
          timestamp: Date.now()
        };
        localStorage.setItem(TC_SESSION_KEY, JSON.stringify(tcData));
        setTipoCambio(tcData);
        setSuccessMessage(`Tipo de cambio actualizado: S/ ${tcData.venta} (venta) — Fecha SBS: ${formatearFechaVisual(tcData.fecha)}`);
      } else {
        localStorage.removeItem(TC_SESSION_KEY);
        setTipoCambio(null);
        setError(response.data.error || 'No se pudo obtener el tipo de cambio');
      }
    } catch (err) {
      console.error('Error actualizando TC:', err);
      setError('Error al consultar tipo de cambio. Intente más tarde.');
    } finally {
      setLoadingTC(false);
    }
  };

  const convertirUSDaPEN = (montoUSD) => {
    if (!tipoCambio || !montoUSD) return null;
    return parseFloat(montoUSD) * tipoCambio.venta;
  };

  const cargarDatos = async (silencioso = false, soloDatos = false) => {
    const requestId = ++requestIdRef.current;
    try {
      if (!silencioso) setLoading(true);
      setRefreshing(silencioso);
      setError(null);

      const filtros = {};
      if (filtroEstado) filtros.estado = filtroEstado;
      if (busquedaAplicada) filtros.search = busquedaAplicada;
      filtros.page = currentPage;
      filtros.limit = itemsPerPage;
      filtros.orden = ordenAscendente ? 'asc' : 'desc';
      if (soloDatos) filtros.solo_datos = true;

      const response = await cotizacionesAPI.getAll(filtros);

      if (response.data.success && requestId === requestIdRef.current) {
        setCotizaciones(response.data.data || []);
        if (soloDatos) {
          setPagination(prev => ({ ...prev, page: response.data.pagination?.page ?? prev.page }));
        } else {
          setPagination(response.data.pagination || { total: response.data.data?.length || 0, totalPages: 1 });
          setResumen(response.data.summary || null);
        }
      }
      
    } catch (err) {
      console.error(err);
      if (requestId === requestIdRef.current) setError(err.response?.data?.error || 'Error al cargar cotizaciones');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const cotizacionesFiltradas = cotizaciones;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = cotizacionesFiltradas;
  const totalPages = Math.max(1, pagination.totalPages || 1);

  const estadisticas = (() => {
    const base = resumen ? {
      total: Number(resumen.total || 0),
      pendientes: Number(resumen.pendientes || 0),
      aprobadas: Number(resumen.aprobadas || 0),
      convertidas: Number(resumen.convertidas || 0),
      montoTotalPEN: Number(resumen.monto_total_pen || 0),
      montoTotalUSD: Number(resumen.monto_total_usd || 0),
      montoUSDenPEN: 0
    } : {
      total: cotizaciones.length,
      pendientes: cotizaciones.filter(c => c.estado === 'Pendiente').length,
      aprobadas: cotizaciones.filter(c => c.estado === 'Aprobada').length,
      convertidas: cotizaciones.filter(c => c.estado === 'Convertida').length,
      montoTotalPEN: 0,
      montoTotalUSD: 0,
      montoUSDenPEN: 0
    };

    if (!resumen) cotizaciones.forEach(c => {
      const total = parseFloat(c.total || 0);
      if (c.moneda === 'USD') {
        base.montoTotalUSD += total;
        if (tipoCambio) {
          base.montoUSDenPEN += total * tipoCambio.venta;
        }
      } else {
        base.montoTotalPEN += total;
      }
    });

    if (tipoCambio) base.montoUSDenPEN = base.montoTotalUSD * tipoCambio.venta;

    return base;
  })();

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  };

  const formatearMoneda = (valor, moneda) => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${formatearNumero(parseFloat(valor || 0))}`;
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('T')[0].split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const obtenerEdadTC = () => {
    if (!tipoCambio?.timestamp) return null;
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const finDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
    const restanteMs = finDia - ahora;
    const horasRestantes = Math.floor(restanteMs / 3600000);
    const minutosRestantes = Math.floor((restanteMs % 3600000) / 60000);
    if (horasRestantes > 0) return `Válido por ${horasRestantes}h ${minutosRestantes}min`;
    if (minutosRestantes > 0) return `Válido por ${minutosRestantes} min`;
    return 'Expira pronto';
  };

  const handleDescargarPDF = async (id_cotizacion, numero, cliente, estadoActual) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cotizacionesAPI.descargarPDF(id_cotizacion);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const clienteSanitizado = (cliente || 'CLIENTE')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-zA-Z0-9]/g, "_")   
        .replace(/_+/g, "_")            
        .toUpperCase();

      const nroCot = numero || id_cotizacion;
      const fileName = `${clienteSanitizado}_${nroCot}.pdf`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('PDF descargado exitosamente');

      if (estadoActual === 'Borrador' || estadoActual === 'Pendiente') {
        await cargarDatos(true);
      }

    } catch (err) {
      console.error("Error original:", err);

      if (err.response && err.response.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const errorJson = JSON.parse(errorText);
          const mensajeError = errorJson.error || 'Error al generar el PDF';
          setError(mensajeError);
        } catch (e) {
          setError('Ocurrió un error inesperado al descargar el archivo.');
        }
      } else {
        setError(err.message || 'Error de conexión al descargar el PDF');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicar = (id, e) => {
    e.stopPropagation();
    navigate(`/ventas/cotizaciones/${id}/duplicar`);
  };

  const handleVerDetalle = (id) => {
    sessionStorage.setItem('cotizaciones_pagina', currentPage);
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (busqueda) params.set('busqueda', busqueda);
    const queryString = params.toString();
    navigate(`/ventas/cotizaciones/${id}${queryString ? `?${queryString}` : ''}`);
  };

  if (loading) return <Loading variant="table" />;

  const filtrosEstado = [
    { valor: '', label: 'Todos' },
    { valor: 'Pendiente', label: 'Pendiente' },
    { valor: 'Aprobada', label: 'Aprobada' },
    { valor: 'Convertida', label: 'Convertida' }
  ];

  const kpisEstado = [
    { valor: '', label: 'Total', cantidad: estadisticas.total, tono: '', icon: FileText },
    { valor: 'Pendiente', label: 'Pendientes', cantidad: estadisticas.pendientes, tono: configEstadoCotizacion('Pendiente').tono, icon: configEstadoCotizacion('Pendiente').icon },
    { valor: 'Aprobada', label: 'Aprobadas', cantidad: estadisticas.aprobadas, tono: configEstadoCotizacion('Aprobada').tono, icon: configEstadoCotizacion('Aprobada').icon },
    { valor: 'Convertida', label: 'Convertidas', cantidad: estadisticas.convertidas, tono: configEstadoCotizacion('Convertida').tono, icon: configEstadoCotizacion('Convertida').icon }
  ];

  const vigenciaVencida = (row) => ['Pendiente', 'Enviada'].includes(row.estado)
    && row.fecha_vencimiento && diasDesde(row.fecha_vencimiento) > 0;

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><FileText size={13} /> Ventas</span>
          <h1 className="pg-title">Cotizaciones</h1>
          <p className="pg-subtitle">Gestión de cotizaciones de venta · <b>{pagination.total}</b> {filtroEstado || busquedaAplicada ? 'coinciden con los filtros' : 'registradas'}</p>
        </div>
        <div className="pg-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => cargarDatos(true)}
            disabled={refreshing}
            title="Actualizar datos"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/ventas/cotizaciones/nueva')}
          >
            <Plus size={16} /> Nueva cotización
          </button>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />}

        <section className={`pg-panel vt-tc-panel ${tipoCambio ? 'is-on' : ''}`}>
          <div className="vt-tc">
            <span className="vt-tc-label"><DollarSign size={14} /> Tipo de cambio SBS (USD → PEN)</span>
            {tipoCambio ? (
              <>
                <span>Compra <b>S/ {tipoCambio.compra.toFixed(3)}</b></span>
                <span>Venta <b className="is-accent">S/ {tipoCambio.venta.toFixed(3)}</b></span>
                <span className="vt-tc-meta"><Calendar size={12} /> Fecha SBS: {formatearFechaVisual(tipoCambio.fecha)}</span>
                <span className="vt-tc-meta"><Clock size={12} /> {obtenerEdadTC()}</span>
              </>
            ) : (
              <span className="vt-tc-meta"><AlertTriangle size={14} /> No disponible — Presione "Actualizar TC" para consultar</span>
            )}
          </div>
          <div className="pg-actions">
            {tipoCambio && (
              <button
                type="button"
                className={`btn btn-sm ${mostrarConversion ? 'btn-secondary' : 'btn-outline'}`}
                onClick={() => setMostrarConversion(!mostrarConversion)}
                aria-pressed={mostrarConversion}
                title={mostrarConversion ? 'Ocultar conversiones USD → PEN' : 'Mostrar conversiones USD → PEN'}
              >
                <ArrowRightLeft size={14} />
                {mostrarConversion ? 'Ocultar PEN' : 'Ver en PEN'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={actualizarTipoCambio}
              disabled={loadingTC}
              title="Consulta el TC actual desde la SBS (consume 1 token)"
            >
              <RefreshCcw size={14} className={loadingTC ? 'animate-spin' : ''} />
              {loadingTC ? 'Consultando...' : 'Actualizar TC'}
            </button>
          </div>
        </section>

        <div className="pg-kpis">
          {kpisEstado.map(k => {
            const activo = filtroEstado === k.valor;
            const visible = !filtroEstado || activo || k.valor === '';
            return (
              <button key={k.label} type="button" className={`pg-kpi ${k.tono} ${activo && k.valor ? 'on' : ''}`} aria-pressed={activo}
                onClick={() => setFiltroEstado(activo ? '' : k.valor)}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><k.icon size={16} /></span>
                </div>
                <span className="pg-kpi-value">{visible ? k.cantidad : '—'}</span>
                <span className="pg-kpi-foot">
                  {k.valor === '' ? (filtroEstado ? 'Con el filtro actual' : 'Todas las cotizaciones') : activo ? 'Filtro activo · pulsa para quitar' : 'Pulsa para filtrar'}
                </span>
              </button>
            );
          })}
          <div className="pg-kpi is-accent">
            <div className="pg-kpi-top">
              <span className="pg-kpi-label">Monto total · PEN</span>
              <span className="pg-kpi-icon"><DollarSign size={16} /></span>
            </div>
            <span className="pg-kpi-value"><small>S/</small>{formatearNumero(estadisticas.montoTotalPEN)}</span>
          </div>
          {estadisticas.montoTotalUSD > 0 && (
            <div className="pg-kpi is-accent">
              <div className="pg-kpi-top">
                <span className="pg-kpi-label">Monto total · USD</span>
                <span className="pg-kpi-icon"><DollarSign size={16} /></span>
              </div>
              <span className="pg-kpi-value"><small>$</small>{formatearNumero(estadisticas.montoTotalUSD)}</span>
              {tipoCambio && estadisticas.montoUSDenPEN > 0 && (
                <span className="pg-kpi-foot"><ArrowRightLeft size={11} /> Equiv. <b>S/ {formatearNumero(estadisticas.montoUSDenPEN)}</b></span>
              )}
            </div>
          )}
        </div>

        <section className="pg-panel">
          <div className="pg-filters">
            <div className="pg-filters-row">
              <div className="pg-field pg-field-grow pg-search">
                <label className="pg-field-label" htmlFor="vt-cot-busqueda">Buscar</label>
                <Search size={14} />
                <input
                  id="vt-cot-busqueda"
                  type="search"
                  className="form-input"
                  placeholder="N°, cliente, RUC o comercial"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="pg-field">
                <span className="pg-field-label"><Filter size={11} /> Estado</span>
                <div className="pg-segmented" role="group" aria-label="Filtrar por estado">
                  {filtrosEstado.map(f => (
                    <button
                      key={f.label}
                      type="button"
                      className={filtroEstado === f.valor ? 'active' : ''}
                      aria-pressed={filtroEstado === f.valor}
                      onClick={() => setFiltroEstado(f.valor)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Orden</span>
                <button
                  type="button"
                  className={`btn ${ordenAscendente ? 'btn-secondary' : 'btn-outline'}`}
                  style={{ height: 38 }}
                  onClick={() => setOrdenAscendente(prev => !prev)}
                  aria-pressed={ordenAscendente}
                  title={ordenAscendente ? 'Mostrando: más antiguos primero' : 'Mostrando: más recientes primero'}
                >
                  <ArrowUpDown size={14} />
                  {ordenAscendente ? 'Más antiguos' : 'Más recientes'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="pg-panel" ref={tablaRef}>
          <div className="pg-panel-head">
            <h2 className="pg-panel-title"><FileText size={16} /> Lista de cotizaciones <span className="pg-count">{pagination.total}</span></h2>
            <span className="pg-panel-meta">
              Mostrando {currentItems.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, pagination.total)} · pulsa una fila para ver el detalle
            </span>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>N° Cotización</th>
                  <th>Cliente</th>
                  <th>Vigencia</th>
                  <th className="num">Total</th>
                  <th className="center">Estado</th>
                  <th>Comercial</th>
                  <th className="center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map(row => {
                  const value = row.id_cotizacion;
                  const esUSD = row.moneda === 'USD';
                  const conversionPEN = esUSD && mostrarConversion && tipoCambio
                    ? convertirUSDaPEN(row.total)
                    : null;
                  return (
                    <tr key={value} className="is-clickable" onClick={() => handleVerDetalle(value)}>
                      <td className="nowrap">
                        <span className="pg-cell-main">
                          <span className="pg-code">{row.numero_cotizacion}</span>
                          {!!row.convertida_venta && (
                            <CheckCircle2 size={14} className="vt-ok-icon" aria-label="Convertida a Orden de Venta" />
                          )}
                        </span>
                        <span className="pg-cell-sub">{formatearFechaVisual(row.fecha_emision)} · {row.total_items || 0} ítems</span>
                        {!!row.convertida_venta && !!row.id_orden_venta && (
                          <button
                            type="button"
                            className="vt-link-chip"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ventas/ordenes/${row.id_orden_venta}`);
                            }}
                          >
                            <ExternalLink size={10} /> Ver OV
                          </button>
                        )}
                      </td>
                      <td>
                        <span className="pg-cell-main pg-truncate" title={row.cliente}>{row.cliente}</span>
                        <span className="pg-cell-sub">RUC {row.ruc_cliente}</span>
                      </td>
                      <td className="nowrap">
                        {row.fecha_vencimiento ? (
                          <>
                            <span className="pg-cell-main"><CalendarDays size={12} className="pg-muted" />{formatearFechaVisual(row.fecha_vencimiento)}</span>
                            {vigenciaVencida(row) && (
                              <span className="pg-tags"><span className="pg-tag is-warning"><AlertTriangle size={11} />Vigencia superada</span></span>
                            )}
                          </>
                        ) : <span className="pg-muted">—</span>}
                      </td>
                      <td className="num">
                        <span className="vt-amount">{formatearMoneda(row.total, row.moneda)}</span>
                        {esUSD && parseFloat(row.tipo_cambio || 0) > 1 && (
                          <span className="pg-cell-sub">TC Cot: S/ {formatearNumero(parseFloat(row.tipo_cambio))}</span>
                        )}
                        {conversionPEN !== null && (
                          <span className="pg-tags">
                            <span className="pg-tag is-accent"><ArrowRightLeft size={10} />S/ {formatearNumero(conversionPEN)}</span>
                          </span>
                        )}
                      </td>
                      <td className="center"><BadgeEstadoCotizacion estado={row.estado} /></td>
                      <td>{row.comercial || <span className="pg-muted">Sin asignar</span>}</td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <div className="pg-rowactions">
                          <button
                            type="button"
                            className="pg-iconbtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerDetalle(value);
                            }}
                            title="Ver detalle"
                            aria-label={`Ver detalle de ${row.numero_cotizacion}`}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="pg-iconbtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ventas/cotizaciones/${value}/editar`);
                            }}
                            title="Editar"
                            aria-label={`Editar ${row.numero_cotizacion}`}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="pg-iconbtn"
                            onClick={(e) => handleDuplicar(value, e)}
                            title="Duplicar cotización"
                            aria-label={`Duplicar ${row.numero_cotizacion}`}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            className="pg-iconbtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDescargarPDF(value, row.numero_cotizacion, row.cliente, row.estado);
                            }}
                            title="Descargar PDF"
                            aria-label={`Descargar PDF de ${row.numero_cotizacion}`}
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="pg-empty">
                        <FileText size={28} />
                        <strong>{filtroEstado || busquedaAplicada ? 'Ninguna cotización coincide con los filtros' : 'No hay cotizaciones registradas'}</strong>
                        <span>{filtroEstado || busquedaAplicada ? 'Cambia el estado o la búsqueda.' : 'Crea la primera para enviarla al cliente.'}</span>
                        {!(filtroEstado || busquedaAplicada) && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/ventas/cotizaciones/nueva')}><Plus size={14} /> Nueva cotización</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={pagination.total}
            itemsPerPage={itemsPerPage}
            setCurrentPage={setCurrentPage}
          />
        </section>
      </div>
    </div>
  );
}

export default Cotizaciones;
