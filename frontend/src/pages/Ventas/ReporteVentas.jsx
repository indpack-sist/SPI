import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  Calendar, Search, Filter, Download, FileSpreadsheet,
  DollarSign, TrendingUp, PieChart as PieIcon, 
  FileText, CheckCircle, AlertCircle, Truck, User, X,
  Eye, Package, MapPin, Phone, Mail, CreditCard, FileCheck,
  ShoppingCart, Percent, Building2, RefreshCw
} from 'lucide-react';
import { reportesAPI, clientesAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';

const COLORS_PIE = {
  'Pagado': '#10B981',
  'Parcial': '#F59E0B',
  'Pendiente': '#EF4444',
  'Pagado USD': '#059669',
  'Parcial USD': '#D97706',
  'Pendiente USD': '#DC2626'
};

const ReporteVentas = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para opciones de descarga
  const [incluirDetalleExcel, setIncluirDetalleExcel] = useState(true);
  const [incluirDetallePDF, setIncluirDetallePDF] = useState(true); // <--- NUEVO ESTADO

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesSugeridos, setClientesSugeridos] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const wrapperRef = useRef(null);

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mostrarDetalleOrden, setMostrarDetalleOrden] = useState(false);

  const fechaHoy = new Date();
  const primerDiaMes = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), 1);

  const [filtros, setFiltros] = useState({
    fechaInicio: primerDiaMes.toISOString().split('T')[0],
    fechaFin: fechaHoy.toISOString().split('T')[0],
    idCliente: '',
    estadoOrden: '',
    estadoPago: ''
  });

  const [dataReporte, setDataReporte] = useState({
    resumen: {
      total_ventas_pen: 0,
      total_ventas_usd: 0,
      total_pagado_pen: 0,
      total_pagado_usd: 0,
      total_pendiente_pen: 0,
      total_pendiente_usd: 0,
      total_comisiones_pen: 0,
      total_comisiones_usd: 0,
      contado_pen: 0,
      contado_usd: 0,
      credito_pen: 0,
      credito_usd: 0,
      pedidos_retrasados: 0,
      cantidad_ordenes: 0
    },
    graficos: {
      estado_pago: [],
      ventas_dia: [],
      top_vendedores: [],
      ventas_por_estado: []
    },
    detalle: []
  });

  const [dataFiltrada, setDataFiltrada] = useState([]);

  useEffect(() => {
    generarReporte();
    
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const buscarClientes = async () => {
        if (busquedaCliente.length > 1 && !filtros.idCliente) {
            try {
                const response = await clientesAPI.search(busquedaCliente);
                if (response.data.success) {
                    setClientesSugeridos(response.data.data);
                    setMostrarSugerencias(true);
                }
            } catch (error) {
                console.error("Error buscando clientes", error);
            }
        } else {
            setClientesSugeridos([]);
        }
    };

    const timeoutId = setTimeout(() => {
        buscarClientes();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busquedaCliente, filtros.idCliente]);

  useEffect(() => {
    aplicarFiltrosLocales();
  }, [filtros.estadoOrden, filtros.estadoPago, dataReporte.detalle]);

  const seleccionarCliente = (cliente) => {
    setFiltros({ ...filtros, idCliente: cliente.id_cliente });
    setBusquedaCliente(cliente.razon_social);
    setClienteSeleccionado(cliente);
    setMostrarSugerencias(false);
  };

  const limpiarCliente = () => {
    setFiltros({ ...filtros, idCliente: '' });
    setBusquedaCliente('');
    setClienteSeleccionado(null);
    setClientesSugeridos([]);
  };

  const aplicarFiltrosLocales = () => {
    let filtrada = [...dataReporte.detalle];

    if (filtros.estadoOrden) {
      filtrada = filtrada.filter(item => item.estado === filtros.estadoOrden);
    }

    if (filtros.estadoPago) {
      filtrada = filtrada.filter(item => item.estado_pago === filtros.estadoPago);
    }

    setDataFiltrada(filtrada);
  };

  const generarReporte = async (e) => {
    if(e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await reportesAPI.getVentas({
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin,
        idCliente: filtros.idCliente
      });

      if (response.data.success) {
        setDataReporte(response.data.data);
        setDataFiltrada(response.data.data.detalle);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el reporte. Verifique su conexión.');
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN DESCARGAR PDF ACTUALIZADA
  const descargarPDF = async () => {
    setLoadingPdf(true);
    try {
        const response = await reportesAPI.getVentas({
            fechaInicio: filtros.fechaInicio,
            fechaFin: filtros.fechaFin,
            idCliente: filtros.idCliente,
            incluirDetalle: incluirDetallePDF, // <--- PARÁMETRO AGREGADO
            format: 'pdf'
        }, { responseType: 'blob' });

        const nombreCliente = clienteSeleccionado ? clienteSeleccionado.razon_social.replace(/[^a-zA-Z0-9]/g, '_') : 'Todos';
        const fechaActual = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Reporte_${nombreCliente}_${fechaActual}.pdf`;

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', nombreArchivo);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        console.error(err);
        setError('Error al descargar el PDF');
    } finally {
        setLoadingPdf(false);
    }
  };

  const descargarExcel = () => {
    setLoadingExcel(true);
    try {
      const wb = XLSX.utils.book_new();
  
      // HOJA 1: RESUMEN GENERAL
      const datosResumen = dataFiltrada.map(item => ({
        'Orden': item.numero,
        'Comprobante': item.numero_comprobante || '',
        'Cliente': item.cliente,
        'RUC': item.ruc,
        'Vendedor': item.vendedor,
        'Fecha Emisión': formatearFecha(item.fecha_emision),
        'Fecha Despacho': item.fecha_despacho ? formatearFecha(item.fecha_despacho) : 'Pendiente',
        'Moneda': item.moneda,
        'Subtotal': parseFloat(item.subtotal),
        'IGV': parseFloat(item.igv),
        'Total': parseFloat(item.total),
        'Pagado': parseFloat(item.monto_pagado),
        'Por Cobrar': parseFloat(item.pendiente_cobro),
        'Estado Pago': item.estado_pago,
        'Estado': item.estado,
        'Tipo Venta': item.tipo_venta,
        'Estado Logístico': item.estado_logistico
      }));
  
      const wsResumen = XLSX.utils.json_to_sheet(datosResumen);
      wsResumen['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 },
        { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
  
      // HOJAS DE DETALLE (SOLO SI EL CHECKBOX ESTÁ MARCADO)
      if (incluirDetalleExcel) {
        dataFiltrada.forEach((orden) => {
          const nombreHoja = orden.numero.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 31);
          
          const datosOrden = [
            ['INFORMACIÓN DE LA ORDEN'],
            ['Número de Orden', orden.numero],
            ['Tipo Comprobante', orden.tipo_comprobante],
            ['Número Comprobante', orden.numero_comprobante || ''],
            ['Estado', orden.estado],
            ['Estado Verificación', orden.estado_verificacion],
            ['Estado Pago', orden.estado_pago],
            ['Tipo de Venta', orden.tipo_venta],
            [''],
            ['INFORMACIÓN DEL CLIENTE'],
            ['Razón Social', orden.cliente],
            ['RUC', orden.ruc],
            ['Dirección', orden.direccion_cliente || ''],
            ['Teléfono', orden.telefono_cliente || ''],
            ['Email', orden.email_cliente || ''],
            [''],
            ['FECHAS'],
            ['Creación', formatearFechaHora(orden.fecha_creacion)],
            ['Emisión', formatearFecha(orden.fecha_emision)],
            ['Vencimiento', formatearFecha(orden.fecha_vencimiento)],
            ['Despacho', orden.fecha_despacho ? formatearFecha(orden.fecha_despacho) : 'Pendiente'],
            ['Verificación', orden.fecha_verificacion ? formatearFechaHora(orden.fecha_verificacion) : ''],
            [''],
            ['INFORMACIÓN DE ENTREGA'],
            ['Tipo de Entrega', orden.tipo_entrega],
            ['Vehículo', orden.vehiculo_placa ? `${orden.vehiculo_placa} - ${orden.vehiculo_marca}` : ''],
            ['Conductor', orden.conductor_nombre || ''],
            ['DNI Conductor', orden.conductor_dni || ''],
            ['Transporte', orden.transporte_nombre || ''],
            ['Placa Transporte', orden.transporte_placa || ''],
            ['Dirección Entrega', orden.direccion_entrega || ''],
            ['Ciudad', orden.ciudad_entrega || ''],
            [''],
            ['PRODUCTOS'],
            ['Producto', 'Código', 'Cantidad', 'Unidad', 'P. Unitario', 'Descuento', 'Subtotal', 'Despachado']
          ];
  
          if (orden.detalles && orden.detalles.length > 0) {
            orden.detalles.forEach(det => {
              datosOrden.push([
                det.producto_nombre,
                det.codigo_producto,
                det.cantidad,
                det.unidad_medida,
                `${orden.moneda} ${det.precio_unitario}`,
                parseFloat(det.descuento) > 0 ? `${orden.moneda} ${det.descuento}` : '-',
                `${orden.moneda} ${det.subtotal}`,
                `${det.cantidad_despachada}/${det.cantidad}`
              ]);
            });
          }
  
          datosOrden.push(
            [''],
            ['RESUMEN FINANCIERO'],
            ['Subtotal', `${orden.moneda} ${orden.subtotal}`],
            ['IGV (' + orden.porcentaje_impuesto + '%)', `${orden.moneda} ${orden.igv}`],
            ['Total', `${orden.moneda} ${orden.total}`],
            ['Monto Pagado', `${orden.moneda} ${orden.monto_pagado}`],
            ['Pendiente de Cobro', `${orden.moneda} ${orden.pendiente_cobro}`]
          );
  
          if (parseFloat(orden.total_comision) > 0) {
            datosOrden.push(['Comisión (' + orden.porcentaje_comision_promedio + '%)', `${orden.moneda} ${orden.total_comision}`]);
          }
  
          datosOrden.push(
            [''],
            ['PERSONAL'],
            ['Vendedor', orden.vendedor],
            ['Registrado por', orden.registrador],
            ['Verificador', orden.verificador]
          );
  
          datosOrden.push(
            [''],
            ['DOCUMENTOS ASOCIADOS'],
            ['Cotización', orden.numero_cotizacion || ''],
            ['Guía Interna', orden.numero_guia_interna || ''],
            ['OC Cliente', orden.orden_compra_cliente || '']
          );
  
          if (orden.observaciones || orden.observaciones_verificador || orden.motivo_rechazo) {
            datosOrden.push([''], ['OBSERVACIONES']);
            if (orden.observaciones) {
              datosOrden.push(['Observaciones Generales', orden.observaciones]);
            }
            if (orden.observaciones_verificador) {
              datosOrden.push(['Observaciones Verificador', orden.observaciones_verificador]);
            }
            if (orden.motivo_rechazo) {
              datosOrden.push(['Motivo de Rechazo', orden.motivo_rechazo]);
            }
          }
  
          const wsOrden = XLSX.utils.aoa_to_sheet(datosOrden);
          wsOrden['!cols'] = [{ wch: 30 }, { wch: 50 }];
          XLSX.utils.book_append_sheet(wb, wsOrden, nombreHoja);
        });
      }
  
      const nombreCliente = clienteSeleccionado ? clienteSeleccionado.razon_social.replace(/[^a-zA-Z0-9]/g, '_') : 'Todos';
      const fechaActual = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Reporte_${nombreCliente}_${fechaActual}.xlsx`;
  
      XLSX.writeFile(wb, nombreArchivo);
    } catch (err) {
      console.error(err);
      setError('Error al generar el archivo Excel');
    } finally {
      setLoadingExcel(false);
    }
  };

  const verDetalleOrden = (orden) => {
    setOrdenSeleccionada(orden);
    setMostrarDetalleOrden(true);
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(valor || 0)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearFechaHora = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const obtenerBadgeEstadoPago = (estado) => {
    const estilos = {
      'Pagado': 'badge badge-success',
      'Parcial': 'badge badge-warning',
      'Pendiente': 'badge badge-danger'
    };
    return (
      <span className={estilos[estado] || 'badge badge-secondary'}>
        {estado}
      </span>
    );
  };

  const obtenerBadgeEstado = (estado) => {
    const estilos = {
      'En Espera': 'badge badge-secondary',
      'En Proceso': 'badge badge-info',
      'Atendido por Producción': 'badge badge-purple-100 text-purple-900 border-purple-200', 
      'Despacho Parcial': 'badge badge-warning',
      'Despachada': 'badge badge-success',
      'Entregada': 'badge badge-success',
      'Cancelada': 'badge badge-danger'
    };
    
    const claseExtra = estado === 'Atendido por Producción' ? 'bg-purple-100 text-purple-900 border border-purple-200' : (estilos[estado] || 'badge badge-secondary');

    return (
      <span className={claseExtra.startsWith('badge') ? claseExtra : `badge ${claseExtra}`}>
        {estado}
      </span>
    );
  };

  const obtenerBadgeVerificacion = (estado) => {
    const estilos = {
      'Pendiente': 'badge badge-warning',
      'Aprobada': 'badge badge-success',
      'Rechazada': 'badge badge-danger'
    };
    return (
      <span className={estilos[estado] || 'badge badge-secondary'}>
        {estado}
      </span>
    );
  };

  const obtenerBadgeLogistica = (estado) => {
    const estilos = {
        'A tiempo': 'badge badge-info',
        'En plazo': 'badge badge-info badge-outline',
        'Retrasado': 'badge badge-danger',
        'Vencido': 'badge badge-danger badge-outline'
    };
    return (
        <span className={estilos[estado] || 'badge badge-secondary'}>
            {estado}
        </span>
    );
  };

  const obtenerIconoTipoEntrega = (tipo) => {
    if (tipo === 'Vehiculo Empresa') return <Truck size={16} className="text-blue-600" />;
    if (tipo === 'Transporte Privado') return <Package size={16} className="text-orange-600" />;
    return <ShoppingCart size={16} className="text-green-600" />;
  };

  return (
    <div className="w-full px-6 py-8 font-sans">
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-primary" /> Dashboard de Ventas
          </h1>
          <p className="text-muted text-sm">Monitor de rendimiento comercial y logístico</p>
        </div>
        <div className="flex gap-2">
          <button 
              onClick={descargarExcel}
              disabled={loadingExcel || dataFiltrada.length === 0}
              className="btn btn-success"
          >
              {loadingExcel ? <Loading size="sm" color="white"/> : <FileSpreadsheet size={18} />}
              Excel
          </button>
          <button 
              onClick={descargarPDF}
              disabled={loadingPdf}
              className="btn btn-danger"
          >
              {loadingPdf ? <Loading size="sm" color="white"/> : <Download size={18} />}
              PDF
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-body">
            <form onSubmit={generarReporte} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="form-group mb-0">
                    <label className="form-label uppercase text-xs text-muted">Desde</label>
                    <div className="input-with-icon">
                        <Calendar className="icon" size={16} />
                        <input 
                            type="date" 
                            className="form-input"
                            value={filtros.fechaInicio}
                            onChange={(e) => setFiltros({...filtros, fechaInicio: e.target.value})}
                        />
                    </div>
                </div>
                <div className="form-group mb-0">
                    <label className="form-label uppercase text-xs text-muted">Hasta</label>
                    <div className="input-with-icon">
                        <Calendar className="icon" size={16} />
                        <input 
                            type="date" 
                            className="form-input"
                            value={filtros.fechaFin}
                            onChange={(e) => setFiltros({...filtros, fechaFin: e.target.value})}
                        />
                    </div>
                </div>
                
                <div className="form-group mb-0 relative" ref={wrapperRef}>
                    <label className="form-label uppercase text-xs text-muted">Cliente</label>
                    <div className="search-input-wrapper">
                        <Search className="search-icon" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar cliente por nombre o RUC..."
                            className="form-input search-input bg-white"
                            value={busquedaCliente}
                            onChange={(e) => {
                                setBusquedaCliente(e.target.value);
                                if(filtros.idCliente) setFiltros({...filtros, idCliente: ''});
                            }}
                            onFocus={() => busquedaCliente && setMostrarSugerencias(true)}
                        />
                        {filtros.idCliente && (
                            <button 
                                type="button"
                                onClick={limpiarCliente}
                                className="absolute right-2 top-2.5 text-gray-400 hover:text-red-500"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    
                    {mostrarSugerencias && clientesSugeridos.length > 0 && (
                        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-96 overflow-y-auto">
                            {clientesSugeridos.map(cliente => (
                                <li 
                                    key={cliente.id_cliente}
                                    onClick={() => seleccionarCliente(cliente)}
                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800 border-b border-gray-100 last:border-0"
                                >
                                    <div className="font-medium">{cliente.razon_social}</div>
                                    <div className="text-xs text-muted">RUC: {cliente.ruc}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-gray-200 pt-4">
                <div className="flex gap-3">
                  <div className="form-group mb-0">
                      <label className="form-label uppercase text-xs text-muted">Estado Orden</label>
                      <select 
                          className="form-select"
                          value={filtros.estadoOrden}
                          onChange={(e) => setFiltros({...filtros, estadoOrden: e.target.value})}
                      >
                          <option value="">Todos</option>
                          <option value="En Espera">En Espera</option>
                          <option value="En Proceso">En Proceso</option>
                          <option value="Atendido por Producción">Atendido por Producción</option>
                          <option value="Despacho Parcial">Despacho Parcial</option>
                          <option value="Despachada">Despachada</option>
                          <option value="Entregada">Entregada</option>
                      </select>
                  </div>

                  <div className="form-group mb-0">
                      <label className="form-label uppercase text-xs text-muted">Estado Pago</label>
                      <select 
                          className="form-select"
                          value={filtros.estadoPago}
                          onChange={(e) => setFiltros({...filtros, estadoPago: e.target.value})}
                      >
                          <option value="">Todos</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="Parcial">Parcial</option>
                          <option value="Pagado">Pagado</option>
                      </select>
                  </div>

                  {/* CHECKBOX PARA DETALLE EXCEL */}
                  <div className="form-group mb-0">
                      <label className="form-label uppercase text-xs text-muted">Detalle Excel</label>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input 
                              type="checkbox"
                              checked={incluirDetalleExcel}
                              onChange={(e) => setIncluirDetalleExcel(e.target.checked)}
                              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                          />
                          <span className="text-sm text-gray-700">Incluir hojas de detalle</span>
                      </label>
                  </div>

                  {/* NUEVO CHECKBOX PARA PDF */}
                  <div className="form-group mb-0">
                      <label className="form-label uppercase text-xs text-muted">Detalle PDF</label>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input 
                              type="checkbox"
                              checked={incluirDetallePDF}
                              onChange={(e) => setIncluirDetallePDF(e.target.checked)}
                              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                          />
                          <span className="text-sm text-gray-700">Incluir detalle órdenes</span>
                      </label>
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      setFiltros({...filtros, estadoOrden: '', estadoPago: ''});
                    }}
                    className="btn btn-ghost"
                    title="Limpiar filtros"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <Loading size="sm" color="white" /> : <Filter size={18} />}
                    Buscar
                </button>
              </div>
            </form>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="stats-grid">
        <div className="stat-card border-l-4 border-blue-500">
            <div className="stat-content">
                <p className="text-xs text-muted font-bold uppercase tracking-wider">Ventas Totales</p>
                <h3 className="stat-value text-gray-900">{formatearMoneda(dataReporte.resumen.total_ventas_pen, 'PEN')}</h3>
                {dataReporte.resumen.total_ventas_usd > 0 && (
                    <p className="text-sm text-blue-700 font-semibold mt-1">{formatearMoneda(dataReporte.resumen.total_ventas_usd, 'USD')}</p>
                )}
                <div className="flex gap-2 mt-2 text-xs flex-wrap">
                    <span className="badge badge-info badge-sm">Ct PEN: {formatearMoneda(dataReporte.resumen.contado_pen, 'PEN')}</span>
                    <span className="badge badge-purple-100 text-purple-900 badge-sm border border-purple-200">Cr PEN: {formatearMoneda(dataReporte.resumen.credito_pen, 'PEN')}</span>
                    {dataReporte.resumen.contado_usd > 0 && (
                        <span className="badge badge-info badge-sm">Ct USD: {formatearMoneda(dataReporte.resumen.contado_usd, 'USD')}</span>
                    )}
                    {dataReporte.resumen.credito_usd > 0 && (
                        <span className="badge badge-purple-100 text-purple-900 badge-sm border border-purple-200">Cr USD: {formatearMoneda(dataReporte.resumen.credito_usd, 'USD')}</span>
                    )}
                </div>
            </div>
            <div className="stat-icon bg-blue-50 text-blue-600"><DollarSign size={24}/></div>
        </div>

        <div className="stat-card border-l-4 border-green-500">
            <div className="stat-content">
                <p className="text-xs text-muted font-bold uppercase tracking-wider">Cobrado</p>
                <h3 className="stat-value text-success">{formatearMoneda(dataReporte.resumen.total_pagado_pen, 'PEN')}</h3>
                {dataReporte.resumen.total_pagado_usd > 0 && (
                    <p className="text-sm text-green-700 font-semibold mt-1">{formatearMoneda(dataReporte.resumen.total_pagado_usd, 'USD')}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Liquidez ingresada</p>
            </div>
            <div className="stat-icon bg-green-50 text-success"><CheckCircle size={24}/></div>
        </div>

        <div className="stat-card border-l-4 border-red-500">
            <div className="stat-content">
                <p className="text-xs text-muted font-bold uppercase tracking-wider">Por Cobrar</p>
                <h3 className="stat-value text-danger">{formatearMoneda(dataReporte.resumen.total_pendiente_pen, 'PEN')}</h3>
                {dataReporte.resumen.total_pendiente_usd > 0 && (
                    <p className="text-sm text-red-700 font-semibold mt-1">{formatearMoneda(dataReporte.resumen.total_pendiente_usd, 'USD')}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Crédito pendiente</p>
            </div>
            <div className="stat-icon bg-red-50 text-danger"><AlertCircle size={24}/></div>
        </div>

        <div className="stat-card border-l-4 border-orange-500">
            <div className="stat-content">
                <p className="text-xs text-muted font-bold uppercase tracking-wider">Operaciones</p>
                <h3 className="stat-value text-gray-900">{dataReporte.resumen.cantidad_ordenes}</h3>
                <div className="mt-2 text-xs flex items-center gap-2">
                    <span className={`badge ${dataReporte.resumen.pedidos_retrasados > 0 ? 'badge-danger' : 'badge-success'}`}>
                        {dataReporte.resumen.pedidos_retrasados} Retrasos
                    </span>
                </div>
            </div>
            <div className="stat-icon bg-orange-50 text-orange-600"><Truck size={24}/></div>
        </div>
      </div>

      {(dataReporte.resumen.total_comisiones_pen > 0 || dataReporte.resumen.total_comisiones_usd > 0) && (
        <div className="card mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <div className="card-body p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Percent size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-purple-600 uppercase">Total Comisiones</p>
                        <p className="text-lg font-bold text-purple-900">{formatearMoneda(dataReporte.resumen.total_comisiones_pen, 'PEN')}</p>
                        {dataReporte.resumen.total_comisiones_usd > 0 && (
                            <p className="text-sm font-semibold text-purple-700">{formatearMoneda(dataReporte.resumen.total_comisiones_usd, 'USD')}</p>
                        )}
                    </div>
                    </div>
                </div>
            </div>
        </div>
      )}


      <div className="card">
        <div className="card-header bg-gray-50 flex justify-between items-center">
            <h3 className="card-title text-sm text-gray-800">Detalle de Transacciones</h3>
            <span className="badge badge-secondary badge-outline">
                {dataFiltrada.length} Registros
            </span>
        </div>
        <div className="table-container">
            <table className="table">
                <thead>
                    <tr>
                        <th className="px-4 py-3">Acciones</th>
                        <th className="px-4 py-3">Orden</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Vendedor</th>
                        <th className="px-4 py-3">Emisión</th>
                        <th className="px-4 py-3">Despacho</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Estado Pago</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center">Logística</th>
                    </tr>
                </thead>
                <tbody>
                    {dataFiltrada.length > 0 ? (
                        dataFiltrada.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => verDetalleOrden(item)}>
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => verDetalleOrden(item)}
                                        className="btn btn-ghost btn-xs text-primary"
                                        title="Ver detalles"
                                    >
                                        <Eye size={14} />
                                        Ver
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-mono font-medium text-primary">
                                        {item.numero}
                                    </div>
                                    {item.numero_comprobante && (
                                        <div className="text-xs text-muted">{item.tipo_comprobante}: {item.numero_comprobante}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-gray-800">
                                    <div className="font-medium truncate w-32" title={item.cliente}>{item.cliente}</div>
                                    <div className="text-xs text-muted">{item.ruc}</div>
                                </td>
                                <td className="px-4 py-3 text-muted text-xs truncate w-24">
                                    {item.vendedor}
                                </td>
                                <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                                    {formatearFecha(item.fecha_emision)}
                                </td>
                                <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                                    {item.fecha_despacho ? formatearFecha(item.fecha_despacho) : 
                                     <span className="text-gray-400 italic">Pendiente</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-700">
                                    <span className="text-xs text-muted mr-1">{item.moneda}</span>
                                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(item.total)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {obtenerBadgeEstadoPago(item.estado_pago)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {obtenerBadgeEstado(item.estado)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {obtenerBadgeLogistica(item.estado_logistico)}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="10" className="px-4 py-12 text-center text-muted">
                                <div className="flex flex-col items-center justify-center">
                                    <Search size={32} className="mb-2 opacity-20"/>
                                    No se encontraron ventas con los filtros seleccionados.
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {mostrarDetalleOrden && ordenSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-content bg-white rounded-xl shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-primary" />
                  Detalle de Orden: {ordenSeleccionada.numero}
                </h2>
                <p className="text-sm text-muted mt-1">Información completa de la orden de venta</p>
              </div>
              <button
                onClick={() => setMostrarDetalleOrden(false)}
                className="btn btn-ghost"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Estado General</p>
                  <div className="flex flex-col gap-2">
                    {obtenerBadgeEstado(ordenSeleccionada.estado)}
                    {obtenerBadgeVerificacion(ordenSeleccionada.estado_verificacion)}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-semibold uppercase mb-1">Estado de Pago</p>
                  <div className="flex flex-col gap-2">
                    {obtenerBadgeEstadoPago(ordenSeleccionada.estado_pago)}
                    <p className="text-xs text-gray-600 mt-1">
                      Pagado: {ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}
                    </p>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Tipo de Venta</p>
                  <p className="text-lg font-bold text-purple-900">{ordenSeleccionada.tipo_venta}</p>
                  {ordenSeleccionada.dias_credito > 0 && (
                    <p className="text-xs text-gray-600">{ordenSeleccionada.dias_credito} días de crédito</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 size={18} className="text-primary" />
                        Información del Cliente
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div>
                        <span className="text-muted">Razón Social:</span>
                        <p className="font-medium text-gray-800">{ordenSeleccionada.cliente}</p>
                        </div>
                        <div>
                        <span className="text-muted">RUC:</span>
                        <p className="font-medium text-gray-800">{ordenSeleccionada.ruc}</p>
                        </div>
                        {ordenSeleccionada.direccion_cliente && (
                        <div>
                            <span className="text-muted flex items-center gap-1">
                            <MapPin size={14} /> Dirección:
                            </span>
                            <p className="font-medium text-gray-800">{ordenSeleccionada.direccion_cliente}</p>
                        </div>
                        )}
                        {ordenSeleccionada.telefono_cliente && (
                        <div className="flex items-center gap-2">
                            <Phone size={14} className="text-muted" />
                            <span className="text-gray-800">{ordenSeleccionada.telefono_cliente}</span>
                        </div>
                        )}
                        {ordenSeleccionada.email_cliente && (
                        <div className="flex items-center gap-2">
                            <Mail size={14} className="text-muted" />
                            <span className="text-gray-800">{ordenSeleccionada.email_cliente}</span>
                        </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="card shadow-none">
                    <div className="card-body p-5">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-success" />
                            Fechas Importantes
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                            <span className="text-muted">Creación:</span>
                            <span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_creacion)}</span>
                            </div>
                            <div className="flex justify-between">
                            <span className="text-muted">Emisión:</span>
                            <span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_emision)}</span>
                            </div>
                            {ordenSeleccionada.fecha_vencimiento && (
                            <div className="flex justify-between">
                                <span className="text-muted">Vencimiento:</span>
                                <span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_vencimiento)}</span>
                            </div>
                            )}
                            {ordenSeleccionada.fecha_entrega_programada && (
                            <div className="flex justify-between">
                                <span className="text-muted">Entrega Programada:</span>
                                <span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_entrega_programada)}</span>
                            </div>
                            )}
                            {ordenSeleccionada.fecha_entrega_real && (
                            <div className="flex justify-between">
                                <span className="text-muted">Entrega Real:</span>
                                <span className="font-medium text-green-700">{formatearFecha(ordenSeleccionada.fecha_entrega_real)}</span>
                            </div>
                            )}
                            {ordenSeleccionada.fecha_verificacion && (
                            <div className="flex justify-between">
                                <span className="text-muted">Verificación:</span>
                                <span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_verificacion)}</span>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              <div className="card shadow-none">
                <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        {obtenerIconoTipoEntrega(ordenSeleccionada.tipo_entrega)}
                        Información de Entrega
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                        <span className="text-muted">Tipo de Entrega:</span>
                        <p className="font-medium text-gray-800">{ordenSeleccionada.tipo_entrega}</p>
                        </div>
                        {ordenSeleccionada.tipo_entrega === 'Vehiculo Empresa' && (
                        <>
                            {ordenSeleccionada.vehiculo_placa && (
                            <div>
                                <span className="text-muted">Vehículo:</span>
                                <p className="font-medium text-gray-800">
                                {ordenSeleccionada.vehiculo_placa} - {ordenSeleccionada.vehiculo_marca}
                                </p>
                            </div>
                            )}
                            {ordenSeleccionada.conductor_nombre && (
                            <div>
                                <span className="text-muted">Conductor:</span>
                                <p className="font-medium text-gray-800">{ordenSeleccionada.conductor_nombre}</p>
                                {ordenSeleccionada.conductor_dni && (
                                <p className="text-xs text-muted">DNI: {ordenSeleccionada.conductor_dni}</p>
                                )}
                                {ordenSeleccionada.conductor_licencia && (
                                <p className="text-xs text-muted">Licencia: {ordenSeleccionada.conductor_licencia}</p>
                                )}
                            </div>
                            )}
                        </>
                        )}
                        {ordenSeleccionada.tipo_entrega === 'Transporte Privado' && (
                        <>
                            {ordenSeleccionada.transporte_nombre && (
                            <div>
                                <span className="text-muted">Empresa de Transporte:</span>
                                <p className="font-medium text-gray-800">{ordenSeleccionada.transporte_nombre}</p>
                            </div>
                            )}
                            {ordenSeleccionada.transporte_placa && (
                            <div>
                                <span className="text-muted">Placa:</span>
                                <p className="font-medium text-gray-800">{ordenSeleccionada.transporte_placa}</p>
                            </div>
                            )}
                            {ordenSeleccionada.transporte_conductor && (
                            <div>
                                <span className="text-muted">Conductor:</span>
                                <p className="font-medium text-gray-800">{ordenSeleccionada.transporte_conductor}</p>
                                {ordenSeleccionada.transporte_dni && (
                                <p className="text-xs text-muted">DNI: {ordenSeleccionada.transporte_dni}</p>
                                )}
                            </div>
                            )}
                        </>
                        )}
                        {ordenSeleccionada.direccion_entrega && (
                        <div className="md:col-span-2">
                            <span className="text-muted flex items-center gap-1">
                            <MapPin size={14} /> Dirección de Entrega:
                            </span>
                            <p className="font-medium text-gray-800">{ordenSeleccionada.direccion_entrega}</p>
                            {ordenSeleccionada.ciudad_entrega && (
                            <p className="text-xs text-muted">{ordenSeleccionada.ciudad_entrega}</p>
                            )}
                        </div>
                        )}
                        {ordenSeleccionada.contacto_entrega && (
                        <div>
                            <span className="text-muted">Contacto:</span>
                            <p className="font-medium text-gray-800">{ordenSeleccionada.contacto_entrega}</p>
                            {ordenSeleccionada.telefono_entrega && (
                            <p className="text-xs text-muted">{ordenSeleccionada.telefono_entrega}</p>
                            )}
                        </div>
                        )}
                    </div>
                </div>
              </div>

              {ordenSeleccionada.detalles && ordenSeleccionada.detalles.length > 0 && (
                <div className="card shadow-none">
                    <div className="card-body p-5">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Package size={18} className="text-purple-600" />
                            Productos ({ordenSeleccionada.detalles.length})
                        </h3>
                        <div className="table-container">
                            <table className="table">
                            <thead>
                                <tr>
                                <th className="px-3 py-2 text-left">Producto</th>
                                <th className="px-3 py-2 text-center">Código</th>
                                <th className="px-3 py-2 text-center">Cantidad</th>
                                <th className="px-3 py-2 text-right">P. Unitario</th>
                                <th className="px-3 py-2 text-right">Descuento</th>
                                <th className="px-3 py-2 text-right">Subtotal</th>
                                <th className="px-3 py-2 text-center">Despachado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordenSeleccionada.detalles.map((det, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                    <div className="font-medium text-gray-800">{det.producto_nombre}</div>
                                    {det.descripcion && (
                                        <div className="text-xs text-muted">{det.descripcion}</div>
                                    )}
                                    </td>
                                    <td className="px-3 py-2 text-center text-muted font-mono text-xs">
                                    {det.codigo_producto}
                                    </td>
                                    <td className="px-3 py-2 text-center font-semibold text-gray-800">
                                    {det.cantidad} {det.unidad_medida}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                    {ordenSeleccionada.moneda} {det.precio_unitario}
                                    </td>
                                    <td className="px-3 py-2 text-right text-red-600">
                                    {parseFloat(det.descuento) > 0 ? `-${ordenSeleccionada.moneda} ${det.descuento}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-gray-800">
                                    {ordenSeleccionada.moneda} {det.subtotal}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                    <span className={`badge ${
                                        det.cantidad_despachada >= det.cantidad 
                                        ? 'badge-success' 
                                        : det.cantidad_despachada > 0 
                                            ? 'badge-warning' 
                                            : 'badge-secondary'
                                    }`}>
                                        {det.cantidad_despachada}/{det.cantidad}
                                    </span>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                    </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-primary" />
                  Resumen Financiero
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{ordenSeleccionada.tipo_impuesto} ({ordenSeleccionada.porcentaje_impuesto}%):</span>
                      <span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.igv}</span>
                    </div>
                    <div className="flex justify-between text-lg border-t border-gray-300 pt-2">
                      <span className="font-bold text-gray-800">Total:</span>
                      <span className="font-bold text-primary">{ordenSeleccionada.moneda} {ordenSeleccionada.total}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monto Pagado:</span>
                      <span className="font-semibold text-green-600">{ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Pendiente de Cobro:</span>
                      <span className="font-semibold text-red-600">{ordenSeleccionada.moneda} {ordenSeleccionada.pendiente_cobro}</span>
                    </div>
                    {parseFloat(ordenSeleccionada.total_comision) > 0 && (
                      <div className="flex justify-between text-sm border-t border-gray-300 pt-2">
                        <span className="text-gray-600">Comisión ({ordenSeleccionada.porcentaje_comision_promedio}%):</span>
                        <span className="font-semibold text-purple-600">{ordenSeleccionada.moneda} {ordenSeleccionada.total_comision}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card shadow-none">
                    <div className="card-body p-4">
                        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Personal Involucrado</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                            <span className="text-muted">Vendedor:</span>
                            <span className="font-medium text-gray-800">{ordenSeleccionada.vendedor}</span>
                            </div>
                            <div className="flex justify-between">
                            <span className="text-muted">Registrado por:</span>
                            <span className="font-medium text-gray-800">{ordenSeleccionada.registrador}</span>
                            </div>
                            {ordenSeleccionada.verificador !== 'No asignado' && (
                            <div className="flex justify-between">
                                <span className="text-muted">Verificador:</span>
                                <span className="font-medium text-gray-800">{ordenSeleccionada.verificador}</span>
                            </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="card shadow-none">
                    <div className="card-body p-4">
                        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Documentos Asociados</h4>
                        <div className="space-y-1 text-sm">
                            {ordenSeleccionada.numero_cotizacion && (
                            <div className="flex justify-between">
                                <span className="text-muted">Cotización:</span>
                                <span className="font-medium text-gray-800">{ordenSeleccionada.numero_cotizacion}</span>
                            </div>
                            )}
                            {ordenSeleccionada.numero_guia_interna && (
                            <div className="flex justify-between">
                                <span className="text-muted">Guía Interna:</span>
                                <span className="font-medium text-gray-800">{ordenSeleccionada.numero_guia_interna}</span>
                            </div>
                            )}
                            {ordenSeleccionada.orden_compra_cliente && (
                            <div className="flex justify-between">
                                <span className="text-muted">OC Cliente:</span>
                                <span className="font-medium text-gray-800">{ordenSeleccionada.orden_compra_cliente}</span>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              {(ordenSeleccionada.observaciones || ordenSeleccionada.observaciones_verificador || ordenSeleccionada.motivo_rechazo) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FileCheck size={16} className="text-yellow-600" />
                    Observaciones
                  </h4>
                  <div className="space-y-2 text-sm">
                    {ordenSeleccionada.observaciones && (
                      <div>
                        <span className="font-medium text-gray-700">Observaciones generales:</span>
                        <p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones}</p>
                      </div>
                    )}
                    {ordenSeleccionada.observaciones_verificador && (
                      <div>
                        <span className="font-medium text-gray-700">Observaciones del verificador:</span>
                        <p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones_verificador}</p>
                      </div>
                    )}
                    {ordenSeleccionada.motivo_rechazo && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <span className="font-medium text-red-700">Motivo de rechazo:</span>
                        <p className="text-red-600 mt-1">{ordenSeleccionada.motivo_rechazo}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end rounded-b-xl">
              <button
                onClick={() => setMostrarDetalleOrden(false)}
                className="btn btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReporteVentas;