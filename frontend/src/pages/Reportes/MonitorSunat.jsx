// pages/Reportes/MonitorSunat.jsx — Fase 15 (frontend).
// Panel de soporte diario del módulo SEE: conteo por estado (comprobantes, guías, bajas),
// tickets abiertos (ENVIADO sin CDR), últimos rechazos y errores del sunat_log.
// Consume GET /api/sunat/monitor (solo lectura, gated por permiso 'facturacion').
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, RefreshCw, AlertTriangle, FileText, Truck, Ban,
  Ticket, ServerCrash, ExternalLink, ShieldCheck
} from 'lucide-react';
import { sunatAPI } from '../../config/api';
import BadgeEstadoSunat from '../../components/Ventas/sunat/BadgeEstadoSunat';

const ORDEN_ESTADOS = ['PENDIENTE', 'ENVIADO', 'ACEPTADO', 'OBSERVADO', 'RECHAZADO', 'BAJA', 'ANULADA', 'REEMPLAZADA', 'ERROR'];

// Ordena las filas {estado, n} según ORDEN_ESTADOS y calcula el total.
const normalizar = (rows = []) => {
  const arr = [...rows].sort(
    (a, b) => ORDEN_ESTADOS.indexOf(String(a.estado).toUpperCase()) - ORDEN_ESTADOS.indexOf(String(b.estado).toUpperCase())
  );
  const total = arr.reduce((s, r) => s + Number(r.n || 0), 0);
  return { arr, total };
};

