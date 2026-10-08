import { Clock, Send, CheckCircle, XCircle, Ban, RefreshCw, AlertTriangle } from 'lucide-react';

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
