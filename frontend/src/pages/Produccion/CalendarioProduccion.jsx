import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, ExternalLink, Clock,
  CheckCircle, X, ArrowRight, RotateCcw, ShoppingCart, Briefcase, Factory, ClipboardList
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/UI/Loading';
import { ESTADOS_PRODUCCION, configEstadoProduccion, BadgeEstadoProduccion, BadgePrioridad } from './estadosProduccion';
import './Produccion.css';

const LEYENDA = ['Pendiente Asignación', 'Pendiente', 'En Curso', 'En Pausa', 'Finalizada', 'Cancelada'];

const fechaCorta = (iso) => {
  if (!iso) return '';
  const p = String(iso).split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

const CalendarioProduccion = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrden, setDraggedOrden] = useState(null);
  const [pendingResize, setPendingResize] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const userRole = user?.rol || '';
  const esComercial = ['comercial', 'ventas', 'vendedor'].includes(userRole.toLowerCase());

  useEffect(() => {
    const fechaParam = searchParams.get('fecha');
    if (fechaParam) {
      const fechaBase = fechaParam.includes('T') ? fechaParam.split('T')[0] : fechaParam;
      setCurrentDate(new Date(`${fechaBase}T12:00:00`));
    }
  }, [searchParams]);

  useEffect(() => { cargarOrdenes(); }, []);

  const cargarOrdenes = async () => {
    try {
      setLoading(true);
      const response = await ordenesProduccionAPI.getAll({});
      setOrdenes(Array.isArray(response.data.data) ? response.data.data : []);
    } catch { setOrdenes([]); }
    finally { setLoading(false); }
  };

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => { const d = new Date(y, m, 1, 12).getDay(); return d === 0 ? 6 : d - 1; };
  const changeMonth = (inc) => { const d = new Date(currentDate); d.setMonth(d.getMonth() + inc); setCurrentDate(d); };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const days = [];
    for (let i = 0; i < getFirstDayOfMonth(year, month); i++) days.push({ day: null, fullDate: null });
    for (let i = 1; i <= getDaysInMonth(year, month); i++) {
      days.push({ day: i, fullDate: `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}` });
    }
    while (days.length < 42) days.push({ day: null, fullDate: null });
    return days;
  };

  const calendarDays = generateCalendarDays();

  const isToday = (d) => {
    if (!d) return false;
    const today = new Date();
    return d === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const getOrderDates = (orden) => {
    if (orden.fecha_programada) {
      return {
        start: orden.fecha_programada.split('T')[0],
        end: (orden.fecha_programada_fin || orden.fecha_programada).split('T')[0]
      };
    }
    if (orden.fecha_inicio) {
      const now = new Date();
      return {
        start: orden.fecha_inicio.split('T')[0],
        end: orden.fecha_fin ? orden.fecha_fin.split('T')[0]
          : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      };
    }
    return { start: null, end: null };
  };

  const isOrderInDay = (orden, dayDate) => {
    const { start, end } = getOrderDates(orden);
    if (!start) return false;
    return dayDate >= start && dayDate <= end;
  };

  const handleDragStart = (e, orden) => {
    if (esComercial) return;
    setDraggedOrden(orden);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (esComercial || !draggedOrden || !dateStr) return;
    setOrdenes(prev => prev.map(o => o.id_orden === draggedOrden.id_orden
      ? { ...o, fecha_programada: dateStr, fecha_programada_fin: dateStr } : o));
    setPendingResize({ id_orden: draggedOrden.id_orden, numero_orden: draggedOrden.numero_orden, start_date: dateStr });
    setDraggedOrden(null);
  };

  const handleDayClick = async (dayData) => {
    if (!dayData?.fullDate) return;
    if (pendingResize) {
      if (esComercial) { setPendingResize(null); return; }
      const endDate = dayData.fullDate;
      if (endDate < pendingResize.start_date) { alert('La fecha de fin no puede ser anterior a la de inicio.'); return; }
      try {
        setOrdenes(prev => prev.map(o => o.id_orden === pendingResize.id_orden ? { ...o, fecha_programada_fin: endDate } : o));
        await ordenesProduccionAPI.update(pendingResize.id_orden, { fecha_programada: pendingResize.start_date, fecha_programada_fin: endDate });
        setPendingResize(null);
      } catch { cargarOrdenes(); }
      return;
    }
    setSelectedDay(dayData);
    setModalOpen(true);
  };

  const handleDesprogramar = async (e, orden) => {
    e.stopPropagation();
    if (esComercial) return;
    if (!window.confirm(`¿Retornar la orden ${orden.numero_orden} a la lista de pendientes?`)) return;
    setOrdenes(prev => prev.map(o => o.id_orden === orden.id_orden ? { ...o, fecha_programada: null, fecha_programada_fin: null } : o));
    try { await ordenesProduccionAPI.update(orden.id_orden, { fecha_programada: null, fecha_programada_fin: null }); }
    catch { cargarOrdenes(); }
  };

  const [diaDestino, setDiaDestino] = useState(null);

  useEffect(() => {
    if (!modalOpen && !pendingResize) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modalOpen) setModalOpen(false);
      else setPendingResize(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen, pendingResize]);

  const esArrastrable = (orden) => !esComercial && (orden.estado === 'Pendiente' || orden.estado === 'Pendiente Asignación');

  const abrirOrden = (orden) => navigate(`/produccion/ordenes/${orden.id_orden}`);

  const renderEvento = (orden) => {
    const cfg = configEstadoProduccion(orden.estado);
    const Icono = cfg.icon;
    const { start, end } = getOrderDates(orden);
    const arrastrable = esArrastrable(orden);
    return (
      <button
        key={orden.id_orden}
        type="button"
        draggable={arrastrable}
        onDragStart={(e) => arrastrable && handleDragStart(e, orden)}
        onDragEnd={() => setDiaDestino(null)}
        onClick={(e) => {
          if (pendingResize) return;
          e.stopPropagation();
          abrirOrden(orden);
        }}
        className={`pd-event ${start !== end ? 'is-range' : ''} ${draggedOrden?.id_orden === orden.id_orden ? 'is-dragging' : ''}`}
        style={{ '--c': cfg.color, cursor: pendingResize ? 'crosshair' : (arrastrable ? 'grab' : 'pointer') }}
        title={`${orden.numero_orden} · ${orden.producto} · ${cfg.label}`}
      >
        <Icono size={11} />
        <b>{orden.numero_orden}</b>
        <span>{orden.producto}</span>
      </button>
    );
  };

  const renderTarjeta = (orden) => {
    const arrastrable = esArrastrable(orden);
    const programada = !!orden.fecha_programada;
    return (
      <div
        key={orden.id_orden}
        role="button"
        tabIndex={0}
        draggable={arrastrable}
        onDragStart={(e) => arrastrable && handleDragStart(e, orden)}
        onDragEnd={() => setDiaDestino(null)}
        onClick={() => { if (!pendingResize) abrirOrden(orden); }}
        onKeyDown={(e) => { if (e.key === 'Enter') abrirOrden(orden); }}
        className={`pd-card ${arrastrable ? '' : 'is-locked'}`}
        style={{ opacity: draggedOrden?.id_orden === orden.id_orden ? 0.4 : 1 }}
      >
        <div className="pd-card-top">
          <span className="pg-code">{orden.numero_orden}</span>
          <BadgeEstadoProduccion estado={orden.estado} />
        </div>
        <span className="pd-card-product">{orden.producto}</span>
        <div className="pd-card-meta">
          <span><Package size={12} /> <b>{parseFloat(orden.cantidad_planificada || 0).toFixed(0)}</b> {orden.unidad_medida}</span>
          {orden.supervisor && <span><User size={12} /> {orden.supervisor}</span>}
          {orden.numero_orden_venta && (
            <span><ShoppingCart size={12} /> <b>{orden.numero_orden_venta}</b>{orden.comercial_venta && <> · <Briefcase size={11} /> {orden.comercial_venta.split(' ')[0]}</>}</span>
          )}
          {orden.fecha_estimada_venta && (
            <span className="text-warning"><Clock size={12} /> Entrega {fechaCorta(orden.fecha_estimada_venta)}</span>
          )}
        </div>
        <div className="pd-card-top">
          <BadgePrioridad prioridad={orden.prioridad_venta} />
          <span className="pd-card-actions">
            {programada && arrastrable && (
              <button type="button" className="pg-iconbtn" title="Retornar a pendientes" aria-label="Retornar a pendientes"
                onClick={(e) => handleDesprogramar(e, orden)}>
                <RotateCcw size={13} />
              </button>
            )}
            <button type="button" className="pg-iconbtn" title="Ver detalle" aria-label={`Ver ${orden.numero_orden}`}
              onClick={(e) => { e.stopPropagation(); abrirOrden(orden); }}>
              <ExternalLink size={13} />
            </button>
          </span>
        </div>
      </div>
    );
  };

  if (loading) return <Loading message="Cargando calendario..." />;

  const ordenesParaSidebar = ordenes.filter(o => !o.fecha_programada && (o.estado === 'Pendiente' || o.estado === 'Pendiente Asignación'));
  const ordenesDelDiaSeleccionado = selectedDay ? ordenes.filter(o => isOrderInDay(o, selectedDay.fullDate)) : [];
  const prefijoMes = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const ordenesDelMes = ordenes.filter(o => {
    const { start, end } = getOrderDates(o);
    return start && start.slice(0, 7) <= prefijoMes && end.slice(0, 7) >= prefijoMes;
  });

  return (
    <div className="pg-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><Factory size={13} /> Producción</span>
          <h1 className="pg-title">Calendario de producción</h1>
          <p className="pg-subtitle">
            <b>{ordenesDelMes.length}</b> órdenes en {monthNames[currentDate.getMonth()].toLowerCase()} · <b>{ordenesParaSidebar.length}</b> por programar
          </p>
        </div>
        <div className="pg-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/produccion/ordenes')}>
            <ClipboardList size={16} /> Listado
          </button>
          <div className="pd-cal-nav">
            <button type="button" className="pg-iconbtn" onClick={() => changeMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
            <h2 className="pd-cal-month">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <button type="button" className="pg-iconbtn" onClick={() => changeMonth(1)} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
          </div>
        </div>
      </header>

      {pendingResize && (
        <div className="pd-resize-banner" role="status">
          <ArrowRight size={16} />
          Elige el día de fin para {pendingResize.numero_orden}
          <button type="button" className="pg-iconbtn" onClick={() => setPendingResize(null)} aria-label="Cancelar"><X size={14} /></button>
        </div>
      )}

      <div className="pd-legend" style={{ marginBottom: '0.75rem' }}>
        {LEYENDA.map(estado => (
          <span key={estado}><i style={{ '--c': ESTADOS_PRODUCCION[estado].color }} />{ESTADOS_PRODUCCION[estado].label}</span>
        ))}
        <span><i style={{ '--c': 'var(--accent-dim)', outline: '1px solid var(--accent-border)' }} />Varios días</span>
      </div>

      <div className="pd-cal-layout">
        <section className="pg-panel pd-cal" aria-label="Calendario">
          <div className="pd-weekdays">
            {daysOfWeek.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="pd-days">
            {calendarDays.map((item, index) => {
              if (!item.day) return <div key={`empty-${index}`} className="pd-day is-blank" />;

              const esHoy = isToday(item.day);
              const ordenesDelDia = ordenes.filter(o => isOrderInDay(o, item.fullDate));
              const esDestino = pendingResize && item.fullDate >= pendingResize.start_date;

              return (
                <div
                  key={item.fullDate}
                  onDragOver={(e) => { handleDragOver(e); if (diaDestino !== item.fullDate) setDiaDestino(item.fullDate); }}
                  onDragLeave={() => setDiaDestino(null)}
                  onDrop={(e) => { setDiaDestino(null); handleDrop(e, item.fullDate); }}
                  onClick={() => handleDayClick(item)}
                  className={`pd-day ${esHoy ? 'is-today' : ''} ${esDestino ? 'is-target' : ''} ${diaDestino === item.fullDate ? 'is-drop' : ''}`}
                >
                  <div className="pd-day-head">
                    <span className="pd-day-num">{item.day}</span>
                    {ordenesDelDia.length > 0 && <span className="pd-day-count">{ordenesDelDia.length}</span>}
                  </div>
                  <div className="pd-day-list">
                    {ordenesDelDia.slice(0, 3).map(renderEvento)}
                    {ordenesDelDia.length > 3 && <span className="pd-day-more">+{ordenesDelDia.length - 3} más</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="pg-panel pd-pending" aria-label="Órdenes por programar">
          <div className="pg-panel-head">
            <div>
              <h2 className="pg-panel-title"><Package size={16} /> Por programar <span className="pg-count">{ordenesParaSidebar.length}</span></h2>
              {!esComercial && <span className="pg-panel-meta">Arrastra una orden al día de inicio</span>}
            </div>
          </div>
          <div className="pd-pending-body">
            {ordenesParaSidebar.length === 0 ? (
              <div className="pg-empty">
                <CheckCircle size={26} className="text-success" />
                <strong>Todo programado</strong>
              </div>
            ) : (
              ordenesParaSidebar.map(renderTarjeta)
            )}
          </div>
        </aside>
      </div>

      {modalOpen && selectedDay && (
        <div className="pd-modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="pd-modal" role="dialog" aria-modal="true" aria-labelledby="pd-modal-title">
            <div className="pg-panel-head">
              <h3 id="pd-modal-title" className="pg-panel-title">
                <CalendarIcon size={16} /> {selectedDay.day} de {monthNames[currentDate.getMonth()].toLowerCase()}
                <span className="pg-count">{ordenesDelDiaSeleccionado.length}</span>
              </h3>
              <button type="button" className="pg-iconbtn" onClick={() => setModalOpen(false)} aria-label="Cerrar" autoFocus><X size={16} /></button>
            </div>
            <div className="pd-modal-body">
              {ordenesDelDiaSeleccionado.length === 0 ? (
                <div className="pg-empty">
                  <CalendarIcon size={26} />
                  <strong>Sin órdenes este día</strong>
                  {!esComercial && <span>Arrastra una orden desde «Por programar» para agendarla.</span>}
                </div>
              ) : (
                ordenesDelDiaSeleccionado.map(o => {
                  const { start, end } = getOrderDates(o);
                  return (
                    <div key={o.id_orden}>
                      {renderTarjeta(o)}
                      <div className="pd-range" style={{ padding: '0.35rem 0.2rem 0' }}>
                        <span>Inicio <b>{fechaCorta(start)}</b></span>
                        <span>Fin <b>{fechaCorta(end)}</b></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="pd-modal-foot">
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarioProduccion;
