import { ESTADOS_SEE } from '../../../pages/Ventas/estadosVentas';

const TEXTOS = {
  PENDIENTE:   'Pendiente',
  ENVIADO:     'Enviado',
  ACEPTADO:    'Aceptado',
  OBSERVADO:   'Observado',
  RECHAZADO:   'Rechazado',
  BAJA:        'Anulado',
  ANULADA:     'Sin efecto',
  REEMPLAZADA: 'Reemplazada',
  ERROR:       'Error'
};

export default function BadgeEstadoSunat({ estado, size = 'text-xs' }) {
  const key = String(estado || '').toUpperCase();
  const cfg = !key ? ESTADOS_SEE.SIN_EMITIR : (ESTADOS_SEE[key] || ESTADOS_SEE.SIN_EMITIR);
  const texto = !key ? ESTADOS_SEE.SIN_EMITIR.label : (TEXTOS[key] || estado);
  const Icono = cfg.icon;
  return (
    <span className={`badge ${cfg.badge} ${size}`} title={`Estado SUNAT: ${texto}`}>
      <Icono size={12} />
      {texto}
    </span>
  );
}
