import { useEffect, useState } from 'react';
import { RefreshCw, ArrowRightLeft, CheckCircle, Calendar, AlertTriangle, Database } from 'lucide-react';
import Modal from '../UI/Modal';
import { tipoCambioAPI } from '../../config/api';

export default function ModalTipoCambio({
  isOpen,
  monedaOrigen,
  monedaDestino,
  montoReferencia = 0,
  onConfirmar,
  onCancelar,
  procesando = false
}) {
  const [cargando, setCargando] = useState(false);
  const [tcOficial, setTcOficial] = useState(null);
  const [fechaOficial, setFechaOficial] = useState(null);
  const [origenTC, setOrigenTC] = useState(null);
  const [sinTasaOficial, setSinTasaOficial] = useState(false);
  const [tcInput, setTcInput] = useState('');
  const [aviso, setAviso] = useState(null);

  const simboloOrigen = monedaOrigen === 'USD' ? '$' : 'S/';
  const simboloDestino = monedaDestino === 'USD' ? '$' : 'S/';

  const buscarTipoCambio = async () => {
    try {
      setCargando(true);
      setAviso(null);
      const res = await tipoCambioAPI.actualizar();
      const d = res.data || {};
      const venta = parseFloat(d.venta);
      const hayOficial = d.valido && !d.es_default && !isNaN(venta);

      if (hayOficial) {
        setTcOficial(venta);
        setFechaOficial(d.fecha || null);
        setOrigenTC(d.desde_bd_local ? 'bd' : (d.origen || 'api'));
        setSinTasaOficial(false);
        setTcInput(venta.toFixed(4));
      } else {
        setTcOficial(null);
        setFechaOficial(d.fecha || null);
        setOrigenTC(null);
        setSinTasaOficial(true);
        setTcInput(!isNaN(venta) ? venta.toFixed(4) : '');
        setAviso(d.advertencia || 'No se encontro el tipo de cambio oficial del dia. Ingreselo manualmente.');
      }
    } catch (err) {
      console.error(err);
      setTcOficial(null);
      setSinTasaOficial(true);
      setAviso('No se pudo consultar el tipo de cambio. Ingreselo manualmente.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTcOficial(null);
      setFechaOficial(null);
      setOrigenTC(null);
      setSinTasaOficial(false);
      setTcInput('');
      setAviso(null);
      buscarTipoCambio();
    }
  }, [isOpen]);

  const tc = parseFloat(tcInput);
  const tcValido = !isNaN(tc) && tc > 0;
  const montoConvertido = tcValido
    ? (monedaDestino === 'USD' ? montoReferencia / tc : montoReferencia * tc)
    : 0;

  const fmt = (n) => parseFloat(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const manejarAccion = async (convertir) => {
    if (convertir && !tcValido) return;
    if (convertir && sinTasaOficial && fechaOficial) {
      try {
        await tipoCambioAPI.guardarManual({ fecha: fechaOficial, compra: tc, venta: tc });
      } catch (err) {
        console.error(err);
      }
    }
    onConfirmar(tcValido ? parseFloat(tc.toFixed(4)) : null, convertir);
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancelar} title="Tipo de cambio" size="md">
      <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <ArrowRightLeft size={16} className="text-blue-600 shrink-0" />
        <p className="text-xs text-blue-800">
          Cambio de <strong>{monedaOrigen}</strong> a <strong>{monedaDestino}</strong>. Elija si desea <strong>convertir los precios</strong> con el tipo de cambio, o <strong>solo cambiar la moneda</strong> manteniendo los precios tal cual.
        </p>
      </div>

      <div className="mb-4 p-3 border rounded-lg bg-gray-50">
        {cargando ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
            <RefreshCw size={16} className="animate-spin" />
            Buscando tipo de cambio del dia...
          </div>
        ) : tcOficial != null ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar size={15} className="text-gray-500" />
              <span>
                TC venta SUNAT
                {fechaOficial && (
                  <span className="text-gray-500"> ({new Date(fechaOficial + 'T12:00:00').toLocaleDateString('es-PE')})</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">{tcOficial.toFixed(4)}</span>
              {origenTC === 'bd' && (
                <span className="flex items-center gap-1 text-[11px] text-green-600" title="Ya registrado">
                  <Database size={12} /> registrado
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{aviso}</span>
          </div>
        )}
      </div>

      <div className="form-group mb-4">
        <label className="form-label">Tipo de cambio a usar</label>
        <div className="flex gap-2">
          <input
            type="number"
            className="form-input"
            value={tcInput}
            onChange={(e) => setTcInput(e.target.value)}
            step="0.0001"
            min="0"
            autoFocus
            onWheel={(e) => e.target.blur()}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={buscarTipoCambio}
            disabled={cargando}
            title="Volver a buscar el TC del dia"
          >
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
        <small className="text-muted block mt-1">Puede editarlo manualmente.</small>
      </div>

      <div className="mb-4 p-3 border rounded-lg">
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className="font-medium text-gray-700">{simboloOrigen} {fmt(montoReferencia)}</span>
          <ArrowRightLeft size={16} className="text-gray-400" />
          <span className="font-bold text-primary text-lg">{simboloDestino} {tcValido ? fmt(montoConvertido) : '—'}</span>
        </div>
        <p className="text-[11px] text-muted text-center mt-1">Resultado si convierte los precios con el TC indicado.</p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t">
        <button
          type="button"
          className="btn btn-outline text-gray-600 border-gray-300 hover:bg-gray-100"
          onClick={onCancelar}
          disabled={procesando}
        >
          Cancelar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => manejarAccion(false)}
            disabled={cargando || procesando}
            title="Mantiene los precios y solo cambia la etiqueta de moneda"
          >
            Solo cambiar moneda
          </button>
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            onClick={() => manejarAccion(true)}
            disabled={!tcValido || cargando || procesando}
          >
            <CheckCircle size={16} />
            Convertir precios
          </button>
        </div>
      </div>
    </Modal>
  );
}
