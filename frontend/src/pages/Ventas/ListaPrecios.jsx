import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, Package, Save, Edit, Trash2, Tag, Eye, EyeOff, History, Lock, User, AlertTriangle } from 'lucide-react';
import { clientesAPI, listasPreciosAPI, productosAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';
import './Ventas.css';

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

  const clientesVisibles = busqueda.trim()
    ? clientes.filter(c => c.razon_social.toLowerCase().includes(busqueda.toLowerCase()))
    : clientes.filter(c => c.id_cliente === clienteSel?.id_cliente);
  const totalIncluidos = Object.keys(nuevaLista.items).filter(k => nuevaLista.items[k] !== undefined && nuevaLista.items[k] !== '').length;

  return (
    <div className="pg-page vt-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Tag size={13} /> Ventas</span>
          <h1 className="pg-title">Listas de precios</h1>
          <p className="pg-subtitle">
            Gestión de precios especiales por cliente
            {clienteSel && <> · <b>{clienteSel.razon_social}</b> · <b>{listas.length}</b> {listas.length === 1 ? 'lista' : 'listas'}</>}
          </p>
        </div>
      </header>

      <div className="pg-stack">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="vt-lp">
          <aside className="pg-panel vt-lp-aside">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><User size={16} /> Cliente</h2>
            </div>
            <div className="pg-filters">
              <div className="pg-field pg-search">
                <label className="pg-field-label" htmlFor="vt-lp-cliente">Buscar cliente</label>
                <Search size={14} />
                <input
                  id="vt-lp-cliente"
                  type="search"
                  className="form-input"
                  placeholder="Razón social"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
            {!busqueda.trim() && !clienteSel ? (
              <div className="pg-empty">
                <Search size={24} />
                <span>Escribe para buscar un cliente</span>
              </div>
            ) : clientesVisibles.length === 0 ? (
              <div className="pg-empty">
                <Search size={24} />
                <span>Ningún cliente coincide con la búsqueda</span>
              </div>
            ) : (
              <ul className="vt-lp-clientes">
                {clientesVisibles.map(c => (
                  <li key={c.id_cliente}>
                    <button
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className={`vt-lp-cliente ${clienteSel?.id_cliente === c.id_cliente ? 'on' : ''}`}
                      aria-pressed={clienteSel?.id_cliente === c.id_cliente}
                    >
                      <strong title={c.razon_social}>{c.razon_social}</strong>
                      <small>RUC {c.ruc}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="pg-stack">
            {clienteSel ? (
              <>
                <section className="pg-panel">
                  <div className="pg-panel-head">
                    <div>
                      <h2 className="pg-panel-title"><Tag size={16} /> Listas de {clienteSel.razon_social} <span className="pg-count">{listas.length}</span></h2>
                      <span className="pg-panel-meta">Pulsa una lista para ver sus precios; usa Editar para modificar productos</span>
                    </div>
                    <button type="button" onClick={abrirModalNuevaLista} className="btn btn-primary">
                      <Plus size={16} /> Nueva lista
                    </button>
                  </div>

                  {listas.length === 0 ? (
                    <div className="pg-empty">
                      <Tag size={28} />
                      <strong>Este cliente no tiene listas de precios creadas</strong>
                      <span>Crea una lista para fijarle precios especiales y cotizar más rápido.</span>
                      <button type="button" className="btn btn-primary btn-sm" onClick={abrirModalNuevaLista}><Plus size={14} /> Nueva lista</button>
                    </div>
                  ) : (
                    <div className="vt-lp-cards">
                      {listas.map(l => (
                        <div
                          key={l.id_lista}
                          onClick={() => verDetalle(l)}
                          className={`vt-lp-card ${listaSeleccionadaID === l.id_lista ? 'on' : ''}`}
                        >
                          <div className="vt-lp-card-main">
                            <div className="vt-lp-card-title">
                              <strong title={l.nombre_lista}>{l.nombre_lista}</strong>
                              <span className="badge badge-sm badge-info">{l.moneda}</span>
                            </div>
                            <span className="vt-lp-card-meta"><Package size={12} /><span>{l.total_productos} productos incluidos</span></span>
                            <span className="vt-lp-card-meta" title={l.creador_nombre || ''}>
                              <User size={12} />
                              <span>{l.creador_nombre ? `Creada por ${l.creador_nombre}` : 'Sin dueño asignado'}</span>
                            </span>
                          </div>

                          <div className="pg-rowactions">
                            <button
                              type="button"
                              className="pg-iconbtn"
                              onClick={(e) => verHistorial(e, l)}
                              title="Ver historial de cambios de precios"
                              aria-label={`Ver historial de ${l.nombre_lista}`}
                            >
                              <History size={15} />
                            </button>
                            {puedeEditar(l) ? (
                              <>
                                <button
                                  type="button"
                                  className="pg-iconbtn"
                                  onClick={(e) => abrirModalEditarLista(e, l)}
                                  title="Editar lista"
                                  aria-label={`Editar ${l.nombre_lista}`}
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="pg-iconbtn is-danger"
                                  onClick={(e) => eliminarLista(e, l)}
                                  title="Eliminar lista"
                                  aria-label={`Eliminar ${l.nombre_lista}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            ) : (
                              <span
                                className="pg-iconbtn vt-lp-lock"
                                title={`Solo ${l.creador_nombre || 'el creador'} puede editar o eliminar esta lista`}
                              >
                                <Lock size={15} />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="pg-panel vt-lp-detail">
                  <div className="pg-panel-head">
                    <h2 className="pg-panel-title"><FileText size={16} /> Detalle de lista {detalleLista.length > 0 && <span className="pg-count">{detalleLista.length}</span>}</h2>
                    {seleccionados.length > 0 && (
                      <button type="button" onClick={generarCotizacion} className="btn btn-success">
                        <FileText size={16} /> Cotizar ({seleccionados.length})
                      </button>
                    )}
                  </div>

                  {detalleLista.length > 0 ? (
                    <div className="pg-table-wrap">
                      <table className="pg-table">
                        <thead>
                          <tr>
                            <th className="center" aria-label="Seleccionar">
                              <input
                                type="checkbox"
                                className="vt-lp-check"
                                aria-label="Seleccionar todos los productos"
                                onChange={(e) => {
                                  if(e.target.checked) setSeleccionados(detalleLista);
                                  else setSeleccionados([]);
                                }}
                                checked={seleccionados.length === detalleLista.length && detalleLista.length > 0}
                              />
                            </th>
                            <th>Producto</th>
                            <th className="num">Precio estándar</th>
                            <th className="num">Precio de lista</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalleLista.map(item => (
                            <tr key={item.id_producto} className={seleccionados.find(s => s.id_producto === item.id_producto) ? 'is-selected' : ''}>
                              <td className="center">
                                <input
                                  type="checkbox"
                                  className="vt-lp-check"
                                  aria-label={`Seleccionar ${item.producto}`}
                                  checked={!!seleccionados.find(s => s.id_producto === item.id_producto)}
                                  onChange={() => toggleSeleccion(item)}
                                />
                              </td>
                              <td>
                                <span className="pg-cell-main">{item.producto}</span>
                                <span className="pg-cell-sub">{item.codigo}</span>
                              </td>
                              <td className="num">
                                <span className="vt-lp-old">{item.moneda} {parseFloat(item.precio_estandar).toFixed(2)}</span>
                              </td>
                              <td className="num">
                                <span className="vt-lp-price">{item.moneda} {parseFloat(item.precio_especial).toFixed(2)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="pg-empty">
                      <Package size={28} />
                      <strong>Ninguna lista seleccionada</strong>
                      <span>Selecciona una lista arriba para ver sus precios, o edita una lista para agregar o quitar productos.</span>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section className="pg-panel">
                <div className="pg-empty">
                  <User size={28} />
                  <strong>Selecciona un cliente</strong>
                  <span>Podrás ver, crear y editar sus listas de precios.</span>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modoEdicion ? "Editar Lista de Precios" : "Crear Nueva Lista de Precios"} size="xl">
        <div className="vt-lp-modal">
          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="vt-lp-nombre">Nombre de la lista</label>
              <input
                id="vt-lp-nombre"
                type="text"
                className="form-input"
                placeholder="Ej: Precios 2026, Mayorista..."
                value={nuevaLista.nombre_lista}
                onChange={(e) => setNuevaLista({...nuevaLista, nombre_lista: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vt-lp-moneda">Moneda</label>
              <select
                id="vt-lp-moneda"
                className="form-select"
                value={nuevaLista.moneda}
                onChange={(e) => setNuevaLista({...nuevaLista, moneda: e.target.value})}
              >
                <option value="PEN">Soles (PEN)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
          </div>

          <div className="pg-panel vt-lp-modal-table">
            <div className="vt-lp-modal-tools">
              <div className="pg-field pg-search">
                <label className="pg-field-label" htmlFor="vt-lp-producto">Buscar producto</label>
                <Search size={14} />
                <input
                  id="vt-lp-producto"
                  type="search"
                  className="form-input"
                  placeholder="Nombre o código"
                  value={busquedaProdModal}
                  onChange={(e) => setBusquedaProdModal(e.target.value)}
                />
              </div>
              <div className="pg-rowactions">
                <div className="pg-segmented" role="group" aria-label="Productos a mostrar">
                  <button type="button" className={!mostrarSoloIncluidos ? 'active' : ''} aria-pressed={!mostrarSoloIncluidos} onClick={() => setMostrarSoloIncluidos(false)}>
                    <Eye size={14} /> Todo el catálogo
                  </button>
                  <button type="button" className={mostrarSoloIncluidos ? 'active' : ''} aria-pressed={mostrarSoloIncluidos} onClick={() => setMostrarSoloIncluidos(true)}>
                    <EyeOff size={14} /> Solo incluidos
                  </button>
                </div>
                <span className="pg-count">{totalIncluidos} productos</span>
              </div>
            </div>

            <div className="pg-table-wrap">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th className="center">Incluir</th>
                    <th>Producto</th>
                    <th className="num">Precio ref.</th>
                    <th className="num">Precio especial</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltradosModal.length === 0 ? (
                    <tr>
                      <td colSpan="4">
                        <div className="pg-empty">
                          <Package size={24} />
                          <span>No se encontraron productos</span>
                        </div>
                      </td>
                    </tr>
                  ) : productosFiltradosModal.map(p => {
                    const precioRef = parseFloat((nuevaLista.moneda === 'PEN' ? (p.precio_venta_soles || p.precio_venta) : p.precio_venta) || 0).toFixed(2);
                    const isSelected = nuevaLista.items[p.id_producto] !== undefined;

                    return (
                      <tr key={p.id_producto} className={isSelected ? 'is-selected' : ''}>
                        <td className="center">
                          <input
                            type="checkbox"
                            className="vt-lp-check"
                            aria-label={`Incluir ${p.nombre}`}
                            checked={isSelected}
                            onChange={() => handleToggleProductoEnLista(p.id_producto, precioRef)}
                          />
                        </td>
                        <td>
                          <span className={`pg-cell-main ${isSelected ? '' : 'pg-muted'}`}>{p.nombre}</span>
                          <span className="pg-cell-sub">{p.codigo}</span>
                        </td>
                        <td className="num pg-muted">
                          {nuevaLista.moneda === 'PEN' ? 'S/' : '$'} {precioRef}
                        </td>
                        <td className="num">
                          <div className={`vt-money-input ${isSelected ? 'is-on' : ''}`}>
                            <span>{nuevaLista.moneda === 'PEN' ? 'S/' : '$'}</span>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0.00"
                              aria-label={`Precio especial de ${p.nombre}`}
                              disabled={!isSelected}
                              value={isSelected ? nuevaLista.items[p.id_producto] : ''}
                              onChange={(e) => handlePrecioChange(p.id_producto, e.target.value)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="vt-lp-modal-foot">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarLista} disabled={loading}>
              {loading ? <Loading size="sm" /> : <Save size={18} />}
              {modoEdicion ? 'Actualizar Lista' : 'Guardar Lista'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={historialModalOpen} onClose={() => setHistorialModalOpen(false)} title="Historial de Cambios de Precios" size="xl">
        <div className="pg-stack">
          <div className="pg-kv">
            <div><span>Cliente</span><strong>{clienteSel?.razon_social || historialData[0]?.cliente || '—'}</strong></div>
            <div><span>Lista</span><strong>{historialLista?.nombre_lista || '—'}</strong></div>
          </div>

          <div className="pg-panel">
            <div className="pg-table-wrap vt-lp-historial">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th className="num">Precio anterior</th>
                    <th className="num">Precio nuevo</th>
                    <th className="num">Variación</th>
                    <th>Editó</th>
                  </tr>
                </thead>
                <tbody>
                  {historialData.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="pg-empty">
                          <History size={24} />
                          <span>Esta lista no tiene cambios de precio registrados</span>
                        </div>
                      </td>
                    </tr>
                  ) : historialData.map(h => {
                    const anterior = fmtPrecio(h.precio_anterior, h.moneda);
                    const nuevo = fmtPrecio(h.precio_nuevo, h.moneda);
                    const variacion = calcVariacion(h.precio_anterior, h.precio_nuevo, h.moneda);
                    return (
                      <tr key={h.id_historial}>
                        <td className="nowrap">{fmtFecha(h.fecha)}</td>
                        <td>
                          <span className="pg-cell-main">{h.producto}</span>
                          <span className="pg-cell-sub">{h.codigo}</span>
                        </td>
                        <td className="num">
                          {anterior
                            ? <span className="vt-lp-old">{anterior}</span>
                            : <span className="badge badge-sm badge-success"><Plus size={10} />Alta</span>}
                        </td>
                        <td className="num">
                          {nuevo
                            ? <span className="vt-lp-price">{nuevo}</span>
                            : <span className="badge badge-sm badge-danger"><Trash2 size={10} />Retirado</span>}
                        </td>
                        <td className="num">
                          {variacion
                            ? <span className={variacion.delta > 0 ? 'vt-delta-up' : variacion.delta < 0 ? 'vt-delta-down' : 'pg-muted'}>
                                {variacion.monto}
                                {variacion.pct && <span className="pg-cell-sub">{variacion.pct}</span>}
                              </span>
                            : <span className="pg-muted">—</span>}
                        </td>
                        <td>
                          {h.empleado
                            ? <span className="pg-muted">{h.empleado}</span>
                            : <span className="badge badge-sm badge-warning" title="Cambio hecho directamente en la base de datos, fuera del sistema"><AlertTriangle size={10} />Cambio directo en BD</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ListaPrecios;
