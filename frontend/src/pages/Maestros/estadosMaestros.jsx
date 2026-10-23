import {
  CheckCircle, Ban, Truck, Wrench, Shield, ShieldCheck, Briefcase, Wallet, ShoppingCart, Megaphone,
  UserCog, HardHat, Factory, Package, Route, User, Building2, Banknote, CalendarClock, CreditCard,
  Hourglass, AlertTriangle
} from 'lucide-react';

export const ESTADOS_REGISTRO = {
  Activo:   { label: 'Activo',   badge: 'badge-success',   color: 'var(--success)',     icon: CheckCircle },
  Inactivo: { label: 'Inactivo', badge: 'badge-secondary', color: 'var(--steel-light)', icon: Ban }
};

export function BadgeEstadoRegistro({ estado }) {
  const cfg = ESTADOS_REGISTRO[estado] || ESTADOS_REGISTRO.Inactivo;
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const ESTADOS_VEHICULO = {
  'Disponible':    { label: 'Disponible',    badge: 'badge-success',   tono: 'is-success', color: 'var(--success)',     icon: CheckCircle },
  'En Uso':        { label: 'En uso',        badge: 'badge-primary',   tono: 'is-accent',  color: 'var(--accent)',      icon: Truck },
  'Mantenimiento': { label: 'Mantenimiento', badge: 'badge-info',      tono: 'is-info',    color: 'var(--info)',        icon: Wrench },
  'Inactivo':      { label: 'Inactivo',      badge: 'badge-secondary', tono: '',           color: 'var(--steel-light)', icon: Ban }
};

export function BadgeEstadoVehiculo({ estado }) {
  const cfg = ESTADOS_VEHICULO[estado] || ESTADOS_VEHICULO.Inactivo;
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{cfg.label}</span>;
}

export const ROLES_EMPLEADO = {
  Administrador:  { label: 'Administrador',             grupo: 'Administración y Calidad', badge: 'badge-danger',    icon: Shield },
  Calidad:        { label: 'Calidad',                   grupo: 'Administración y Calidad', badge: 'badge-danger',    icon: ShieldCheck },
  Administrativo: { label: 'Administrativo',            grupo: 'Administración y Calidad', badge: 'badge-secondary', icon: Briefcase },
  Cobranzas:      { label: 'Cobranzas',                 grupo: 'Finanzas',                 badge: 'badge-secondary', icon: Wallet },
  Ventas:         { label: 'Ventas',                    grupo: 'Ventas y Comercial',       badge: 'badge-success',   icon: ShoppingCart },
  Comercial:      { label: 'Comercial',                 grupo: 'Ventas y Comercial',       badge: 'badge-success',   icon: Megaphone },
  Supervisor:     { label: 'Supervisor de Producción',  grupo: 'Producción',               badge: 'badge-primary',   icon: UserCog },
  Operario:       { label: 'Operario de Producción',    grupo: 'Producción',               badge: 'badge-secondary', icon: HardHat },
  Produccion:     { label: 'Jefe de Producción',        grupo: 'Producción',               badge: 'badge-primary',   icon: Factory },
  Almacenero:     { label: 'Almacenero',                grupo: 'Almacén y Logística',      badge: 'badge-secondary', icon: Package },
  Logistica:      { label: 'Coordinador de Logística',  grupo: 'Almacén y Logística',      badge: 'badge-warning',   icon: Route },
  Conductor:      { label: 'Conductor',                 grupo: 'Transporte',               badge: 'badge-info',      icon: Truck }
};

export const configRol = (rol) => ROLES_EMPLEADO[rol] || { label: rol || 'Sin rol', grupo: 'Otros', badge: 'badge-secondary', icon: User };

export function BadgeRol({ rol }) {
  const cfg = configRol(rol);
  const Icono = cfg.icon;
  return <span className={`badge ${cfg.badge}`}><Icono size={11} />{rol || 'Sin rol'}</span>;
}

export function OpcionesRol() {
  const grupos = Object.entries(ROLES_EMPLEADO).reduce((acc, [valor, cfg]) => {
    (acc[cfg.grupo] = acc[cfg.grupo] || []).push({ valor, label: cfg.label });
    return acc;
  }, {});
  return Object.entries(grupos).map(([grupo, roles]) => (
    <optgroup key={grupo} label={grupo}>
      {roles.map(r => <option key={r.valor} value={r.valor}>{r.label}</option>)}
    </optgroup>
  ));
}

export const TIPOS_DOCUMENTO = {
  RUC: { label: 'RUC', badge: 'badge-primary', icon: Building2 },
  DNI: { label: 'DNI', badge: 'badge-info',    icon: User }
};

export function BadgeTipoDocumento({ tipo }) {
  const cfg = TIPOS_DOCUMENTO[tipo] || TIPOS_DOCUMENTO.RUC;
  const Icono = cfg.icon;
  return <span className={`badge badge-sm ${cfg.badge}`}><Icono size={10} />{cfg.label}</span>;
}

export const CONDICIONES_PAGO = {
  Contado: { label: 'Contado', badge: 'badge-success', icon: Banknote },
  Credito: { label: 'Crédito', badge: 'badge-warning', icon: CalendarClock }
};

export function BadgeCondicionPago({ condicion, dias }) {
  const cfg = CONDICIONES_PAGO[condicion] || CONDICIONES_PAGO.Contado;
  const Icono = cfg.icon;
  return (
    <span className={`badge ${cfg.badge}`}>
      <Icono size={11} />{cfg.label}{condicion === 'Credito' && Number(dias) > 0 ? ` · ${dias} d` : ''}
    </span>
  );
}

export const ESTADOS_CREDITO = {
  vencido:   { label: 'Con vencidos',        badge: 'badge-danger',    tono: 'is-danger',  icon: AlertTriangle },
  solicitud: { label: 'Solicitud pendiente', badge: 'badge-warning',   tono: 'is-warning', icon: Hourglass },
  linea:     { label: 'Línea de crédito',    badge: 'badge-info',      tono: 'is-info',    icon: CreditCard },
  sin:       { label: 'Sin línea',           badge: 'badge-secondary', tono: '',           icon: Banknote }
};

export const usaLimiteCredito = (c) => c?.usar_limite_credito === 1 || c?.usar_limite_credito === true;

export function estadoCreditoCliente(c) {
  if (Number(c?.ordenes_vencidas) > 0) return 'vencido';
  if (Number(c?.tiene_solicitud_pendiente) === 1 || c?.tiene_solicitud_pendiente === true) return 'solicitud';
  if (usaLimiteCredito(c)) return 'linea';
  return 'sin';
}

export function BadgeCreditoCliente({ cliente }) {
  const cfg = ESTADOS_CREDITO[estadoCreditoCliente(cliente)];
  const Icono = cfg.icon;
  return <span className={`badge badge-sm ${cfg.badge}`}><Icono size={10} />{cfg.label}</span>;
}
