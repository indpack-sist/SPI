import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, ChevronRight, Package, Save, X, DollarSign, Edit, Trash2 } from 'lucide-react';
import { clientesAPI, listasPreciosAPI, productosAPI } from '../../config/api';
import Modal from '../../components/UI/Modal';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';

function ListaPrecios() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [clienteSel, setClienteSel] = useState(null);
  
  const [listas, setListas] = useState([]);
  const [detalleLista, setDetalleLista] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [listaSeleccionadaID, setListaSeleccionadaID] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [busquedaProdModal, setBusquedaProdModal] = useState('');
  
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idListaEditar, setIdListaEditar] = useState(null);
  
  const [nuevaLista, setNuevaLista] = useState({
    nombre_lista: '',
    moneda: 'PEN',
    items: {} 
  });

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      const [resClientes, resProductos] = await Promise.all([
        clientesAPI.getAll({ estado: 'Activo' }),
        productosAPI.getAll({ estado: 'Activo' })
      ]);
      
      if (resClientes.data.success) setClientes(resClientes.data.data);
      if (resProductos.data.success) setProductosCatalogo(resProductos.data.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos iniciales');
    }
  };

  const seleccionarCliente = async (cliente) => {
    setLoading(true);
    setClienteSel(cliente);
    setListaSeleccionadaID(null); 
    try {
      const res = await listasPreciosAPI.getByCliente(cliente.id_cliente);
      if (res.data.success) setListas(res.data.data);
      setDetalleLista([]);
      setSeleccionados([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = async (lista) => {
    setLoading(true);
    setListaSeleccionadaID(lista.id_lista);
    try {
      const res = await listasPreciosAPI.getDetalle(lista.id_lista);
      if (res.data.success) {
        setDetalleLista(res.data.data.map(i => ({ 
            ...i, 
            moneda: lista.moneda,
            precio_unitario: i.precio_especial 
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
          cantidad: 1,
          moneda: s.moneda
        }))
      }
    });
  };

  const abrirModalNuevaLista = () => {
    if (!clienteSel) return;
    setModoEdicion(false);
    setIdListaEditar(null);
    setNuevaLista({
      nombre_lista: '',
      moneda: 'PEN',
      items: {}
    });
    setModalOpen(true);
  };

  const abrirModalEditarLista = async (e, lista) => {
    e.stopPropagation(); 
    if (!clienteSel) return;
    
    setModoEdicion(true);
    setIdListaEditar(lista.id_lista);
    
    try {
        setLoading(true);
        const res = await listasPreciosAPI.getDetalle(lista.id_lista);
        
        const itemsMap = {};
        if (res.data.success) {
            res.data.data.forEach(item => {
                itemsMap[item.id_producto] = item.precio_especial;
            });
        }

        setNuevaLista({
            nombre_lista: lista.nombre_lista,
            moneda: lista.moneda,
            items: itemsMap
        });
        
        setModalOpen(true);
    } catch (err) {
        console.error(err);
        setError('Error al cargar datos de la lista');
    } finally {
        setLoading(false);
    }
  };

  const eliminarLista = async (e, idLista) => {
      e.stopPropagation();
      if(!confirm('¿Estás seguro de eliminar esta lista de precios?')) return;

      try {
          setLoading(true);
          const res = await listasPreciosAPI.delete(idLista);
          if (res.data.success) {
              setSuccess('Lista eliminada correctamente');
              if (listaSeleccionadaID === idLista) {
                  setDetalleLista([]);
                  setListaSeleccionadaID(null);
              }
              seleccionarCliente(clienteSel);
          }
      } catch (err) {
          setError('Error al eliminar la lista');
      } finally {
          setLoading(false);
      }
  };

  const handlePrecioChange = (idProducto, valor) => {
    setNuevaLista(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [idProducto]: valor
      }
    }));
  };

  const guardarLista = async () => {
    if (!nuevaLista.nombre_lista) {
      alert('Ingrese un nombre para la lista');
      return;
    }

    const productosParaGuardar = Object.entries(nuevaLista.items)
      .filter(([_, precio]) => precio && parseFloat(precio) > 0)
      .map(([idProd, precio]) => ({
        id_producto: parseInt(idProd),
        precio_especial: parseFloat(precio)
      }));

    if (productosParaGuardar.length === 0) {
      alert('Debe asignar precio al menos a un producto');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        id_cliente: clienteSel.id_cliente,
        nombre_lista: nuevaLista.nombre_lista,
        moneda: nuevaLista.moneda,
        productos: productosParaGuardar
      };

      let res;
      if (modoEdicion) {
          res = await listasPreciosAPI.update(idListaEditar, payload);
      } else {
          res = await listasPreciosAPI.create(payload);
      }

      if (res.data.success) {
        setSuccess(modoEdicion ? 'Lista actualizada correctamente' : 'Lista creada correctamente');
        setModalOpen(false);
        seleccionarCliente(clienteSel); 
        
        // Si estábamos viendo la lista que acabamos de editar, recargar el detalle
        if (modoEdicion && listaSeleccionadaID === idListaEditar) {
            verDetalle({ id_lista: idListaEditar, moneda: nuevaLista.moneda });
        }
      }
    } catch (err) {
      setError('Error al guardar la lista');
    } finally {
      setLoading(false);
    }
  };

  const productosFiltradosModal = productosCatalogo.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProdModal.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busquedaProdModal.toLowerCase())
  );

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package size={28} /> Listas de Precios por Cliente
        </h1>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
        
        <div className="card flex flex-col h-full">
          <div className="p-4 border-b">
            <h3 className="font-bold mb-2">1. Seleccionar Cliente</h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-muted" size={18} />
              <input 
                type="text" 
                className="form-input pl-10" 
                placeholder="Buscar cliente..." 
                onChange={(e) => setBusqueda(e.target.value)} 
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {clientes.filter(c => c.razon_social.toLowerCase().includes(busqueda.toLowerCase())).map(c => (
              <div 
                key={c.id_cliente} 
                onClick={() => seleccionarCliente(c)} 
                className={`p-4 border-b cursor-pointer hover:bg-blue-50 transition ${clienteSel?.id_cliente === c.id_cliente ? 'bg-blue-50 border-l-4 border-l-primary' : ''}`}
              >
                <p className="font-bold text-sm">{c.razon_social}</p>
                <p className="text-xs text-muted">{c.ruc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6 h-full overflow-hidden">
          {clienteSel ? (
            <>
              <div className="card flex-shrink-0">
                <div className="card-header flex justify-between items-center bg-gray-50">
                  <div>
                    <h2 className="font-bold text-lg">Listas de {clienteSel.razon_social}</h2>
                    <p className="text-xs text-muted">Seleccione una lista para ver sus precios</p>
                  </div>
                  <button onClick={abrirModalNuevaLista} className="btn btn-sm btn-primary">
                    <Plus size={16} /> Nueva Lista
                  </button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-48 overflow-y-auto">
                  {listas.length === 0 && <p className="text-muted text-sm col-span-2 text-center py-4">Este cliente no tiene listas de precios creadas.</p>}
                  {listas.map(l => (
                    <div 
                        key={l.id_lista} 
                        onClick={() => verDetalle(l)} 
                        className={`p-4 border rounded-lg hover:shadow-md cursor-pointer flex justify-between items-center transition group relative
                            ${listaSeleccionadaID === l.id_lista ? 'border-primary bg-blue-50/50' : 'border-gray-200'}
                        `}
                    >
                      <div>
                        <p className="font-bold text-primary flex items-center gap-2">
                            {l.nombre_lista}
                            <span className="badge badge-sm badge-outline text-[10px]">{l.moneda}</span>
                        </p>
                        <p className="text-xs text-muted">{l.total_productos} productos asignados</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => abrirModalEditarLista(e, l)}
                            title="Editar Lista"
                        >
                            <Edit size={16} />
                        </button>
                        <button 
                            className="p-1.5 rounded-full hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => eliminarLista(e, l.id_lista)}
                            title="Eliminar Lista"
                        >
                            <Trash2 size={16} />
                        </button>
                        <ChevronRight className="text-muted self-center ml-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card flex-1 flex flex-col overflow-hidden">
                <div className="card-header flex justify-between items-center border-b">
                  <h2 className="font-bold flex items-center gap-2">
                    <FileText size={18} /> Productos en Lista
                  </h2>
                  {seleccionados.length > 0 && (
                    <button onClick={generarCotizacion} className="btn btn-success animate-fadeIn">
                      Generar Cotización ({seleccionados.length})
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    {detalleLista.length > 0 ? (
                        <table className="table w-full">
                            <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                <tr>
                                    <th className="w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            onChange={(e) => {
                                                if(e.target.checked) setSeleccionados(detalleLista);
                                                else setSeleccionados([]);
                                            }}
                                            checked={seleccionados.length === detalleLista.length && detalleLista.length > 0}
                                        />
                                    </th>
                                    <th>Producto</th>
                                    <th className="text-right">Precio Estándar</th>
                                    <th className="text-right">Precio Especial</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalleLista.map(item => (
                                    <tr key={item.id_producto} className={seleccionados.find(s => s.id_producto === item.id_producto) ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                        <td className="text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 cursor-pointer" 
                                                checked={!!seleccionados.find(s => s.id_producto === item.id_producto)} 
                                                onChange={() => toggleSeleccion(item)} 
                                            />
                                        </td>
                                        <td>
                                            <p className="font-bold text-sm text-gray-800">{item.producto}</p>
                                            <p className="text-xs text-muted font-mono">{item.codigo}</p>
                                        </td>
                                        <td className="text-right text-muted line-through text-xs">
                                            {item.moneda} {parseFloat(item.precio_estandar).toFixed(2)}
                                        </td>
                                        <td className="text-right">
                                            <span className="font-bold text-primary text-lg">
                                                {item.moneda} {parseFloat(item.precio_especial).toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted">
                            <Package size={48} className="mb-2 opacity-20" />
                            <p>Seleccione una lista arriba para ver los precios</p>
                        </div>
                    )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-lg">Seleccione un cliente para comenzar</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modoEdicion ? "Editar Lista de Precios" : "Crear Nueva Lista de Precios"} size="lg">
        <div className="flex flex-col h-[70vh]">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="form-label">Nombre de la Lista</label>
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: Precios 2026, Mayorista..." 
                        value={nuevaLista.nombre_lista}
                        onChange={(e) => setNuevaLista({...nuevaLista, nombre_lista: e.target.value})}
                    />
                </div>
                <div>
                    <label className="form-label">Moneda</label>
                    <select 
                        className="form-select"
                        value={nuevaLista.moneda}
                        onChange={(e) => setNuevaLista({...nuevaLista, moneda: e.target.value})}
                    >
                        <option value="PEN">Soles (PEN)</option>
                        <option value="USD">Dólares (USD)</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 border rounded-lg flex flex-col overflow-hidden">
                <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
                    <input 
                        type="text" 
                        className="form-input form-input-sm w-2/3" 
                        placeholder="Filtrar productos..." 
                        value={busquedaProdModal}
                        onChange={(e) => setBusquedaProdModal(e.target.value)}
                    />
                    <div className="text-xs text-muted">
                        {Object.keys(nuevaLista.items).filter(k => nuevaLista.items[k] > 0).length} productos con precio
                    </div>
                </div>
                <div className="overflow-y-auto flex-1">
                    <table className="table w-full">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr>
                                <th>Producto</th>
                                <th className="text-right w-32">Precio Ref.</th>
                                <th className="text-right w-40">Precio Especial</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productosFiltradosModal.map(p => (
                                <tr key={p.id_producto} className={nuevaLista.items[p.id_producto] ? 'bg-blue-50/30' : ''}>
                                    <td>
                                        <div className="font-medium text-sm">{p.nombre}</div>
                                        <div className="text-xs text-muted">{p.codigo}</div>
                                    </td>
                                    <td className="text-right text-xs text-muted">
                                        {nuevaLista.moneda === 'PEN' ? 'S/' : '$'} {parseFloat(nuevaLista.moneda === 'PEN' ? p.precio_venta_soles : p.precio_venta).toFixed(2)}
                                    </td>
                                    <td className="text-right">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                                {nuevaLista.moneda === 'PEN' ? 'S/' : '$'}
                                            </span>
                                            <input 
                                                type="number" 
                                                className={`form-input form-input-sm text-right pl-6 ${nuevaLista.items[p.id_producto] ? 'border-primary bg-white font-bold text-primary' : ''}`}
                                                placeholder="0.00"
                                                value={nuevaLista.items[p.id_producto] || ''}
                                                onChange={(e) => handlePrecioChange(p.id_producto, e.target.value)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
                <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarLista} disabled={loading}>
                    {loading ? 'Guardando...' : (modoEdicion ? 'Actualizar Lista' : 'Guardar Lista')}
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
}

export default ListaPrecios;