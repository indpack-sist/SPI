import { AlertCircle, Clock, Factory, PauseCircle, CheckCircle, XCircle, Flag } from 'lucide-react';

export const ESTADOS_PRODUCCION = {
  'Pendiente Asignación': { label: 'Por asignar', badge: 'badge-warning', color: 'var(--warning)', icon: AlertCircle },
  'Pendiente':            { label: 'Pendiente',   badge: 'badge-secondary', color: 'var(--steel-light)', icon: Clock },
  'En Curso':             { label: 'En curso',    badge: 'badge-primary', color: 'var(--accent)', icon: Factory },
  'En Pausa':             { label: 'En pausa',    badge: 'badge-info', color: 'var(--info)', icon: PauseCircle },
  'Finalizada':           { label: 'Finalizada',  badge: 'badge-success', color: 'var(--success)', icon: CheckCircle },
  'Cancelada':            { label: 'Cancelada',   badge: 'badge-danger', color: 'var(--danger)', icon: XCircle },
  'Anulada':              { label: 'Anulada',     badge: 'badge-danger', color: 'var(--danger)', icon: XCircle }
};

export const configEstadoProduccion = (estado) => ESTADOS_PRODUCCION[estado] || ESTADOS_PRODUCCION.Pendiente;

const BADGE_PRIORIDAD = {
  URGENTE: 'badge-danger',
  ALTA: 'badge-warning',
  MEDIA: 'badge-info',
  BAJA: 'badge-secondary'
};

export function BadgeEstadoProduccion({ estado }) {
  const cfg = configEstadoProduccion(estado);
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export function BadgePrioridad({ prioridad }) {
  if (!prioridad) return null;
  const clase = BADGE_PRIORIDAD[String(prioridad).toUpperCase()] || 'badge-secondary';
  return <span className={`badge badge-sm ${clase}`}><Flag size={10} />{prioridad}</span>;
}
