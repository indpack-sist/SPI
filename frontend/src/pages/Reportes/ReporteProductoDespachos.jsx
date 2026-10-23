import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../config/api';
import { Search, Package, Box, User, TrendingUp, AlertCircle, FileText, Receipt, Banknote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import { BadgeEstadoOrden, configEstadoOrden } from '../Ventas/estadosVentas';
import '../Ventas/Ventas.css';

const particionarDatosGrafico = (detalle) => {
    const grupos = {
        facturasPEN: [],
        facturasUSD: [],
        notasVentaPEN: [],
        notasVentaUSD: [],
        sinComprPEN: [],
        sinComprUSD: []
    };

    const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

    [...detalle].reverse().forEach((item, index) => {
        const tipoImpuesto = String(item.tipo_impuesto || '').toUpperCase().trim();
        const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
        const tipo = String(item.tipo_comprobante || '').trim();

        const fechaFormateada = new Date(item.fecha_emision).toLocaleDateString('es-PE');
        const punto = {
            idUnico: `${fechaFormateada}-${item.numero_orden}-${index}`,
            fecha: fechaFormateada,
            fechaDespacho: item.fecha_despacho_real,
            precio: parseFloat(item.precio_unitario),
            cliente: item.cliente,
            cantidad: parseFloat(item.cantidad_despachada),
            cantidadTotal: parseFloat(item.cantidad_total || item.cantidad_despachada),
            cantidadPendiente: Math.max(0, parseFloat(item.cantidad_total || 0) - parseFloat(item.cantidad_despachada || 0)),
            estado: item.estado,
            moneda: item.moneda,
            orden: item.numero_orden
        };

        let categoria = '';
        if (tipo.includes('Factura')) {
            if (!esSinImpuesto || facturasExportacion.includes(item.numero_orden)) {
                categoria = item.moneda === 'USD' ? 'facturasUSD' : 'facturasPEN';
            } else {
                categoria = item.moneda === 'USD' ? 'notasVentaUSD' : 'notasVentaPEN';
            }
        } else if (tipo.includes('Nota de Venta')) {
            categoria = item.moneda === 'USD' ? 'notasVentaUSD' : 'notasVentaPEN';
        } else {
            categoria = item.moneda === 'USD' ? 'sinComprUSD' : 'sinComprPEN';
        }

        grupos[categoria].push(punto);
    });

    return grupos;
};

const ReporteProductoDespachos = () => {
    const [productos, setProductos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [busquedaCliente, setBusquedaCliente] = useState('');
    const [mostrarDropdownProducto, setMostrarDropdownProducto] = useState(false);
    const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);

    const [filtros, setFiltros] = useState({
        idProducto: '',
        idCliente: '',
        fechaInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        estados: ['Despachada', 'Despacho Parcial', 'Entregada'],
        tipoFecha: 'emision'
    });

    const [errorFecha, setErrorFecha] = useState('');

    const handleToggleEstado = (estado) => {
        setFiltros(prev => {
            const nuevosEstados = prev.estados.includes(estado)
                ? prev.estados.filter(e => e !== estado)
                : [...prev.estados, estado];
            return { ...prev, estados: nuevosEstados };
        });
    };

    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    const dropdownProductoRef = useRef(null);
    const dropdownClienteRef = useRef(null);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const fechaPrincipal = filtros.tipoFecha === 'despacho' && data.fechaDespacho
                ? new Date(data.fechaDespacho).toLocaleDateString('es-PE')
                : data.fecha;

            return (
                <div className="vt-tooltip">
                    {filtros.tipoFecha === 'despacho' ? 'Fecha de despacho' : 'Fecha de emisión'} · {fechaPrincipal}
                    <strong>{data.moneda === 'USD' ? '$' : 'S/'} {data.precio.toFixed(2)}</strong>
                    <dl>
                        <dt>Orden</dt><dd>{data.orden}</dd>
                        {filtros.tipoFecha === 'emision' && (
                            <><dt>Despacho</dt><dd>{data.fechaDespacho ? new Date(data.fechaDespacho).toLocaleDateString('es-PE') : 'Pendiente'}</dd></>
                        )}
                        {filtros.tipoFecha === 'despacho' && (
                            <><dt>Emisión</dt><dd>{data.fecha}</dd></>
                        )}
                        <dt>Despachado</dt><dd>{data.cantidad}</dd>
                        <dt>Pendiente</dt><dd>{data.cantidadPendiente}</dd>
                    </dl>
                    <span className="pg-cell-sub">{data.cliente}</span>
                    <BadgeEstadoOrden estado={data.estado} />
                </div>
            );
        }
        return null;
    };

    const renderGrafico = (datos, titulo) => {
        if (!datos || datos.length === 0) return null;

        return (
            <div className="vt-chart-card">
                <h4 className="pg-section-title"><TrendingUp size={14} /> {titulo}</h4>
                <div className="vt-chart">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={datos} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                            <CartesianGrid stroke="var(--vt-grid)" vertical={false} />
                            <XAxis
                                dataKey="idUnico"
                                tickLine={false}
                                axisLine={{ stroke: 'var(--steel)' }}
                                tickFormatter={(val) => {
                                    const found = datos.find(d => d.idUnico === val);
                                    return found ? found.fecha : val;
                                }}
                                tick={{ fill: 'var(--vt-axis)', fontSize: 11 }}
                                minTickGap={16}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--vt-axis)', fontSize: 11 }}
                                tickFormatter={(value) => `${value.toFixed(2)}`}
                                domain={[0, 'auto']}
                                width={64}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--steel-light)', strokeWidth: 1 }} isAnimationActive={false} />
                            <Line
                                type="monotone"
                                dataKey="precio"
                                name="Precio unitario"
                                stroke="var(--vt-s1)"
                                strokeWidth={2}
                                dot={datos.length <= 31 ? { r: 4, strokeWidth: 2, fill: 'var(--bg-primary)', stroke: 'var(--vt-s1)' } : false}
                                activeDot={{ r: 5, stroke: 'var(--bg-primary)', strokeWidth: 2, fill: 'var(--vt-s1)' }}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [resProductos, resClientes] = await Promise.all([
                    api.get('/productos'),
                    api.get('/clientes')
                ]);
                if (resProductos.data.success) setProductos(resProductos.data.data);
                if (resClientes.data.success) setClientes(resClientes.data.data);
            } catch (err) {
                console.error("Error cargando datos iniciales", err);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownProductoRef.current && !dropdownProductoRef.current.contains(event.target)) {
                setMostrarDropdownProducto(false);
            }
            if (dropdownClienteRef.current && !dropdownClienteRef.current.contains(event.target)) {
                setMostrarDropdownCliente(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChangeFiltro = (e) => {
        const value = e.target.value;
        const nuevosFiltros = { ...filtros, [e.target.name]: value };
        setFiltros(nuevosFiltros);

        const inicio = e.target.name === 'fechaInicio' ? value : nuevosFiltros.fechaInicio;
        const fin = e.target.name === 'fechaFin' ? value : nuevosFiltros.fechaFin;

        if (inicio && fin) {
            if (inicio > fin) {
                setErrorFecha('La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
            } else {
                setErrorFecha('');
            }
        } else {
            setErrorFecha('');
        }
    };

    const handleSelectProducto = (producto) => {
        setFiltros({ ...filtros, idProducto: producto.id_producto });
        setBusquedaProducto(`${producto.codigo} - ${producto.nombre}`);
        setMostrarDropdownProducto(false);
    };

    const handleSelectCliente = (cliente) => {
        setFiltros({ ...filtros, idCliente: cliente.id_cliente });
        setBusquedaCliente(cliente.razon_social);
        setMostrarDropdownCliente(false);
    };

    const productosFiltrados = useMemo(() => {
        if (!busquedaProducto) return [];
        const term = busquedaProducto.toLowerCase();
        return productos.filter(p => {
            const fullString = `${p.codigo} - ${p.nombre}`.toLowerCase();
            return p.nombre.toLowerCase().includes(term) ||
                p.codigo.toLowerCase().includes(term) ||
                fullString.includes(term);
        }).slice(0, 50);
    }, [productos, busquedaProducto]);

    const clientesFiltrados = useMemo(() => {
        if (!busquedaCliente) return [];
        const term = busquedaCliente.toLowerCase();
        return clientes.filter(c => {
            return c.razon_social.toLowerCase().includes(term) ||
                (c.ruc && c.ruc.includes(term));
        }).slice(0, 50);
    }, [clientes, busquedaCliente]);

    const generarReporte = async () => {
        if (errorFecha) return;
        if (!filtros.idProducto && !filtros.idCliente) {
            setError("Debe seleccionar un producto o un cliente.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/reportes/producto-despachos', { params: filtros });
            if (response.data.success) {
                setReporteData(response.data.data);
            } else {
                setError(response.data.error || "Error al obtener el reporte.");
            }
        } catch (err) {
            setError(err.response?.data?.error || "Error de conexión al generar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    const estadisticas = useMemo(() => {
        if (!reporteData) return null;
        return reporteData.detalle.reduce((acc, mov) => {
            const tipoImpuesto = String(mov.tipo_impuesto || '').toUpperCase().trim();
            const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
            const monto = parseFloat(mov.subtotal_item || 0);
            const tipo = String(mov.tipo_comprobante || '').trim();
            const facturasExportacion = ['OV-2026-0380', 'OV-2026-0277', 'OV-2026-0162', 'OV-2026-0093'];

            if (tipo.includes('Factura')) {
                if (!esSinImpuesto || facturasExportacion.includes(mov.numero_orden)) {
                    if (mov.moneda === 'PEN') acc.facturas_pen += monto;
                    if (mov.moneda === 'USD') acc.facturas_usd += monto;
                } else {
                    if (mov.moneda === 'PEN') acc.notas_venta_pen += monto;
                    if (mov.moneda === 'USD') acc.notas_venta_usd += monto;
                }
            } else if (tipo.includes('Nota de Venta')) {
                if (mov.moneda === 'PEN') acc.notas_venta_pen += monto;
                if (mov.moneda === 'USD') acc.notas_venta_usd += monto;
            } else {
                if (mov.moneda === 'PEN') acc.sin_comprobante_pen += monto;
                if (mov.moneda === 'USD') acc.sin_comprobante_usd += monto;
            }
            acc.total_unidades += parseFloat(mov.cantidad_despachada || 0);
            return acc;
        }, {
            facturas_pen: 0, facturas_usd: 0,
            notas_venta_pen: 0, notas_venta_usd: 0,
            sin_comprobante_pen: 0, sin_comprobante_usd: 0,
            total_unidades: 0
        });
    }, [reporteData]);

    const formatearNumero = (valor) => {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
    };

    const productosAgrupados = useMemo(() => {
        if (!reporteData || !reporteData.detalle) return [];
        const grupos = {};
        reporteData.detalle.forEach(row => {
            const key = row.id_producto || 'desconocido';
            if (!grupos[key]) {
                grupos[key] = {
                    id_producto: key,
                    codigo: row.codigo_producto || 'N/A',
                    nombre: row.nombre_producto || 'Producto Desconocido',
                    total_solicitada: 0,
                    total_despachada: 0,
                    total_pendiente: 0,
                    detalles: []
                };
            }
            const solicitada = parseFloat(row.cantidad_total || row.cantidad_despachada);
            const despachada = parseFloat(row.cantidad_despachada);

            grupos[key].total_solicitada += solicitada;
            grupos[key].total_despachada += despachada;
            grupos[key].total_pendiente += Math.max(0, solicitada - despachada);
            grupos[key].detalles.push(row);
        });
        return Object.values(grupos).sort((a, b) => b.total_despachada - a.total_despachada);
    }, [reporteData]);

    const renderTablaDetalles = (detalles) => (
        <div className="pg-table-wrap">
            <table className="pg-table">
                <thead>
                    <tr>
                        <th className={filtros.tipoFecha === 'emision' ? 'is-focus' : ''}>Emisión</th>
                        <th className={filtros.tipoFecha === 'despacho' ? 'is-focus' : ''}>Despacho</th>
                        <th>N° Orden</th>
                        <th>Documento</th>
                        <th>Cliente</th>
                        <th className="num">Cant. solicitada</th>
                        <th className="num">Cant. despachada</th>
                        <th className="num">Cant. pendiente</th>
                        <th className="num">Precio unit.</th>
                        <th className="num">Subtotal desp.</th>
                        <th className="center">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {detalles.map((row, idx) => {
                        const tipoDoc = String(row.tipo_comprobante || '').trim() || 'Sin Comprobante';
                        const esFactura = tipoDoc.includes('Factura');
                        const esNV = tipoDoc.includes('Nota de Venta');
                        const cantSolicitada = parseFloat(row.cantidad_total || row.cantidad_despachada);
                        const cantDespachada = parseFloat(row.cantidad_despachada);
                        const cantPendiente = Math.max(0, cantSolicitada - cantDespachada);
                        const IconoDoc = esFactura ? FileText : esNV ? Receipt : Banknote;

                        return (
                            <tr key={idx}>
                                <td className={`nowrap ${filtros.tipoFecha === 'emision' ? 'is-focus' : ''}`}>
                                    {new Date(row.fecha_emision).toLocaleDateString('es-PE')}
                                </td>
                                <td className={`nowrap ${filtros.tipoFecha === 'despacho' ? 'is-focus' : ''}`}>
                                    {row.fecha_despacho_real ? new Date(row.fecha_despacho_real).toLocaleDateString('es-PE') : <span className="pg-muted">—</span>}
                                </td>
                                <td className="nowrap">
                                    <Link
                                        to={`/ventas/ordenes/${row.id_orden_venta}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="pg-code"
                                        title="Abrir la orden en otra pestaña"
                                    >
                                        {row.numero_orden}
                                    </Link>
                                </td>
                                <td>
                                    <span className={`badge ${esFactura ? 'badge-success' : esNV ? 'badge-info' : 'badge-secondary'}`}>
                                        <IconoDoc size={11} />{tipoDoc}
                                    </span>
                                </td>
                                <td><span className="pg-cell-main pg-truncate" title={row.cliente}>{row.cliente}</span></td>
                                <td className="num pg-muted">{formatearNumero(cantSolicitada)}</td>
                                <td className="num"><b>{formatearNumero(cantDespachada)}</b></td>
                                <td className="num" style={{ color: cantPendiente > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                    <b>{formatearNumero(cantPendiente)}</b>
                                </td>
                                <td className="num">
                                    <span className="pg-muted">{row.moneda === 'USD' ? '$' : 'S/'}</span> {formatearNumero(row.precio_unitario)}
                                </td>
                                <td className="num">
                                    <span className="pg-muted">{row.moneda === 'USD' ? '$' : 'S/'}</span> <b>{formatearNumero(row.subtotal_item)}</b>
                                </td>
                                <td className="center"><BadgeEstadoOrden estado={row.estado} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const tarjetasMonto = estadisticas ? [
        { label: 'Facturas · PEN', valor: estadisticas.facturas_pen, moneda: 'PEN', tono: 'is-accent', icon: FileText },
        { label: 'Facturas · USD', valor: estadisticas.facturas_usd, moneda: 'USD', tono: 'is-accent', icon: FileText },
        { label: 'N. venta · PEN', valor: estadisticas.notas_venta_pen, moneda: 'PEN', tono: 'is-info', icon: Receipt },
        { label: 'N. venta · USD', valor: estadisticas.notas_venta_usd, moneda: 'USD', tono: 'is-info', icon: Receipt },
        { label: 'Sin compr. · PEN', valor: estadisticas.sin_comprobante_pen, moneda: 'PEN', tono: 'is-warning', icon: Banknote },
        { label: 'Sin compr. · USD', valor: estadisticas.sin_comprobante_usd, moneda: 'USD', tono: 'is-warning', icon: Banknote }
    ] : [];

    return (
        <div className="pg-page vt-page">
            <header className="pg-header">
                <div>
                    <span className="pg-eyebrow"><Package size={13} /> Reportes de ventas</span>
                    <h1 className="pg-title">Despachos por producto y cliente</h1>
                    <p className="pg-subtitle">Análisis histórico, trazabilidad logística y variación de precios</p>
                </div>
            </header>

            <div className="pg-stack">
                <section className="pg-panel">
                    <div className="pg-filters">
                        <div className="vt-filters-grid">
                            <div className="pg-field pg-field-grow vt-combo" ref={dropdownProductoRef}>
                                <label className="pg-field-label" htmlFor="vt-desp-producto">Producto (opcional si eliges cliente)</label>
                                <Search size={14} className="vt-combo-icon" />
                                <input
                                    id="vt-desp-producto"
                                    type="text"
                                    autoComplete="off"
                                    className="form-input"
                                    placeholder="Nombre o código del producto"
                                    value={busquedaProducto}
                                    onChange={(e) => {
                                        setBusquedaProducto(e.target.value);
                                        setMostrarDropdownProducto(true);
                                        if (e.target.value === '') setFiltros({ ...filtros, idProducto: '' });
                                    }}
                                    onFocus={() => setMostrarDropdownProducto(true)}
                                />
                                {mostrarDropdownProducto && busquedaProducto && (
                                    <ul className="vt-suggest">
                                        {productosFiltrados.length > 0 ? (
                                            productosFiltrados.map((producto) => (
                                                <li key={producto.id_producto}>
                                                    <button type="button" onClick={() => handleSelectProducto(producto)}>
                                                        {producto.nombre}
                                                        <small>{producto.codigo}</small>
                                                    </button>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="vt-suggest-empty">No se encontraron productos</li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className="pg-field pg-field-grow vt-combo" ref={dropdownClienteRef}>
                                <label className="pg-field-label" htmlFor="vt-desp-cliente">Cliente (opcional si eliges producto)</label>
                                <User size={14} className="vt-combo-icon" />
                                <input
                                    id="vt-desp-cliente"
                                    type="text"
                                    autoComplete="off"
                                    className="form-input"
                                    placeholder="Todos los clientes"
                                    value={busquedaCliente}
                                    onChange={(e) => {
                                        setBusquedaCliente(e.target.value);
                                        setMostrarDropdownCliente(true);
                                        if (e.target.value === '') setFiltros({ ...filtros, idCliente: '' });
                                    }}
                                    onFocus={() => setMostrarDropdownCliente(true)}
                                />
                                {mostrarDropdownCliente && busquedaCliente && (
                                    <ul className="vt-suggest">
                                        {clientesFiltrados.length > 0 ? (
                                            clientesFiltrados.map((cliente) => (
                                                <li key={cliente.id_cliente}>
                                                    <button type="button" onClick={() => handleSelectCliente(cliente)}>
                                                        {cliente.razon_social}
                                                        <small>RUC {cliente.ruc || 'N/A'}</small>
                                                    </button>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="vt-suggest-empty">No se encontraron clientes</li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className="pg-field">
                                <span className="pg-field-label">Filtrar fechas por</span>
                                <div className="pg-segmented" role="group" aria-label="Filtrar fechas por">
                                    {[
                                        { id: 'emision', label: 'Emisión' },
                                        { id: 'despacho', label: 'Despacho' }
                                    ].map(opcion => (
                                        <button
                                            key={opcion.id}
                                            type="button"
                                            className={filtros.tipoFecha === opcion.id ? 'active' : ''}
                                            aria-pressed={filtros.tipoFecha === opcion.id}
                                            onClick={() => setFiltros({ ...filtros, tipoFecha: opcion.id })}
                                        >
                                            {opcion.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-desp-desde">Desde</label>
                                <input
                                    id="vt-desp-desde"
                                    type="date"
                                    name="fechaInicio"
                                    value={filtros.fechaInicio}
                                    onChange={handleChangeFiltro}
                                    max={filtros.fechaFin || undefined}
                                    className={`form-input ${errorFecha ? 'is-invalid' : ''}`}
                                />
                            </div>
                            <div className="pg-field">
                                <label className="pg-field-label" htmlFor="vt-desp-hasta">Hasta</label>
                                <input
                                    id="vt-desp-hasta"
                                    type="date"
                                    name="fechaFin"
                                    value={filtros.fechaFin}
                                    onChange={handleChangeFiltro}
                                    min={filtros.fechaInicio || undefined}
                                    className={`form-input ${errorFecha ? 'is-invalid' : ''}`}
                                />
                            </div>
                        </div>

                        <div className="pg-field">
                            <span className="pg-field-label">Estados a incluir</span>
                            <div className="pg-chips">
                                {['Despachada', 'Despacho Parcial', 'Entregada'].map(estado => {
                                    const cfg = configEstadoOrden(estado);
                                    const activo = filtros.estados.includes(estado);
                                    return (
                                        <button
                                            key={estado}
                                            type="button"
                                            className={`pg-chip ${activo ? 'on' : ''}`}
                                            style={{ '--chip-c': cfg.color }}
                                            aria-pressed={activo}
                                            onClick={() => handleToggleEstado(estado)}
                                        >
                                            <i />{estado}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {errorFecha && (
                            <span className="vt-error" role="alert"><AlertCircle size={14} /> {errorFecha}</span>
                        )}
                    </div>
                    <div className="vt-filters-foot">
                        <span className="pg-hint">Elige al menos un producto o un cliente.</span>
                        <button
                            type="button"
                            onClick={generarReporte}
                            className="btn btn-primary"
                            disabled={loading || !!errorFecha}
                        >
                            <TrendingUp size={16} /> {loading ? 'Procesando…' : 'Generar reporte'}
                        </button>
                    </div>
                </section>

                {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

                {!reporteData && !loading && (
                    <section className="pg-panel">
                        <div className="pg-empty">
                            <Package size={28} />
                            <strong>Elige un producto o un cliente y genera el reporte</strong>
                            <span>Verás cuánto se pidió, cuánto se despachó y cómo evolucionó el precio en el periodo.</span>
                        </div>
                    </section>
                )}

                {loading && !reporteData && <Loading variant="table" />}

                {reporteData && estadisticas && (
                    <>
                        <div className="pg-kpis">
                            <div className="pg-kpi">
                                <div className="pg-kpi-top">
                                    <span className="pg-kpi-label">Total unidades</span>
                                    <span className="pg-kpi-icon"><Box size={16} /></span>
                                </div>
                                <span className="pg-kpi-value">{formatearNumero(estadisticas.total_unidades)}</span>
                                <span className="pg-kpi-foot"><b>{productosAgrupados.length}</b> productos · <b>{reporteData.detalle.length}</b> movimientos</span>
                            </div>
                            {tarjetasMonto.map(t => (
                                <div key={t.label} className={`pg-kpi ${t.tono}`}>
                                    <div className="pg-kpi-top">
                                        <span className="pg-kpi-label">{t.label}</span>
                                        <span className="pg-kpi-icon"><t.icon size={16} /></span>
                                    </div>
                                    <span className="pg-kpi-value"><small>{t.moneda === 'USD' ? '$' : 'S/'}</small>{formatearNumero(t.valor)}</span>
                                </div>
                            ))}
                        </div>

                        {productosAgrupados.length === 0 && (
                            <section className="pg-panel">
                                <div className="pg-empty">
                                    <Package size={28} />
                                    <strong>No hay despachos con estos filtros</strong>
                                    <span>Amplía el rango de fechas o incluye más estados.</span>
                                </div>
                            </section>
                        )}

                        {productosAgrupados.map(prod => {
                            const graficosProd = particionarDatosGrafico(prod.detalles);
                            const avance = prod.total_solicitada > 0 ? Math.min(100, (prod.total_despachada / prod.total_solicitada) * 100) : 0;

                            return (
                                <section key={prod.id_producto} className="pg-panel">
                                    <div className="pg-panel-head">
                                        <h3 className="pg-panel-title">
                                            <Package size={16} /> {prod.codigo} - {prod.nombre}
                                            <span className="pg-count">{prod.detalles.length} movs</span>
                                        </h3>
                                        <div className="vt-figures">
                                            <div className="vt-figure"><span>Solicitado</span><b>{formatearNumero(prod.total_solicitada)}</b></div>
                                            <div className="vt-figure"><span>Despachado</span><b className="is-success">{formatearNumero(prod.total_despachada)}</b></div>
                                            <div className="vt-figure"><span>Pendiente</span><b className={prod.total_pendiente > 0 ? 'is-warning' : ''}>{formatearNumero(prod.total_pendiente)}</b></div>
                                            <div className="pg-measure">
                                                <div className="pg-measure-top"><span>Avance</span><b>{avance.toFixed(0)}%</b></div>
                                                <div className="pg-meter" style={{ '--meter-c': avance >= 99.99 ? 'var(--success)' : 'var(--accent)' }}>
                                                    <span style={{ width: `${avance}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {renderTablaDetalles(prod.detalles)}

                                    {graficosProd && (
                                        <div className="vt-charts">
                                            {renderGrafico(graficosProd.facturasPEN, 'Precio · Facturas (PEN)')}
                                            {renderGrafico(graficosProd.facturasUSD, 'Precio · Facturas (USD)')}
                                            {renderGrafico(graficosProd.notasVentaPEN, 'Precio · N. Venta (PEN)')}
                                            {renderGrafico(graficosProd.notasVentaUSD, 'Precio · N. Venta (USD)')}
                                            {renderGrafico(graficosProd.sinComprPEN, 'Precio · Sin Compr. (PEN)')}
                                            {renderGrafico(graficosProd.sinComprUSD, 'Precio · Sin Compr. (USD)')}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
};

export default ReporteProductoDespachos;
