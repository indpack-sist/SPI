import {
  Clock, PlayCircle, Factory, Truck, PackageCheck, CheckCircle, XCircle, AlertTriangle,
  Receipt, Ban, FileText, CreditCard, Hourglass, ShieldCheck, ShieldX, Route, Car, Store,
  FileEdit, Send, ArrowRightCircle, CalendarX
} from 'lucide-react';

export const ESTADOS_ORDEN = {
  'En Espera':               { label: 'En espera',        badge: 'badge-warning',   tono: 'is-warning', color: 'var(--warning)',     icon: Clock },
  'En Proceso':              { label: 'En proceso',       badge: 'badge-info',      tono: 'is-info',    color: 'var(--info)',        icon: PlayCircle },
  'Atendido por Producción': { label: 'Atendido',         badge: 'badge-primary',   tono: 'is-accent',  color: 'var(--accent)',      icon: Factory },
  'Despacho Parcial':        { label: 'Despacho parcial', badge: 'badge-warning',   tono: 'is-warning', color: 'var(--warning)',     icon: Truck },
  'Despachada':              { label: 'Despachada',       badge: 'badge-primary',   tono: 'is-accent',  color: 'var(--accent)',      icon: PackageCheck },
  'Entregada':               { label: 'Entregada',        badge: 'badge-success',   tono: 'is-success', color: 'var(--success)',     icon: CheckCircle },
  'Cancelada':               { label: 'Cancelada',        badge: 'badge-danger',    tono: 'is-danger',  color: 'var(--danger)',      icon: XCircle }
};

const ALIAS_ORDEN = { 'Atendido por Produccion': 'Atendido por Producción' };

export const configEstadoOrden = (estado) => (
  ESTADOS_ORDEN[estado] || ESTADOS_ORDEN[ALIAS_ORDEN[estado]] || { label: estado || 'Sin estado', badge: 'badge-secondary', tono: '', color: 'var(--steel-light)', icon: Clock }
);

export function BadgeEstadoOrden({ estado }) {
  const cfg = configEstadoOrden(estado);
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const ESTADOS_COTIZACION = {
  'Borrador':   { label: 'Borrador',   badge: 'badge-secondary', tono: '',           color: 'var(--steel-light)', icon: FileEdit },
  'Pendiente':  { label: 'Pendiente',  badge: 'badge-warning',   tono: 'is-warning', color: 'var(--warning)',     icon: Clock },
  'Enviada':    { label: 'Enviada',    badge: 'badge-info',      tono: 'is-info',    color: 'var(--info)',        icon: Send },
  'Aprobada':   { label: 'Aprobada',   badge: 'badge-success',   tono: 'is-success', color: 'var(--success)',     icon: CheckCircle },
  'Rechazada':  { label: 'Rechazada',  badge: 'badge-danger',    tono: 'is-danger',  color: 'var(--danger)',      icon: XCircle },
  'Convertida': { label: 'Convertida', badge: 'badge-primary',   tono: 'is-accent',  color: 'var(--accent)',      icon: ArrowRightCircle },
  'Vencida':    { label: 'Vencida',    badge: 'badge-secondary', tono: '',           color: 'var(--steel-light)', icon: CalendarX }
};

export const configEstadoCotizacion = (estado) => (
  ESTADOS_COTIZACION[estado] || { label: estado || 'Sin estado', badge: 'badge-secondary', tono: '', color: 'var(--steel-light)', icon: FileText }
);

export function BadgeEstadoCotizacion({ estado }) {
  const cfg = configEstadoCotizacion(estado);
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const TIPOS_ENTREGA = {
  'Vehiculo Empresa':    { label: 'Vehículo de la empresa', icon: Truck },
  'Transporte Privado':  { label: 'Transporte privado',     icon: Route },
  'Vehiculo Particular': { label: 'Vehículo particular',    icon: Car },
  'Recojo Tienda':       { label: 'Recojo en tienda',       icon: Store }
};

export const configTipoEntrega = (tipo) => TIPOS_ENTREGA[tipo] || (tipo ? { label: tipo, icon: Truck } : null);

export const ESTADOS_SEE = {
  ACEPTADO:   { label: 'Aceptada',    badge: 'badge-success',   icon: CheckCircle,   color: 'var(--success)' },
  OBSERVADO:  { label: 'Observada',   badge: 'badge-warning',   icon: AlertTriangle, color: 'var(--warning)' },
  RECHAZADO:  { label: 'Rechazada',   badge: 'badge-danger',    icon: XCircle,       color: 'var(--danger)' },
  EN_PROCESO: { label: 'En proceso',  badge: 'badge-info',      icon: Clock,         color: 'var(--info)' },
  PENDIENTE:  { label: 'Pendiente',   badge: 'badge-info',      icon: Clock,         color: 'var(--info)' },
  ENVIADO:    { label: 'Enviada',     badge: 'badge-info',      icon: Clock,         color: 'var(--info)' },
  ERROR:      { label: 'Error',       badge: 'badge-danger',    icon: XCircle,       color: 'var(--danger)' },
  SIN_EMITIR: { label: 'Sin emitir',  badge: 'badge-secondary', icon: Receipt,       color: 'var(--steel-light)' },
  ANULADA:    { label: 'Anulada',     badge: 'badge-secondary', icon: Ban,           color: 'var(--steel-light)' },
  BAJA:       { label: 'De baja',     badge: 'badge-secondary', icon: Ban,           color: 'var(--steel-light)' },
  NO_APLICA:  { label: 'No aplica',   badge: 'badge-secondary', icon: FileText,      color: 'var(--steel-light)' }
};

export function BadgeSee({ estado }) {
  const cfg = ESTADOS_SEE[estado] || ESTADOS_SEE.SIN_EMITIR;
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const ESTADOS_PAGO_OV = {
  Pendiente: { label: 'Pendiente', badge: 'badge-warning', tono: 'is-warning', color: 'var(--warning)', icon: Clock },
  Parcial:   { label: 'Parcial',   badge: 'badge-info',    tono: 'is-info',    color: 'var(--info)',    icon: CreditCard },
  Pagado:    { label: 'Pagado',    badge: 'badge-success', tono: 'is-success', color: 'var(--success)', icon: CheckCircle }
};

export function BadgeEstadoPago({ estado }) {
  const cfg = ESTADOS_PAGO_OV[estado] || ESTADOS_PAGO_OV.Pendiente;
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const ESTADOS_VERIFICACION = {
  Pendiente: { label: 'Por verificar', badge: 'badge-warning', tono: 'is-warning', color: 'var(--warning)', icon: Hourglass },
  Aprobada:  { label: 'Aprobada',      badge: 'badge-success', tono: 'is-success', color: 'var(--success)', icon: ShieldCheck },
  Rechazada: { label: 'Rechazada',     badge: 'badge-danger',  tono: 'is-danger',  color: 'var(--danger)',  icon: ShieldX }
};

export function BadgeVerificacion({ estado }) {
  const cfg = ESTADOS_VERIFICACION[estado] || ESTADOS_VERIFICACION.Pendiente;
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}
