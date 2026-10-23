import { Clock, CheckCircle, XCircle, FileSpreadsheet, PenLine, Database } from 'lucide-react';

export const ESTADOS_SOLICITUD_CREDITO = {
  Pendiente: { label: 'Pendiente', badge: 'badge-warning', tono: 'is-warning', color: 'var(--warning)', icon: Clock },
  Aprobada:  { label: 'Aprobada',  badge: 'badge-success', tono: 'is-success', color: 'var(--success)', icon: CheckCircle },
  Rechazada: { label: 'Rechazada', badge: 'badge-danger',  tono: 'is-danger',  color: 'var(--danger)',  icon: XCircle }
};

export const configEstadoSolicitudCredito = (estado) => (
  ESTADOS_SOLICITUD_CREDITO[estado] || { label: estado || 'Sin estado', badge: 'badge-secondary', tono: '', color: 'var(--steel-light)', icon: Clock }
);

export function BadgeSolicitudCredito({ estado }) {
  const cfg = configEstadoSolicitudCredito(estado);
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const ORIGENES_TC = {
  EXCEL_SUNAT: { label: 'Excel SUNAT', icon: FileSpreadsheet },
  MANUAL:      { label: 'Ingreso manual', icon: PenLine }
};

export const configOrigenTc = (origen) => ORIGENES_TC[origen] || { label: origen || 'Origen no indicado', icon: Database };
