import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

const pilaModales = [];

function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    pilaModales.push(id);
    const onKey = (e) => {
      if (e.key !== 'Escape' || pilaModales[pilaModales.length - 1] !== id) return;
      e.stopPropagation();
      onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const idx = pilaModales.lastIndexOf(id);
      if (idx !== -1) pilaModales.splice(idx, 1);
    };
  }, [isOpen, id]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={`${id}-titulo`}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar" autoFocus>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
