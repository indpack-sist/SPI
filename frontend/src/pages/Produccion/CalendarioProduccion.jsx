import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, ExternalLink, Clock,
  AlertCircle, PlayCircle, PauseCircle, CheckCircle, XCircle, X, ArrowRight
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api'; 
import Loading from '../../components/UI/Loading'; 

const CalendarioProduccion = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para la lógica Drag -> Click
  const [draggedOrden, setDraggedOrden] = useState(null);
  const [pendingResize, setPendingResize] = useState(null); // { id_orden, start_date }

  // Estados visuales
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
      console.error("Error", error);
      setOrdenes([]);
    } finally { setLoading(false); }
  };

  // --- Helpers de Fecha ---
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

  // Helper para saber si una orden cae en un día específico (Rango)
  const isOrderInDay = (orden, dayDate) => {
    if (!orden.fecha_programada) return false;
    // Si no tiene fecha fin, asumimos que es de 1 día (start == end)
    const start = orden.fecha_programada;
    const end = orden.fecha_programada_fin || orden.fecha_programada;
    return dayDate >= start && dayDate <= end;
  };

  // --- LÓGICA CORE: Drag (Inicio) -> Click (Fin) ---

  const handleDragStart = (e, orden) => {
    setDraggedOrden(orden);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!draggedOrden || !dateStr) return;

    // 1. Establecemos visualmente el inicio y activamos modo "Esperando click final"
    const ordenesTemp = ordenes.map(o => {
      if (o.id_orden === draggedOrden.id_orden) {
        return { 
          ...o, 
          fecha_programada: dateStr, 
          fecha_programada_fin: dateStr // Temporalmente fin = inicio
        };
      }
      return o;
    });
    
    setOrdenes(ordenesTemp);
    
    // 2. Guardamos el estado para esperar el segundo click
    setPendingResize({
      id_orden: draggedOrden.id_orden,
      numero_orden: draggedOrden.numero_orden,
      start_date: dateStr
    });
    
    setDraggedOrden(null);
  };

  const handleDayClick = async (dayData) => {
    if (!dayData || !dayData.fullDate) return;

    // CASO A: Estamos seleccionando la fecha de fin (segundo click)
    if (pendingResize) {
      const endDate = dayData.fullDate;
      const startDate = pendingResize.start_date;

      // Validación simple: Fin no puede ser antes que Inicio
      if (endDate < startDate) {
        alert("La fecha de fin no puede ser anterior a la de inicio.");
        return;
      }

      // Guardar en Backend (Inicio y Fin)
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
        
        // Limpiar estado y terminar flujo
        setPendingResize(null); 

      } catch (err) {
        console.error("Error al guardar rango", err);
        cargarOrdenes();
      }
      return; // Salir, no abrir modal
    }

    // CASO B: Comportamiento normal (Ver detalles del día)
    setSelectedDay(dayData);
    setModalOpen(true);
  };

  // --- Render Card ---
  const OrdenCard = ({ orden, compact = false, isRangePart = false }) => {
    // Si la orden es parte de un rango y no estamos en la sidebar, la hacemos ver diferente
    
    const isDraggable = orden.estado === 'Pendiente' || orden.estado === 'Pendiente Asignación';
    
    let borderColor = '#9ca3af'; 
    let IconEstado = AlertCircle;
    
    switch(orden.estado) {
        case 'Pendiente': case 'Pendiente Asignación': borderColor = '#f59e0b'; IconEstado = Clock; break;
        case 'En Curso': borderColor = '#3b82f6'; IconEstado = PlayCircle; break;
        case 'En Pausa': borderColor = '#f97316'; IconEstado = PauseCircle; break;
        case 'Finalizada': borderColor = '#22c55e'; IconEstado = CheckCircle; break;
        case 'Cancelada': borderColor = '#ef4444'; IconEstado = XCircle; break;
    }

    return (
      <div
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, orden)}
        onClick={(e) => {
            // Si estamos redimensionando, dejamos que el click pase al día
            if(pendingResize) return; 
            e.stopPropagation();
            navigate(`/produccion/ordenes/${orden.id_orden}`);
        }}
        style={{
          backgroundColor: isRangePart ? '#fffbeb' : '#fff', // Fondo amarillento si es rango
          borderLeft: `4px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '4px',
          marginBottom: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          cursor: pendingResize ? 'crosshair' : (isDraggable ? 'grab' : 'pointer'),
          fontSize: '11px',
          opacity: draggedOrden?.id_orden === orden.id_orden ? 0.5 : 1,
          border: '1px solid #e5e7eb',
          borderLeftWidth: '4px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
             {!compact && <IconEstado size={10} color={borderColor} />}
             <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{orden.numero_orden}</span>
          </div>
        </div>
        
        <div style={{ 
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
          color: '#475569', margin: '2px 0', fontWeight: '500' 
        }} title={orden.producto}>
          {orden.producto}
        </div>
      </div>
    );
  };

  if (loading) return <Loading message="Cargando calendario..." />;

  // Filtro Sidebar: Sin fecha programada Y pendientes
  const ordenesParaSidebar = ordenes.filter(o => !o.fecha_programada && (o.estado === 'Pendiente' || o.estado === 'Pendiente Asignación'));

  // Filtro Modal
  const ordenesDelDiaSeleccionado = selectedDay 
    ? ordenes.filter(o => isOrderInDay(o, selectedDay.fullDate))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 80px)', backgroundColor: '#f1f5f9', padding: '16px', gap: '16px', overflow: 'hidden', fontFamily: 'system-ui' }}>

      {/* --- AVISO FLOTANTE MIENTRAS SE SELECCIONA FECHA FIN --- */}
      {pendingResize && (
        <div style={{ 
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', 
          zIndex: 100, backgroundColor: '#3b82f6', color: 'white', padding: '10px 20px', 
          borderRadius: '50px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold'
        }}>
          <ArrowRight size={20} />
          <span>Selecciona el día de fin para la orden {pendingResize.numero_orden}</span>
          <button onClick={() => setPendingResize(null)} style={{ marginLeft: '10px', background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '50%', padding: '4px', cursor: 'pointer', color: 'white' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* CALENDARIO */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px' }}><CalendarIcon color="#2563eb" size={24} /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', textTransform: 'capitalize', margin: 0 }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => changeMonth(-1)} style={{ padding: '8px', cursor: 'pointer', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px' }}><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} style={{ padding: '8px 16px', cursor: 'pointer', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: '600' }}>Hoy</button>
            <button onClick={() => changeMonth(1)} style={{ padding: '8px', cursor: 'pointer', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px' }}><ChevronRight size={20} /></button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          {daysOfWeek.map(day => <div key={day} style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>{day}</div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', flex: 1, overflowY: 'auto', backgroundColor: '#e2e8f0', gap: '1px' }}>
          {calendarDays.map((item, index) => {
            if (!item.day) return <div key={`empty-${index}`} style={{ backgroundColor: '#f9fafb', minHeight: '100px' }}></div>;

            const isTodayDay = isToday(currentDate.getFullYear(), currentDate.getMonth(), item.day);
            
            // FILTRO DE RANGO: Orden aparece si el día está dentro de su [start, end]
            const ordenesDelDia = ordenes.filter(o => isOrderInDay(o, item.fullDate));

            // Estilo visual si estamos seleccionando rango
            const isPotentialEndDay = pendingResize && item.fullDate >= pendingResize.start_date;

            return (
              <div 
                key={item.fullDate}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item.fullDate)}
                onClick={() => handleDayClick(item)}
                style={{ 
                  backgroundColor: isPotentialEndDay ? '#e0f2fe' : (isTodayDay ? '#eff6ff' : 'white'), 
                  padding: '4px',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '100px',
                  cursor: pendingResize ? (isPotentialEndDay ? 'pointer' : 'not-allowed') : 'default'
                }}
                className="hover:bg-gray-50"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: isTodayDay ? '#2563eb' : '#475569', backgroundColor: isTodayDay ? '#dbeafe' : 'transparent', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    {item.day}
                  </span>
                  {ordenesDelDia.length > 0 && (
                    <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '10px', color: '#64748b', fontWeight: 'bold' }}>{ordenesDelDia.length}</span>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {ordenesDelDia.slice(0, 4).map(orden => (
                    <OrdenCard key={orden.id_orden} orden={orden} compact={true} isRangePart={orden.fecha_programada !== orden.fecha_programada_fin} />
                  ))}
                  {ordenesDelDia.length > 4 && <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center' }}>+ {ordenesDelDia.length - 4} más...</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SIDEBAR */}
      <div style={{ width: '320px', minWidth: '320px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', height: '100%' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={18} /> Por Programar</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Arrastra al día de inicio</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#f1f5f9' }}>
          {ordenesParaSidebar.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}><CheckCircle size={32} style={{margin:'0 auto 8px'}}/><p>Todo programado</p></div>
          ) : (
            ordenesParaSidebar.map(orden => <OrdenCard key={orden.id_orden} orden={orden} />)
          )}
        </div>
      </div>

      {/* MODAL DETALLE DIA */}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ordenesDelDiaSeleccionado.map(orden => (
                    <div key={orden.id_orden} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', backgroundColor: '#f9fafb' }}>
                        <OrdenCard orden={orden} />
                        <div style={{fontSize:'11px', marginTop:'4px', color:'#64748b'}}>
                            <strong>Inicio:</strong> {orden.fecha_programada} | <strong>Fin:</strong> {orden.fecha_programada_fin || orden.fecha_programada}
                        </div>
                    </div>
                  ))}
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