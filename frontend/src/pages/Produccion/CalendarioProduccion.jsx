import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths,
  parseISO,
  isValid 
} from 'date-fns';
import { es } from 'date-fns/locale';
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

  useEffect(() => {
    cargarOrdenes();
  }, []);

  const cargarOrdenes = async () => {
    try {
      setLoading(true);
      // Obtenemos todas las órdenes
      const response = await ordenesProduccionAPI.getAll({});
      setOrdenes(response.data.data);
    } catch (error) {
      console.error("Error al cargar órdenes", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica del Calendario ---
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // --- Drag & Drop ---
  const handleDragStart = (e, orden) => {
    setDraggedOrden(orden);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(orden));
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    if (!draggedOrden) return;

    const nuevaFecha = format(day, 'yyyy-MM-dd');

    // 1. Actualización Optimista en UI
    const ordenesActualizadas = ordenes.map(o => {
      if (o.id_orden === draggedOrden.id_orden) {
        // Actualizamos la fecha visualmente para programación
        return { ...o, fecha_inicio: nuevaFecha };
      }
      return o;
    });
    
    setOrdenes(ordenesActualizadas);
    setDraggedOrden(null);

    // 2. Aquí deberías guardar la "fecha programada" en el backend
    console.log(`Reprogramando Orden ${draggedOrden.numero_orden} para el día: ${nuevaFecha}`);
    
    // Ejemplo de llamada API (Descomentar cuando tengas el endpoint de reprogramación)
    /*
    try {
        await ordenesProduccionAPI.reprogramar(draggedOrden.id_orden, { fecha_programada: nuevaFecha });
    } catch (err) {
        console.error("Error al guardar programación", err);
        cargarOrdenes(); // Revertir si falla
    }
    */
  };

  // --- Renderizado de Tarjeta de Orden ---
  const OrdenCard = ({ orden, isCompact = false }) => {
    
    const verDetalle = (e) => {
      e.stopPropagation(); // Evita que el click interfiera con el drag
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

    return (
      <div 
        draggable={orden.estado !== 'Finalizada' && orden.estado !== 'Cancelada'}
        onDragStart={(e) => handleDragStart(e, orden)}
        className={`
          relative group p-2 rounded shadow-sm border border-gray-200 
          cursor-grab active:cursor-grabbing hover:shadow-md transition-all
          ${getEstadoColor(orden.estado)}
          ${isCompact ? 'text-xs mb-1' : 'text-sm mb-3'}
        `}
      >
        <div className="flex justify-between items-start">
          <span className="font-bold text-gray-800">{orden.numero_orden}</span>
          
          {/* BOTÓN VER DETALLE */}
          <button 
            onClick={verDetalle}
            className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-gray-100 transition-colors"
            title="Ver Detalle de Orden"
          >
            <ExternalLink size={isCompact ? 14 : 16} />
          </button>
        </div>
        
        <div className={`truncate font-medium ${isCompact ? 'mt-0.5' : 'mt-1'} text-gray-700`} title={orden.producto}>
          {orden.producto}
        </div>

        {!isCompact && (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <div className="flex items-center gap-1">
              <Package size={12} /> 
              {parseFloat(orden.cantidad_planificada).toFixed(2)} {orden.unidad_medida}
            </div>
            <div className="flex items-center gap-1">
              <User size={12} /> 
              {orden.supervisor || 'Sin asignar'}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Loading message="Cargando programación..." />;

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4 p-2"> {/* Ajusta altura según tu layout */}
      
      {/* --- CALENDARIO (IZQUIERDA) --- */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header del Calendario */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <CalendarIcon size={24} />
            </div>
            <h2 className="text-xl font-bold capitalize text-gray-800">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={prevMonth} className="p-1 hover:bg-white hover:shadow rounded-md transition-all text-gray-600">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 text-sm font-semibold text-gray-600 hover:text-blue-600">
              Hoy
            </button>
            <button onClick={nextMonth} className="p-1 hover:bg-white hover:shadow rounded-md transition-all text-gray-600">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Celdas del Calendario */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-gray-200 gap-px overflow-y-auto">
          {calendarDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            
            // Filtramos las órdenes visualmente para este día
            // NOTA: Usamos fecha_inicio como referencia de programación
            const ordenesDelDia = ordenes.filter(o => {
               if (!o.fecha_inicio) return false;
               // Parseamos para comparar solo fecha (ignorando hora si viene en ISO)
               const fechaOrden = format(parseISO(o.fecha_inicio), 'yyyy-MM-dd');
               return fechaOrden === dateStr;
            });

            const esHoy = isSameDay(day, new Date());
            const esMesActual = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toString()}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
                className={`
                  relative flex flex-col min-h-[100px] p-2 transition-colors
                  ${esMesActual ? 'bg-white' : 'bg-gray-50/50'}
                  ${esHoy ? 'bg-blue-50/30' : ''}
                  hover:bg-gray-50
                `}
              >
                {/* Número del día */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`
                    text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                    ${esHoy ? 'bg-blue-600 text-white shadow-sm' : esMesActual ? 'text-gray-700' : 'text-gray-400'}
                  `}>
                    {format(day, 'd')}
                  </span>
                  {ordenesDelDia.length > 0 && (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {ordenesDelDia.length}
                    </span>
                  )}
                </div>

                {/* Contenedor de Órdenes (Scroll interno si hay muchas) */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[120px] scrollbar-thin scrollbar-thumb-gray-200">
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
      <div className="w-80 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Package size={20} />
            Órdenes
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Arrastra al calendario para programar
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
          {ordenes.length === 0 ? (
             <div className="text-center py-10 text-gray-400">
               No hay órdenes
             </div>
          ) : (
             ordenes.map(orden => (
                <div key={`sidebar-${orden.id_orden}`} className="relative">
                   {/* Indicador visual si ya está programada */}
                   {orden.fecha_inicio && (
                      <div className="absolute top-[-8px] right-2 z-10 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 shadow-sm flex items-center gap-1">
                        <Clock size={10} />
                        {isValid(parseISO(orden.fecha_inicio)) 
                           ? format(parseISO(orden.fecha_inicio), 'dd/MMM') 
                           : 'Programada'}
                      </div>
                   )}
                   <OrdenCard orden={orden} />
                </div>
             ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarioProduccion;