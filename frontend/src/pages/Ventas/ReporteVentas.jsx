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
  ShoppingCart, Percent, Building2, RefreshCw, ArrowRightLeft,
  RefreshCcw, AlertTriangle, Clock
} from 'lucide-react';
import { reportesAPI, clientesAPI, tipoCambioAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';
import { generarReporteVentasPDF } from './reporteVentasPDF'; 

const COLORS_PIE = {
  'Pagado': '#10B981',
  'Parcial': '#F59E0B',
  'Pendiente': '#EF4444',
  'Pagado USD': '#059669',
  'Parcial USD': '#D97706',
  'Pendiente USD': '#DC2626'
};

const TC_SESSION_KEY = 'indpack_tipo_cambio';

const ReporteVentas = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [incluirDetalleExcel, setIncluirDetalleExcel] = useState(true);
  const [incluirDetallePDF, setIncluirDetallePDF] = useState(true);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesSugeridos, setClientesSugeridos] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const wrapperRef = useRef(null);

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mostrarDetalleOrden, setMostrarDetalleOrden] = useState(false);

  const [tipoCambio, setTipoCambio] = useState(null);
  const [loadingTC, setLoadingTC] = useState(false);
  const [convertirUSD, setConvertirUSD] = useState(false);

  const fechaHoy = new Date();
  const primerDiaMes = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), 1);

  const [filtros, setFiltros] = useState({
    fechaInicio: primerDiaMes.toISOString().split('T')[0],
    fechaFin: fechaHoy.toISOString().split('T')[0],
    idCliente: '',
    estadoOrden: '',
    estadoPago: '',
    filtroFecha: 'fecha_emision'
  });

  const [dataReporte, setDataReporte] = useState({
    resumen: {
      total_ventas_pen: 0, total_ventas_usd: 0,
      total_pagado_pen: 0, total_pagado_usd: 0,
      total_pendiente_pen: 0, total_pendiente_usd: 0,
      total_comisiones_pen: 0, total_comisiones_usd: 0,
      contado_pen: 0, contado_usd: 0,
      credito_pen: 0, credito_usd: 0,
      pedidos_retrasados: 0, cantidad_ordenes: 0
    },
    graficos: { estado_pago: [], ventas_dia: [], top_vendedores: [], ventas_por_estado: [] },
    detalle: []
  });

  const [dataFiltrada, setDataFiltrada] = useState([]);

  const tcVenta = tipoCambio?.venta || null;

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
      console.error('Error leyendo TC:', e);
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
        setSuccess(`TC actualizado: S/ ${tcData.venta} (venta) — SUNAT: ${formatearFecha(tcData.fecha)}`);
      } else {
        setError(response.data.error || 'No se pudo obtener el tipo de cambio');
      }
    } catch (err) {
      console.error('Error actualizando TC:', err);
      setError('Error al consultar tipo de cambio. Intente mas tarde.');
    } finally {
      setLoadingTC(false);
    }
  };

  const obtenerEdadTC = () => {
    if (!tipoCambio?.timestamp) return null;
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const finDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
    const restanteMs = finDia - ahora;
    const horasRestantes = Math.floor(restanteMs / 3600000);
    const minutosRestantes = Math.floor((restanteMs % 3600000) / 60000);
    if (horasRestantes > 0) return `Valido por ${horasRestantes}h ${minutosRestantes}min`;
    if (minutosRestantes > 0) return `Valido por ${minutosRestantes} min`;
    return 'Expira pronto';
  };

  const totalUnificadoPEN = (pen, usd) => {
    if (!convertirUSD || !tcVenta) return null;
    return parseFloat(pen) + (parseFloat(usd) * tcVenta);
  };

  const formatearMoneda = (valor, moneda = 'PEN') => {
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    return `${simbolo} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valor || 0)}`;
  };

  const formatearNumero = (valor) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    const partes = fecha.toString().split('T')[0].split('-');
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };
  const formatearFechaHora = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    generarReporte();
    cargarTCDesdeSession();
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
    const timeoutId = setTimeout(() => { buscarClientes(); }, 300);
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
    if (filtros.estadoOrden) filtrada = filtrada.filter(item => item.estado === filtros.estadoOrden);
    if (filtros.estadoPago) filtrada = filtrada.filter(item => item.estado_pago === filtros.estadoPago);
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
        idCliente: filtros.idCliente,
        filtro_fecha: filtros.filtroFecha
      });
      if (response.data.success) {
        setDataReporte(response.data.data);
        setDataFiltrada(response.data.data.detalle);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el reporte. Verifique su conexion.');
    } finally {
      setLoading(false);
    }
  };

  const descargarPDF = async () => {
    setLoadingPdf(true);
    try {
      await generarReporteVentasPDF(dataReporte, incluirDetallePDF);
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
      const hayConversion = convertirUSD && tcVenta;
      const hayUSD = dataFiltrada.some(item => item.moneda === 'USD');

      const datosResumen = dataFiltrada.map(item => {
        const base = {
          'Orden': item.numero,
          'Tipo Comprobante': item.tipo_comprobante || '',
          'Comprobante': (item.tipo_comprobante === 'Factura' && item.facturado_sunat && item.numero_comprobante_sunat)
              ? item.numero_comprobante_sunat
              : (item.tipo_comprobante === 'Factura' && !item.facturado_sunat)
                ? ''
                : (item.numero_comprobante || ''),
          'Facturado SUNAT': item.facturado_sunat ? 'Si' : 'No',
          'Fecha Fact. SUNAT': (item.facturado_sunat && item.fecha_facturacion_sunat) ? formatearFecha(item.fecha_facturacion_sunat) : '',
          'Cliente': item.cliente,
          'RUC': item.ruc,
          'Vendedor': item.vendedor,
          'Fecha Emision': formatearFecha(item.fecha_emision),
          'Fecha Despacho': item.fecha_despacho ? formatearFecha(item.fecha_despacho) : 'Pendiente',
          'Moneda': item.moneda,
          'Subtotal': parseFloat(parseFloat(item.subtotal).toFixed(3)),
          'IGV': parseFloat(parseFloat(item.igv).toFixed(3)),
          'Total': parseFloat(parseFloat(item.total).toFixed(3)),
          'Pagado': parseFloat(parseFloat(item.monto_pagado).toFixed(3)),
          'Por Cobrar': parseFloat(parseFloat(item.pendiente_cobro).toFixed(3)),
          'Estado Pago': item.estado_pago,
          'Estado': item.estado,
          'Tipo Venta': item.tipo_venta,
          'Estado Logistico': item.estado_logistico
        };

        if (hayConversion && hayUSD) {
          const esUSD = item.moneda === 'USD';
          base['Subtotal (PEN)'] = parseFloat((parseFloat(item.subtotal) * (esUSD ? tcVenta : 1)).toFixed(3));
          base['IGV (PEN)'] = parseFloat((parseFloat(item.igv) * (esUSD ? tcVenta : 1)).toFixed(3));
          base['Total (PEN)'] = parseFloat((parseFloat(item.total) * (esUSD ? tcVenta : 1)).toFixed(3));
          base['Pagado (PEN)'] = parseFloat((parseFloat(item.monto_pagado) * (esUSD ? tcVenta : 1)).toFixed(3));
          base['Por Cobrar (PEN)'] = parseFloat((parseFloat(item.pendiente_cobro) * (esUSD ? tcVenta : 1)).toFixed(3));
          base['TC Aplicado'] = esUSD ? tcVenta : '-';
        }

        return base;
      });

      const wsResumen = XLSX.utils.json_to_sheet(datosResumen);
      const colsBase = [
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
        { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 12 },
        { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
      ];
      if (hayConversion && hayUSD) {
        colsBase.push({ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 });
      }
      wsResumen['!cols'] = colsBase;
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

      if (hayConversion && hayUSD) {
        const r = dataReporte.resumen;
        const tcInfo = [
          ['INFORMACION DEL TIPO DE CAMBIO APLICADO'],
          [''],
          ['Fuente', 'SUNAT'],
          ['Fecha TC', formatearFecha(tipoCambio.fecha)],
          ['TC Compra', tipoCambio.compra],
          ['TC Venta', tipoCambio.venta],
          ['TC Promedio', tipoCambio.promedio],
          [''],
          ['Fecha de Generacion', formatearFechaHora(new Date().toISOString())],
          [''],
          ['NOTA: Los montos en columnas "(PEN)" fueron convertidos usando el TC Venta SUNAT indicado arriba.'],
          ['Los montos originales en USD se mantienen en las columnas Subtotal, IGV, Total, Pagado y Por Cobrar.'],
          [''],
          ['RESUMEN UNIFICADO EN SOLES'],
          [''],
          ['Concepto', 'PEN Original', 'USD Original', 'USD Convertido a PEN', 'Total Unificado PEN'],
          ['Ventas', r.total_ventas_pen, r.total_ventas_usd, parseFloat((r.total_ventas_usd * tcVenta).toFixed(3)), parseFloat((r.total_ventas_pen + r.total_ventas_usd * tcVenta).toFixed(3))],
          ['Cobrado', r.total_pagado_pen, r.total_pagado_usd, parseFloat((r.total_pagado_usd * tcVenta).toFixed(3)), parseFloat((r.total_pagado_pen + r.total_pagado_usd * tcVenta).toFixed(3))],
          ['Por Cobrar', r.total_pendiente_pen, r.total_pendiente_usd, parseFloat((r.total_pendiente_usd * tcVenta).toFixed(3)), parseFloat((r.total_pendiente_pen + r.total_pendiente_usd * tcVenta).toFixed(3))],
          ['Comisiones', r.total_comisiones_pen, r.total_comisiones_usd, parseFloat((r.total_comisiones_usd * tcVenta).toFixed(3)), parseFloat((r.total_comisiones_pen + r.total_comisiones_usd * tcVenta).toFixed(3))]
        ];
        const wsTCInfo = XLSX.utils.aoa_to_sheet(tcInfo);
        wsTCInfo['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, wsTCInfo, 'Tipo de Cambio');
      }

      const productosAgrupados = {};
      dataFiltrada.forEach((orden) => {
        if (orden.detalles && orden.detalles.length > 0) {
          orden.detalles.forEach(det => {
            const key = hayConversion ? det.codigo_producto : `${det.codigo_producto}_${orden.moneda}`;
            if (!productosAgrupados[key]) {
              productosAgrupados[key] = {
                codigo: det.codigo_producto, nombre: det.producto_nombre,
                unidad_medida: det.unidad_medida, moneda: hayConversion ? 'PEN (Unif.)' : orden.moneda,
                cantidad_total: 0, cantidad_despachada_total: 0, cantidad_pendiente_total: 0,
                subtotal: 0, descuento_total: 0, ordenes: []
              };
            }
            const factor = (hayConversion && orden.moneda === 'USD') ? tcVenta : 1;
            productosAgrupados[key].cantidad_total += parseFloat(det.cantidad);
            productosAgrupados[key].cantidad_despachada_total += parseFloat(det.cantidad_despachada || 0);
            productosAgrupados[key].cantidad_pendiente_total += parseFloat(det.cantidad) - parseFloat(det.cantidad_despachada || 0);
            productosAgrupados[key].subtotal += parseFloat(det.subtotal) * factor;
            productosAgrupados[key].descuento_total += parseFloat(det.descuento || 0) * factor;
            productosAgrupados[key].ordenes.push({ numero: orden.numero, cliente: orden.cliente, cantidad: parseFloat(det.cantidad), precio_unitario: parseFloat(det.precio_unitario) * factor, subtotal: parseFloat(det.subtotal) * factor });
          });
        }
      });

      const datosProductos = [];
      Object.values(productosAgrupados).sort((a, b) => b.subtotal - a.subtotal).forEach(prod => {
        datosProductos.push({
          'Codigo': prod.codigo, 'Producto': prod.nombre, 'Unidad': prod.unidad_medida, 'Moneda': prod.moneda,
          'Cant. Total': parseFloat(prod.cantidad_total.toFixed(3)), 'Cant. Despachada': parseFloat(prod.cantidad_despachada_total.toFixed(3)),
          'Cant. Pendiente': parseFloat(prod.cantidad_pendiente_total.toFixed(3)), 'Descuento Total': parseFloat(prod.descuento_total.toFixed(3)),
          'Subtotal': parseFloat(prod.subtotal.toFixed(3)), 'N Ordenes': prod.ordenes.length,
          'Ordenes': prod.ordenes.map(o => `${o.numero} (${o.cliente}: ${o.cantidad})`).join(' | ')
        });
      });

      if (datosProductos.length > 0) {
        const wsProductos = XLSX.utils.json_to_sheet(datosProductos);
        wsProductos['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 80 }];
        XLSX.utils.book_append_sheet(wb, wsProductos, 'Resumen Productos');
      }

      if (incluirDetalleExcel) {
        dataFiltrada.forEach((orden) => {
          const nombreHoja = orden.numero.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 31);
          const formaPagoTexto = orden.tipo_venta === 'Credito' ? `Credito ${orden.dias_credito} Dias` : 'Contado';
          const fechaVencimientoTexto = orden.tipo_venta === 'Credito' ? formatearFecha(orden.fecha_vencimiento) : '-';

          const datosOrden = [
            ['INFORMACION DE LA ORDEN'],
            ['Numero de Orden', orden.numero],
            ['Tipo Comprobante', orden.tipo_comprobante],
            ['Numero Comprobante', (orden.tipo_comprobante === 'Factura' && orden.facturado_sunat && orden.numero_comprobante_sunat) ? `${orden.numero_comprobante_sunat} (SUNAT)` : (orden.tipo_comprobante === 'Factura' && !orden.facturado_sunat) ? '' : (orden.numero_comprobante || '')],            ...(orden.facturado_sunat ? [['Comprobante SUNAT', orden.numero_comprobante_sunat || ''], ['Fecha Facturacion SUNAT', formatearFecha(orden.fecha_facturacion_sunat)]] : []),
            ['Estado', orden.estado], ['Estado Verificacion', orden.estado_verificacion], ['Estado Pago', orden.estado_pago],
            ['Tipo de Venta', orden.tipo_venta], ['Forma de Pago', formaPagoTexto], ['Fecha Vencimiento', fechaVencimientoTexto],
            [''], ['INFORMACION DEL CLIENTE'],
            ['Razon Social', orden.cliente], ['RUC', orden.ruc], ['Direccion', orden.direccion_cliente || ''],
            ['Telefono', orden.telefono_cliente || ''], ['Email', orden.email_cliente || ''],
            [''], ['FECHAS'],
            ['Creacion', formatearFechaHora(orden.fecha_creacion)], ['Emision', formatearFecha(orden.fecha_emision)],
            ['Vencimiento', formatearFecha(orden.fecha_vencimiento)],
            ['Despacho', orden.fecha_despacho ? formatearFecha(orden.fecha_despacho) : 'Pendiente'],
            ['Verificacion', orden.fecha_verificacion ? formatearFechaHora(orden.fecha_verificacion) : ''],
            [''], ['INFORMACION DE ENTREGA'],
            ['Tipo de Entrega', orden.tipo_entrega],
            ['Vehiculo', orden.vehiculo_placa ? `${orden.vehiculo_placa} - ${orden.vehiculo_marca}` : ''],
            ['Conductor', orden.conductor_nombre || ''], ['DNI Conductor', orden.conductor_dni || ''],
            ['Transporte', orden.transporte_nombre || ''], ['Placa Transporte', orden.transporte_placa || ''],
            ['Direccion Entrega', orden.direccion_entrega || ''], ['Ciudad', orden.ciudad_entrega || ''],
            [''], ['PRODUCTOS'],
            ['Producto', 'Codigo', 'Cantidad', 'Unidad', 'P. Unitario', 'Descuento', 'Subtotal', 'Despachado']
          ];

          if (orden.detalles && orden.detalles.length > 0) {
            orden.detalles.forEach(det => {
              datosOrden.push([det.producto_nombre, det.codigo_producto, det.cantidad, det.unidad_medida,
                `${orden.moneda} ${det.precio_unitario}`, parseFloat(det.descuento) > 0 ? `${orden.moneda} ${det.descuento}` : '-',
                `${orden.moneda} ${det.subtotal}`, `${det.cantidad_despachada}/${det.cantidad}`]);
            });
          }

          datosOrden.push([''], ['RESUMEN FINANCIERO'],
            ['Subtotal', `${orden.moneda} ${orden.subtotal}`],
            ['IGV (' + orden.porcentaje_impuesto + '%)', `${orden.moneda} ${orden.igv}`],
            ['Total', `${orden.moneda} ${orden.total}`],
            ['Monto Pagado', `${orden.moneda} ${orden.monto_pagado}`],
            ['Pendiente de Cobro', `${orden.moneda} ${orden.pendiente_cobro}`]);

          if (hayConversion && orden.moneda === 'USD') {
            datosOrden.push([''], ['CONVERSION A SOLES (TC Venta SUNAT: S/ ' + tcVenta.toFixed(3) + ')'],
              ['Subtotal (PEN)', `S/ ${(parseFloat(orden.subtotal) * tcVenta).toFixed(3)}`],
              ['IGV (PEN)', `S/ ${(parseFloat(orden.igv) * tcVenta).toFixed(3)}`],
              ['Total (PEN)', `S/ ${(parseFloat(orden.total) * tcVenta).toFixed(3)}`],
              ['Pagado (PEN)', `S/ ${(parseFloat(orden.monto_pagado) * tcVenta).toFixed(3)}`],
              ['Pendiente (PEN)', `S/ ${(parseFloat(orden.pendiente_cobro) * tcVenta).toFixed(3)}`]);
          }

          if (parseFloat(orden.total_comision) > 0) {
            datosOrden.push(['Comision (' + orden.porcentaje_comision_promedio + '%)', `${orden.moneda} ${orden.total_comision}`]);
          }

          datosOrden.push([''], ['PERSONAL'], ['Vendedor', orden.vendedor], ['Registrado por', orden.registrador], ['Verificador', orden.verificador]);
          datosOrden.push([''], ['DOCUMENTOS ASOCIADOS'], ['Cotizacion', orden.numero_cotizacion || ''], ['Guia Interna', orden.numero_guia_interna || ''], ['OC Cliente', orden.orden_compra_cliente || '']);

          if (orden.observaciones || orden.observaciones_verificador || orden.motivo_rechazo) {
            datosOrden.push([''], ['OBSERVACIONES']);
            if (orden.observaciones) datosOrden.push(['Observaciones Generales', orden.observaciones]);
            if (orden.observaciones_verificador) datosOrden.push(['Observaciones Verificador', orden.observaciones_verificador]);
            if (orden.motivo_rechazo) datosOrden.push(['Motivo de Rechazo', orden.motivo_rechazo]);
          }

          const wsOrden = XLSX.utils.aoa_to_sheet(datosOrden);
          wsOrden['!cols'] = [{ wch: 30 }, { wch: 50 }];
          XLSX.utils.book_append_sheet(wb, wsOrden, nombreHoja);
        });
      }

      const nombreCliente = clienteSeleccionado ? clienteSeleccionado.razon_social.replace(/[^a-zA-Z0-9]/g, '_') : 'Todos';
      const fechaActual = new Date().toISOString().split('T')[0];
      const sufijo = (hayConversion && hayUSD) ? '_TC_SUNAT' : '';
      XLSX.writeFile(wb, `Reporte_${nombreCliente}_${fechaActual}${sufijo}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('Error al generar el archivo Excel');
    } finally {
      setLoadingExcel(false);
    }
  };

  const verDetalleOrden = (orden) => { setOrdenSeleccionada(orden); setMostrarDetalleOrden(true); };

  const obtenerBadgeEstadoPago = (estado) => {
    const estilos = { 'Pagado': 'badge badge-success', 'Parcial': 'badge badge-warning', 'Pendiente': 'badge badge-danger' };
    return <span className={estilos[estado] || 'badge badge-secondary'}>{estado}</span>;
  };

  const obtenerBadgeEstado = (estado) => {
    const estilos = {
      'En Espera': 'badge badge-secondary', 'En Proceso': 'badge badge-info',
      'Atendido por Produccion': 'badge badge-purple-100 text-purple-900 border-purple-200',
      'Despacho Parcial': 'badge badge-warning', 'Despachada': 'badge badge-success',
      'Entregada': 'badge badge-success', 'Cancelada': 'badge badge-danger'
    };
    const claseExtra = estado === 'Atendido por Produccion' ? 'bg-purple-100 text-purple-900 border border-purple-200' : (estilos[estado] || 'badge badge-secondary');
    return <span className={claseExtra.startsWith('badge') ? claseExtra : `badge ${claseExtra}`}>{estado}</span>;
  };

  const obtenerBadgeVerificacion = (estado) => {
    const estilos = { 'Pendiente': 'badge badge-warning', 'Aprobada': 'badge badge-success', 'Rechazada': 'badge badge-danger' };
    return <span className={estilos[estado] || 'badge badge-secondary'}>{estado}</span>;
  };

  const obtenerBadgeLogistica = (estado) => {
    const estilos = { 'A tiempo': 'badge badge-info', 'En plazo': 'badge badge-info badge-outline', 'Retrasado': 'badge badge-danger', 'Vencido': 'badge badge-danger badge-outline' };
    return <span className={estilos[estado] || 'badge badge-secondary'}>{estado}</span>;
  };

  const obtenerIconoTipoEntrega = (tipo) => {
    if (tipo === 'Vehiculo Empresa') return <Truck size={16} className="text-blue-600" />;
    if (tipo === 'Transporte Privado') return <Package size={16} className="text-orange-600" />;
    return <ShoppingCart size={16} className="text-green-600" />;
  };

  const resumen = dataReporte.resumen;
  const hayUSDenData = resumen.total_ventas_usd > 0;

  return (
    <div className="w-full px-6 py-8 font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-primary" /> Dashboard de Ventas
          </h1>
          <p className="text-muted text-sm">Monitor de rendimiento comercial y logistico</p>
        </div>
        <div className="flex gap-2">
          <button onClick={descargarExcel} disabled={loadingExcel || dataFiltrada.length === 0} className="btn btn-success">
            {loadingExcel ? <Loading size="sm" color="white"/> : <FileSpreadsheet size={18} />}
            Excel {convertirUSD && tcVenta ? '(TC)' : ''}
          </button>
          <button onClick={descargarPDF} disabled={loadingPdf} className="btn btn-danger">
            {loadingPdf ? <Loading size="sm" color="white"/> : <Download size={18} />}
            PDF
          </button>
        </div>
      </div>

      <div className="card mb-4" style={{ borderLeft: tipoCambio ? '4px solid var(--accent, #ca8a04)' : '4px solid var(--border-color, #374151)' }}>
        <div className="card-body p-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: tipoCambio ? 'var(--accent-dim, rgba(234,179,8,0.1))' : 'var(--bg-tertiary, #1f2937)' }}>
                <DollarSign size={20} style={{ color: tipoCambio ? 'var(--accent, #ca8a04)' : 'var(--text-muted)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tipo de Cambio SUNAT</p>
                {tipoCambio ? (
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Compra: <strong className="text-base" style={{ color: 'var(--text-primary)' }}>S/ {tipoCambio.compra.toFixed(3)}</strong>
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Venta: <strong className="text-base" style={{ color: 'var(--accent, #ca8a04)' }}>S/ {tipoCambio.venta.toFixed(3)}</strong>
                      </span>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={12} /><span>SUNAT: {formatearFecha(tipoCambio.fecha)}</span>
                      <span className="mx-1">&middot;</span>
                      <Clock size={12} /><span>{obtenerEdadTC()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <AlertTriangle size={14} /><span>No disponible — Presione "Actualizar TC" para consultar</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tipoCambio && hayUSDenData && (
                <button className={`btn btn-sm ${convertirUSD ? 'btn-warning' : 'btn-outline'}`} onClick={() => setConvertirUSD(!convertirUSD)}
                  title={convertirUSD ? 'Mostrando totales unificados en PEN' : 'Convertir USD a PEN con TC SUNAT'}>
                  <ArrowRightLeft size={14} />{convertirUSD ? 'Viendo en PEN' : 'Unificar a PEN'}
                </button>
              )}
              <button className="btn btn-sm btn-outline" onClick={actualizarTipoCambio} disabled={loadingTC} title="Consultar TC actual desde SUNAT">
                {loadingTC ? <RefreshCcw size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                {loadingTC ? 'Consultando...' : 'Actualizar TC'}
              </button>
            </div>
          </div>
          {tipoCambio && (
            <div className="flex md:hidden items-center gap-2 text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={12} /><span>SUNAT: {formatearFecha(tipoCambio.fecha)}</span>
              <span className="mx-1">&middot;</span><Clock size={12} /><span>{obtenerEdadTC()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={generarReporte} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="form-group mb-0">
                <label className="form-label uppercase text-xs text-muted">Filtrar por</label>
                <select className="form-select" value={filtros.filtroFecha} onChange={(e) => setFiltros({...filtros, filtroFecha: e.target.value})}>
                  <option value="fecha_emision">Fecha Emision</option>
                  <option value="fecha_sunat">Fecha Facturado SUNAT</option>
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="form-label uppercase text-xs text-muted">Desde</label>
                <div className="input-with-icon"><Calendar className="icon" size={16} />
                  <input type="date" className="form-input" value={filtros.fechaInicio} onChange={(e) => setFiltros({...filtros, fechaInicio: e.target.value})} />
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="form-label uppercase text-xs text-muted">Hasta</label>
                <div className="input-with-icon"><Calendar className="icon" size={16} />
                  <input type="date" className="form-input" value={filtros.fechaFin} onChange={(e) => setFiltros({...filtros, fechaFin: e.target.value})} />
                </div>
              </div>
              <div className="form-group mb-0 relative" ref={wrapperRef}>
                <label className="form-label uppercase text-xs text-muted">Cliente</label>
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={16} />
                  <input type="text" placeholder="Buscar cliente por nombre o RUC..." className="form-input search-input" value={busquedaCliente}
                    onChange={(e) => { setBusquedaCliente(e.target.value); if(filtros.idCliente) setFiltros({...filtros, idCliente: ''}); }}
                    onFocus={() => busquedaCliente && setMostrarSugerencias(true)} />
                  {filtros.idCliente && (
                    <button type="button" onClick={limpiarCliente} className="absolute right-2 top-2.5 text-gray-400 hover:text-red-500"><X size={16} /></button>
                  )}
                </div>
                {mostrarSugerencias && clientesSugeridos.length > 0 && (
                  <ul className="absolute z-50 w-full border border-border rounded-none shadow-lg mt-1 max-h-96 overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {clientesSugeridos.map(cliente => (
                      <li key={cliente.id_cliente} onClick={() => seleccionarCliente(cliente)} className="px-4 py-2 cursor-pointer text-sm border-b border-border last:border-0"
                        style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--carbon-light)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
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
                  <select className="form-select" value={filtros.estadoOrden} onChange={(e) => setFiltros({...filtros, estadoOrden: e.target.value})}>
                    <option value="">Todos</option><option value="En Espera">En Espera</option><option value="En Proceso">En Proceso</option>
                    <option value="Atendido por Produccion">Atendido por Produccion</option><option value="Despacho Parcial">Despacho Parcial</option>
                    <option value="Despachada">Despachada</option><option value="Entregada">Entregada</option>
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label uppercase text-xs text-muted">Estado Pago</label>
                  <select className="form-select" value={filtros.estadoPago} onChange={(e) => setFiltros({...filtros, estadoPago: e.target.value})}>
                    <option value="">Todos</option><option value="Pendiente">Pendiente</option><option value="Parcial">Parcial</option><option value="Pagado">Pagado</option>
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label uppercase text-xs text-muted">Detalle Excel</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={incluirDetalleExcel} onChange={(e) => setIncluirDetalleExcel(e.target.checked)} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2" />
                    <span className="text-sm text-gray-700">Incluir hojas de detalle</span>
                  </label>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label uppercase text-xs text-muted">Detalle PDF</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={incluirDetallePDF} onChange={(e) => setIncluirDetallePDF(e.target.checked)} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2" />
                    <span className="text-sm text-gray-700">Incluir detalle ordenes</span>
                  </label>
                </div>
                <button type="button" onClick={() => { setFiltros({...filtros, estadoOrden: '', estadoPago: '', filtroFecha: 'fecha_emision'}); }} className="btn btn-ghost" title="Limpiar filtros">
                  <RefreshCw size={16} />
                </button>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <Loading size="sm" color="white" /> : <Filter size={18} />} Buscar
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {convertirUSD && tcVenta && hayUSDenData && (
        <div className="card mb-4 p-4 rounded-lg" style={{ background: 'var(--accent-dim, rgba(234,179,8,0.08))', border: '1px solid var(--accent-border, rgba(234,179,8,0.3))' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowRightLeft size={20} style={{ color: 'var(--accent, #ca8a04)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent, #ca8a04)' }}>
                  Totales unificados en Soles (TC Venta SUNAT: S/ {tcVenta.toFixed(3)})
                </p>
                <div className="flex gap-6 mt-1">
                  <span className="text-sm">Ventas: <strong className="text-base">S/ {formatearNumero(totalUnificadoPEN(resumen.total_ventas_pen, resumen.total_ventas_usd))}</strong></span>
                  <span className="text-sm text-green-700">Cobrado: <strong>S/ {formatearNumero(totalUnificadoPEN(resumen.total_pagado_pen, resumen.total_pagado_usd))}</strong></span>
                  <span className="text-sm text-red-700">Por Cobrar: <strong>S/ {formatearNumero(totalUnificadoPEN(resumen.total_pendiente_pen, resumen.total_pendiente_usd))}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card border-l-4 border-blue-500">
          <div className="stat-content">
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Ventas Totales</p>
            <h3 className="stat-value text-gray-900">{formatearMoneda(resumen.total_ventas_pen, 'PEN')}</h3>
            {resumen.total_ventas_usd > 0 && (
              <p className="text-sm text-blue-700 font-semibold mt-1">
                {formatearMoneda(resumen.total_ventas_usd, 'USD')}
                {convertirUSD && tcVenta && (<span className="text-xs ml-2" style={{ color: 'var(--accent, #ca8a04)' }}>= S/ {formatearNumero(resumen.total_ventas_usd * tcVenta)}</span>)}
              </p>
            )}
            <div className="flex gap-2 mt-2 text-xs flex-wrap">
              <span className="badge badge-info badge-sm">Ct PEN: {formatearMoneda(resumen.contado_pen, 'PEN')}</span>
              <span className="badge badge-purple-100 text-purple-900 badge-sm border border-purple-200">Cr PEN: {formatearMoneda(resumen.credito_pen, 'PEN')}</span>
              {resumen.contado_usd > 0 && (<span className="badge badge-info badge-sm">Ct USD: {formatearMoneda(resumen.contado_usd, 'USD')}</span>)}
              {resumen.credito_usd > 0 && (<span className="badge badge-purple-100 text-purple-900 badge-sm border border-purple-200">Cr USD: {formatearMoneda(resumen.credito_usd, 'USD')}</span>)}
            </div>
          </div>
          <div className="stat-icon bg-blue-50 text-blue-600"><DollarSign size={24}/></div>
        </div>

        <div className="stat-card border-l-4 border-green-500">
          <div className="stat-content">
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Cobrado</p>
            <h3 className="stat-value text-success">{formatearMoneda(resumen.total_pagado_pen, 'PEN')}</h3>
            {resumen.total_pagado_usd > 0 && (
              <p className="text-sm text-green-700 font-semibold mt-1">
                {formatearMoneda(resumen.total_pagado_usd, 'USD')}
                {convertirUSD && tcVenta && (<span className="text-xs ml-2" style={{ color: 'var(--accent, #ca8a04)' }}>= S/ {formatearNumero(resumen.total_pagado_usd * tcVenta)}</span>)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Liquidez ingresada</p>
          </div>
          <div className="stat-icon bg-green-50 text-success"><CheckCircle size={24}/></div>
        </div>

        <div className="stat-card border-l-4 border-red-500">
          <div className="stat-content">
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Por Cobrar</p>
            <h3 className="stat-value text-danger">{formatearMoneda(resumen.total_pendiente_pen, 'PEN')}</h3>
            {resumen.total_pendiente_usd > 0 && (
              <p className="text-sm text-red-700 font-semibold mt-1">
                {formatearMoneda(resumen.total_pendiente_usd, 'USD')}
                {convertirUSD && tcVenta && (<span className="text-xs ml-2" style={{ color: 'var(--accent, #ca8a04)' }}>= S/ {formatearNumero(resumen.total_pendiente_usd * tcVenta)}</span>)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Credito pendiente</p>
          </div>
          <div className="stat-icon bg-red-50 text-danger"><AlertCircle size={24}/></div>
        </div>

        <div className="stat-card border-l-4 border-orange-500">
          <div className="stat-content">
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Operaciones</p>
            <h3 className="stat-value text-gray-900">{resumen.cantidad_ordenes}</h3>
            <div className="mt-2 text-xs flex items-center gap-2">
              <span className={`badge ${resumen.pedidos_retrasados > 0 ? 'badge-danger' : 'badge-success'}`}>{resumen.pedidos_retrasados} Retrasos</span>
            </div>
          </div>
          <div className="stat-icon bg-orange-50 text-orange-600"><Truck size={24}/></div>
        </div>
      </div>

      {(resumen.total_comisiones_pen > 0 || resumen.total_comisiones_usd > 0) && (
        <div className="card mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg"><Percent size={20} className="text-purple-600" /></div>
                <div>
                  <p className="text-xs font-semibold text-purple-600 uppercase">Total Comisiones</p>
                  <p className="text-lg font-bold text-purple-900">{formatearMoneda(resumen.total_comisiones_pen, 'PEN')}</p>
                  {resumen.total_comisiones_usd > 0 && (
                    <p className="text-sm font-semibold text-purple-700">
                      {formatearMoneda(resumen.total_comisiones_usd, 'USD')}
                      {convertirUSD && tcVenta && (<span className="text-xs ml-2" style={{ color: 'var(--accent, #ca8a04)' }}>= S/ {formatearNumero(resumen.total_comisiones_usd * tcVenta)}</span>)}
                    </p>
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
          <span className="badge badge-secondary badge-outline">{dataFiltrada.length} Registros</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="px-4 py-3">Acciones</th>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Emision</th>
                <th className="px-4 py-3">Despacho</th>
                <th className="px-4 py-3 text-right">Total</th>
                {convertirUSD && tcVenta && <th className="px-4 py-3 text-right">Total (PEN)</th>}
                <th className="px-4 py-3 text-center">Estado Pago</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Logistica</th>
              </tr>
            </thead>
            <tbody>
              {dataFiltrada.length > 0 ? (
                dataFiltrada.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => verDetalleOrden(item)}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => verDetalleOrden(item)} className="btn btn-ghost btn-xs text-primary" title="Ver detalles"><Eye size={14} /> Ver</button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium text-primary">{item.numero}</div>
                      {(item.numero_comprobante || item.numero_comprobante_sunat) && (
                        <div className="text-xs text-muted">
                          {item.tipo_comprobante}: {(item.tipo_comprobante === 'Factura' && item.facturado_sunat && item.numero_comprobante_sunat)
                             ? <span className="text-green-600 font-medium">{item.numero_comprobante_sunat}</span>
                             : (item.tipo_comprobante === 'Factura' && !item.facturado_sunat) ? '' : item.numero_comprobante}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="font-medium truncate w-32" title={item.cliente}>{item.cliente}</div>
                      <div className="text-xs text-muted">{item.ruc}</div>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs truncate w-24">{item.vendedor}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">{formatearFecha(item.fecha_emision)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                      {item.fecha_despacho ? formatearFecha(item.fecha_despacho) : <span className="text-gray-400 italic">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">
                      <span className="text-xs text-muted mr-1">{item.moneda}</span>
                      {formatearNumero(item.total)}
                    </td>
                    {convertirUSD && tcVenta && (
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--accent, #ca8a04)' }}>
                        S/ {formatearNumero(item.moneda === 'USD' ? parseFloat(item.total) * tcVenta : parseFloat(item.total))}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">{obtenerBadgeEstadoPago(item.estado_pago)}</td>
                    <td className="px-4 py-3 text-center">{obtenerBadgeEstado(item.estado)}</td>
                    <td className="px-4 py-3 text-center">{obtenerBadgeLogistica(item.estado_logistico)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={convertirUSD && tcVenta ? 11 : 10} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center">
                      <Search size={32} className="mb-2 opacity-20"/>No se encontraron ventas con los filtros seleccionados.
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
                  <FileText className="text-primary" /> Detalle de Orden: {ordenSeleccionada.numero}
                </h2>
                <p className="text-sm text-muted mt-1">Informacion completa de la orden de venta</p>
              </div>
              <button onClick={() => setMostrarDetalleOrden(false)} className="btn btn-ghost"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Estado General</p>
                  <div className="flex flex-col gap-2">{obtenerBadgeEstado(ordenSeleccionada.estado)}{obtenerBadgeVerificacion(ordenSeleccionada.estado_verificacion)}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-semibold uppercase mb-1">Estado de Pago</p>
                  <div className="flex flex-col gap-2">
                    {obtenerBadgeEstadoPago(ordenSeleccionada.estado_pago)}
                    <p className="text-xs text-gray-600 mt-1">Pagado: {ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}</p>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold uppercase mb-1">Tipo de Venta</p>
                  <p className="text-lg font-bold text-purple-900">{ordenSeleccionada.tipo_venta}</p>
                  {ordenSeleccionada.tipo_venta === 'Credito' && (
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-purple-800">Forma Pago: Credito {ordenSeleccionada.dias_credito} Dias</p>
                      <p className="text-xs text-gray-600">Vence: {formatearFecha(ordenSeleccionada.fecha_vencimiento)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={18} className="text-primary" /> Informacion del Cliente</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted">Razon Social:</span><p className="font-medium text-gray-800">{ordenSeleccionada.cliente}</p></div>
                      <div><span className="text-muted">RUC:</span><p className="font-medium text-gray-800">{ordenSeleccionada.ruc}</p></div>
                      {ordenSeleccionada.direccion_cliente && (<div><span className="text-muted flex items-center gap-1"><MapPin size={14} /> Direccion:</span><p className="font-medium text-gray-800">{ordenSeleccionada.direccion_cliente}</p></div>)}
                      {ordenSeleccionada.telefono_cliente && (<div className="flex items-center gap-2"><Phone size={14} className="text-muted" /><span className="text-gray-800">{ordenSeleccionada.telefono_cliente}</span></div>)}
                      {ordenSeleccionada.email_cliente && (<div className="flex items-center gap-2"><Mail size={14} className="text-muted" /><span className="text-gray-800">{ordenSeleccionada.email_cliente}</span></div>)}
                    </div>
                  </div>
                </div>
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar size={18} className="text-success" /> Fechas Importantes</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Creacion:</span><span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_creacion)}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Emision:</span><span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_emision)}</span></div>
                      {ordenSeleccionada.fecha_vencimiento && (<div className="flex justify-between"><span className="text-muted">Vencimiento:</span><span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_vencimiento)}</span></div>)}
                      {ordenSeleccionada.fecha_entrega_programada && (<div className="flex justify-between"><span className="text-muted">Entrega Programada:</span><span className="font-medium text-gray-800">{formatearFecha(ordenSeleccionada.fecha_entrega_programada)}</span></div>)}
                      {ordenSeleccionada.fecha_entrega_real && (<div className="flex justify-between"><span className="text-muted">Entrega Real:</span><span className="font-medium text-green-700">{formatearFecha(ordenSeleccionada.fecha_entrega_real)}</span></div>)}
                      {ordenSeleccionada.fecha_verificacion && (<div className="flex justify-between"><span className="text-muted">Verificacion:</span><span className="font-medium text-gray-800">{formatearFechaHora(ordenSeleccionada.fecha_verificacion)}</span></div>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-none">
                <div className="card-body p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">{obtenerIconoTipoEntrega(ordenSeleccionada.tipo_entrega)} Informacion de Entrega</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted">Tipo de Entrega:</span><p className="font-medium text-gray-800">{ordenSeleccionada.tipo_entrega}</p></div>
                    {ordenSeleccionada.tipo_entrega === 'Vehiculo Empresa' && (<>
                      {ordenSeleccionada.vehiculo_placa && (<div><span className="text-muted">Vehiculo:</span><p className="font-medium text-gray-800">{ordenSeleccionada.vehiculo_placa} - {ordenSeleccionada.vehiculo_marca}</p></div>)}
                      {ordenSeleccionada.conductor_nombre && (<div><span className="text-muted">Conductor:</span><p className="font-medium text-gray-800">{ordenSeleccionada.conductor_nombre}</p>{ordenSeleccionada.conductor_dni && (<p className="text-xs text-muted">DNI: {ordenSeleccionada.conductor_dni}</p>)}{ordenSeleccionada.conductor_licencia && (<p className="text-xs text-muted">Licencia: {ordenSeleccionada.conductor_licencia}</p>)}</div>)}
                    </>)}
                    {ordenSeleccionada.tipo_entrega === 'Transporte Privado' && (<>
                      {ordenSeleccionada.transporte_nombre && (<div><span className="text-muted">Empresa de Transporte:</span><p className="font-medium text-gray-800">{ordenSeleccionada.transporte_nombre}</p></div>)}
                      {ordenSeleccionada.transporte_placa && (<div><span className="text-muted">Placa:</span><p className="font-medium text-gray-800">{ordenSeleccionada.transporte_placa}</p></div>)}
                      {ordenSeleccionada.transporte_conductor && (<div><span className="text-muted">Conductor:</span><p className="font-medium text-gray-800">{ordenSeleccionada.transporte_conductor}</p>{ordenSeleccionada.transporte_dni && (<p className="text-xs text-muted">DNI: {ordenSeleccionada.transporte_dni}</p>)}</div>)}
                    </>)}
                    {ordenSeleccionada.direccion_entrega && (<div className="md:col-span-2"><span className="text-muted flex items-center gap-1"><MapPin size={14} /> Direccion de Entrega:</span><p className="font-medium text-gray-800">{ordenSeleccionada.direccion_entrega}</p>{ordenSeleccionada.ciudad_entrega && (<p className="text-xs text-muted">{ordenSeleccionada.ciudad_entrega}</p>)}</div>)}
                    {ordenSeleccionada.contacto_entrega && (<div><span className="text-muted">Contacto:</span><p className="font-medium text-gray-800">{ordenSeleccionada.contacto_entrega}</p>{ordenSeleccionada.telefono_entrega && (<p className="text-xs text-muted">{ordenSeleccionada.telefono_entrega}</p>)}</div>)}
                  </div>
                </div>
              </div>

              {ordenSeleccionada.detalles && ordenSeleccionada.detalles.length > 0 && (
                <div className="card shadow-none">
                  <div className="card-body p-5">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Package size={18} className="text-purple-600" /> Productos ({ordenSeleccionada.detalles.length})</h3>
                    <div className="table-container">
                      <table className="table">
                        <thead><tr>
                          <th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-center">Codigo</th>
                          <th className="px-3 py-2 text-center">Cantidad</th><th className="px-3 py-2 text-right">P. Unitario</th>
                          <th className="px-3 py-2 text-right">Descuento</th><th className="px-3 py-2 text-right">Subtotal</th>
                          <th className="px-3 py-2 text-center">Despachado</th>
                        </tr></thead>
                        <tbody>
                          {ordenSeleccionada.detalles.map((det, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2"><div className="font-medium text-gray-800">{det.producto_nombre}</div>{det.descripcion && (<div className="text-xs text-muted">{det.descripcion}</div>)}</td>
                              <td className="px-3 py-2 text-center text-muted font-mono text-xs">{det.codigo_producto}</td>
                              <td className="px-3 py-2 text-center font-semibold text-gray-800">{det.cantidad} {det.unidad_medida}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{ordenSeleccionada.moneda} {det.precio_unitario}</td>
                              <td className="px-3 py-2 text-right text-red-600">{parseFloat(det.descuento) > 0 ? `-${ordenSeleccionada.moneda} ${det.descuento}` : '-'}</td>
                              <td className="px-3 py-2 text-right font-bold text-gray-800">{ordenSeleccionada.moneda} {det.subtotal}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`badge ${det.cantidad_despachada >= det.cantidad ? 'badge-success' : det.cantidad_despachada > 0 ? 'badge-warning' : 'badge-secondary'}`}>
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
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Resumen Financiero</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal:</span><span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.subtotal}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{ordenSeleccionada.tipo_impuesto} ({ordenSeleccionada.porcentaje_impuesto}%):</span><span className="font-semibold text-gray-800">{ordenSeleccionada.moneda} {ordenSeleccionada.igv}</span></div>
                    <div className="flex justify-between text-lg border-t border-gray-300 pt-2"><span className="font-bold text-gray-800">Total:</span><span className="font-bold text-primary">{ordenSeleccionada.moneda} {ordenSeleccionada.total}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Monto Pagado:</span><span className="font-semibold text-green-600">{ordenSeleccionada.moneda} {ordenSeleccionada.monto_pagado}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Pendiente de Cobro:</span><span className="font-semibold text-red-600">{ordenSeleccionada.moneda} {ordenSeleccionada.pendiente_cobro}</span></div>
                    {parseFloat(ordenSeleccionada.total_comision) > 0 && (
                      <div className="flex justify-between text-sm border-t border-gray-300 pt-2"><span className="text-gray-600">Comision ({ordenSeleccionada.porcentaje_comision_promedio}%):</span><span className="font-semibold text-purple-600">{ordenSeleccionada.moneda} {ordenSeleccionada.total_comision}</span></div>
                    )}
                  </div>
                </div>
                {convertirUSD && tcVenta && ordenSeleccionada.moneda === 'USD' && (
                  <div className="mt-4 pt-3 rounded-lg p-3" style={{ background: 'var(--accent-dim, rgba(234,179,8,0.08))', border: '1px solid var(--accent-border, rgba(234,179,8,0.3))' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent, #ca8a04)' }}><ArrowRightLeft size={12} className="inline mr-1" />Equivalente en Soles (TC Venta SUNAT: S/ {tcVenta.toFixed(3)})</p>
                    <div className="flex justify-between text-sm"><span>Total:</span><span className="font-bold" style={{ color: 'var(--accent, #ca8a04)' }}>S/ {formatearNumero(parseFloat(ordenSeleccionada.total) * tcVenta)}</span></div>
                    <div className="flex justify-between text-sm"><span>Pagado:</span><span className="font-semibold text-green-700">S/ {formatearNumero(parseFloat(ordenSeleccionada.monto_pagado) * tcVenta)}</span></div>
                    <div className="flex justify-between text-sm"><span>Pendiente:</span><span className="font-semibold text-red-700">S/ {formatearNumero(parseFloat(ordenSeleccionada.pendiente_cobro) * tcVenta)}</span></div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card shadow-none">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">Personal Involucrado</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Vendedor:</span><span className="font-medium text-gray-800">{ordenSeleccionada.vendedor}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Registrado por:</span><span className="font-medium text-gray-800">{ordenSeleccionada.registrador}</span></div>
                      {ordenSeleccionada.verificador !== 'No asignado' && (<div className="flex justify-between"><span className="text-muted">Verificador:</span><span className="font-medium text-gray-800">{ordenSeleccionada.verificador}</span></div>)}
                    </div>
                  </div>
                </div>
                <div className="card shadow-none">
                  <div className="card-body p-4">
                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">Documentos Asociados</h4>
                    <div className="space-y-1 text-sm">
                      {ordenSeleccionada.numero_cotizacion && (<div className="flex justify-between"><span className="text-muted">Cotizacion:</span><span className="font-medium text-gray-800">{ordenSeleccionada.numero_cotizacion}</span></div>)}
                      {ordenSeleccionada.numero_guia_interna && (<div className="flex justify-between"><span className="text-muted">Guia Interna:</span><span className="font-medium text-gray-800">{ordenSeleccionada.numero_guia_interna}</span></div>)}
                      {ordenSeleccionada.orden_compra_cliente && (<div className="flex justify-between"><span className="text-muted">OC Cliente:</span><span className="font-medium text-gray-800">{ordenSeleccionada.orden_compra_cliente}</span></div>)}
                    </div>
                  </div>
                </div>
              </div>

              {(ordenSeleccionada.observaciones || ordenSeleccionada.observaciones_verificador || ordenSeleccionada.motivo_rechazo) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><FileCheck size={16} className="text-yellow-600" /> Observaciones</h4>
                  <div className="space-y-2 text-sm">
                    {ordenSeleccionada.observaciones && (<div><span className="font-medium text-gray-700">Observaciones generales:</span><p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones}</p></div>)}
                    {ordenSeleccionada.observaciones_verificador && (<div><span className="font-medium text-gray-700">Observaciones del verificador:</span><p className="text-gray-600 mt-1">{ordenSeleccionada.observaciones_verificador}</p></div>)}
                    {ordenSeleccionada.motivo_rechazo && (<div className="bg-red-50 border border-red-200 rounded p-2"><span className="font-medium text-red-700">Motivo de rechazo:</span><p className="text-red-600 mt-1">{ordenSeleccionada.motivo_rechazo}</p></div>)}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end rounded-b-xl">
              <button onClick={() => setMostrarDetalleOrden(false)} className="btn btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteVentas;