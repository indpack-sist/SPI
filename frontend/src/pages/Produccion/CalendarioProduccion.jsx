import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Package, 
  User, 
  ExternalLink,
  Clock
} from 'lucide-react';
import { ordenesProduccionAPI } from '../../config/api'; 
import Loading from '../../components/UI/Loading'; 

const CalendarioProduccion = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrden, setDraggedOrden] = useState(null);

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    cargarOrdenes();
  }, []);

  const cargarOrdenes = async () => {
    try {
      setLoading(true);
      const response = await ordenesProduccionAPI.getAll({});
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setOrdenes(data);
    } catch (error) {
      console.error("Error al cargar órdenes", error);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Fecha ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  
  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const changeMonth = (increment) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    
    const days = [];
    // Días vacíos previos
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, fullDate: null });
    }
    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, fullDate: dateStr });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  // --- Helpers ---
  const isToday = (year, month, day) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  // --- Drag & Drop ---
  const handleDragStart = (e, orden) => {
    setDraggedOrden(orden);
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!draggedOrden || !dateStr) return;

    const ordenesActualizadas = ordenes.map(o => {
      if (o.id_orden === draggedOrden.id_orden) {
        return { ...o, fecha_inicio: dateStr };
      }
      return o;
    });
    setOrdenes(ordenesActualizadas);
    setDraggedOrden(null);

    try {
      await ordenesProduccionAPI.update(draggedOrden.id_orden, { fecha_inicio: dateStr });
    } catch (err) {
      console.error("Error al guardar fecha", err);
      cargarOrdenes();
    }
  };

  // --- Componente Tarjeta (Reutilizable) ---
  const OrdenCard = ({ orden, isCompact = false }) => {
    const isDraggable = orden.estado !== 'Finalizada' && orden.estado !== 'Cancelada';
    
    const getBorderColor = () => {
      switch(orden.estado) {
        case 'Pendiente': return '#9ca3af'; // gris
        case 'En Curso': return '#3b82f6'; // azul
        case 'Finalizada': return '#22c55e'; // verde
        default: return '#eab308'; // amarillo
      }
    };

    return (
      <div 
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, orden)}
        style={{
          borderLeft: `4px solid ${getBorderColor()}`,
          backgroundColor: 'white',
          padding: '6px',
          marginBottom: '6px',
          borderRadius: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          cursor: isDraggable ? 'grab' : 'default',
          fontSize: isCompact ? '11px' : '13px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#1f2937' }}>{orden.numero_orden}</strong>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/produccion/ordenes/${orden.id_orden}`); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
            <ExternalLink size={14} />
          </button>
        </div>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px', color: '#4b5563' }} title={orden.producto}>
          {orden.producto}
        </div>
        {!isCompact && (
          <div style={{ marginTop: '4px', color: '#6b7280', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Package size={12} /> 
              {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando..." />;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: '16px', padding: '16px', overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
      
      {/* === SECCIÓN IZQUIERDA: CALENDARIO (OCUPA LA MAYORÍA) === */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        
        {/* Header Calendario */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={24} color="#2563eb" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'capitalize', margin: 0 }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => changeMonth(-1)} className="btn btn-outline btn-sm"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="btn btn-outline btn-sm">Hoy</button>
            <button onClick={() => changeMonth(1)} className="btn btn-outline btn-sm"><ChevronRight size={20} /></button>
          </div>
        </div>

        {/* Días de la Semana (Header Grid) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {daysOfWeek.map(day => (
            <div key={day} style={{ padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
              {day}
            </div>
          ))}
        </div>

        {/* CUADRÍCULA DE DÍAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflowY: 'auto', backgroundColor: '#e5e7eb', gap: '1px' }}>
          {calendarDays.map((dayData, index) => {
            if (!dayData.fullDate) {
              return <div key={`empty-${index}`} style={{ backgroundColor: '#f9fafb', minHeight: '100px' }}></div>;
            }

            const ordenesDelDia = ordenes.filter(o => o.fecha_inicio && o.fecha_inicio.startsWith(dayData.fullDate));
            const isDayToday = isToday(currentDate.getFullYear(), currentDate.getMonth(), dayData.day);

            return (
              <div
                key={dayData.fullDate}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dayData.fullDate)}
                style={{ 
                  backgroundColor: isDayToday ? '#eff6ff' : 'white', 
                  minHeight: '100px', 
                  padding: '4px', 
                  display: 'flex', 
                  flexDirection: 'column' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ 
                    fontSize: '14px', fontWeight: '500', width: '24px', height: '24px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                    backgroundColor: isDayToday ? '#2563eb' : 'transparent',
                    color: isDayToday ? 'white' : '#374151'
                  }}>
                    {dayData.day}
                  </span>
                  {ordenesDelDia.length > 0 && (
                    <span style={{ fontSize: '10px', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '999px', fontWeight: 'bold' }}>
                      {ordenesDelDia.length}
                    </span>
                  )}
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '120px' }}>
                  {ordenesDelDia.map(orden => (
                    <OrdenCard key={orden.id_orden} orden={orden} isCompact={true} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* === SECCIÓN DERECHA: SIDEBAR (LISTA DE PENDIENTES) === */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Package size={20} />
            Pendientes
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Arrastra al calendario para agendar</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#f9fafb' }}>
          {ordenes.filter(o => !o.fecha_inicio).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>No hay órdenes pendientes de agendar</div>
          ) : (
            // FILTRO: Solo mostramos aquí las que NO tienen fecha (Pendientes de agendar)
            // O mostramos todas si prefieres, aquí he puesto un filtro para que veas las "sin fecha"
            ordenes.map(orden => (
              <div key={`sidebar-${orden.id_orden}`} style={{ position: 'relative' }}>
                {orden.fecha_inicio && (
                  <div style={{ 
                    position: 'absolute', top: '-8px', right: '4px', zIndex: 10, 
                    backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '10px', 
                    fontWeight: 'bold', padding: '2px 6px', borderRadius: '999px',
                    border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '2px'
                  }}>
                    <Clock size={10} /> {formatDateShort(orden.fecha_inicio)}
                  </div>
                )}
                <OrdenCard orden={orden} isCompact={false} />
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default CalendarioProduccion;