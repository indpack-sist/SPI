import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../config/api';
import { Search } from 'lucide-react';

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

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Historial de Despachos por Producto</h1>

            <div className="card mb-6">
                <div className="card-body">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="form-group flex-1 min-w-[250px]" ref={dropdownRef}>
                            <label className="form-label">Producto:</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={16} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    className="form-input pl-10 w-full"
                                    placeholder="Buscar por código o nombre..."
                                    value={busquedaProducto}
                                    onChange={(e) => {
                                        setBusquedaProducto(e.target.value);
                                        setMostrarDropdown(true);
                                        // Si el usuario borra todo, limpiamos el filtro seleccionado
                                        if (e.target.value === '') {
                                            setFiltros({...filtros, idProducto: ''});
                                        }
                                    }}
                                    onFocus={() => setMostrarDropdown(true)}
                                />
                                {mostrarDropdown && busquedaProducto && (
                                    <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto sm:text-sm border border-gray-200">
                                        {productosFiltrados.length > 0 ? (
                                            productosFiltrados.map((producto) => (
                                                <li
                                                    key={producto.id_producto}
                                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
                                                    onClick={() => handleSelectProducto(producto)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{producto.nombre}</span>
                                                        <span className="text-xs text-gray-500 font-mono">{producto.codigo}</span>
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="cursor-default select-none relative py-2 pl-3 pr-9 text-gray-500">
                                                No se encontraron productos
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>
                        
                        <div className="form-group w-40">
                            <label className="form-label">Fecha Inicio:</label>
                            <input 
                                type="date" 
                                name="fechaInicio" 
                                value={filtros.fechaInicio} 
                                onChange={handleChangeFiltro}
                                className="form-input w-full"
                            />
                        </div>

                        <div className="form-group w-40">
                            <label className="form-label">Fecha Fin:</label>
                            <input 
                                type="date" 
                                name="fechaFin" 
                                value={filtros.fechaFin} 
                                onChange={handleChangeFiltro}
                                className="form-input w-full"
                            />
                        </div>

                        <div className="form-group">
                            <button 
                                onClick={generarReporte} 
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Generando...' : 'Generar Reporte'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 text-red-700">
                    <p>{error}</p>
                </div>
            )}

            {reporteData && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="card bg-blue-50 border border-blue-100">
                            <div className="card-body">
                                <h4 className="text-blue-800 text-sm font-semibold mb-1">Unidades Despachadas</h4>
                                <p className="text-2xl font-bold text-blue-900">
                                    {reporteData.resumen.total_cantidad}
                                </p>
                            </div>
                        </div>
                        <div className="card bg-green-50 border border-green-100">
                            <div className="card-body">
                                <h4 className="text-green-800 text-sm font-semibold mb-1">Ingresos Totales (Soles)</h4>
                                <p className="text-2xl font-bold text-green-900">
                                    S/ {reporteData.resumen.total_ingresos_pen}
                                </p>
                            </div>
                        </div>
                        <div className="card bg-green-50 border border-green-100">
                            <div className="card-body">
                                <h4 className="text-green-800 text-sm font-semibold mb-1">Ingresos Totales (Dólares)</h4>
                                <p className="text-2xl font-bold text-green-900">
                                    $ {reporteData.resumen.total_ingresos_usd}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Detalle de Despachos</h3>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="table table-sm text-sm w-full">
                                <thead>
                                    <tr>
                                        <th>Fecha Emisión (Orden)</th>
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
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td>{new Date(row.fecha_emision).toLocaleDateString('es-PE')}</td>
                                                <td>{row.fecha_despacho_real ? new Date(row.fecha_despacho_real).toLocaleDateString('es-PE') : <span className="text-gray-400">Pendiente</span>}</td>
                                                <td className="font-semibold text-gray-800">{row.numero_orden}</td>
                                                <td className="truncate max-w-[200px]">{row.cliente}</td>
                                                <td className="text-right font-bold">{parseFloat(row.cantidad_despachada).toFixed(2)}</td>
                                                <td className="text-right text-gray-600">
                                                    {row.moneda === 'USD' ? '$' : 'S/'} {parseFloat(row.precio_unitario).toFixed(2)}
                                                </td>
                                                <td className="text-right font-bold text-gray-800">
                                                    {row.moneda === 'USD' ? '$' : 'S/'} {parseFloat(row.subtotal_item).toFixed(2)}
                                                </td>
                                                <td className="text-center">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.estado === 'Entregada' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {row.estado}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="text-center py-8 text-gray-500">
                                                No se encontraron despachos para este producto en el rango de fechas.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ReporteProductoDespachos;