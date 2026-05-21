import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../config/api';
import { Search, Package, Box, User, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

    [...detalle].reverse().forEach(item => {
        const tipoImpuesto = String(item.tipo_impuesto || '').toUpperCase().trim();
        const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuesto);
        const tipo = String(item.tipo_comprobante || '').trim();
        
        const punto = {
            fecha: new Date(item.fecha_emision).toLocaleDateString('es-PE'),
            precio: parseFloat(item.precio_unitario),
            cliente: item.cliente,
            cantidad: parseFloat(item.cantidad_despachada),
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
        fechaFin: new Date().toISOString().split('T')[0]
    });
    
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    const dropdownProductoRef = useRef(null);
    const dropdownClienteRef = useRef(null);

    // Cargar listas
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

    // Cerrar dropdowns al hacer click fuera
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
        setFiltros({
            ...filtros,
            [e.target.name]: e.target.value
        });
    };

    const handleSelectProducto = (producto) => {
        setFiltros({
            ...filtros,
            idProducto: producto.id_producto
        });
        setBusquedaProducto(`${producto.codigo} - ${producto.nombre}`);
        setMostrarDropdownProducto(false);
    };

    const handleSelectCliente = (cliente) => {
        setFiltros({
            ...filtros,
            idCliente: cliente.id_cliente
        });
        setBusquedaCliente(cliente.razon_social);
        setMostrarDropdownCliente(false);
    };

    const productosFiltrados = productos.filter(p => {
        const term = busquedaProducto.toLowerCase();
        const fullString = `${p.codigo} - ${p.nombre}`.toLowerCase();
        return (
            p.nombre.toLowerCase().includes(term) ||
            p.codigo.toLowerCase().includes(term) ||
            fullString.includes(term)
        );
    });

    const clientesFiltrados = clientes.filter(c => {
        const term = busquedaCliente.toLowerCase();
        return (
            c.razon_social.toLowerCase().includes(term) ||
            (c.ruc && c.ruc.includes(term))
        );
    });

    const generarReporte = async () => {
        if (!filtros.idProducto) {
            setError("Debe seleccionar un producto.");
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

    const estadisticas = reporteData ? reporteData.detalle.reduce((acc, mov) => {
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
    }) : null;

    const formatearNumero = (valor) => {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
    };

    const gruposGraficos = reporteData ? particionarDatosGrafico(reporteData.detalle) : null;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-carbon border border-steel p-3 rounded shadow-xl">
                    <p className="text-white font-bold text-sm mb-1">{data.fecha}</p>
                    <p className="text-primary text-xs font-bold mb-2">Orden: {data.orden}</p>
                    <p className="text-mist text-xs mb-1"><span className="text-wire font-bold">Cliente:</span> {data.cliente}</p>
                    <p className="text-mist text-xs mb-1"><span className="text-wire font-bold">Cantidad:</span> {data.cantidad}</p>
                    <p className="text-mist text-xs"><span className="text-wire font-bold">Precio Unitario:</span> {data.moneda === 'USD' ? '$' : 'S/'} {data.precio.toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    const renderGrafico = (datos, titulo, colorLinea) => {
        if (!datos || datos.length === 0) return null;
        return (
            <div className="card border border-steel/20 shadow-xl bg-carbon-mid">
                <div className="card-header border-b border-steel/30 px-6 py-4 flex items-center gap-2">
                    <TrendingUp size={20} className={titulo.includes('USD') ? "text-primary" : "text-white"} />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{titulo}</h3>
                </div>
                <div className="card-body p-6">
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datos} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis 
                                    dataKey="fecha" 
                                    stroke="#888" 
                                    tick={{ fill: '#888', fontSize: 11 }} 
                                    tickMargin={10} 
                                />
                                <YAxis 
                                    stroke="#888" 
                                    tick={{ fill: '#888', fontSize: 11 }}
                                    tickFormatter={(value) => `${value.toFixed(2)}`}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#ccc', paddingTop: '10px' }} />
                                <Line 
                                    type="monotone" 
                                    dataKey="precio" 
                                    name="Precio Unitario" 
                                    stroke={colorLinea} 
                                    strokeWidth={3} 
                                    dot={{ r: 4, strokeWidth: 2, fill: '#1a1a1a' }} 
                                    activeDot={{ r: 6, strokeWidth: 0, fill: colorLinea }} 
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 page-reporte-despachos">
            <style dangerouslySetInnerHTML={{__html: `
                .page-reporte-despachos, 
                .page-reporte-despachos .card { background-color: var(--carbon) !important; color: var(--mist) !important; }
                .page-reporte-despachos .form-input, .page-reporte-despachos input[type="text"], .page-reporte-despachos input[type="date"] {
                    background-color: var(--carbon-mid) !important; border: 1px solid var(--steel) !important; color: var(--white) !important; font-family: inherit !important; height: 48px !important;
                }
                .page-reporte-despachos .form-input:focus, .page-reporte-despachos input:focus {
                    border-color: var(--primary) !important; outline: none !important; background-color: var(--carbon-light) !important; box-shadow: 0 0 0 2px rgba(232, 184, 75, 0.1) !important;
                }
                .page-reporte-despachos .dropdown-menu { background-color: var(--carbon-light) !important; border: 1px solid var(--steel) !important; z-index: 100 !important; }
                .page-reporte-despachos .dropdown-item:hover { background-color: var(--steel) !important; }
                .page-reporte-despachos .table-container { background-color: var(--carbon) !important; border: 1px solid var(--border) !important; border-radius: 4px !important; overflow: hidden !important; }
                .page-reporte-despachos table { background-color: var(--carbon) !important; }
                .page-reporte-despachos th { background-color: var(--carbon-light) !important; color: var(--wire) !important; text-transform: uppercase !important; font-size: 0.65rem !important; letter-spacing: 0.05em !important; border-bottom: 2px solid var(--steel) !important; padding: 10px 12px !important; }
                .page-reporte-despachos td { border-bottom: 1px solid var(--border) !important; color: var(--mist) !important; padding: 10px 12px !important; font-size: 0.75rem !important; }
                .page-reporte-despachos tr:hover td { background-color: rgba(255, 255, 255, 0.02) !important; }
                .page-reporte-despachos .stat-card { min-height: 85px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.75rem 1rem !important; border-radius: 8px !important; }
            `}} />

            <div className="flex flex-col mb-6">
                <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Package size={28} className="text-primary" />
                    </div>
                    <span className="uppercase font-barlow text-white">Despachos por Producto y Cliente</span>
                </h1>
                <p className="text-[0.7rem] text-wire uppercase tracking-[0.2em] mt-2">
                    Análisis histórico, trazabilidad logística y variación de precios
                </p>
            </div>

            <div className="card mb-6 bg-carbon-mid border border-steel/30 shadow-xl">
                <div className="card-body p-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-end">
                        <div className="form-group flex-1 w-full" ref={dropdownProductoRef}>
                            <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">
                                Producto a consultar *
                            </label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire z-10" />
                                <input
                                    type="text"
                                    className="form-input pl-10 w-full"
                                    placeholder="Buscar por código o nombre..."
                                    value={busquedaProducto}
                                    onChange={(e) => {
                                        setBusquedaProducto(e.target.value);
                                        setMostrarDropdownProducto(true);
                                        if (e.target.value === '') setFiltros({...filtros, idProducto: ''});
                                    }}
                                    onFocus={() => setMostrarDropdownProducto(true)}
                                />
                                {mostrarDropdownProducto && busquedaProducto && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 dropdown-menu shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <ul className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                                            {productosFiltrados.length > 0 ? (
                                                productosFiltrados.map((producto) => (
                                                    <li key={producto.id_producto} className="cursor-pointer select-none relative py-2.5 px-4 dropdown-item rounded-md transition-colors" onClick={() => handleSelectProducto(producto)}>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-mist text-sm">{producto.nombre}</span>
                                                            <span className="text-[10px] text-primary font-black uppercase tracking-widest mt-0.5">{producto.codigo}</span>
                                                        </div>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="cursor-default select-none py-4 px-4 text-wire text-[10px] font-black uppercase tracking-[0.2em] text-center">No se encontraron productos</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group flex-1 w-full" ref={dropdownClienteRef}>
                            <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">
                                Cliente (Opcional)
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire z-10" />
                                <input
                                    type="text"
                                    className="form-input pl-10 w-full"
                                    placeholder="Todos los clientes..."
                                    value={busquedaCliente}
                                    onChange={(e) => {
                                        setBusquedaCliente(e.target.value);
                                        setMostrarDropdownCliente(true);
                                        if (e.target.value === '') setFiltros({...filtros, idCliente: ''});
                                    }}
                                    onFocus={() => setMostrarDropdownCliente(true)}
                                />
                                {mostrarDropdownCliente && busquedaCliente && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-1 dropdown-menu shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <ul className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                                            {clientesFiltrados.length > 0 ? (
                                                clientesFiltrados.map((cliente) => (
                                                    <li key={cliente.id_cliente} className="cursor-pointer select-none relative py-2.5 px-4 dropdown-item rounded-md transition-colors" onClick={() => handleSelectCliente(cliente)}>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-mist text-sm">{cliente.razon_social}</span>
                                                            <span className="text-[10px] text-wire font-black uppercase tracking-widest mt-0.5">RUC: {cliente.ruc || 'N/A'}</span>
                                                        </div>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="cursor-default select-none py-4 px-4 text-wire text-[10px] font-black uppercase tracking-[0.2em] text-center">No se encontraron clientes</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-row gap-4 w-full lg:w-auto">
                            <div className="form-group flex-1 lg:w-32">
                                <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">Desde</label>
                                <input type="date" name="fechaInicio" value={filtros.fechaInicio} onChange={handleChangeFiltro} className="form-input w-full text-sm font-bold" />
                            </div>
                            <div className="form-group flex-1 lg:w-32">
                                <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">Hasta</label>
                                <input type="date" name="fechaFin" value={filtros.fechaFin} onChange={handleChangeFiltro} className="form-input w-full text-sm font-bold" />
                            </div>
                        </div>

                        <div className="w-full lg:w-auto mt-4 lg:mt-0">
                            <button onClick={generarReporte} className="btn btn-primary w-full lg:w-auto font-black tracking-widest h-12 px-8 shadow-xl shadow-primary/20 active:scale-95 transition-all" disabled={loading}>
                                {loading ? 'PROCESANDO...' : 'GENERAR REPORTE'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-danger/10 border-l-4 border-danger p-4 mb-6 rounded">
                    <p className="text-danger font-bold text-sm">{error}</p>
                </div>
            )}

            {reporteData && estadisticas && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="card bg-carbon-mid border-l-4 border-mist shadow-lg mb-4 h-16 flex items-center px-6">
                        <div className="flex items-center gap-3 w-full">
                            <Box size={20} className="text-wire" />
                            <span className="text-[0.7rem] font-black text-wire uppercase tracking-widest">Total Unidades:</span>
                            <span className="text-xl font-black text-white ml-auto">{formatearNumero(estadisticas.total_unidades)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                        <div className="card stat-card bg-carbon-mid border-l-4 border-success/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNumero(estadisticas.facturas_pen)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-primary/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">FACTURAS (USD)</p>
                            <p className="text-lg font-black text-primary">$ {formatearNumero(estadisticas.facturas_usd)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-info/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (PEN)</p>
                            <p className="text-lg font-black text-white">S/ {formatearNumero(estadisticas.notas_venta_pen)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-info/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">N. VENTA (USD)</p>
                            <p className="text-lg font-black text-white">$ {formatearNumero(estadisticas.notas_venta_usd)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-warning/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (PEN)</p>
                            <p className="text-lg font-black text-warning">S/ {formatearNumero(estadisticas.sin_comprobante_pen)}</p>
                        </div>
                        <div className="card stat-card bg-carbon-mid border-l-4 border-warning/50 shadow-lg">
                            <p className="text-[0.5rem] font-black text-wire uppercase tracking-[0.2em] mb-0.5">SIN COMPR. (USD)</p>
                            <p className="text-lg font-black text-warning">$ {formatearNumero(estadisticas.sin_comprobante_usd)}</p>
                        </div>
                    </div>

                    <div className="card shadow-2xl relative border border-steel/20 bg-carbon">
                        <div className="card-header border-b border-steel/30 px-6 py-4">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                Registro Detallado
                                <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">
                                    {reporteData.detalle.length} movs
                                </span>
                            </h3>
                        </div>
                        
                        <div className="card-body p-0 overflow-x-auto">
                            <div className="table-container border-0 rounded-none">
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                        <tr>
                                            <th>Emisión</th>
                                            <th>N° Orden</th>
                                            <th>Documento</th>
                                            <th>Cliente</th>
                                            <th className="text-right">Cant.</th>
                                            <th className="text-right">Precio Unit.</th>
                                            <th className="text-right">Subtotal</th>
                                            <th className="text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reporteData.detalle.length > 0 ? (
                                            reporteData.detalle.map((row, idx) => {
                                                const tipoDoc = String(row.tipo_comprobante || '').trim() || 'Sin Comprobante';
                                                const esFactura = tipoDoc.includes('Factura');
                                                const esNV = tipoDoc.includes('Nota de Venta');

                                                return (
                                                    <tr key={idx} className="transition-colors">
                                                        <td className="font-medium">{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</td>
                                                        <td className="font-mono font-bold text-primary">{row.numero_orden}</td>
                                                        <td>
                                                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded ${
                                                                esFactura ? 'bg-success/10 text-success border border-success/20' :
                                                                esNV ? 'bg-info/10 text-info border border-info/20' :
                                                                'bg-steel/20 text-wire border border-steel/30'
                                                            }`}>
                                                                {tipoDoc}
                                                            </span>
                                                        </td>
                                                        <td className="truncate max-w-[250px] font-medium" title={row.cliente}>{row.cliente}</td>
                                                        <td className="text-right font-black text-white">{formatearNumero(row.cantidad_despachada)}</td>
                                                        <td className="text-right font-mono text-mist">
                                                            <span className="text-wire mr-1">{row.moneda === 'USD' ? '$' : 'S/'}</span>
                                                            {formatearNumero(row.precio_unitario)}
                                                        </td>
                                                        <td className="text-right font-black text-white">
                                                            <span className="text-wire mr-1 font-mono">{row.moneda === 'USD' ? '$' : 'S/'}</span>
                                                            {formatearNumero(row.subtotal_item)}
                                                        </td>
                                                        <td className="text-center">
                                                            <span className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-black rounded ${
                                                                row.estado === 'Entregada' 
                                                                    ? 'bg-success/10 text-success border border-success/20' 
                                                                    : 'bg-warning/10 text-warning border border-warning/20'
                                                            }`}>
                                                                {row.estado}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="text-center py-12 text-wire text-sm uppercase tracking-widest font-bold">
                                                    No se encontraron despachos.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {gruposGraficos && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            {renderGrafico(gruposGraficos.facturasPEN, 'Evolución: Facturas (PEN)', '#10B981')}
                            {renderGrafico(gruposGraficos.facturasUSD, 'Evolución: Facturas (USD)', '#e8b84b')}
                            {renderGrafico(gruposGraficos.notasVentaPEN, 'Evolución: N. Venta (PEN)', '#3B82F6')}
                            {renderGrafico(gruposGraficos.notasVentaUSD, 'Evolución: N. Venta (USD)', '#60A5FA')}
                            {renderGrafico(gruposGraficos.sinComprPEN, 'Evolución: Sin Compr. (PEN)', '#F59E0B')}
                            {renderGrafico(gruposGraficos.sinComprUSD, 'Evolución: Sin Compr. (USD)', '#FCD34D')}
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};

export default ReporteProductoDespachos;