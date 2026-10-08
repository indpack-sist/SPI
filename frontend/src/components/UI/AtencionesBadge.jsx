export default function AtencionesBadge({ atenciones = 0, totalOrdenes = 0, desglose = '' }) {
  const n = Number(atenciones) || 0;
  const total = Number(totalOrdenes) || 0;

  const lineas = desglose
    ? desglose.split('|').map(p => {
        const idx = p.lastIndexOf(':');
        const estado = p.slice(0, idx);
        const cnt = p.slice(idx + 1);
        return `  • ${estado}: ${cnt}`;
      })
    : [];

  const tooltip = [
    `Atenciones: ${n} (despachadas / despacho parcial / entregadas)`,
    `Total de ordenes: ${total}`,
    lineas.length ? '' : null,
    ...lineas
  ].filter(l => l !== null).join('\n');

  return (
    <span
      className={`badge ${n > 0 ? 'badge-success' : 'badge-secondary'}`}
      title={tooltip}
      style={{ cursor: 'help' }}
    >
      {n} atenci{n === 1 ? 'ón' : 'ones'}
    </span>
  );
}
