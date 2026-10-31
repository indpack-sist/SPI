const CLASES = {
  cargando: 'text-muted',
  ok: 'text-success',
  aviso: 'text-warning',
  error: 'text-danger',
};

export default function EstadoConsulta({ estado }) {
  if (!estado) return null;
  return <small className={`block vt-fs-11 mt-1 ${CLASES[estado.tipo]}`}>{estado.mensaje}</small>;
}
