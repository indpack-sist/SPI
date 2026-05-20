import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../config/api';
import { Search, Package, TrendingUp, DollarSign, Box } from 'lucide-react';

const ReporteProductoDespachos = () => {
    const [productos, setProductos] = useState([]);
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [mostrarDropdown, setMostrarDropdown] = useState(false);
    
    const [filtros, setFiltros] = useState({
        idProducto: '',
        fechaInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0]
    });
    
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState(null);
    const [error, setError] = useState(null);

    const dropdownRef = useRef(null);

    // Cargar lista de productos
    useEffect(() => {
        const fetchProductos = async () => {
            try {
                const response = await api.get('/productos');
                if (response.data.success) {
                    setProductos(response.data.data);
                }
            } catch (err) {
                console.error("Error cargando productos", err);
            }
        };
        fetchProductos();
    }, []);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setMostrarDropdown(false);
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
        setMostrarDropdown(false);
    };

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
    );

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

    const formatearNumero = (valor) => {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
    };

    return (
        <div className="p-4 md:p-6 page-reporte-despachos">
            {/* INYECCIÓN DE ESTILOS PARA SOBRESCRIBIR LIBRERÍAS EXTERNAS Y ADAPTAR A CARBON/GOLD */}
            <style dangerouslySetInnerHTML={{__html: `
                .page-reporte-despachos, 
                .page-reporte-despachos .card {
                    background-color: var(--carbon) !important;
                    color: var(--mist) !important;
                }

                .page-reporte-despachos .form-input,
                .page-reporte-despachos input[type="text"],
                .page-reporte-despachos input[type="date"] {
                    background-color: var(--carbon-mid) !important;
                    border: 1px solid var(--steel) !important;
                    color: var(--white) !important;
                    font-family: inherit !important;
                    height: 48px !important;
                }
                
                .page-reporte-despachos .form-input:focus, 
                .page-reporte-despachos input:focus {
                    border-color: var(--primary) !important;
                    outline: none !important;
                    background-color: var(--carbon-light) !important;
                    box-shadow: 0 0 0 2px rgba(232, 184, 75, 0.1) !important;
                }

                .page-reporte-despachos .dropdown-menu {
                    background-color: var(--carbon-light) !important;
                    border: 1px solid var(--steel) !important;
                }

                .page-reporte-despachos .dropdown-item:hover {
                    background-color: var(--steel) !important;
                }

                .page-reporte-despachos .table-container {
                    background-color: var(--carbon) !important;
                    border: 1px solid var(--border) !important;
                    border-radius: 4px !important;
                    overflow: hidden !important;
                }

                .page-reporte-despachos table {
                    background-color: var(--carbon) !important;
                }
                
                .page-reporte-despachos th {
                    background-color: var(--carbon-light) !important;
                    color: var(--wire) !important;
                    text-transform: uppercase !important;
                    font-size: 0.7rem !important;
                    letter-spacing: 0.05em !important;
                    border-bottom: 2px solid var(--steel) !important;
                    padding: 12px 16px !important;
                }

                .page-reporte-despachos td {
                    border-bottom: 1px solid var(--border) !important;
                    color: var(--mist) !important;
                    padding: 12px 16px !important;
                }

                .page-reporte-despachos tr:hover td {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                }

                .page-reporte-despachos .stat-card {
                    min-height: 90px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: center !important;
                    padding: 1rem !important;
                }
            `}} />

            <div className="flex flex-col mb-6">
                <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Package size={28} className="text-primary" />
                    </div>
                    <span className="uppercase font-barlow text-white">Despachos por Producto</span>
                </h1>
                <p className="text-[0.7rem] text-wire uppercase tracking-[0.2em] mt-2">
                    Análisis histórico y trazabilidad logística
                </p>
            </div>

            <div className="card mb-6 bg-carbon-mid border border-steel/30 shadow-xl">
                <div className="card-body p-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-end">
                        <div className="form-group flex-1 w-full" ref={dropdownRef}>
                            <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">
                                Producto a consultar
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={18} className="text-wire" />
                                </div>
                                <input
                                    type="text"
                                    className="form-input pl-10 w-full"
                                    placeholder="Buscar por código o nombre..."
                                    value={busquedaProducto}
                                    onChange={(e) => {
                                        setBusquedaProducto(e.target.value);
                                        setMostrarDropdown(true);
                                        if (e.target.value === '') {
                                            setFiltros({...filtros, idProducto: ''});
                                        }
                                    }}
                                    onFocus={() => setMostrarDropdown(true)}
                                />
                                {mostrarDropdown && busquedaProducto && (
                                    <ul className="absolute z-50 mt-1 w-full dropdown-menu shadow-xl max-h-60 rounded-md py-1 text-base overflow-auto sm:text-sm">
                                        {productosFiltrados.length > 0 ? (
                                            productosFiltrados.map((producto) => (
                                                <li
                                                    key={producto.id_producto}
                                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 dropdown-item transition-colors"
                                                    onClick={() => handleSelectProducto(producto)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-mist">{producto.nombre}</span>
                                                        <span className="text-xs text-primary font-mono mt-0.5">{producto.codigo}</span>
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="cursor-default select-none relative py-3 px-4 text-wire text-sm font-bold uppercase tracking-widest">
                                                No se encontraron productos
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-row gap-4 w-full lg:w-auto">
                            <div className="form-group flex-1 lg:w-40">
                                <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">
                                    Desde
                                </label>
                                <input 
                                    type="date" 
                                    name="fechaInicio" 
                                    value={filtros.fechaInicio} 
                                    onChange={handleChangeFiltro}
                                    className="form-input w-full text-sm font-bold"
                                />
                            </div>

                            <div className="form-group flex-1 lg:w-40">
                                <label className="form-label text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1.5 block">
                                    Hasta
                                </label>
                                <input 
                                    type="date" 
                                    name="fechaFin" 
                                    value={filtros.fechaFin} 
                                    onChange={handleChangeFiltro}
                                    className="form-input w-full text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="w-full lg:w-auto mt-4 lg:mt-0">
                            <button 
                                onClick={generarReporte} 
                                className="btn btn-primary w-full lg:w-auto font-black tracking-widest h-12 px-8 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                disabled={loading}
                            >
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

            {reporteData && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="card stat-card bg-carbon-mid border-l-4 border-info/60 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1">
                                        Unidades Despachadas
                                    </p>
                                    <p className="text-2xl font-black text-white">
                                        {formatearNumero(reporteData.resumen.total_cantidad)}
                                    </p>
                                </div>
                                <div className="bg-info/10 p-2.5 rounded text-info hidden sm:block">
                                    <Box size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="card stat-card bg-carbon-mid border-l-4 border-success/60 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1">
                                        Ingresos (PEN)
                                    </p>
                                    <p className="text-2xl font-black text-white">
                                        S/ {formatearNumero(reporteData.resumen.total_ingresos_pen)}
                                    </p>
                                </div>
                                <div className="bg-success/10 p-2.5 rounded text-success hidden sm:block">
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="card stat-card bg-carbon-mid border-l-4 border-primary/60 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em] mb-1">
                                        Ingresos (USD)
                                    </p>
                                    <p className="text-2xl font-black text-primary">
                                        $ {formatearNumero(reporteData.resumen.total_ingresos_usd)}
                                    </p>
                                </div>
                                <div className="bg-primary/10 p-2.5 rounded text-primary hidden sm:block">
                                    <DollarSign size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card shadow-2xl relative border border-steel/20">
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
                                            <th>Emisión (Orden)</th>
                                            <th>Fecha Despacho</th>
                                            <th>N° Orden</th>
                                            <th>Cliente</th>
                                            <th className="text-right">Cant. Despachada</th>
                                            <th className="text-right">Precio Unit.</th>
                                            <th className="text-right">Subtotal</th>
                                            <th className="text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reporteData.detalle.length > 0 ? (
                                            reporteData.detalle.map((row, idx) => (
                                                <tr key={idx} className="transition-colors">
                                                    <td className="font-medium">{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</td>
                                                    <td>
                                                        {row.fecha_despacho_real ? (
                                                            <span className="font-medium text-white">{new Date(row.fecha_despacho_real).toLocaleDateString('es-PE')}</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-warning uppercase tracking-widest bg-warning/10 px-2 py-1 rounded">Pendiente</span>
                                                        )}
                                                    </td>
                                                    <td className="font-mono font-bold">
                                                        <a 
                                                            href={`/ventas/ordenes/${row.id_orden_venta}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:text-primary-focus underline decoration-primary/30 hover:decoration-primary transition-colors cursor-pointer"
                                                            title="Ver detalle de la orden"
                                                        >
                                                            {row.numero_orden}
                                                        </a>
                                                    </td>
                                                    <td className="truncate max-w-[200px] font-medium" title={row.cliente}>{row.cliente}</td>
                                                    <td className="text-right font-black text-white">{formatearNumero(row.cantidad_despachada)}</td>
                                                    <td className="text-right font-mono">
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
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="text-center py-12 text-wire text-sm uppercase tracking-widest font-bold">
                                                    No se encontraron despachos para este producto en el rango de fechas.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteProductoDespachos;