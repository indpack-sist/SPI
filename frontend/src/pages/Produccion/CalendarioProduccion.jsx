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

  // --- Nombres de días y meses (Español) ---
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
      // Aseguramos que sea un array
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setOrdenes(data);
    } catch (error) {
      console.error("Error al cargar órdenes", error);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Fecha Nativa ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  
  const getFirstDayOfMonth = (year, month) => {
    // 0 = Domingo, 1 = Lunes ... 6 = Sábado
    const day = new Date(year, month, 1).getDay();
    // Ajustar para que Lunes sea 0 y Domingo 6 (para el grid)
    return day === 0 ? 6 : day - 1;
  };

  const changeMonth = (increment) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  // Generar array de días para el calendario
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month); // Días vacíos al inicio
    
    const days = [];
    
    // Días vacíos del mes anterior
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, fullDate: null, isCurrentMonth: false });
    }
    
    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      // Crear fecha segura manejando zona horaria local
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ 
        day: i, 
        fullDate: dateStr, 
        isCurrentMonth: true 
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // --- Helpers de Fecha ---
  const isToday = (year, month, day) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '';
    // Asumimos formato YYYY-MM-DD
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}`;
  };

  // --- Drag & Drop ---
  const handleDragStart = (e, orden) => {
    setDraggedOrden(orden);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requiere setData
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!draggedOrden || !dateStr) return;

    // 1. Actualización Optimista
    const ordenesActualizadas = ordenes.map(o => {
      if (o.id_orden === draggedOrden.id_orden) {
        return { ...o, fecha_inicio: dateStr };
      }
      return o;
    });
    
    setOrdenes(ordenesActualizadas);
    setDraggedOrden(null);

    // 2. Guardar en Backend
    console.log(`Reprogramando Orden ${draggedOrden.numero_orden} para: ${dateStr}`);
    try {
      // NOTA: Asegúrate de que tu ordenesProduccionAPI.update exista en api.js
      await ordenesProduccionAPI.update(draggedOrden.id_orden, { 
        fecha_inicio: dateStr 
      });
    } catch (err) {
      console.error("Error al guardar fecha", err);
      // Revertir cambios en caso de error (opcional: recargar datos)
      cargarOrdenes(); 
      alert("Error al actualizar la fecha en el servidor");
    }
  };

  // --- Componente Tarjeta ---
  const OrdenCard = ({ orden, isCompact = false }) => {
    const verDetalle = (e) => {
      e.stopPropagation();
      navigate(`/produccion/ordenes/${orden.id_orden}`);
    };

    const getEstadoColor = (estado) => {
      switch (estado) {
        case 'Pendiente': return 'border-l-4 border-l-gray-400 bg-white';
        case 'En Curso': return 'border-l-4 border-l-blue-500 bg-blue-50';
        case 'Finalizada': return 'border-l-4 border-l-green-500 bg-green-50 opacity-75';
        case 'Cancelada': return 'border-l-4 border-l-red-500 bg-red-50 opacity-60';
        default: return 'border-l-4 border-l-yellow-500 bg-yellow-50';
      }
    };

    // No permitir arrastrar si está finalizada o cancelada
    const isDraggable = orden.estado !== 'Finalizada' && orden.estado !== 'Cancelada';

    return (
      <div 
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, orden)}
        className={`
          relative group p-2 rounded shadow-sm border border-gray-200 
          ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default'} 
          transition-all
          ${getEstadoColor(orden.estado)}
          text-sm mb-2 w-full
        `}
      >
        <div className="flex justify-between items-start w-full">
          <span className="font-bold text-gray-800 text-xs">{orden.numero_orden}</span>
          
          <button 
            onClick={verDetalle}
            className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
            title="Ver Detalle"
          >
            <ExternalLink size={14} />
          </button>
        </div>
        
        <div className="truncate font-medium mt-1 text-gray-700 text-xs w-full" title={orden.producto}>
          {orden.producto}
        </div>

        {!isCompact && (
          <div className="mt-2 text-[10px] text-gray-500 space-y-1">
            <div className="flex items-center gap-1">
              <Package size={10} className="shrink-0" /> 
              <span className="truncate">
                {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <User size={10} className="shrink-0" /> 
              <span className="truncate">
                {orden.supervisor || 'Sin asignar'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando calendario..." />;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-4 p-2 overflow-hidden">
      
      {/* --- CALENDARIO (IZQUIERDA) --- */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0">
        
        {/* Header del Calendario */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <CalendarIcon size={24} />
            </div>
            <h2 className="text-xl font-bold capitalize text-gray-800">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white hover:shadow rounded-md transition-all text-gray-600">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 text-sm font-semibold text-gray-600 hover:text-blue-600">
              Hoy
            </button>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white hover:shadow rounded-md transition-all text-gray-600">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0">
          {daysOfWeek.map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Celdas del Calendario */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-gray-200 gap-px overflow-y-auto">
          {calendarDays.map((dayData, index) => {
            if (!dayData.fullDate) {
              return <div key={`empty-${index}`} className="bg-gray-50/50 min-h-[100px]"></div>;
            }

            // Filtrar órdenes para este día (Comparación de Strings YYYY-MM-DD)
            const ordenesDelDia = ordenes.filter(o => {
               if (!o.fecha_inicio) return false;
               return o.fecha_inicio.startsWith(dayData.fullDate);
            });

            const isDayToday = isToday(currentDate.getFullYear(), currentDate.getMonth(), dayData.day);

            return (
              <div
                key={dayData.fullDate}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dayData.fullDate)}
                className={`
                  relative flex flex-col min-h-[100px] p-1 transition-colors bg-white
                  ${isDayToday ? 'bg-blue-50/30' : ''}
                  hover:bg-gray-50
                `}
              >
                {/* Número del día */}
                <div className="flex justify-between items-start mb-1 px-1">
                  <span className={`
                    text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isDayToday ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700'}
                  `}>
                    {dayData.day}
                  </span>
                  {ordenesDelDia.length > 0 && (
                    <span className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {ordenesDelDia.length}
                    </span>
                  )}
                </div>

                {/* Contenedor de Órdenes */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[120px] scrollbar-thin scrollbar-thumb-gray-200 px-1">
                  {ordenesDelDia.map(orden => (
                    <OrdenCard key={orden.id_orden} orden={orden} isCompact={true} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- LISTA DE ÓRDENES (DERECHA) --- */}
      <div className="w-full md:w-80 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden shrink-0 h-full">
        <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Package size={20} />
            Órdenes
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Arrastra al calendario para programar
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
          {ordenes.length === 0 ? (
             <div className="text-center py-10 text-gray-400">
               No hay órdenes
             </div>
          ) : (
             ordenes.map(orden => (
                <div key={`sidebar-${orden.id_orden}`} className="relative group">
                   {/* Indicador visual si ya está programada */}
                   {orden.fecha_inicio && (
                      <div className="absolute top-[-6px] right-1 z-10 bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-blue-200 shadow-sm flex items-center gap-1">
                        <Clock size={8} />
                        {formatDateShort(orden.fecha_inicio)}
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