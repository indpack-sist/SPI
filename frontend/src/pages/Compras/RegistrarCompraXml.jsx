import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, PackagePlus, Link2 } from 'lucide-react';
import Alert from '../../components/UI/Alert';
import { comprasAPI, proveedoresAPI, productosAPI } from '../../config/api';

// Registrar Compra desde el XML de la factura del proveedor.
// Flujo: subo el .xml → el backend lo parsea (POST /compras/parse-xml) → concilio (mapear/crear
// productos, elegir su inventario, ajustar cantidades/precios) → "Registrar Compra" (POST /compras).
// La compra se crea SIN mover stock (tipo_recepcion 'Ninguna'); el inventario entra luego con la guía.
export default function RegistrarCompraXml() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [tiposInv, setTiposInv] = useState([]);
  const [proveedor, setProveedor] = useState(null);   // { ruc, razon_social, id_proveedor|null }
  const [cabecera, setCabecera] = useState(null);      // { tipo, serie, numero, fecha, moneda, porcentaje_igv }
  const [lineas, setLineas] = useState([]);            // filas conciliables
  const [tipoCompra, setTipoCompra] = useState('Contado');
  const [tipoCambio, setTipoCambio] = useState('1.00');

  useEffect(() => {
    productosAPI.getTiposInventario()
      .then((r) => setTiposInv(r.data?.data || r.data || []))
      .catch(() => setTiposInv([]));
  }, []);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null); setSuccess(null);
    const reader = new FileReader();
    reader.onload = () => procesarXml(String(reader.result || ''));
    reader.onerror = () => setError('No se pudo leer el archivo.');
    reader.readAsText(f);
  };

  const procesarXml = async (xml) => {
    setParsing(true); setError(null);
    try {
      const { data } = await comprasAPI.parseXml(xml);
      const d = data.data;
      setProveedor(d.proveedor);
      setCabecera(d.comprobante);
      setLineas((d.lineas || []).map((l) => ({
        ...l,
        // Nuevo (sin match): requiere elegir inventario. Vinculado: usa el id_producto del match.
        id_tipo_inventario: '',
      })));
      if (d.comprobante?.moneda === 'USD') setTipoCambio('3.75');
      setSuccess('XML leído. Revisa la conciliación antes de registrar.');
    } catch (err) {
      setError(err?.error || err?.response?.data?.error || 'No se pudo leer el XML de la factura.');
      setProveedor(null); setCabecera(null); setLineas([]);
    } finally {
      setParsing(false);
    }
  };

  const setLinea = (i, campo, val) => {
    setLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, [campo]: val } : l));
  };

  const nuevosSinInventario = lineas.some((l) => !l.id_producto && !l.id_tipo_inventario);

  const registrar = async () => {
    setError(null); setSuccess(null);
    if (!cabecera?.serie || !cabecera?.numero) return setError('El XML no trae serie/número de la factura.');
    if (!lineas.length) return setError('La factura no tiene ítems.');
    if (nuevosSinInventario) return setError('Elige el inventario destino de cada producto nuevo (los que se crearán).');

    setSubmitting(true);
    try {
      // Proveedor: si no existe en el catálogo, se crea con los datos del XML.
      let idProveedor = proveedor?.id_proveedor;
      if (!idProveedor) {
        if (!proveedor?.ruc) throw new Error('El XML no trae el RUC del proveedor.');
        const rp = await proveedoresAPI.create({ ruc: proveedor.ruc, razon_social: proveedor.razon_social || proveedor.ruc });
        idProveedor = rp.data?.data?.id_proveedor ?? rp.data?.id_proveedor ?? rp.data?.data?.id;
        if (!idProveedor) throw new Error('No se pudo crear el proveedor.');
      }

      const detalle = lineas.map((l) => {
        const base = {
          cantidad: parseFloat(l.cantidad) || 0,
          precio_unitario: parseFloat(l.precio_unitario) || 0,
          descuento_porcentaje: 0,
        };
        if (l.id_producto) return { ...base, id_producto: l.id_producto };
        return {
          ...base,
          id_producto: null,
          crear_producto: {
            codigo: l.codigo_xml || '',
            nombre: l.descripcion || l.codigo_xml || 'PRODUCTO',
            unidad_medida: l.producto_match?.unidad_medida || 'UND',
            codigo_unidad_sunat: l.unidad_sunat || null,
            id_tipo_inventario: parseInt(l.id_tipo_inventario),
          },
        };
      });

      const hoy = new Date().toISOString().split('T')[0];
      const payload = {
        id_proveedor: idProveedor,
        moneda: cabecera.moneda || 'PEN',
        tipo_compra: tipoCompra,
        forma_pago_detalle: tipoCompra,
        accion_pago: 'diferido',            // no registra pago ahora
        tipo_recepcion: 'Ninguna',          // NO mueve stock: el inventario entra con la guía
        tipo_documento: 'Factura',
        serie_documento: cabecera.serie,
        numero_documento: cabecera.numero,
        fecha_emision_documento: cabecera.fecha || hoy,
        fecha_emision: cabecera.fecha || hoy,
        tipo_impuesto: 'IGV',
        porcentaje_impuesto: cabecera.porcentaje_igv ?? 18,
        tipo_cambio: parseFloat(tipoCambio || 1) || 1,
        prioridad: 'Media',
        numero_cuotas: 0,
        dias_entre_cuotas: 30,
        dias_credito: 0,
        detalle,
      };

      const { data } = await comprasAPI.create(payload);
      if (data.success) {
        const id = data.data?.id;
        setSuccess(`Compra ${data.data?.numero || ''} registrada. Ya puedes emitir sus guías de remisión.`);
        setTimeout(() => navigate(id ? `/compras/${id}` : '/compras'), 1200);
      } else {
        setError(data.error || 'No se pudo registrar la compra.');
      }
    } catch (err) {
      setError(err?.error || err?.response?.data?.error || err?.message || 'No se pudo registrar la compra.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <button className="btn btn-sm btn-ghost mb-3" onClick={() => navigate('/compras')}>
        <ArrowLeft size={18} /> Volver a Compras
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText size={28} className="text-primary" />
          Registrar Compra desde XML
        </h1>
        <p className="text-muted">Sube el XML de la factura del proveedor; se leen sus productos y se concilian con tu catálogo.</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Paso 1: cargar XML */}
      <div className="card mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={onFile} />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={parsing}>
            <Upload size={18} /> {parsing ? 'Leyendo…' : 'Seleccionar XML de la factura'}
          </button>
          {cabecera && (
            <span className="text-sm text-muted">
              Factura <b>{cabecera.serie}-{cabecera.numero}</b> · {cabecera.fecha} · {cabecera.moneda} · IGV {cabecera.porcentaje_igv}%
            </span>
          )}
        </div>
      </div>

      {proveedor && (
        <>
          {/* Proveedor + condiciones */}
          <div className="card mb-4">
            <h2 className="font-semibold mb-3">Proveedor y condiciones</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="form-label">Proveedor (emisor)</label>
                <div className="form-input bg-gray-50 flex items-center gap-2">
                  <span className="font-medium">{proveedor.razon_social || '—'}</span>
                  <span className="text-muted text-sm">RUC {proveedor.ruc}</span>
                </div>
                {proveedor.id_proveedor
                  ? <span className="text-xs text-success flex items-center gap-1 mt-1"><CheckCircle size={12} /> Ya existe en tu catálogo</span>
                  : <span className="text-xs text-warning flex items-center gap-1 mt-1"><AlertCircle size={12} /> No existe: se creará al registrar</span>}
              </div>
              <div>
                <label className="form-label">Forma de pago</label>
                <select className="form-select" value={tipoCompra} onChange={(e) => setTipoCompra(e.target.value)}>
                  <option value="Contado">Contado</option>
                  <option value="Crédito">Crédito</option>
                  <option value="Letras">Letras</option>
                </select>
              </div>
              <div>
                <label className="form-label">Tipo de cambio</label>
                <input type="number" step="0.001" min="0" className="form-input"
                  value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)}
                  disabled={cabecera?.moneda !== 'USD'} />
              </div>
            </div>
          </div>

          {/* Paso 2: conciliación de líneas */}
          <div className="card mb-4">
            <h2 className="font-semibold mb-1">Conciliación de productos</h2>
            <p className="text-muted text-sm mb-3">Los productos que ya existen se vinculan; los nuevos se crearán (elige su inventario). Puedes ajustar cantidades y precios.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">#</th>
                    <th className="p-2">Código XML</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Cantidad</th>
                    <th className="p-2">Unid.</th>
                    <th className="p-2 text-right">Precio</th>
                    <th className="p-2">Producto</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i} className="border-b align-top">
                      <td className="p-2 text-muted">{i + 1}</td>
                      <td className="p-2 font-mono text-xs">{l.codigo_xml || '—'}</td>
                      <td className="p-2 min-w-[220px]">
                        <input className="form-input form-input-sm w-full" value={l.descripcion}
                          onChange={(e) => setLinea(i, 'descripcion', e.target.value)} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" step="0.0001" min="0" className="form-input form-input-sm w-24 text-right"
                          value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} />
                      </td>
                      <td className="p-2">{l.unidad_sunat}</td>
                      <td className="p-2 text-right">
                        <input type="number" step="0.0001" min="0" className="form-input form-input-sm w-24 text-right"
                          value={l.precio_unitario} onChange={(e) => setLinea(i, 'precio_unitario', e.target.value)} />
                      </td>
                      <td className="p-2 min-w-[220px]">
                        {l.id_producto ? (
                          <span className="text-success flex items-center gap-1">
                            <Link2 size={14} /> {l.producto_match?.codigo} · {l.producto_match?.nombre}
                          </span>
                        ) : (
                          <div>
                            <span className="text-warning flex items-center gap-1 mb-1">
                              <PackagePlus size={14} /> Nuevo — inventario destino:
                            </span>
                            <select className={`form-select form-select-sm w-full ${!l.id_tipo_inventario ? 'border-warning' : ''}`}
                              value={l.id_tipo_inventario}
                              onChange={(e) => setLinea(i, 'id_tipo_inventario', e.target.value)}>
                              <option value="">— Elegir inventario —</option>
                              {tiposInv.map((t) => (
                                <option key={t.id_tipo_inventario} value={t.id_tipo_inventario}>{t.nombre}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => navigate('/compras')} disabled={submitting}>Cancelar</button>
            <button className="btn btn-primary" onClick={registrar} disabled={submitting || nuevosSinInventario}>
              <CheckCircle size={18} /> {submitting ? 'Registrando…' : 'Registrar Compra'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
