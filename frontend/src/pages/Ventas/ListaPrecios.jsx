import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, Package, Save, Edit, Trash2, Tag, Eye, EyeOff, History, Lock, User } from 'lucide-react';
import { clientesAPI, listasPreciosAPI, productosAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';

function ListaPrecios() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const puedeEditar = (lista) => !lista?.creado_por || Number(lista.creado_por) === Number(user?.id);
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

  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [historialData, setHistorialData] = useState([]);
  const [historialLista, setHistorialLista] = useState(null);
  
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
    setBusqueda('');
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
    if (!puedeEditar(lista)) {
      setError(`Solo ${lista.creador_nombre || 'el usuario que la creó'} puede editar esta lista de precios.`);
      return;
    }

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

  const eliminarLista = async (e, lista) => {
      e.stopPropagation();
      if (!puedeEditar(lista)) {
        setError(`Solo ${lista.creador_nombre || 'el usuario que la creó'} puede eliminar esta lista de precios.`);
        return;
      }
      const idLista = lista.id_lista;
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

  const verHistorial = async (e, lista) => {
    e.stopPropagation();
    setHistorialLista(lista);
    setHistorialData([]);
    try {
      setLoading(true);
      const res = await listasPreciosAPI.getHistorial(lista.id_lista);
      if (res.data.success) setHistorialData(res.data.data);
      setHistorialModalOpen(true);
    } catch (err) {
      console.error(err);
      setError('Error al cargar el historial de precios');
    } finally {
      setLoading(false);
    }
  };

  const fmtFecha = (f) => {
    if (!f) return '—';
    const [y, m, d] = String(f).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  const fmtPrecio = (valor, moneda) => {
    if (valor === null || valor === undefined) return null;
    return `${moneda === 'USD' ? '$' : 'S/'} ${parseFloat(valor).toFixed(2)}`;
  };

  const calcVariacion = (anterior, nuevo, moneda) => {
    if (anterior === null || anterior === undefined) return null;
    if (nuevo === null || nuevo === undefined) return null;
    const a = parseFloat(anterior);
    const n = parseFloat(nuevo);
    const delta = n - a;
    const pct = a !== 0 ? (delta / a) * 100 : null;
    const simbolo = moneda === 'USD' ? '$' : 'S/';
    const signo = delta > 0 ? '+' : delta < 0 ? '−' : '';
    const abs = Math.abs(delta).toFixed(2);
    return {
      delta,
      monto: `${signo}${simbolo} ${abs}`,
      pct: pct === null ? null : `${signo}${Math.abs(pct).toFixed(1)}%`,
    };
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
              delete items[idProducto];
          } else {
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

        if (modoEdicion && listaSeleccionadaID === idListaEditar) {
            verDetalle({ id_lista: idListaEditar, moneda: nuevaLista.moneda });
        }
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al guardar la lista');
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
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag size={28} className="text-primary" />
            Listas de Precios
          </h1>
          <p className="text-muted">Gestión de precios especiales por cliente</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">

        <div className="card shadow-sm flex flex-col h-full">
          <div className="card-header p-4">
            <h2 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">Seleccionar Cliente</h2>
            <div className="search-input-wrapper mt-3">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar cliente por razón social..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 scrollbar-thin">
            {!busqueda.trim() && !clienteSel ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <Search size={28} className="text-muted mb-3" />
                <p className="text-sm text-muted text-center">Escriba para buscar un cliente</p>
              </div>
            ) : (busqueda.trim()
              ? clientes.filter(c => c.razon_social.toLowerCase().includes(busqueda.toLowerCase()))
              : clientes.filter(c => c.id_cliente === clienteSel?.id_cliente)
            ).map(c => (
              <div
                key={c.id_cliente}
                onClick={() => seleccionarCliente(c)}
                className={`p-3 mb-1 rounded-lg border cursor-pointer transition-colors ${clienteSel?.id_cliente === c.id_cliente ? 'bg-primary/10 border-primary' : 'border-transparent hover:border-steel hover:bg-carbon-light'}`}
              >
                <p className={`font-bold text-sm line-clamp-1 ${clienteSel?.id_cliente === c.id_cliente ? 'text-primary' : ''}`}>{c.razon_social}</p>
                <p className="text-xs text-muted font-mono mt-1">RUC: {c.ruc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6 h-full min-h-0">
          {clienteSel ? (
            <>
              <div className="card shadow-sm flex flex-col shrink-0 max-h-[40%]">
                <div className="card-header flex justify-between items-center p-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">Listas de {clienteSel.razon_social}</h2>
                    <p className="text-xs text-muted mt-1">Haga clic en Editar para modificar productos</p>
                  </div>
                  <button onClick={abrirModalNuevaLista} className="btn btn-primary flex items-center gap-2">
                    <Plus size={16} /> Nueva Lista
                  </button>
                </div>

                <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 scrollbar-thin">
                  {listas.length === 0 && <p className="text-muted text-sm col-span-2 text-center py-8">Este cliente no tiene listas de precios creadas.</p>}
                  {listas.map(l => (
                    <div
                        key={l.id_lista}
                        onClick={() => verDetalle(l)}
                        className={`p-4 border rounded-lg cursor-pointer flex justify-between items-center transition-colors
                            ${listaSeleccionadaID === l.id_lista ? 'bg-primary/10 border-primary' : 'border-steel hover:border-wire hover:bg-carbon-light'}
                        `}
                    >
                      <div className="flex-1 overflow-hidden pr-2">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-bold truncate ${listaSeleccionadaID === l.id_lista ? 'text-primary' : ''}`} title={l.nombre_lista}>{l.nombre_lista}</h3>
                            <span className="badge badge-sm badge-info shrink-0">{l.moneda}</span>
                        </div>
                        <p className="text-xs text-muted">{l.total_productos} productos incluidos</p>
                        <p className="text-xs text-muted mt-1 flex items-center gap-1 truncate" title={l.creador_nombre || ''}>
                            <User size={11} className="shrink-0" />
                            {l.creador_nombre ? `Creada por ${l.creador_nombre}` : 'Sin dueño asignado'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                            className="btn btn-sm btn-outline"
                            onClick={(e) => verHistorial(e, l)}
                            title="Ver historial de cambios de precios"
                        >
                            <History size={14} />
                        </button>
                        {puedeEditar(l) ? (
                          <>
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={(e) => abrirModalEditarLista(e, l)}
                                title="Editar lista"
                            >
                                <Edit size={14} />
                            </button>
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={(e) => eliminarLista(e, l)}
                                title="Eliminar lista"
                            >
                                <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span
                            className="btn btn-sm btn-outline opacity-60 cursor-not-allowed"
                            title={`Solo ${l.creador_nombre || 'el creador'} puede editar o eliminar esta lista`}
                          >
                            <Lock size={14} />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card shadow-sm flex-1 flex flex-col min-h-0">
                <div className="card-header flex justify-between items-center p-4 shrink-0">
                  <h2 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    <FileText size={16} className="text-primary" /> Detalle de Lista
                  </h2>
                  {seleccionados.length > 0 && (
                    <button onClick={generarCotizacion} className="btn btn-success flex items-center gap-2">
                      Cotizar ({seleccionados.length})
                    </button>
                  )}
                </div>

                <div className="card-body p-0 flex-1 overflow-auto">
                    {detalleLista.length > 0 ? (
                        <div className="table-container m-0 border-0 rounded-none h-full">
                          <table className="table w-full relative">
                              <thead className="sticky top-0 z-10">
                                  <tr>
                                      <th className="w-12 text-center">
                                          <input
                                              type="checkbox"
                                              className="w-4 h-4 rounded accent-primary cursor-pointer"
                                              onChange={(e) => {
                                                  if(e.target.checked) setSeleccionados(detalleLista);
                                                  else setSeleccionados([]);
                                              }}
                                              checked={seleccionados.length === detalleLista.length && detalleLista.length > 0}
                                          />
                                      </th>
                                      <th>Producto</th>
                                      <th className="text-right">Precio Estándar</th>
                                      <th className="text-right">Precio de Lista</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {detalleLista.map(item => (
                                      <tr key={item.id_producto} className={seleccionados.find(s => s.id_producto === item.id_producto) ? 'bg-primary/10' : ''}>
                                          <td className="text-center align-middle">
                                              <input
                                                  type="checkbox"
                                                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                                                  checked={!!seleccionados.find(s => s.id_producto === item.id_producto)}
                                                  onChange={() => toggleSeleccion(item)}
                                              />
                                          </td>
                                          <td>
                                              <p className="font-medium">{item.producto}</p>
                                              <p className="text-xs text-muted font-mono mt-0.5">{item.codigo}</p>
                                          </td>
                                          <td className="text-right text-muted line-through text-xs align-middle">
                                              {item.moneda} {parseFloat(item.precio_estandar).toFixed(2)}
                                          </td>
                                          <td className="text-right align-middle">
                                              <span className="font-bold text-primary">
                                                  {item.moneda} {parseFloat(item.precio_especial).toFixed(2)}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8">
                            <Package size={40} className="text-muted mb-3" />
                            <p className="text-sm font-medium">Ninguna lista seleccionada</p>
                            <p className="text-xs text-muted mt-1 text-center max-w-sm">
                                Seleccione una lista arriba para ver sus precios, o edite una lista para agregar o remover productos.
                            </p>
                        </div>
                    )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-steel/50">
              <Search size={32} className="text-muted mb-3" />
              <p className="text-sm font-medium">Seleccione un cliente</p>
              <p className="text-xs text-muted mt-1">Podrá visualizar, crear y editar sus listas de precios</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modoEdicion ? "Editar Lista de Precios" : "Crear Nueva Lista de Precios"} size="xl">
        <div className="flex flex-col h-[75vh]">
            <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
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
                        className="form-input cursor-pointer"
                        value={nuevaLista.moneda}
                        onChange={(e) => setNuevaLista({...nuevaLista, moneda: e.target.value})}
                    >
                        <option value="PEN">Soles (PEN)</option>
                        <option value="USD">Dólares (USD)</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 card flex flex-col min-h-0 overflow-hidden">
                <div className="card-header flex justify-between items-center p-3 shrink-0">
                    <div className="search-input-wrapper w-1/2">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            className="form-input search-input"
                            placeholder="Buscar producto por nombre o código..."
                            value={busquedaProdModal}
                            onChange={(e) => setBusquedaProdModal(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className={`btn btn-sm ${mostrarSoloIncluidos ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setMostrarSoloIncluidos(!mostrarSoloIncluidos)}
                        >
                            {mostrarSoloIncluidos ? <Eye size={14} /> : <EyeOff size={14} />}
                            {mostrarSoloIncluidos ? 'Todo el catálogo' : 'Solo incluidos'}
                        </button>
                        <span className="badge badge-primary">
                            {Object.keys(nuevaLista.items).filter(k => nuevaLista.items[k] !== undefined && nuevaLista.items[k] !== '').length} productos
                        </span>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 scrollbar-thin" style={{ overscrollBehavior: 'contain' }}>
                    <table className="table w-full">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="w-16 text-center">Incluir</th>
                                <th>Producto</th>
                                <th className="text-right w-32">Precio Ref.</th>
                                <th className="text-right w-48">Precio Especial</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productosFiltradosModal.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="text-center py-8">
                                  <p className="text-muted text-sm">No se encontraron productos</p>
                                </td>
                              </tr>
                            ) : productosFiltradosModal.map(p => {
                                const precioRef = parseFloat((nuevaLista.moneda === 'PEN' ? (p.precio_venta_soles || p.precio_venta) : p.precio_venta) || 0).toFixed(2);
                                const isSelected = nuevaLista.items[p.id_producto] !== undefined;

                                return (
                                <tr key={p.id_producto} className={isSelected ? 'bg-primary/10' : ''}>
                                    <td className="text-center align-middle">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded accent-primary cursor-pointer"
                                            checked={isSelected}
                                            onChange={() => handleToggleProductoEnLista(p.id_producto, precioRef)}
                                        />
                                    </td>
                                    <td>
                                        <div className={`font-medium text-sm ${isSelected ? '' : 'text-muted'}`}>{p.nombre}</div>
                                        <div className="text-xs text-muted font-mono mt-0.5">{p.codigo}</div>
                                    </td>
                                    <td className="text-right text-xs text-muted align-middle">
                                        {nuevaLista.moneda === 'PEN' ? 'S/' : '$'} {precioRef}
                                    </td>
                                    <td className="text-right align-middle p-2">
                                        <div className="relative flex items-center">
                                            <span className={`absolute left-3 text-sm select-none ${isSelected ? 'text-primary' : 'text-muted'}`}>
                                                {nuevaLista.moneda === 'PEN' ? 'S/' : '$'}
                                            </span>
                                            <input
                                                type="number"
                                                className={`form-input w-full text-right pl-8 h-10 ${isSelected ? 'border-primary font-bold text-primary' : 'opacity-50'}`}
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

            <div className="mt-4 flex justify-end gap-3 shrink-0">
                <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary flex items-center gap-2" onClick={guardarLista} disabled={loading}>
                    {loading ? <Loading size="sm" /> : <Save size={18} />}
                    {modoEdicion ? 'Actualizar Lista' : 'Guardar Lista'}
                </button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={historialModalOpen} onClose={() => setHistorialModalOpen(false)} title="Historial de Cambios de Precios" size="xl">
        <div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
            <div>
              <p className="text-xs text-muted">Cliente</p>
              <p className="font-medium text-sm">{clienteSel?.razon_social || historialData[0]?.cliente || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Lista</p>
              <p className="font-medium text-sm">{historialLista?.nombre_lista || '—'}</p>
            </div>
          </div>

          <div className="card max-h-[60vh] overflow-y-auto scrollbar-thin" style={{ overscrollBehavior: 'contain' }}>
            <div className="card-body p-0">
              <div className="table-container">
                <table className="table w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th className="text-right">Precio Anterior</th>
                      <th className="text-right">Precio Nuevo</th>
                      <th className="text-right">Variación</th>
                      <th>Editó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialData.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-10">
                          <p className="text-muted text-sm">Esta lista no tiene cambios de precio registrados</p>
                        </td>
                      </tr>
                    ) : historialData.map(h => {
                      const anterior = fmtPrecio(h.precio_anterior, h.moneda);
                      const nuevo = fmtPrecio(h.precio_nuevo, h.moneda);
                      const variacion = calcVariacion(h.precio_anterior, h.precio_nuevo, h.moneda);
                      return (
                        <tr key={h.id_historial}>
                          <td className="text-xs font-mono align-middle whitespace-nowrap">{fmtFecha(h.fecha)}</td>
                          <td className="align-middle">
                            <p className="font-medium text-sm">{h.producto}</p>
                            <p className="text-xs text-muted font-mono mt-0.5">{h.codigo}</p>
                          </td>
                          <td className="text-right align-middle">
                            {anterior
                              ? <span className="text-muted line-through text-xs">{anterior}</span>
                              : <span className="badge badge-sm badge-success">Alta</span>}
                          </td>
                          <td className="text-right align-middle">
                            {nuevo
                              ? <span className="font-bold text-primary text-sm">{nuevo}</span>
                              : <span className="badge badge-sm badge-danger">Retirado</span>}
                          </td>
                          <td className="text-right align-middle whitespace-nowrap">
                            {variacion
                              ? <span className={`font-mono text-xs font-bold ${variacion.delta > 0 ? 'text-success' : variacion.delta < 0 ? 'text-danger' : 'text-muted'}`}>
                                  {variacion.monto}
                                  {variacion.pct && <span className="block text-[10px] opacity-80">{variacion.pct}</span>}
                                </span>
                              : <span className="text-muted text-xs">—</span>}
                          </td>
                          <td className="text-xs align-middle">
                            {h.empleado
                              ? <span className="text-muted">{h.empleado}</span>
                              : <span className="badge badge-sm badge-warning" title="Cambio hecho directamente en la base de datos, fuera del sistema">Cambio directo en BD</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ListaPrecios;