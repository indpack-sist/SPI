// components/Ventas/sunat/BadgeEstadoSunat.jsx — Fase 14.
// Badge unificado de estado SUNAT para comprobantes (facturas/notas) y guías de remisión.
// Usa las clases `badge badge-*` del tema (claro/oscuro) e iconos lucide, igual que el resto de la app.
import { Clock, Send, CheckCircle, XCircle, Ban, RefreshCw, AlertTriangle } from 'lucide-react';

// Estados de sunat_estado (comprobantes: PENDIENTE/ENVIADO/ACEPTADO/OBSERVADO/RECHAZADO/BAJA ;
// guías: + ANULADA/REEMPLAZADA/ERROR).
const ESTADOS = {
  PENDIENTE:   { clase: 'badge-secondary', Icono: Clock,         texto: 'Pendiente' },
  ENVIADO:     { clase: 'badge-warning',   Icono: Send,          texto: 'Enviado' },
  ACEPTADO:    { clase: 'badge-success',   Icono: CheckCircle,   texto: 'Aceptado' },
  OBSERVADO:   { clase: 'badge-info',      Icono: AlertTriangle, texto: 'Observado' },
  RECHAZADO:   { clase: 'badge-danger',    Icono: XCircle,       texto: 'Rechazado' },
  BAJA:        { clase: 'badge-secondary', Icono: Ban,           texto: 'Anulado' },
  ANULADA:     { clase: 'badge-secondary', Icono: Ban,           texto: 'Sin efecto' },
  REEMPLAZADA: { clase: 'badge-info',      Icono: RefreshCw,     texto: 'Reemplazada' },
  ERROR:       { clase: 'badge-danger',    Icono: AlertTriangle, texto: 'Error' }
};

// Sin fila SUNAT todavía (no emitido).
const SIN_EMITIR = { clase: 'badge-secondary', Icono: Clock, texto: 'Sin emitir' };

export default function BadgeEstadoSunat({ estado, size = 'text-xs' }) {
  const key = String(estado || '').toUpperCase();
  const cfg = !key
    ? SIN_EMITIR
    : (ESTADOS[key] || { clase: 'badge-secondary', Icono: Clock, texto: estado });
  const { clase, Icono, texto } = cfg;
  return (
    <span className={`badge ${clase} ${size}`} title={`Estado SUNAT: ${texto}`}>
      <Icono size={12} />
      {texto}
    </span>
  );
}
