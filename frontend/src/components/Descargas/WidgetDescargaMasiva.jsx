import { useEffect } from 'react';
import { CheckCircle2, Download, Loader2, X, AlertTriangle, XCircle } from 'lucide-react';
import { useDescargaMasiva } from '../../context/DescargaMasivaContext';
import './WidgetDescargaMasiva.css';

export default function WidgetDescargaMasiva() {
  const { estado, cancelar, cerrar } = useDescargaMasiva();
  const { activa, terminada, total, hechos, actual, ok, fallidos, omitidos, cancelada } = estado;

  // Aviso nativo si intenta cerrar/recargar con una descarga en curso.
  useEffect(() => {
    if (!activa) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activa]);

  if (!activa && !terminada) return null;

  const pct = total ? Math.round((hechos / total) * 100) : 0;

  return (
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
              <li className="dm-fail"><XCircle size={13} /> {fallidos.length} archivo(s) con error
                <small>
                  {fallidos.slice(0, 4).map((f, k) => (
                    <span key={k} className="dm-fail-item">{f.documento} · {f.archivo}: {f.error}</span>
                  ))}
                  {fallidos.length > 4 && <span className="dm-fail-item">…y {fallidos.length - 4} más</span>}
                </small>
              </li>
            )}
            {omitidos.length > 0 && (
              <li className="dm-warn"><AlertTriangle size={13} /> {omitidos.length} archivo(s) omitido(s) (sin XML/CDR)</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
