import { useState } from 'react';
import { CheckCircle, X, FileText, ChevronLeft, ChevronRight, ShieldCheck, SkipForward } from 'lucide-react';

function VisorArchivo({ url, nombre }) {
  const esPDF = typeof url === 'string'
    ? url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')
    : url?.type === 'application/pdf';

  const src = typeof url === 'string' ? url : URL.createObjectURL(url);

  if (esPDF) {
    return (
      <iframe
        src={src}
        title={nombre}
        className="w-full h-full rounded border-0"
        style={{ minHeight: '420px' }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={nombre}
      className="w-full h-full object-contain rounded"
      style={{ minHeight: '420px', maxHeight: '560px' }}
    />
  );
}

export default function ModalVerificacionOC({ isOpen, onVerificado, onOmitir, onCancelar, archivosOC, detalle, totales, moneda }) {
  const [indiceActivo, setIndiceActivo] = useState(0);

  if (!isOpen) return null;

  const archivos = archivosOC || [];
  const totalArchivos = archivos.length;

  const simbolo = moneda === 'USD' ? '$ ' : 'S/ ';
  const fmt = (n) => `${simbolo}${parseFloat(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ShieldCheck size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-base">Verificación de Orden de Compra</h2>
              <p className="text-xs text-gray-500">Confirme que el archivo OC coincide con el detalle de la orden</p>
            </div>
          </div>
          <button onClick={onCancelar} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden divide-x">

          {/* Panel izquierdo: visor OC */}
          <div className="flex flex-col w-1/2 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                <FileText size={13} /> Archivo(s) OC
              </span>
              {totalArchivos > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIndiceActivo(i => Math.max(0, i - 1))}
                    disabled={indiceActivo === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-gray-500 min-w-[40px] text-center">
                    {indiceActivo + 1} / {totalArchivos}
                  </span>
                  <button
                    onClick={() => setIndiceActivo(i => Math.min(totalArchivos - 1, i + 1))}
                    disabled={indiceActivo === totalArchivos - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden rounded-lg border bg-gray-50">
              {totalArchivos === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  Sin archivos adjuntos
                </div>
              ) : (
                <VisorArchivo
                  url={archivos[indiceActivo]}
                  nombre={`OC archivo ${indiceActivo + 1}`}
                />
              )}
            </div>

            {/* Tabs de archivos si hay más de uno */}
            {totalArchivos > 1 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {archivos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndiceActivo(i)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      i === indiceActivo
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    OC {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Panel derecho: detalle OV */}
          <div className="flex flex-col w-1/2 p-4 overflow-hidden">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">
              Detalle de la Orden
            </span>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Producto</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600 w-12">Cant.</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600 w-24">P. Unit.</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600 w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(detalle || []).map((item, i) => {
                    const cant = parseFloat(item.cantidad || 0);
                    const precio = parseFloat(item.precio_venta || item.precio_unitario || 0);
                    const subtotalItem = cant * precio;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-800 leading-tight">
                          {item.nombre || item.producto || `Producto ${i + 1}`}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-700">{cant}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{fmt(precio)}</td>
                        <td className="py-2 px-2 text-right font-medium text-gray-800">{fmt(subtotalItem)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="border-t mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{fmt(totales?.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Impuesto</span>
                <span className="font-medium">{fmt(totales?.impuesto)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-primary border-t pt-2 mt-1">
                <span>TOTAL</span>
                <span>{fmt(totales?.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onOmitir}
            className="flex items-center gap-2 btn btn-outline text-gray-600 border-gray-300 hover:bg-gray-100 text-sm"
          >
            <SkipForward size={16} />
            Guardar sin verificar
          </button>
          <button
            onClick={onVerificado}
            className="flex items-center gap-2 btn btn-primary text-sm px-6"
          >
            <CheckCircle size={16} />
            Verificado y conforme — Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