function BloqueEstados({ titulo, Icono, rows }) {
  const { arr, total } = normalizar(rows);
  return (
    <div className="card">
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <Icono size={16} /> {titulo}
          </h3>
          <span className="text-xs text-muted">Total: <strong>{total}</strong></span>
        </div>
        {arr.length === 0 ? (
          <p className="text-xs text-muted italic">Sin registros.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {arr.map((r) => (
              <div key={r.estado} className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1">
                <BadgeEstadoSunat estado={r.estado} size="text-[11px]" />
                <span className="font-mono font-bold text-sm">{r.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiTicket({ label, valor, Icono }) {
  const activo = Number(valor) > 0;
  return (
    <div className={`card ${activo ? 'border-l-4 border-amber-400' : ''}`}>
      <div className="card-body p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${activo ? 'bg-amber-400/20 text-amber-500' : 'bg-gray-100 text-gray-400'}`}>
          <Icono size={20} />
        </div>
        <div>
          <p className="text-2xl font-black leading-none">{valor}</p>
          <p className="text-[11px] text-muted uppercase tracking-wide">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function MonitorSunat() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaCarga, setUltimaCarga] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sunatAPI.monitor();
      setData(res.data);
      setUltimaCarga(new Date());
    } catch (e) {
      setError(e?.error || e?.message || 'No se pudo cargar el monitor SUNAT.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const fmtFecha = (f) => (f ? new Date(f).toLocaleString('es-PE') : '—');
  const totalAbiertos = data
    ? Number(data.ticketsAbiertos?.comprobantes || 0) + Number(data.ticketsAbiertos?.guias || 0) + Number(data.ticketsAbiertos?.bajas || 0)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-3">
            <Activity size={26} /> Monitor SUNAT
          </h1>
          <p className="text-xs text-muted mt-1 flex items-center gap-2">
            Estado de la emisión electrónica (SEE).
            {data?.mode && (
              <span className={`badge ${data.mode === 'PROD' ? 'badge-success' : 'badge-warning'} text-[10px]`}>
                {data.mode === 'PROD' ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />} {data.mode}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ultimaCarga && <span className="text-[11px] text-muted">Actualizado: {fmtFecha(ultimaCarga)}</span>}
          <button className="btn btn-primary btn-sm" onClick={cargar} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin mr-1' : 'mr-1'} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error flex items-center gap-2">
          <ServerCrash size={16} /> {error}
        </div>
      )}

      {loading && !data ? (
        <div className="text-center text-muted py-16">
          <RefreshCw size={28} className="animate-spin mx-auto mb-2" />
          Cargando monitor…
        </div>
      ) : data ? (
        <>
          {/* Conteo por estado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BloqueEstados titulo="Comprobantes" Icono={FileText} rows={data.comprobantes} />
            <BloqueEstados titulo="Guías de remisión" Icono={Truck} rows={data.guias} />
            <BloqueEstados titulo="Comunicaciones de baja" Icono={Ban} rows={data.bajas} />
          </div>

          {/* Tickets abiertos */}
          <div>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
              <Ticket size={15} /> Tickets abiertos (ENVIADO sin CDR)
              {totalAbiertos > 0 && <span className="badge badge-warning text-[10px]">{totalAbiertos} pendientes</span>}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiTicket label="Comprobantes" valor={data.ticketsAbiertos?.comprobantes ?? 0} Icono={FileText} />
              <KpiTicket label="Guías" valor={data.ticketsAbiertos?.guias ?? 0} Icono={Truck} />
              <KpiTicket label="Bajas" valor={data.ticketsAbiertos?.bajas ?? 0} Icono={Ban} />
            </div>
            {totalAbiertos > 0 && (
              <p className="text-[11px] text-muted mt-2">
                El job de reintentos cierra estos tickets automáticamente (getStatus/getStatusCdr). Si persisten, revisar los errores del log.
              </p>
            )}
          </div>

          {/* Últimos rechazos */}
          <div>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
              <AlertTriangle size={15} /> Últimos comprobantes rechazados / con error
            </h2>
            <div className="card">
              <div className="overflow-x-auto">
                <table className="table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Origen</th>
                      <th>Comprobante</th>
                      <th>Estado</th>
                      <th>Código</th>
                      <th>Detalle</th>
                      <th className="text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!data.ultimosRechazos || data.ultimosRechazos.length === 0) ? (
                      <tr><td colSpan={6} className="text-center text-muted py-4 italic">Sin rechazos recientes. 👍</td></tr>
                    ) : (
                      data.ultimosRechazos.map((r) => (
                        <tr key={`${r.origen}-${r.id}`}>
                          <td className="text-xs font-bold">{r.origen}</td>
                          <td className="font-mono">{r.comprobante}</td>
                          <td><BadgeEstadoSunat estado={r.estado} size="text-[11px]" /></td>
                          <td className="font-mono text-danger">{r.codigo || '—'}</td>
                          <td className="text-xs max-w-md truncate" title={r.detalle}>{r.detalle || '—'}</td>
                          <td className="text-right">
                            <Link to={`/ventas/ordenes`} className="btn btn-xs btn-outline" title="Ir a Ventas">
                              <ExternalLink size={13} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Errores del log */}
          <div>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
              <ServerCrash size={15} /> Errores recientes (sunat_log)
            </h2>
            <div className="card">
              <div className="overflow-x-auto">
                <table className="table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Origen</th>
                      <th>Ref.</th>
                      <th>Evento</th>
                      <th>HTTP</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!data.erroresLog || data.erroresLog.length === 0) ? (
                      <tr><td colSpan={6} className="text-center text-muted py-4 italic">Sin errores registrados. 👍</td></tr>
                    ) : (
                      data.erroresLog.map((l, i) => (
                        <tr key={i}>
                          <td className="text-xs whitespace-nowrap">{fmtFecha(l.fecha)}</td>
                          <td className="text-xs font-bold">{l.origen}</td>
                          <td className="font-mono text-xs">{l.referencia_id ?? '—'}</td>
                          <td className="text-xs">{l.evento}</td>
                          <td className="font-mono text-xs text-danger">{l.http_status ?? '—'}</td>
                          <td className="text-xs max-w-md truncate" title={l.detalle}>{l.detalle || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
