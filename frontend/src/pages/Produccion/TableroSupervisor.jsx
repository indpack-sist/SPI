import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesProduccionAPI } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';
import { AlertTriangle, UserMinus, Factory, RefreshCw, AlertCircle, CalendarCheck, PauseCircle, Users, Clock } from 'lucide-react';
import { BadgePrioridad } from './estadosProduccion';
import './Produccion.css';

const COLUMNAS = [
  { id: 'porAsignar', titulo: 'Por asignar', ayuda: 'Sin programar ni maquinista', color: 'var(--warning)', icon: AlertCircle },
  { id: 'programadas', titulo: 'Programadas', ayuda: 'En cola con fecha asignada', color: 'var(--info)', icon: CalendarCheck },
  { id: 'enCurso', titulo: 'En curso', ayuda: 'Máquina corriendo', color: 'var(--accent)', icon: Factory },
  { id: 'enPausa', titulo: 'En pausa', ayuda: 'Detenidas temporalmente', color: 'var(--steel-light)', icon: PauseCircle }
];

const columnaDeOrden = (orden) => {
  if (orden.estado === 'En Curso') return 'enCurso';
  if (orden.estado === 'En Pausa') return 'enPausa';
  if (orden.estado === 'Pendiente' || orden.estado === 'Pendiente Asignación') {
    return orden.fecha_programada ? 'programadas' : 'porAsignar';
  }
  return null;
};

const formatearFechaCorta = (fecha) => {
  if (!fecha) return '';
  const base = String(fecha).split('T')[0].split('-');
  return base.length === 3 ? `${base[2]}/${base[1]}` : fecha;
};

export default function TableroSupervisor() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarManuales, setMostrarManuales] = useState(false);

  useEffect(() => {
    cargarOrdenes();
  }, []);

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const response = await ordenesProduccionAPI.getAll({ origen_tipo: 'Supervisor' });
      if (response.data.success) {
        setOrdenes(response.data.data);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar las órdenes de producción');
    } finally {
      setLoading(false);
    }
  };

  const agrupadas = COLUMNAS.reduce((acc, c) => ({ ...acc, [c.id]: [] }), {});
  ordenes
    .filter(o => mostrarManuales || !o.es_manual)
    .forEach(orden => {
      const columna = columnaDeOrden(orden);
      if (columna) agrupadas[columna].push(orden);
    });

  const sinMaquinista = Object.values(agrupadas).flat().filter(o => !o.maquinista).length;

  return (
    <div className="pg-page">
      {loading && <Loading variant="detail" />}

      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Factory size={13} /> Producción · Supervisor</span>
          <h1 className="pg-title">Centro de control</h1>
          <p className="pg-subtitle">
            Órdenes internas activas
            {sinMaquinista > 0 && <> · <b className="text-danger">{sinMaquinista}</b> sin maquinista asignado</>}
          </p>
        </div>
        <div className="pg-actions">
          <label className="pd-switch">
            <input type="checkbox" className="checkbox" checked={mostrarManuales} onChange={(e) => setMostrarManuales(e.target.checked)} />
            Incluir manuales / históricas
          </label>
          <button type="button" className="btn btn-outline" onClick={cargarOrdenes} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </header>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="pd-board">
        {COLUMNAS.map(columna => {
          const lista = agrupadas[columna.id];
          const Icono = columna.icon;
          return (
            <section key={columna.id} className="pd-col" style={{ '--col-c': columna.color }} aria-label={columna.titulo}>
              <div className="pd-col-head">
                <div>
                  <h2><Icono size={15} /> {columna.titulo}</h2>
                  <small>{columna.ayuda}</small>
                </div>
                <span className="pg-count">{lista.length}</span>
              </div>
              <div className="pd-col-body">
                {lista.length === 0 ? (
                  <div className="pd-col-empty">Sin órdenes</div>
                ) : lista.map(orden => {
                  const planificado = parseFloat(orden.cantidad_unidades || 0);
                  const producido = parseFloat(orden.cantidad_unidades_producida || 0);
                  return (
                    <button
                      key={orden.id_orden}
                      type="button"
                      className="pd-card"
                      onClick={() => navigate(`/produccion/ordenes/${orden.id_orden}`)}
                    >
                      <div className="pd-card-top">
                        <span className="pg-code">{orden.numero_orden}</span>
                        <span className="flex items-center gap-1">
                          {orden.es_manual === 1 && <span className="pd-tag is-warning">Manual</span>}
                          <BadgePrioridad prioridad={orden.prioridad_venta} />
                        </span>
                      </div>

                      <span className="pd-card-product">{orden.producto}</span>

                      <div className="pd-card-grid">
                        <div>
                          <span>Planificado</span>
                          <b>{planificado.toFixed(0)}</b>
                        </div>
                        <div className="is-right">
                          <span>Producido</span>
                          <b className={producido > 0 ? 'text-success' : ''}>{producido.toFixed(0)}</b>
                        </div>
                      </div>

                      <div className="pd-card-meta">
                        {orden.maquinista ? (
                          <span><Users size={12} /> <b>{orden.maquinista}</b></span>
                        ) : (
                          <span className="pd-card-alert"><UserMinus size={13} /> Sin maquinista asignado</span>
                        )}
                        {orden.turno && <span><Clock size={12} /> Turno <b>{orden.turno}</b></span>}
                        {orden.fecha_programada && (
                          <span><CalendarCheck size={12} /> {formatearFechaCorta(orden.fecha_programada)}
                            {orden.fecha_programada_fin && orden.fecha_programada_fin !== orden.fecha_programada && ` → ${formatearFechaCorta(orden.fecha_programada_fin)}`}
                          </span>
                        )}
                      </div>

                      {orden.observaciones && (
                        <div className="pd-card-note" title={orden.observaciones}>
                          <AlertTriangle size={13} />
                          <p>{orden.observaciones}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
