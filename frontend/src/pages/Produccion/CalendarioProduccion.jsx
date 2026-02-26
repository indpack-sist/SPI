import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, ExternalLink, Clock,
  AlertCircle, PlayCircle, PauseCircle, CheckCircle, XCircle, X, ArrowRight, RotateCcw,
  ShoppingCart, Flag, Briefcase
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api'; 
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/UI/Loading'; 

/* ─── Estilos scoped (no hay CSS separado para este componente) ─── */
const S = {
  /* Layout principal */
  root: {
    display: 'flex', flexDirection: 'row',
    height: 'calc(100vh - 80px)',
    backgroundColor: 'var(--bg-primary)',
    padding: '16px', gap: '12px',
    overflow: 'hidden',
    fontFamily: "'Barlow', sans-serif"
  },
  /* Panel calendario */
  calPanel: {
    flex: 3, display: 'flex', flexDirection: 'column',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  /* Header calendario */
  calHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'var(--carbon-light)',
  },
  calTitle: {
    display: 'flex', alignItems: 'center', gap: '10px'
  },
  calTitleIcon: {
    backgroundColor: 'rgba(232,184,75,0.1)',
    border: '1px solid rgba(232,184,75,0.2)',
    padding: '7px', borderRadius: '2px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  calTitleText: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '1.25rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--text-primary)', margin: 0
  },
  calControls: {
    display: 'flex', gap: '8px', alignItems: 'center'
  },
  btnHoy: {
    padding: '6px 14px', cursor: 'pointer',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600, fontSize: '12px',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'var(--text-secondary)',
    transition: 'border-color 0.15s, color 0.15s'
  },
  btnNav: {
    padding: '5px 7px', cursor: 'pointer',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    display: 'flex', alignItems: 'center',
    color: 'var(--text-secondary)',
    transition: 'border-color 0.15s'
  },
  /* Días de semana */
  weekRow: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--carbon-light)'
  },
  weekCell: {
    padding: '8px', textAlign: 'center',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    color: 'var(--text-secondary)'
  },
  /* Grid días */
  daysGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    gridAutoRows: '1fr', flex: 1,
    overflowY: 'auto',
    backgroundColor: 'var(--border)', gap: '1px'
  },
  /* Celda día */
  dayCell: (isToday, isPotentialEnd) => ({
    backgroundColor: isPotentialEnd
      ? 'rgba(93,173,226,0.08)'
      : isToday
        ? 'rgba(232,184,75,0.05)'
        : 'var(--bg-secondary)',
    padding: '4px', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minHeight: '100px',
    cursor: isPotentialEnd ? 'pointer' : 'default',
    transition: 'background-color 0.1s'
  }),
  dayCellEmpty: {
    backgroundColor: 'var(--carbon-light)', minHeight: '100px'
  },
  dayNumber: (isToday) => ({
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, fontSize: '13px',
    color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
    backgroundColor: isToday ? 'rgba(232,184,75,0.15)' : 'transparent',
    width: '22px', height: '22px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '2px',
    border: isToday ? '1px solid var(--accent-border)' : 'none'
  }),
  ordenesBadge: {
    fontSize: '9px',
    background: 'var(--carbon-light)',
    border: '1px solid var(--border)',
    padding: '1px 5px', borderRadius: '2px',
    color: 'var(--text-secondary)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, letterSpacing: '0.06em'
  },
  /* Sidebar */
  sidebar: {
    width: '300px', minWidth: '300px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    display: 'flex', flexDirection: 'column',
    height: '100%'
  },
  sidebarHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--carbon-light)',
  },
  sidebarTitle: {
    margin: 0, display: 'flex', alignItems: 'center', gap: '8px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '0.875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--text-primary)'
  },
  sidebarSub: {
    margin: '4px 0 0', fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: "'Barlow', sans-serif"
  },
  sidebarBody: {
    flex: 1, overflowY: 'auto', padding: '10px',
    backgroundColor: 'var(--bg-primary)'
  },
  /* Pendiente resize banner */
  resizeBanner: {
    position: 'absolute', top: '20px', left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    backgroundColor: 'var(--accent)',
    color: '#0f0f0f',
    padding: '10px 20px', borderRadius: '2px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', gap: '10px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, fontSize: '0.875rem',
    textTransform: 'uppercase', letterSpacing: '0.06em'
  },
  resizeBannerBtn: {
    marginLeft: '8px', background: 'rgba(0,0,0,0.15)',
    border: 'none', borderRadius: '2px',
    padding: '4px', cursor: 'pointer', color: '#0f0f0f',
    display: 'flex', alignItems: 'center'
  },
  /* Modal */
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200
  },
  modalBox: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    width: '520px', maxWidth: '90%', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(0,0,0,0.6)'
  },
  modalHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'var(--carbon-light)'
  },
  modalTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '1.1rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--text-primary)', margin: 0
  },
  modalBody: { padding: '12px', overflowY: 'auto', flex: 1 },
  modalFooter: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'flex-end',
    backgroundColor: 'var(--carbon-light)'
  },
  /* Orden card en modal */
  modalOrdenWrap: (colorEstado) => ({
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${colorEstado}`,
    borderRadius: '2px',
    padding: '10px',
    backgroundColor: 'var(--bg-tertiary)',
    marginBottom: '8px'
  }),
  modalOrdenStatus: (colorEstado) => ({
    fontSize: '9px', fontWeight: 700,
    color: colorEstado, textTransform: 'uppercase',
    backgroundColor: 'var(--carbon-light)',
    padding: '2px 7px', borderRadius: '2px',
    border: `1px solid ${colorEstado}`,
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.08em', display: 'inline-block',
    marginBottom: '6px'
  }),
  modalOrdenDates: {
    fontSize: '10px', marginTop: '6px',
    color: 'var(--text-secondary)',
    display: 'flex', gap: '12px',
    borderTop: '1px solid var(--border)', paddingTop: '6px',
    fontFamily: "'Barlow Condensed', sans-serif",
    textTransform: 'uppercase', letterSpacing: '0.06em'
  },
  /* Empty state */
  emptySidebar: {
    textAlign: 'center', color: 'var(--text-secondary)',
    marginTop: '40px', padding: '20px'
  },
  emptyModal: {
    textAlign: 'center', color: 'var(--text-secondary)',
    padding: '24px', fontSize: '13px'
  }
};

/* ─── Colores de estado (se mantienen como valores directos para bordes) ─── */
const getStatusColor = (estado) => {
  switch(estado) {
    case 'Pendiente': case 'Pendiente Asignación': return '#e8b84b';
    case 'En Curso':   return '#5dade2';
    case 'En Pausa':   return '#f39c12';
    case 'Finalizada': return '#2ecc71';
    case 'Cancelada':  return '#e74c3c';
    default:           return '#555555';
  }
};

const getPriorityStyle = (prioridad) => {
  switch(prioridad?.toUpperCase()) {
    case 'URGENTE': return { bg: 'rgba(231,76,60,0.12)',  text: '#e74c3c', border: 'rgba(231,76,60,0.3)' };
    case 'ALTA':    return { bg: 'rgba(243,156,18,0.12)', text: '#f39c12', border: 'rgba(243,156,18,0.3)' };
    case 'MEDIA':   return { bg: 'rgba(93,173,226,0.12)', text: '#5dade2', border: 'rgba(93,173,226,0.3)' };
    case 'BAJA':    return { bg: 'rgba(46,204,113,0.12)', text: '#2ecc71', border: 'rgba(46,204,113,0.3)' };
    default:        return { bg: 'rgba(85,85,85,0.12)',   text: '#888888', border: 'rgba(85,85,85,0.3)' };
  }
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

  /* ─── OrdenCard ─── */
  const OrdenCard = ({ orden, compact = false, isRangePart = false }) => {
    const isDraggable = !esComercial && (orden.estado === 'Pendiente' || orden.estado === 'Pendiente Asignación');
    const isScheduled = !!orden.fecha_programada;
    const borderColor = getStatusColor(orden.estado);
    const priorityStyle = getPriorityStyle(orden.prioridad_venta);

    let IconEstado = AlertCircle;
    switch(orden.estado) {
      case 'Pendiente': case 'Pendiente Asignación': IconEstado = Clock; break;
      case 'En Curso':   IconEstado = PlayCircle; break;
      case 'En Pausa':   IconEstado = PauseCircle; break;
      case 'Finalizada': IconEstado = CheckCircle; break;
      case 'Cancelada':  IconEstado = XCircle; break;
    }

    return (
      <div
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, orden)}
        onClick={(e) => {
          if (pendingResize) return;
          e.stopPropagation();
          navigate(`/produccion/ordenes/${orden.id_orden}`);
        }}
        style={{
          backgroundColor: isRangePart ? 'rgba(232,184,75,0.06)' : 'var(--bg-tertiary)',
          borderLeft: `3px solid ${borderColor}`,
          border: `1px solid var(--border)`,
          borderLeftColor: borderColor,
          borderRadius: '2px',
          padding: '5px 6px',
          marginBottom: '3px',
          cursor: pendingResize ? 'crosshair' : (isDraggable ? 'grab' : 'pointer'),
          fontSize: '11px',
          opacity: draggedOrden?.id_orden === orden.id_orden ? 0.4 : 1,
          transition: 'opacity 0.15s'
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {!compact && <IconEstado size={10} color={borderColor} />}
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, color: 'var(--text-primary)',
              fontSize: '11px', letterSpacing: '0.04em'
            }}>
              {orden.numero_orden}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '3px' }}>
            {isScheduled && isDraggable && (
              <button
                onClick={(e) => handleDesprogramar(e, orden)}
                style={{
                  border: 'none', background: 'rgba(231,76,60,0.1)',
                  borderRadius: '2px', cursor: 'pointer',
                  color: '#e74c3c', padding: '2px',
                  display: 'flex', alignItems: 'center'
                }}
                title="Retornar a pendientes"
              >
                <RotateCcw size={11} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/produccion/ordenes/${orden.id_orden}`); }}
              style={{
                border: 'none', background: 'var(--carbon-light)',
                borderRadius: '2px', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: '2px',
                display: 'flex', alignItems: 'center'
              }}
              title="Ver detalle"
            >
              <ExternalLink size={11} />
            </button>
          </div>
        </div>

        {/* Producto */}
        <div style={{
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: 'var(--text-secondary)', margin: '2px 0', fontWeight: 500,
          fontSize: '10px'
        }} title={orden.producto}>
          {orden.producto}
        </div>

        {/* OV + prioridad */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
          {orden.numero_orden_venta ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ fontSize: '9px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                <ShoppingCart size={9} /> {orden.numero_orden_venta}
              </div>
              {orden.comercial_venta && (
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Briefcase size={9} /> {orden.comercial_venta.split(' ')[0]}
                </div>
              )}
            </div>
          ) : <span />}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            {orden.prioridad_venta && (
              <div style={{
                fontSize: '8px', fontWeight: 700,
                color: priorityStyle.text, backgroundColor: priorityStyle.bg,
                padding: '1px 4px', borderRadius: '2px',
                border: `1px solid ${priorityStyle.border}`,
                display: 'flex', alignItems: 'center', gap: '2px',
                textTransform: 'uppercase',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em'
              }}>
                <Flag size={8} /> {orden.prioridad_venta}
              </div>
            )}
            {orden.fecha_estimada_venta && (
              <div style={{
                fontSize: '8px', fontWeight: 700,
                color: '#f39c12', backgroundColor: 'rgba(243,156,18,0.1)',
                padding: '1px 4px', borderRadius: '2px',
                display: 'flex', alignItems: 'center', gap: '2px',
                border: '1px solid rgba(243,156,18,0.2)'
              }}>
                <Clock size={8} />
                {new Date(orden.fecha_estimada_venta).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        {/* Cantidad + supervisor */}
        {!compact && (
          <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Package size={10} />
              {parseFloat(orden.cantidad_planificada).toFixed(0)} {orden.unidad_medida}
            </div>
            {orden.supervisor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={10} /> {orden.supervisor.split(' ')[0]}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando calendario..." />;

  const ordenesParaSidebar = ordenes.filter(o => !o.fecha_programada && (o.estado === 'Pendiente' || o.estado === 'Pendiente Asignación'));
  const ordenesDelDiaSeleccionado = selectedDay ? ordenes.filter(o => isOrderInDay(o, selectedDay.fullDate)) : [];

  return (
    <div style={S.root}>

      {/* Banner pending resize */}
      {pendingResize && (
        <div style={S.resizeBanner}>
          <ArrowRight size={18} />
          <span>Selecciona el día de fin para {pendingResize.numero_orden}</span>
          <button onClick={() => setPendingResize(null)} style={S.resizeBannerBtn}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Panel Calendario ── */}
      <div style={S.calPanel}>

        {/* Header */}
        <div style={S.calHeader}>
          <div style={S.calTitle}>
            <div style={S.calTitleIcon}>
              <CalendarIcon color="var(--accent)" size={22} />
            </div>
            <h2 style={S.calTitleText}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          <div style={S.calControls}>
            <button style={S.btnHoy} onClick={() => setCurrentDate(new Date())}>Hoy</button>
            <button style={S.btnNav} onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
            <button style={S.btnNav} onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Fila días semana */}
        <div style={S.weekRow}>
          {daysOfWeek.map(d => <div key={d} style={S.weekCell}>{d}</div>)}
        </div>

        {/* Grid días */}
        <div style={S.daysGrid}>
          {calendarDays.map((item, index) => {
            if (!item.day) return <div key={`empty-${index}`} style={S.dayCellEmpty} />;

            const isTodayDay = isToday(item.day);
            const ordenesDelDia = ordenes.filter(o => isOrderInDay(o, item.fullDate));
            const isPotentialEnd = pendingResize && item.fullDate >= pendingResize.start_date;

            return (
              <div
                key={item.fullDate}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item.fullDate)}
                onClick={() => handleDayClick(item)}
                style={S.dayCell(isTodayDay, isPotentialEnd)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', paddingLeft: '2px' }}>
                  <span style={S.dayNumber(isTodayDay)}>{item.day}</span>
                  {ordenesDelDia.length > 0 && (
                    <span style={S.ordenesBadge}>{ordenesDelDia.length}</span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {ordenesDelDia.slice(0, 4).map(o => {
                    const { start, end } = getOrderDates(o);
                    return <OrdenCard key={o.id_orden} orden={o} compact isRangePart={start !== end} />;
                  })}
                  {ordenesDelDia.length > 4 && (
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>
                      +{ordenesDelDia.length - 4} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <h3 style={S.sidebarTitle}>
            <Package size={16} /> Por Programar
          </h3>
          {!esComercial && <p style={S.sidebarSub}>Arrastra al día de inicio</p>}
        </div>
        <div style={S.sidebarBody}>
          {ordenesParaSidebar.length === 0 ? (
            <div style={S.emptySidebar}>
              <CheckCircle size={28} color="var(--success)" style={{ margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '12px' }}>
                Todo programado
              </p>
            </div>
          ) : (
            ordenesParaSidebar.map(o => <OrdenCard key={o.id_orden} orden={o} />)
          )}
        </div>
      </div>

      {/* ── Modal día ── */}
      {modalOpen && selectedDay && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={S.modalHeader}>
              <h3 style={S.modalTitle}>
                {selectedDay.day} de {monthNames[currentDate.getMonth()]}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={S.modalBody}>
              {ordenesDelDiaSeleccionado.length === 0 ? (
                <div style={S.emptyModal}>Sin órdenes programadas para este día.</div>
              ) : (
                ordenesDelDiaSeleccionado.map(o => {
                  const { start, end } = getOrderDates(o);
                  const colorEstado = getStatusColor(o.estado);
                  return (
                    <div key={o.id_orden} style={S.modalOrdenWrap(colorEstado)}>
                      <div style={S.modalOrdenStatus(colorEstado)}>{o.estado}</div>
                      <OrdenCard orden={o} />
                      <div style={S.modalOrdenDates}>
                        <span><strong>Inicio:</strong> {start}</span>
                        <span><strong>Fin:</strong> {end}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={S.modalFooter}>
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarioProduccion;