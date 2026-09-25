import { useEffect, useState } from 'react';
import { FileText, FileCode2, FileCheck2, X, Download } from 'lucide-react';
import './ModalDescargaMasiva.css';

export default function ModalDescargaMasiva({ abierto, cantidad, onCerrar, onConfirmar }) {
  const [opciones, setOpciones] = useState({ pdf: true, xml: true, cdr: true });

  const ninguno = !opciones.pdf && !opciones.xml && !opciones.cdr;

  // Teclado: Esc cierra, Enter confirma (si hay al menos un tipo marcado).
  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'Enter' && !ninguno) onConfirmar(opciones);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, ninguno, opciones, onCerrar, onConfirmar]);

  if (!abierto) return null;

  const toggle = (k) => setOpciones((o) => ({ ...o, [k]: !o[k] }));

  const items = [
    { k: 'pdf', icon: FileText, label: 'Representación impresa (PDF)', desc: 'El comprobante en PDF (CP).' },
    { k: 'xml', icon: FileCode2, label: 'XML firmado', desc: 'El XML UBL enviado a SUNAT.' },
    { k: 'cdr', icon: FileCheck2, label: 'CDR (constancia)', desc: 'La respuesta de SUNAT (.zip).' },
  ];

  return (
    <div className="dmm-scrim" onClick={onCerrar}>
      <div className="dmm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Descargar comprobantes">
        <header className="dmm-head">
          <h3>Descargar {cantidad} comprobante(s)</h3>
          <button className="dmm-x" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <p className="dmm-sub">Elige qué archivos incluir. Se creará una carpeta por comprobante dentro de la carpeta que elijas.</p>
        <div className="dmm-opts">
          {items.map(({ k, icon: Icon, label, desc }) => (
            <label key={k} className={`dmm-opt ${opciones[k] ? 'on' : ''}`}>
              <input type="checkbox" checked={opciones[k]} onChange={() => toggle(k)} />
              <Icon size={18} />
              <span className="dmm-opt-txt"><b>{label}</b><small>{desc}</small></span>
            </label>
          ))}
        </div>
        <footer className="dmm-foot">
          <button className="dmm-btn dmm-ghost" onClick={onCerrar}>Cancelar</button>
          <button className="dmm-btn dmm-primary" disabled={ninguno} onClick={() => onConfirmar(opciones)}>
            <Download size={15} /> Elegir carpeta y descargar
          </button>
        </footer>
      </div>
    </div>
  );
}
