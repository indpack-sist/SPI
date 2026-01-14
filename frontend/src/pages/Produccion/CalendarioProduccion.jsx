import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, ExternalLink, Clock,
  AlertCircle, PlayCircle, PauseCircle, CheckCircle, XCircle, X, ArrowRight, RotateCcw,
  ShoppingCart // Importado para el icono de orden de venta
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api'; 
import Loading from '../../components/UI/Loading'; 

const CalendarioProduccion = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [draggedOrden, setDraggedOrden] = useState(null);
  const [pendingResize, setPendingResize] = useState(null);

  const [selectedDay, setSelectedDay] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  useEffect(() => { cargarOrdenes(); }, []);

  const cargarOrdenes = async () => {
    try {
      setLoading(true);
      const response = await ordenesProduccionAPI.getAll({});
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setOrdenes(data);
    } catch (error) {
      setOrdenes([]);
    } finally { setLoading(false); }
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => { const day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };
  const changeMonth = (inc) => { const d = new Date(currentDate); d.setMonth(d.getMonth() + inc); setCurrentDate(d); };
  
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];
    for (let i = 0; i < getFirstDayOfMonth(year, month); i++) days.push({ day: null, fullDate: null });
    for (let i = 1; i <= getDaysInMonth(year, month); i++) {
      days.push({ day: i, fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` });
    }
    while (days.length < 42) days.push({ day: null, fullDate: null });
    return days;
  };

  const calendarDays = generateCalendarDays();
  const isToday = (d) => d === new Date().toISOString().split('T')[0];

  const getStatusColor = (estado) => {
    switch(estado) {
        case 'Pendiente': case 'Pendiente Asignación': return '#f59e0b';
        case 'En Curso': return '#3b82f6';
        case 'En Pausa': return '#f97316';
        case 'Finalizada': return '#22c55e';
        case 'Cancelada': return '#ef4444';
        default: return '#9ca3af';
    }
  };

  const getOrderDates = (orden) => {
    let start, end;

    if (orden.fecha_programada) {
        start = orden.fecha_programada.split('T')[0];
        end = (orden.fecha_programada_fin || orden.fecha_programada).split('T')[0];
    } 
    else if (orden.fecha_inicio) {
        start = orden.fecha_inicio.split('T')[0];
        end = (orden.fecha_fin || orden.fecha_inicio).split('T')[0];
    } else {
        return { start: null, end: null };
    }

    return { start, end };
  };

  const isOrderInDay = (orden, dayDate) => {
    const { start, end } = getOrderDates(orden);
    if (!start) return false;
    return dayDate >= start && dayDate <= end;
  };

  const handleDragStart = (e, orden) => {
    setDraggedOrden(orden);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!draggedOrden || !dateStr) return;

    const ordenesTemp = ordenes.map(o => {
      if (o.id_orden === draggedOrden.id_orden) {
        return { 
          ...o, 
          fecha_programada: dateStr, 
          fecha_programada_fin: dateStr
        };
      }
      return o;
    });
    
    setOrdenes(ordenesTemp);
    
    setPendingResize({
      id_orden: draggedOrden.id_orden,
      numero_orden: draggedOrden.numero_orden,
      start_date: dateStr
    });
    
    setDraggedOrden(null);
  };

  const handleDayClick = async (dayData) => {
    if (!dayData || !dayData.fullDate) return;

    if (pendingResize) {
      const endDate = dayData.fullDate;
      const startDate = pendingResize.start_date;

      if (endDate < startDate) {
        alert("La fecha de fin no puede ser anterior a la de inicio.");
        return;
      }

      try {
        const ordenesFinales = ordenes.map(o => {
          if (o.id_orden === pendingResize.id_orden) {
            return { ...o, fecha_programada_fin: endDate };
          }
          return o;
        });
        setOrdenes(ordenesFinales);

        await ordenesProduccionAPI.update(pendingResize.id_orden, { 
          fecha_programada: startDate,
          fecha_programada_fin: endDate 
        });
        
        setPendingResize(null); 

      } catch (err) {
        cargarOrdenes();
      }
      return;
    }

    setSelectedDay(dayData);
    setModalOpen(true);
  };

  const handleDesprogramar = async (e, orden) => {
    e.stopPropagation();
    if (!window.confirm(`¿Retornar la orden ${orden.numero_orden} a la lista de pendientes?`)) return;

    const ordenesActualizadas = ordenes.map(o => {
      if (o.id_orden === orden.id_orden) {
        return { ...o, fecha_programada: null, fecha_programada_fin: null };
      }
      return o;
    });
    setOrdenes(ordenesActualizadas);

    try {
      await ordenesProduccionAPI.update(orden.id_orden, { 
        fecha_programada: null,
        fecha_programada_fin: null
      });
    } catch (err) {
      cargarOrdenes();
    }
  };

  const OrdenCard = ({ orden, compact = false, isRangePart = false }) => {
    const isDraggable = orden.estado === 'Pendiente' || orden.estado === 'Pendiente Asignación';
    const isScheduled = !!orden.fecha_programada;
    
    const borderColor = getStatusColor(orden.estado);
    let IconEstado = AlertCircle;
    
    switch(orden.estado) {
        case 'Pendiente': case 'Pendiente Asignación': IconEstado = Clock; break;
        case 'En Curso': IconEstado = PlayCircle; break;
        case 'En Pausa': IconEstado = PauseCircle; break;
        case 'Finalizada': IconEstado = CheckCircle; break;
        case 'Cancelada': IconEstado = XCircle; break;
    }

    return (
      <div
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, orden)}
        onClick={(e) => {
            if(pendingResize) return; 
            e.stopPropagation();
            navigate(`/produccion/ordenes/${orden.id_orden}`);
        }}
        style={{
          backgroundColor: isRangePart ? '#fffbeb' : '#fff',
          borderLeft: `4px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '6px',
          marginBottom: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          cursor: pendingResize ? 'crosshair' : (isDraggable ? 'grab' : 'pointer'),
          fontSize: '11px',
          opacity: draggedOrden?.id_orden === orden.id_orden ? 0.5 : 1,
          border: '1px solid #e5e7eb',
          borderLeftWidth: '4px',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
             {!compact && <IconEstado size={10} color={borderColor} />}
             <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{orden.numero_orden}</span>
          </div>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            {isScheduled && (isDraggable) && (
                <button 
                    onClick={(e) => handleDesprogramar(e, orden)}
                    style={{ border: 'none', background: '#fee2e2', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', padding: '2px' }}
                    title="Retornar a pendientes"
                >
                    <RotateCcw size={14} />
                </button>
            )}
            
            <button 
                onClick={(e) => { e.stopPropagation(); navigate(`/produccion/ordenes/${orden.id_orden}`); }}
                style={{ border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', color: '#4b5563', padding: '2px' }}
                title="Ver detalle completo"
            >
                <ExternalLink size={14} />
            </button>
          </div>
        </div>
        
        <div style={{ 
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
          color: '#475569', margin: '2px 0', fontWeight: '500' 
        }} title={orden.producto}>
          {orden.producto}
        </div>

        {/* --- MOSTRAR NUMERO DE ORDEN DE VENTA SI EXISTE --- */}
        {orden.numero_orden_venta && (
            <div style={{ fontSize: '9px', color: '#2563eb', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '500' }}>
                <ShoppingCart size={10} /> 
                Ref: {orden.numero_orden_venta}
            </div>
        )}

        {!compact && (
             <div style={{ color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', marginTop: '4px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <Package size={10} /> 
               {parseFloat(orden.cantidad_planificada).toFixed(0)} {orden.unidad_medida}
             </div>
             {orden.supervisor && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <User size={10} /> 
                 {orden.supervisor.split(' ')[0]}
                 </div>
             )}
           </div>
        )}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando calendario..." />;

  const ordenesParaSidebar = ordenes.filter(o => 
    !o.fecha_programada && 
    (o.estado === 'Pendiente' || o.estado === 'Pendiente Asignación')
  );

  const ordenesDelDiaSeleccionado = selectedDay 
    ? ordenes.filter(o => isOrderInDay(o, selectedDay.fullDate))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 80px)', backgroundColor: '#f1f5f9', padding: '16px', gap: '16px', overflow: 'hidden', fontFamily: 'system-ui' }}>

      {pendingResize && (
        <div style={{ 
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', 
          zIndex: 100, backgroundColor: '#3b82f6', color: 'white', padding: '10px 20px', 
          borderRadius: '50px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold'
        }}>
          <ArrowRight size={20} />
          <span>Selecciona el día de fin para {pendingResize.numero_orden}</span>
          <button onClick={() => setPendingResize(null)} style={{ marginLeft: '10px', background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '50%', padding: '4px', cursor: 'pointer', color: 'white' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px' }}><CalendarIcon color="#2563eb" size={24} /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', textTransform: 'capitalize', margin: 0 }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
                onClick={() => setCurrentDate(new Date())} 
                style={{ padding: '6px 12px', cursor: 'pointer', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', fontSize: '13px', color: '#4b5563' }}
            >
                Ir a Hoy
            </button>
            <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '2px', borderRadius: '6px' }}>
                <button onClick={() => changeMonth(-1)} style={{ padding: '6px', cursor: 'pointer', background: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', display:'flex', alignItems:'center' }}><ChevronLeft size={18} /></button>
                <button onClick={() => changeMonth(1)} style={{ padding: '6px', cursor: 'pointer', background: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', display:'flex', alignItems:'center' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          {daysOfWeek.map(day => <div key={day} style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>{day}</div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', flex: 1, overflowY: 'auto', backgroundColor: '#e2e8f0', gap: '1px' }}>
          {calendarDays.map((item, index) => {
            if (!item.day) return <div key={`empty-${index}`} style={{ backgroundColor: '#f9fafb', minHeight: '100px' }}></div>;

            const isTodayDay = isToday(currentDate.getFullYear(), currentDate.getMonth(), item.day);
            const ordenesDelDia = ordenes.filter(o => isOrderInDay(o, item.fullDate));
            const isPotentialEnd = pendingResize && item.fullDate >= pendingResize.start_date;

            return (
              <div 
                key={item.fullDate} 
                onDragOver={handleDragOver} 
                onDrop={(e) => handleDrop(e, item.fullDate)}
                onClick={() => handleDayClick(item)}
                style={{ 
                  backgroundColor: isPotentialEnd ? '#e0f2fe' : (isTodayDay ? '#eff6ff' : 'white'), 
                  padding: '4px', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '100px',
                  cursor: pendingResize ? (isPotentialEnd ? 'pointer' : 'not-allowed') : 'default'
                }}
                className="hover:bg-gray-50"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: isTodayDay ? '#2563eb' : '#475569', backgroundColor: isTodayDay ? '#dbeafe' : 'transparent', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>{item.day}</span>
                  {ordenesDelDia.length > 0 && <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '10px', color: '#64748b', fontWeight: 'bold' }}>{ordenesDelDia.length}</span>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {ordenesDelDia.slice(0, 4).map(o => {
                    const { start, end } = getOrderDates(o);
                    const isPart = start !== end;
                    return <OrdenCard key={o.id_orden} orden={o} compact={true} isRangePart={isPart} />;
                  })}
                  {ordenesDelDia.length > 4 && <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center' }}>+ {ordenesDelDia.length - 4} más...</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ width: '320px', minWidth: '320px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', height: '100%' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={18} /> Por Programar</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Arrastra al día de inicio</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#f1f5f9' }}>
          {ordenesParaSidebar.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}><CheckCircle size={32} style={{margin:'0 auto 8px'}}/><p>Todo programado</p></div>
          ) : (
            ordenesParaSidebar.map(o => <OrdenCard key={o.id_orden} orden={o} />)
          )}
        </div>
      </div>

      {modalOpen && selectedDay && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '500px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>{selectedDay.day} de {monthNames[currentDate.getMonth()]}</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {ordenesDelDiaSeleccionado.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>Sin órdenes programadas.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ordenesDelDiaSeleccionado.map(o => {
                    const { start, end } = getOrderDates(o);
                    const colorEstado = getStatusColor(o.estado);
                    return (
                      <div key={o.id_orden} style={{ 
                          border: '1px solid #e5e7eb', 
                          borderLeft: `4px solid ${colorEstado}`, 
                          borderRadius: '6px', 
                          padding: '10px', 
                          backgroundColor: '#f9fafb' 
                      }}>
                          <div style={{ marginBottom: '6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ 
                                  fontSize: '10px', fontWeight: 'bold', color: colorEstado, 
                                  textTransform: 'uppercase', backgroundColor: 'white', 
                                  padding: '2px 8px', borderRadius: '4px', border: `1px solid ${colorEstado}` 
                              }}>
                                  {o.estado}
                              </span>
                          </div>
                          <OrdenCard orden={o} />
                          <div style={{fontSize:'11px', marginTop:'6px', color:'#64748b', display:'flex', gap:'10px', borderTop:'1px solid #e2e8f0', paddingTop:'6px'}}>
                              <span><strong>Inicio:</strong> {start}</span> 
                              <span><strong>Fin:</strong> {end}</span>
                          </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-outline">Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CalendarioProduccion;