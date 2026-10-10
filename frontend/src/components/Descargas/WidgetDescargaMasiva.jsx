import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, X, AlertTriangle, XCircle, ListChecks, Copy } from 'lucide-react';
import { useDescargaMasiva } from '../../context/DescargaMasivaContext';
import './WidgetDescargaMasiva.css';

export default function WidgetDescargaMasiva() {
  const { estado, cancelar, cerrar } = useDescargaMasiva();
  const { activa, terminada, total, hechos, actual, ok, fallidos, omitidos, cancelada } = estado;
  const [verDetalle, setVerDetalle] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!activa) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activa]);

  if (!activa && !terminada) return null;

  const pct = total ? Math.round((hechos / total) * 100) : 0;
  const hayIncidencias = fallidos.length > 0 || omitidos.length > 0;

  const copiarLista = async () => {
    const lineas = [];
    if (fallidos.length) {
      lineas.push('NO DESCARGADOS (SUNAT no los entregó) - ingresar manual:');
      fallidos.forEach((f) => lineas.push(`${f.documento} · ${f.archivo}: ${f.error}`));
    }
    if (omitidos.length) {
      lineas.push('', 'SIN ARCHIVO (XML/CDR) - ingresar manual:');
      omitidos.forEach((o) => lineas.push(`${o.documento} · ${o.archivo}`));
    }
    try { await navigator.clipboard.writeText(lineas.join('\n')); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
  };

  return (
    <>
      <div className={`dm-widget ${cancelada ? 'is-cancel' : ''}`} role="status" aria-live="polite">
        {activa ? (
          <>
            <div className="dm-widget-head">
              <Loader2 className="dm-spin" size={16} />
              <strong>Descargando comprobantes…</strong>
              <button className="dm-widget-x" onClick={cancelar} title="Cancelar"><X size={15} /></button>
            </div>
            <div className="dm-bar"><span style={{ width: `${pct}%` }} /></div>
            <div className="dm-widget-info">
              <span>{hechos} / {total} · {pct}%</span>
              {actual && <span className="dm-widget-actual">{actual}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="dm-widget-head">
              <CheckCircle2 size={16} className="dm-ok-icon" />
              <strong>{cancelada ? 'Descarga cancelada' : 'Descarga completa'}</strong>
              <button className="dm-widget-x" onClick={cerrar} title="Cerrar"><X size={15} /></button>
            </div>
            <ul className="dm-resumen">
              <li><Download size={13} /> {ok} comprobante(s) descargado(s)</li>
              {fallidos.length > 0 && (
                <li className="dm-fail"><XCircle size={13} /> {fallidos.length} sin descargar (SUNAT no los entregó)
                  <small>
                    {fallidos.slice(0, 3).map((f, k) => (
                      <span key={k} className="dm-fail-item">{f.documento}</span>
                    ))}
                    {fallidos.length > 3 && <span className="dm-fail-item">…y {fallidos.length - 3} más</span>}
                  </small>
                </li>
              )}
              {omitidos.length > 0 && (
                <li className="dm-warn"><AlertTriangle size={13} /> {omitidos.length} sin archivo (XML/CDR)</li>
              )}
            </ul>
            {hayIncidencias && (
              <button className="dm-vercompleto" onClick={() => setVerDetalle(true)}>
                <ListChecks size={14} /> Ver completo ({fallidos.length + omitidos.length})
              </button>
            )}
          </>
        )}
      </div>

      {verDetalle && (
        <div className="dm-detalle-scrim" onClick={() => setVerDetalle(false)}>
          <div className="dm-detalle" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Detalle de la descarga">
            <header className="dm-detalle-head">
              <strong>Comprobantes a ingresar manual</strong>
              <button className="dm-widget-x" onClick={() => setVerDetalle(false)} title="Cerrar"><X size={16} /></button>
            </header>
            <p className="dm-detalle-sub">Estos no se incluyeron en la glosa ni se descargaron; cópialos para registrarlos a mano.</p>
            <div className="dm-detalle-body">
              {fallidos.length > 0 && (
                <section>
                  <h4 className="dm-fail"><XCircle size={13} /> No descargados — SUNAT no los entregó ({fallidos.length})</h4>
                  <ul>
                    {fallidos.map((f, k) => (
                      <li key={k}><b>{f.documento}</b> <span>{f.archivo}: {f.error}</span></li>
                    ))}
                  </ul>
                </section>
              )}
              {omitidos.length > 0 && (
                <section>
                  <h4 className="dm-warn"><AlertTriangle size={13} /> Sin archivo (XML/CDR) ({omitidos.length})</h4>
                  <ul>
                    {omitidos.map((o, k) => (
                      <li key={k}><b>{o.documento}</b> <span>{o.archivo}</span></li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <footer className="dm-detalle-foot">
              <button className="dm-btn-copiar" onClick={copiarLista}>
                <Copy size={14} /> {copiado ? 'Copiado' : 'Copiar lista'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
