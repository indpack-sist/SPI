import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Package, 
  User, 
  ExternalLink,
  Clock,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  XCircle
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

  // --- Lógica de Calendario ---
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
    // Celdas vacías antes del día 1
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, fullDate: null });
    }
    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, fullDate: dateStr });
    }
    // Rellenar celdas al final para completar la cuadrícula (estética)
    const remainingCells = 42 - days.length; 
    for(let i = 0; i < remainingCells; i++) {
        days.push({ day: null, fullDate: null });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // --- Helpers ---
  const isToday = (year, month, day) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  // --- Drag & Drop ---
  const handleDragStart = (e, orden) => {
    setDraggedOrden(orden);
    // IMPORTANTE: Esto asegura que el navegador entienda que estamos moviendo un dato
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!draggedOrden || !dateStr) return;

    // Actualización optimista en UI
    const ordenesActualizadas = ordenes.map(o => {
      if (o.id_orden === draggedOrden.id_orden) {
        return { ...o, fecha_inicio: dateStr };
      }
      return o;
    });
    
    setOrdenes(ordenesActualizadas);
    setDraggedOrden(null);

    try {
      // Guardamos la fecha en la BD
      await ordenesProduccionAPI.update(draggedOrden.id_orden, { fecha_inicio: dateStr });
    } catch (err) {
      console.error("Error al guardar fecha", err);
      cargarOrdenes(); 
      alert("No se pudo agendar la orden.");
    }
  };

  // --- Componente de Tarjeta de Orden ---
  const OrdenCard = ({ orden, compact = false }) => {
    // Lógica para decidir si se puede arrastrar
    // Solo permitimos mover las Pendientes. Las iniciadas/finalizadas se quedan fijas en su día histórico.
    const isDraggable = orden.estado === 'Pendiente' || orden.estado === 'Pendiente Asignación';
    
    // Colores e Iconos según estado
    let borderColor = '#9ca3af'; // Gris
    let IconEstado = AlertCircle;
    
    switch(orden.estado) {
        case 'Pendiente': 
        case 'Pendiente Asignación':
            borderColor = '#f59e0b'; // Amarillo
            IconEstado = Clock;
            break;
        case 'En Curso': 
            borderColor = '#3b82f6'; // Azul
            IconEstado = PlayCircle;
            break;
        case 'En Pausa':
            borderColor = '#f97316'; // Naranja
            IconEstado = PauseCircle;
            break;
        case 'Finalizada': 
            borderColor = '#22c55e'; // Verde
            IconEstado = CheckCircle;
            break;
        case 'Cancelada': 
            borderColor = '#ef4444'; // Rojo
            IconEstado = XCircle;
            break;
    }

    return (
      <div
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, orden)}
        style={{
          backgroundColor: '#fff',
          borderLeft: `4px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '6px',
          marginBottom: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          cursor: isDraggable ? 'grab' : 'default',
          fontSize: '11px',
          opacity: draggedOrden?.id_orden === orden.id_orden ? 0.5 : 1,
          transition: 'transform 0.1s',
          border: '1px solid #e5e7eb',
          borderLeftWidth: '4px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
             {/* Icono pequeño de estado */}
             <IconEstado size={10} color={borderColor} />
             <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{orden.numero_orden}</span>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/produccion/ordenes/${orden.id_orden}`); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
            title="Ver detalle"
          >
            <ExternalLink size={12} />
          </button>
        </div>
        
        <div style={{ 
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
          color: '#475569', margin: '2px 0', fontWeight: '500' 
        }} title={orden.producto}>
          {orden.producto}
        </div>
        
        {!compact && (
          <div style={{ color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Package size={10} /> 
              {parseFloat(orden.cantidad_planificada).toFixed(0)} {orden.unidad_medida}
            </div>
            {orden.supervisor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={10} /> 
                {orden.supervisor.split(' ')[0]} {/* Solo primer nombre */}
                </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando calendario..." />;

  // --- FILTRADO DE LISTAS ---
  
  // 1. Sidebar: Solo órdenes pendientes de asignar fecha y que estén en estado "Pendiente..."
  const ordenesParaSidebar = ordenes.filter(o => {
      const esEstadoPendiente = o.estado === 'Pendiente' || o.estado === 'Pendiente Asignación';
      const noTieneFecha = !o.fecha_inicio;
      return esEstadoPendiente && noTieneFecha;
  });

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'row', // FORZAR FILA: Calendario Izq | Sidebar Der
      height: 'calc(100vh - 80px)', // Altura completa menos el header
      backgroundColor: '#f1f5f9',
      padding: '16px',
      gap: '16px',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>

      {/* --- IZQUIERDA: CALENDARIO (75%) --- */}
      <div style={{ 
        flex: 3, 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        
        {/* Header Mes */}
        <div style={{ 
          padding: '16px', borderBottom: '1px solid #e2e8f0', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px' }}>
                <CalendarIcon color="#2563eb" size={24} />
            </div>
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

        {/* Encabezado Días (Lun-Dom) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', // 7 COLUMNAS ESTRICTAS
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          {daysOfWeek.map(day => (
            <div key={day} style={{ 
              padding: '10px', textAlign: 'center', fontWeight: '600', 
              color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' 
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Rejilla de Días (El cuerpo del calendario) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', // 7 COLUMNAS ESTRICTAS
          gridAutoRows: '1fr', // Filas de igual altura
          flex: 1, // Ocupar resto del espacio vertical
          overflowY: 'auto',
          backgroundColor: '#e2e8f0', // Color de las líneas de la grilla
          gap: '1px' // Grosor de las líneas
        }}>
          {calendarDays.map((item, index) => {
            if (!item.day) {
              // Celdas vacías (días de otro mes)
              return <div key={`empty-${index}`} style={{ backgroundColor: '#f9fafb' }}></div>;
            }

            const isDayToday = isToday(currentDate.getFullYear(), currentDate.getMonth(), item.day);
            
            // FILTRO CALENDARIO: Buscar órdenes para este día (Cualquier estado)
            const ordenesDelDia = ordenes.filter(o => o.fecha_inicio && o.fecha_inicio.startsWith(item.fullDate));

            return (
              <div 
                key={item.fullDate}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item.fullDate)}
                style={{ 
                  backgroundColor: isDayToday ? '#eff6ff' : 'white', 
                  padding: '4px',
                  display: 'flex', 
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: '100px' // Altura mínima por celda
                }}
              >
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '4px'
                }}>
                  <span style={{ 
                    fontWeight: 'bold', fontSize: '14px', 
                    color: isDayToday ? '#2563eb' : '#475569',
                    backgroundColor: isDayToday ? '#dbeafe' : 'transparent',
                    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%'
                  }}>
                    {item.day}
                  </span>
                  {ordenesDelDia.length > 0 && (
                    <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '10px', color: '#64748b', fontWeight: 'bold' }}>
                      {ordenesDelDia.length}
                    </span>
                  )}
                </div>

                {/* Contenedor de órdenes dentro del día (con scroll si hay muchas) */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {ordenesDelDia.map(orden => (
                    <OrdenCard key={orden.id_orden} orden={orden} compact={true} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- DERECHA: SIDEBAR DE PENDIENTES (25%) --- */}
      <div style={{ 
        width: '320px',
        minWidth: '320px',
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        display: 'flex', 
        flexDirection: 'column',
        border: '1px solid #e2e8f0',
        height: '100%'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} /> Por Programar
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            Arrastra al día deseado
          </p>
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '12px', 
          backgroundColor: '#f1f5f9' 
        }}>
          {ordenesParaSidebar.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <CheckCircle size={32} />
              </div>
              <p>Todo programado</p>
            </div>
          ) : (
            ordenesParaSidebar.map(orden => (
              <OrdenCard key={orden.id_orden} orden={orden} />
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default CalendarioProduccion;