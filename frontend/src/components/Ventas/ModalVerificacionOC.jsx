import { useState } from 'react';
import { CheckCircle, FileText, ChevronLeft, ChevronRight, ShieldCheck, SkipForward } from 'lucide-react';
import Modal from '../UI/Modal';
import { archivosAPI } from '../../config/api';

function resolverUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') return URL.createObjectURL(url);
  if (url.startsWith('http')) return archivosAPI.getProxyUrl(url);
  return url;
}

function detectarTipo(url) {
  if (typeof url !== 'string') return url?.type === 'application/pdf' ? 'pdf' : 'img';
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ext === 'pdf' ? 'pdf' : 'img';
}

export default function ModalVerificacionOC({
  isOpen, onVerificado, onOmitir, onCancelar,
  archivosOC, detalle, totales, moneda, guardando = false
}) {
  const [indice, setIndice] = useState(0);

  const archivos      = archivosOC || [];
  const totalArchivos = archivos.length;
  const simbolo       = moneda === 'USD' ? '$ ' : 'S/ ';
  const fmt           = (n) => `${simbolo}${parseFloat(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

  const archivoActual = archivos[indice];
  const src           = resolverUrl(archivoActual);
  const tipo          = detectarTipo(archivoActual);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancelar}
      title="Verificación de Orden de Compra"
      size="2xl"
    >
      {/* Cabecera de instrucción */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <ShieldCheck size={16} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">
          Compare el archivo de la OC con el detalle de la orden. Puede hacer zoom y navegar el PDF con los controles del visor.
        </p>
      </div>

      {/* Layout dos columnas */}
      <div className="flex gap-4" style={{ minHeight: '70vh' }}>

        {/* Columna izquierda: visor de archivo */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Navegación entre archivos */}
          {totalArchivos > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <FileText size={13} /> Archivo(s) OC
              </span>
              {totalArchivos > 1 && (
                <div className="flex items-center gap-1">
                  {archivos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIndice(i)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        i === indice
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                      }`}
                    >
                      OC {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setIndice(i => Math.max(0, i - 1))}
                    disabled={indice === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-gray-500">{indice + 1}/{totalArchivos}</span>
                  <button
                    onClick={() => setIndice(i => Math.min(totalArchivos - 1, i + 1))}
                    disabled={indice === totalArchivos - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Visor */}
          <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '65vh' }}>
            {totalArchivos === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Sin archivos adjuntos
              </div>
            ) : tipo === 'pdf' ? (
              <iframe
                src={src}
                title="Visor OC"
                className="w-full border-0 rounded-lg"
                style={{ height: '65vh' }}
              />
            ) : (
              <div className="flex items-center justify-center w-full" style={{ height: '65vh', overflowY: 'auto' }}>
                <img
                  src={src}
                  alt="OC"
                  className="max-w-full max-h-full object-contain rounded-lg shadow"
                />
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: detalle OV */}
        <div className="flex flex-col w-80 shrink-0">
          <p className="text-xs font-semibold text-gray-600 mb-2">Detalle de la Orden</p>

          <div className="flex-1 overflow-y-auto border rounded-lg" style={{ maxHeight: '58vh' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Producto</th>
                  <th className="text-right py-2 px-1 font-semibold text-gray-600 w-10">Cant.</th>
                  <th className="text-right py-2 px-1 font-semibold text-gray-600 w-20">Precio</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-600 w-20">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(detalle || []).map((item, i) => {
                  const cant   = parseFloat(item.cantidad || 0);
                  const precio = parseFloat(item.precio_venta || item.precio_unitario || 0);
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-800 leading-tight">
                        {item.nombre || item.producto || `Producto ${i + 1}`}
                      </td>
                      <td className="py-2 px-1 text-right text-gray-600">{cant}</td>
                      <td className="py-2 px-1 text-right text-gray-600">{fmt(precio)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmt(cant * precio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="border rounded-lg mt-2 p-3 bg-gray-50 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Subtotal</span>
              <span>{fmt(totales?.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Impuesto</span>
              <span>{fmt(totales?.impuesto)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-primary border-t pt-2">
              <span>TOTAL</span>
              <span>{fmt(totales?.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        {onOmitir != null ? (
          <button
            onClick={onOmitir}
            className="flex items-center gap-2 btn btn-outline text-gray-600 border-gray-300 hover:bg-gray-100"
          >
            <SkipForward size={15} />
            Guardar sin verificar
          </button>
        ) : (
          <button
            onClick={onCancelar}
            className="flex items-center gap-2 btn btn-outline text-gray-600 border-gray-300 hover:bg-gray-100"
          >
            Cerrar
          </button>
        )}
        <button
          onClick={onVerificado}
          disabled={guardando}
          className="flex items-center gap-2 btn btn-primary px-6"
        >
          <CheckCircle size={15} />
          {guardando ? 'Guardando...' : 'Verificado y conforme'}
        </button>
      </div>
    </Modal>
  );
}
