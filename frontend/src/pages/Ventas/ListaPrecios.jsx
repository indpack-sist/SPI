import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, ChevronRight, CheckCircle, Package } from 'lucide-react';
import { clientesAPI, listasPreciosAPI } from '../../config/api';
import Modal from '../../components/UI/Modal';
import Loading from '../../components/UI/Loading';

function GestionListasPrecios() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [clientes, setClientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [clienteSel, setClienteSel] = useState(null);
    const [listas, setListas] = useState([]);
    const [detalleLista, setDetalleLista] = useState([]);
    const [seleccionados, setSeleccionados] = useState([]);

    useEffect(() => {
        const cargarClientes = async () => {
            const res = await clientesAPI.getAll({ estado: 'Activo' });
            if (res.data.success) setClientes(res.data.data);
        };
        cargarClientes();
    }, []);

    const seleccionarCliente = async (cliente) => {
        setLoading(true);
        setClienteSel(cliente);
        const res = await listasPreciosAPI.getByCliente(cliente.id_cliente);
        if (res.data.success) setListas(res.data.data);
        setDetalleLista([]);
        setSeleccionados([]);
        setLoading(false);
    };

    const verDetalle = async (lista) => {
        setLoading(true);
        const res = await listasPreciosAPI.getDetalle(lista.id_lista);
        if (res.data.success) setDetalleLista(res.data.data.map(i => ({ ...i, moneda: lista.moneda })));
        setLoading(false);
    };

    const toggleSeleccion = (item) => {
        if (seleccionados.find(s => s.id_producto === item.id_producto)) {
            setSeleccionados(seleccionados.filter(s => s.id_producto !== item.id_producto));
        } else {
            setSeleccionados([...seleccionados, item]);
        }
    };

    const generarCotizacion = () => {
        navigate('/ventas/cotizaciones/nueva', {
            state: {
                clientePreseleccionado: clienteSel,
                productosPreseleccionados: seleccionados.map(s => ({
                    id_producto: s.id_producto,
                    codigo_producto: s.codigo,
                    producto: s.producto,
                    unidad_medida: s.unidad_medida,
                    precio_base: s.precio_especial,
                    precio_unitario: s.precio_especial,
                    cantidad: 1
                }))
            }
        });
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Package size={28} /> Listas de Precios por Cliente</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card h-fit">
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-muted" size={18} />
                            <input type="text" className="form-input pl-10" placeholder="Buscar cliente..." onChange={(e) => setBusqueda(e.target.value)} />
                        </div>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                        {clientes.filter(c => c.razon_social.toLowerCase().includes(busqueda.toLowerCase())).map(c => (
                            <div key={c.id_cliente} onClick={() => seleccionarCliente(c)} className={`p-4 border-b cursor-pointer hover:bg-blue-50 transition ${clienteSel?.id_cliente === c.id_cliente ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}>
                                <p className="font-bold text-sm">{c.razon_social}</p>
                                <p className="text-xs text-muted">{c.ruc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                    {clienteSel && (
                        <div className="card">
                            <div className="card-header flex justify-between items-center">
                                <h2 className="font-bold">Listas de {clienteSel.razon_social}</h2>
                                <button className="btn btn-sm btn-primary"><Plus size={16} /> Nueva Lista</button>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {listas.map(l => (
                                    <div key={l.id_lista} onClick={() => verDetalle(l)} className="p-4 border rounded-lg hover:shadow-md cursor-pointer flex justify-between items-center group">
                                        <div>
                                            <p className="font-bold text-primary">{l.nombre_lista}</p>
                                            <p className="text-xs text-muted">{l.moneda} • {l.total_productos} productos</p>
                                        </div>
                                        <ChevronRight className="text-muted group-hover:text-primary" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {detalleLista.length > 0 && (
                        <div className="card animate-fadeIn">
                            <div className="card-header flex justify-between items-center bg-gray-50">
                                <h2 className="font-bold">Productos en Lista</h2>
                                {seleccionados.length > 0 && (
                                    <button onClick={generarCotizacion} className="btn btn-success"><FileText size={18} /> Cotizar ({seleccionados.length})</button>
                                )}
                            </div>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th className="w-10"></th>
                                        <th>Producto</th>
                                        <th className="text-right">Precio Estándar</th>
                                        <th className="text-right">Precio Especial</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detalleLista.map(item => (
                                        <tr key={item.id_producto} className={seleccionados.find(s => s.id_producto === item.id_producto) ? 'bg-green-50' : ''}>
                                            <td>
                                                <input type="checkbox" className="w-5 h-5 cursor-pointer" checked={!!seleccionados.find(s => s.id_producto === item.id_producto)} onChange={() => toggleSeleccion(item)} />
                                            </td>
                                            <td>
                                                <p className="font-bold text-sm">{item.producto}</p>
                                                <p className="text-xs text-muted">{item.codigo}</p>
                                            </td>
                                            <td className="text-right text-muted line-through">{item.moneda} {item.precio_estandar}</td>
                                            <td className="text-right font-bold text-primary">{item.moneda} {item.precio_especial}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GestionListasPrecios;