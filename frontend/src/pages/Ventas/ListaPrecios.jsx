import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, Package, Save, DollarSign, Edit, Trash2, Tag, ChevronDown, Check, Eye, EyeOff } from 'lucide-react';
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
  const [mostrarSoloIncluidos, setMostrarSoloIncluidos] = useState(false);
  
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
        productosAPI.getAll({ estado: 'Activo', id_tipo_inventario: 3 })
      ]);
      
      if (resClientes.data.success) setClientes(resClientes.data.data);
      if (resProductos.data.success) {
        // En caso la API no soporte el filtrado directo, filtramos en el cliente por seguridad
        const terminados = resProductos.data.data.filter(p => p.id_tipo_inventario === 3);
        setProductosCatalogo(terminados.length > 0 ? terminados : resProductos.data.data.filter(p => p.id_tipo_inventario === 3));
      }
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
    setMostrarSoloIncluidos(false);
    setBusquedaProdModal('');
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
    setMostrarSoloIncluidos(true);
    setBusquedaProdModal('');
    
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
      if(!confirm('¿Estás seguro de eliminar esta lista de precios? Esto no se puede deshacer.')) return;

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
  
  const handleToggleProductoEnLista = (idProducto, precioRef) => {
      setNuevaLista(prev => {
          const items = { ...prev.items };
          if (items[idProducto] !== undefined) {
              // Si ya existe, lo quitamos de la lista
              delete items[idProducto];
          } else {
              // Si no existe, lo agregamos con su precio de referencia
              items[idProducto] = precioRef;
          }
          return { ...prev, items };
      });
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
      alert('Debe asignar precio al menos a un producto para guardar la lista.');
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

  const productosFiltradosModal = productosCatalogo.filter(p => {
    const cumpleBusqueda = p.nombre.toLowerCase().includes(busquedaProdModal.toLowerCase()) || p.codigo.toLowerCase().includes(busquedaProdModal.toLowerCase());
    
    if (mostrarSoloIncluidos) {
      return cumpleBusqueda && nuevaLista.items[p.id_producto] !== undefined;
    }
    return cumpleBusqueda;
  });

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden page-listas-precios">
      <style dangerouslySetInnerHTML={{__html: `
        .page-listas-precios, .page-listas-precios .card { background-color: var(--carbon) !important; color: var(--mist) !important; }
        .page-listas-precios .search-input, .page-listas-precios .form-input, .page-listas-precios input, .page-listas-precios select {
          background-color: var(--carbon-mid) !important; border: 1px solid var(--steel) !important; color: var(--white) !important; font-family: inherit !important;
        }
        .page-listas-precios select { cursor: pointer !important; }
        .page-listas-precios .table-container { background-color: var(--carbon) !important; border: 1px solid var(--steel) !important; border-radius: 6px !important; overflow: hidden !important; }
        .page-listas-precios table th { background-color: var(--carbon-light) !important; color: var(--wire) !important; border-bottom: 1px solid var(--steel) !important; }
        .page-listas-precios table td { border-bottom: 1px solid var(--steel) !important; color: var(--mist) !important; }
        .page-listas-precios table tr:hover td { background-color: var(--carbon-mid) !important; }
        .page-listas-precios .bg-blue-50\\/50, .page-listas-precios .bg-blue-50\\/30, .page-listas-precios .bg-green-50\\/50 { background-color: var(--primary-10) !important; border-color: var(--primary) !important; }
      `}} />

      <div className="flex flex-row justify-between items-start gap-4 mb-6 shrink-0">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-primary/10 rounded-lg"><Tag size={28} className="text-primary" /></div>
                <span className="uppercase font-barlow text-white">Listas de Precios</span>
              </h1>
              <p className="text-[0.7rem] text-wire uppercase tracking-[0.2em] mt-1">Gestión de precios especiales por cliente</p>
            </div>
          </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Selector de Clientes */}
        <div className="card shadow-2xl bg-carbon-mid border border-steel/30 flex flex-col h-full">
          <div className="card-header border-b border-steel/20 p-4">
            <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">1. Seleccionar Cliente</h2>
            <div className="relative flex items-center mt-3">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire" />
              <input 
                type="text" 
                className="form-input w-full pl-10 h-11" 
                placeholder="Buscar cliente..." 
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)} 
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 scrollbar-thin">
            {clientes.filter(c => c.razon_social.toLowerCase().includes(busqueda.toLowerCase())).map(c => (
              <div 
                key={c.id_cliente} 
                onClick={() => seleccionarCliente(c)} 
                className={`p-3 mb-1 rounded-lg border cursor-pointer transition-all ${clienteSel?.id_cliente === c.id_cliente ? 'bg-primary/10 border-primary shadow-[0_0_10px_rgba(232,184,75,0.1)]' : 'border-transparent hover:border-steel hover:bg-carbon-light'}`}
              >
                <p className={`font-bold text-sm line-clamp-1 ${clienteSel?.id_cliente === c.id_cliente ? 'text-primary' : 'text-mist'}`}>{c.razon_social}</p>
                <p className="text-xs text-wire font-mono mt-1">RUC: {c.ruc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Central y Derecho */}
        <div className="md:col-span-2 flex flex-col gap-6 h-full min-h-0">
          {clienteSel ? (
            <>
              {/* Contenedor de Listas */}
              <div className="card shadow-2xl bg-carbon-mid border border-steel/30 flex flex-col shrink-0 max-h-[40%]">
                <div className="card-header flex justify-between items-center border-b border-steel/20 p-4 bg-carbon-light">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">Listas de {clienteSel.razon_social}</h2>
                    <p className="text-[0.6rem] font-bold text-wire uppercase tracking-widest mt-1">Haga clic en Editar para modificar productos.</p>
                  </div>
                  <button onClick={abrirModalNuevaLista} className="btn btn-primary font-black text-xs tracking-widest h-10 px-4 shadow-xl active:scale-95 transition-all flex items-center gap-2">
                    <Plus size={16} /> NUEVA LISTA
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 scrollbar-thin bg-carbon">
                  {listas.length === 0 && <p className="text-wire text-sm col-span-2 text-center py-8 uppercase tracking-widest font-black">Este cliente no tiene listas de precios creadas.</p>}
                  {listas.map(l => (
                    <div 
                        key={l.id_lista} 
                        onClick={() => verDetalle(l)} 
                        className={`p-4 border rounded-xl cursor-pointer flex justify-between items-center transition-all bg-carbon-light
                            ${listaSeleccionadaID === l.id_lista ? 'border-primary shadow-[0_0_15px_rgba(232,184,75,0.2)]' : 'border-steel hover:border-wire'}
                        `}
                    >
                      <div className="flex-1 overflow-hidden pr-2">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className={`font-black truncate ${listaSeleccionadaID === l.id_lista ? 'text-primary' : 'text-mist'}`} title={l.nombre_lista}>{l.nombre_lista}</h3>
                            <span className="badge badge-sm badge-info shrink-0 text-[10px] uppercase font-black tracking-wider">{l.moneda}</span>
                        </div>
                        <p className="text-xs text-wire font-medium uppercase tracking-wider">{l.total_productos} productos incluidos</p>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                            className="btn btn-xs btn-outline border-steel p-2 hover:border-primary hover:text-primary transition-colors text-mist"
                            onClick={(e) => abrirModalEditarLista(e, l)}
                            title="Editar Lista (Añadir/Eliminar Productos)"
                        >
                            <Edit size={14} />
                        </button>
                        <button 
                            className="btn btn-xs btn-outline border-steel p-2 hover:border-danger hover:text-danger hover:bg-danger/10 transition-colors text-mist"
                            onClick={(e) => eliminarLista(e, l.id_lista)}
                            title="Eliminar Lista Completa"
                        >
                            <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contenedor de Detalle de Productos */}
              <div className="card shadow-2xl bg-carbon-mid border border-steel/30 flex-1 flex flex-col min-h-0">
                <div className="card-header flex justify-between items-center border-b border-steel/20 p-4 bg-carbon-light shrink-0">
                  <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <FileText size={16} className="text-primary" /> VISUALIZACIÓN DE LISTA
                  </h2>
                  <div className="flex items-center gap-2">
                      {seleccionados.length > 0 && (
                        <button onClick={generarCotizacion} className="btn h-10 px-4 flex items-center gap-2 text-[0.7rem] font-black tracking-widest transition-all btn-success animate-fadeIn">
                          COTIZAR ({seleccionados.length})
                        </button>
                      )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto bg-carbon">
                    {detalleLista.length > 0 ? (
                        <div className="table-container m-0 border-0 rounded-none h-full">
                          <table className="table w-full relative">
                              <thead className="sticky top-0 bg-carbon-light shadow-sm z-10">
                                  <tr>
                                      <th className="w-12 text-center border-b border-steel">
                                          <input 
                                              type="checkbox" 
                                              className="w-4 h-4 rounded border-steel bg-carbon-mid accent-primary"
                                              onChange={(e) => {
                                                  if(e.target.checked) setSeleccionados(detalleLista);
                                                  else setSeleccionados([]);
                                              }}
                                              checked={seleccionados.length === detalleLista.length && detalleLista.length > 0}
                                          />
                                      </th>
                                      <th className="font-bold text-xs text-wire uppercase tracking-widest border-b border-steel">Producto</th>
                                      <th className="text-right font-bold text-xs text-wire uppercase tracking-widest border-b border-steel">Precio Estándar</th>
                                      <th className="text-right font-bold text-xs text-wire uppercase tracking-widest border-b border-steel">Precio de Lista</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {detalleLista.map(item => (
                                      <tr key={item.id_producto} className={`${seleccionados.find(s => s.id_producto === item.id_producto) ? 'bg-primary/10' : 'hover:bg-carbon-light'}`}>
                                          <td className="text-center align-middle border-b border-steel">
                                              <input 
                                                  type="checkbox" 
                                                  className="w-4 h-4 rounded border-steel bg-carbon-mid accent-primary cursor-pointer" 
                                                  checked={!!seleccionados.find(s => s.id_producto === item.id_producto)} 
                                                  onChange={() => toggleSeleccion(item)} 
                                              />
                                          </td>
                                          <td className="border-b border-steel">
                                              <p className="font-bold text-sm text-mist">{item.producto}</p>
                                              <p className="text-xs text-wire font-mono mt-1">{item.codigo}</p>
                                          </td>
                                          <td className="text-right text-wire line-through text-xs border-b border-steel align-middle">
                                              {item.moneda} {parseFloat(item.precio_estandar).toFixed(2)}
                                          </td>
                                          <td className="text-right border-b border-steel align-middle p-3">
                                              <span className="font-black text-primary text-base bg-carbon px-3 py-1.5 rounded border border-steel shadow-inner">
                                                  {item.moneda} {parseFloat(item.precio_especial).toFixed(2)}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-wire p-8">
                            <div className="bg-carbon-light p-5 rounded-xl border border-steel mb-4 shadow-inner">
                                <Package size={48} className="text-steel" />
                            </div>
                            <p className="text-sm font-black uppercase tracking-widest text-mist">Ninguna lista seleccionada</p>
                            <p className="text-xs mt-2 text-center max-w-sm text-wire uppercase tracking-wider leading-relaxed">
                                Seleccione una lista arriba para ver sus precios, o edite una lista para agregar o remover productos.
                            </p>
                        </div>
                    )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-carbon-mid rounded-xl border-2 border-dashed border-steel/50 shadow-inner">
              <div className="bg-carbon-light p-6 rounded-full shadow-lg border border-steel mb-4">
                <Search size={32} className="text-wire" />
              </div>
              <p className="text-sm font-black text-mist uppercase tracking-widest">Seleccione un cliente</p>
              <p className="text-xs text-wire mt-2 uppercase tracking-wider font-medium">Podrá visualizar, crear y editar sus listas de precios</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modoEdicion ? "Editar Lista de Precios" : "Crear Nueva Lista de Precios"} size="xl">
        <div className="flex flex-col h-[75vh] page-listas-precios p-1">
            <div className="grid grid-cols-2 gap-4 mb-4 shrink-0 bg-carbon-mid p-4 rounded-xl border border-steel shadow-inner">
                <div>
                    <label className="form-label text-[0.65rem] font-black text-wire uppercase tracking-widest mb-1.5">Nombre de la Lista</label>
                    <input 
                        type="text" 
                        className="form-input h-11 font-bold text-mist" 
                        placeholder="Ej: Precios 2026, Mayorista..." 
                        value={nuevaLista.nombre_lista}
                        onChange={(e) => setNuevaLista({...nuevaLista, nombre_lista: e.target.value})}
                    />
                </div>
                <div>
                    <label className="form-label text-[0.65rem] font-black text-wire uppercase tracking-widest mb-1.5">Moneda</label>
                    <div className="relative">
                      <select 
                          className="w-full h-11 px-3 border border-steel rounded bg-carbon-mid text-mist font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer appearance-none"
                          value={nuevaLista.moneda}
                          onChange={(e) => setNuevaLista({...nuevaLista, moneda: e.target.value})}
                      >
                          <option value="PEN" className="bg-carbon text-mist">Soles (PEN)</option>
                          <option value="USD" className="bg-carbon text-mist">Dólares (USD)</option>
                      </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 border border-steel rounded-xl flex flex-col min-h-0 bg-carbon overflow-hidden shadow-xl">
                <div className="p-3 border-b border-steel bg-carbon-light flex justify-between items-center shrink-0">
                    <div className="relative w-1/2 flex items-center">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-wire" />
                        <input 
                            type="text" 
                            className="form-input h-10 w-full pl-10 text-sm" 
                            placeholder="Buscar producto por nombre o código..." 
                            value={busquedaProdModal}
                            onChange={(e) => setBusquedaProdModal(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            className={`flex items-center gap-2 h-10 px-4 rounded-lg border text-[0.65rem] font-black tracking-widest transition-all ${mostrarSoloIncluidos ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(232,184,75,0.1)]' : 'bg-carbon-mid border-steel text-wire hover:text-mist hover:border-wire'}`}
                            onClick={() => setMostrarSoloIncluidos(!mostrarSoloIncluidos)}
                        >
                            {mostrarSoloIncluidos ? <Eye size={16} /> : <EyeOff size={16} />}
                            {mostrarSoloIncluidos ? 'MOSTRAR TODO EL CATÁLOGO' : 'VER SOLO INCLUIDOS'}
                        </button>
                        <div className="flex flex-col items-end gap-1 border-l border-steel pl-4">
                            <div className="badge badge-primary font-black uppercase tracking-widest text-[10px] px-2 py-1 shadow-[0_0_10px_rgba(232,184,75,0.2)]">
                                {Object.keys(nuevaLista.items).filter(k => nuevaLista.items[k] !== undefined && nuevaLista.items[k] !== '').length} productos
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 scrollbar-thin">
                    <table className="table w-full">
                        <thead className="sticky top-0 bg-carbon-mid shadow-md z-10 border-b border-steel">
                            <tr>
                                <th className="w-16 text-center font-black text-[10px] text-wire uppercase tracking-widest py-3">Incluir</th>
                                <th className="font-black text-[10px] text-wire uppercase tracking-widest py-3">Producto</th>
                                <th className="text-right w-32 font-black text-[10px] text-wire uppercase tracking-widest py-3">Precio Ref.</th>
                                <th className="text-right w-48 font-black text-[10px] text-wire uppercase tracking-widest py-3">Precio Especial</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productosFiltradosModal.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="text-center py-8">
                                  <p className="text-wire font-bold uppercase tracking-widest text-xs">No se encontraron productos</p>
                                </td>
                              </tr>
                            ) : productosFiltradosModal.map(p => {
                                const precioRef = parseFloat((nuevaLista.moneda === 'PEN' ? (p.precio_venta_soles || p.precio_venta) : p.precio_venta) || 0).toFixed(2);
                                const isSelected = nuevaLista.items[p.id_producto] !== undefined;

                                return (
                                <tr key={p.id_producto} className={`border-b border-steel/50 ${isSelected ? 'bg-primary/10' : 'hover:bg-carbon-light'}`}>
                                    <td className="text-center align-middle">
                                        <div className="flex justify-center">
                                          <input 
                                              type="checkbox"
                                              className="w-5 h-5 rounded border-steel bg-carbon-mid accent-primary cursor-pointer shadow-sm hover:ring-2 hover:ring-primary/50 transition-all"
                                              checked={isSelected}
                                              onChange={() => handleToggleProductoEnLista(p.id_producto, precioRef)}
                                          />
                                        </div>
                                    </td>
                                    <td>
                                        <div className={`font-bold text-sm ${isSelected ? 'text-mist' : 'text-wire'}`}>{p.nombre}</div>
                                        <div className="text-xs text-wire font-mono mt-1">{p.codigo}</div>
                                    </td>
                                    <td className="text-right text-xs text-wire align-middle font-medium">
                                        {nuevaLista.moneda === 'PEN' ? 'S/' : '$'} {precioRef}
                                    </td>
                                    <td className="text-right align-middle p-2">
                                        <div className="relative flex items-center">
                                            <span className={`absolute left-3 font-bold select-none ${isSelected ? 'text-primary' : 'text-steel'}`}>
                                                {nuevaLista.moneda === 'PEN' ? 'S/' : '$'}
                                            </span>
                                            <input 
                                                type="number" 
                                                className={`form-input w-full text-right pl-8 h-10 ${isSelected ? 'border-primary shadow-[0_0_10px_rgba(232,184,75,0.1)] font-black text-primary bg-carbon text-lg' : 'bg-carbon-mid border-steel text-wire opacity-50'}`}
                                                placeholder="0.00"
                                                disabled={!isSelected}
                                                value={isSelected ? nuevaLista.items[p.id_producto] : ''}
                                                onChange={(e) => handlePrecioChange(p.id_producto, e.target.value)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-5 flex justify-end gap-3 shrink-0">
                <button className="btn btn-outline border-steel text-mist h-11 px-6 font-black text-xs tracking-widest hover:border-wire hover:bg-carbon-light" onClick={() => setModalOpen(false)}>CANCELAR</button>
                <button className="btn btn-primary min-w-[200px] h-11 flex justify-center items-center gap-2 font-black text-xs tracking-widest shadow-[0_0_20px_rgba(232,184,75,0.2)] active:scale-95 transition-all" onClick={guardarLista} disabled={loading}>
                    {loading ? <Loading size="sm" /> : <Save size={18} />}
                    {modoEdicion ? 'ACTUALIZAR LISTA' : 'GUARDAR LISTA'}
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
}

export default ListaPrecios;