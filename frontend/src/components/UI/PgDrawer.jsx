import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function PgDrawer({ eyebrow, title, badges, footer, onClose, children }) {
  const tituloId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.modal-overlay')) return;
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div className="pg-drawer-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="pg-drawer" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <div className="pg-drawer-head">
          <div>
            {eyebrow && <span className="pg-eyebrow">{eyebrow}</span>}
            <h2 id={tituloId}>{title}</h2>
            {badges && <div className="pg-drawer-badges">{badges}</div>}
          </div>
          <button type="button" className="pg-iconbtn" onClick={onClose} aria-label="Cerrar detalle" autoFocus><X size={16} /></button>
        </div>
        <div className="pg-drawer-body">{children}</div>
        {footer && <div className="pg-drawer-foot">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}

export default PgDrawer;
