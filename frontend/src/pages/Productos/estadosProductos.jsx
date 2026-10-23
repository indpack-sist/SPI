import {
  PackageX, AlertTriangle, CheckCircle, ArrowUpCircle, TrendingUp, TrendingDown, ArrowRightLeft,
  Factory, Undo2, Scale
} from 'lucide-react';

export const ESTADOS_STOCK = {
  sin:    { label: 'Sin stock',   badge: 'badge-danger',  tono: 'is-danger',  color: 'var(--danger)',  icon: PackageX },
  bajo:   { label: 'Stock bajo',  badge: 'badge-warning', tono: 'is-warning', color: 'var(--warning)', icon: AlertTriangle },
  normal: { label: 'Normal',      badge: 'badge-success', tono: 'is-success', color: 'var(--success)', icon: CheckCircle },
  sobre:  { label: 'Sobre stock', badge: 'badge-info',    tono: 'is-info',    color: 'var(--info)',    icon: ArrowUpCircle }
};

export const ORDEN_ESTADOS_STOCK = ['sin', 'bajo', 'normal', 'sobre'];

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function estadoStock(p) {
  const stock = num(p?.stock_actual);
  const minimo = num(p?.stock_minimo);
  const maximo = num(p?.stock_maximo);
  if (stock <= 0) return 'sin';
  if (minimo > 0 && stock <= minimo) return 'bajo';
  if (maximo > 0 && stock > maximo) return 'sobre';
  return 'normal';
}

export function medidaStock(p) {
  const stock = Math.max(num(p?.stock_actual), 0);
  const minimo = num(p?.stock_minimo);
  const maximo = num(p?.stock_maximo);
  const tope = Math.max(maximo, minimo * 2, stock, 1);
  return {
    pct: Math.min((stock / tope) * 100, 100),
    minPct: minimo > 0 ? Math.min((minimo / tope) * 100, 100) : null,
    maxPct: maximo > 0 ? Math.min((maximo / tope) * 100, 100) : null
  };
}

export function BadgeEstadoStock({ producto, sm = false }) {
  const cfg = ESTADOS_STOCK[estadoStock(producto)];
  const Icono = cfg.icon;
  return <span className={`badge ${sm ? 'badge-sm ' : ''}${cfg.badge}`}><Icono size={sm ? 10 : 11} />{cfg.label}</span>;
}

export function MedidorStock({ producto }) {
  const { pct, minPct, maxPct } = medidaStock(producto);
  const cfg = ESTADOS_STOCK[estadoStock(producto)];
  return (
    <div className="pg-meter pr-meter" style={{ '--meter-c': cfg.color }} role="img"
      aria-label={`${cfg.label}: ${Math.round(pct)}% de la escala`}>
      <span style={{ width: `${pct}%` }} />
      {minPct !== null && <i className="pr-meter-mark" style={{ left: `${minPct}%` }} />}
      {maxPct !== null && <i className="pr-meter-mark is-max" style={{ left: `${maxPct}%` }} />}
    </div>
  );
}

export const TIPOS_MOVIMIENTO = {
  entrada:               { label: 'Entrada',           signo: 1,  tono: 'is-success', icon: TrendingUp },
  salida:                { label: 'Salida',            signo: -1, tono: 'is-danger',  icon: TrendingDown },
  transferencia_entrada: { label: 'Transf. entrada',   signo: 1,  tono: 'is-info',    icon: ArrowRightLeft },
  transferencia_salida:  { label: 'Transf. salida',    signo: -1, tono: 'is-warning', icon: ArrowRightLeft },
  produccion_consumo:    { label: 'Consumo producción', signo: -1, tono: 'is-accent', icon: Factory },
  devolucion_anulacion:  { label: 'Reverso anulación', signo: 1,  tono: 'is-success', icon: Undo2 },
  ajuste:                { label: 'Ajuste conteo',     signo: 0,  tono: 'is-info',    icon: Scale }
};

export const FILTROS_MOVIMIENTO = [
  { id: '', label: 'Todos' },
  { id: 'entrada', label: 'Entradas' },
  { id: 'salida', label: 'Salidas' },
  { id: 'transferencia', label: 'Transferencias' },
  { id: 'produccion', label: 'Producción' },
  { id: 'ajuste', label: 'Ajustes' }
];

export const configMovimiento = (tipo) => TIPOS_MOVIMIENTO[tipo] || TIPOS_MOVIMIENTO.entrada;

export function TagMovimiento({ tipo }) {
  const cfg = configMovimiento(tipo);
  const Icono = cfg.icon;
  return <span className={`pg-tag ${cfg.tono}`}><Icono size={11} />{cfg.label}</span>;
}

export const fmtCantidad = (valor, decimales = 4) => {
  const n = num(valor);
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: decimales }).format(n);
};

const formatoCosto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const fmtCosto = (valor, moneda = 'PEN') => `${moneda === 'USD' ? '$' : 'S/'} ${formatoCosto.format(num(valor))}`;

export const fmtPeso = (pesoKg) => {
  const peso = num(pesoKg);
  if (peso === 0) return '—';
  if (peso < 1) return `${fmtCantidad(peso * 1000, 0)} g`;
  return `${fmtCantidad(peso, 3)} kg`;
};

export const esTipoVendible = (nombreTipo) => nombreTipo === 'Productos Terminados' || nombreTipo === 'Productos de Reventa';
