import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesProduccionAPI } from '../../../config/api';
import Loading from '../../UI/Loading';
import Alert from '../../UI/Alert';
import { Play, Pause, CheckSquare, Clock, AlertTriangle, UserMinus, Factory, Settings } from 'lucide-react';

const COLUMNAS = [
  { id: 'Pendiente', titulo: 'En Espera (Por Asignar)', color: 'border-steel' },
  { id: 'Programada', titulo: 'Programadas (En Cola)', color: 'border-info' },
  { id: 'En Curso', titulo: 'En Curso (Máquina Corriendo)', color: 'border-primary' },
  { id: 'Pausada', titulo: 'Pausadas', color: 'border-warning' }
];

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

  const procesarOrdenes = () => {
    let filtradas = ordenes;
    if (!mostrarManuales) {
      filtradas = filtradas.filter(o => !o.es_manual);
    }
    
    const agrupadas = {
      'Pendiente': [],
      'Programada': [],
      'En Curso': [],
      'Pausada': []
    };

    filtradas.forEach(orden => {
      if (agrupadas[orden.estado]) {
        agrupadas[orden.estado].push(orden);
      } else if (orden.estado === 'En Espera') {
         // Ajuste por si el estado viene como 'En Espera' en vez de Pendiente
         agrupadas['Pendiente'].push(orden);
      }
    });

    return agrupadas;
  };

  const ordenesAgrupadas = procesarOrdenes();

  return (
    <div className="p-4 md:p-6">
      {loading && <Loading message="Cargando tablero..." />}
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3 tracking-tight text-white">
            <div className="p-2 bg-primary/10 rounded-lg"><Factory size={28} className="text-primary" /></div>
            <span className="uppercase font-barlow">Centro de Control de Producción</span>
          </h1>
          <p className="text-[0.7rem] text-wire uppercase tracking-[0.2em] mt-1">Panel de Supervisor</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-carbon-mid px-4 py-2 rounded border border-steel">
            <input 
              type="checkbox" 
              checked={mostrarManuales} 
              onChange={(e) => setMostrarManuales(e.target.checked)} 
              className="accent-primary"
            />
            <span className="text-xs font-bold text-mist uppercase tracking-widest">Mostrar Históricas / Manuales</span>
          </label>
          <button className="btn btn-primary btn-sm" onClick={cargarOrdenes}>Actualizar</button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
        {COLUMNAS.map(columna => (
          <div key={columna.id} className="min-w-[320px] w-[320px] flex flex-col bg-carbon-mid border border-steel/50 rounded-xl overflow-hidden shadow-lg">
            <div className={`p-3 bg-carbon border-b-4 ${columna.color}`}>
              <h2 className="font-black text-white text-sm uppercase tracking-wider">{columna.titulo}</h2>
              <span className="text-xs text-wire font-bold">{ordenesAgrupadas[columna.id]?.length || 0} Órdenes</span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
              {ordenesAgrupadas[columna.id]?.map(orden => (
                <div 
                  key={orden.id_orden} 
                  className="bg-carbon border border-steel/40 p-4 rounded-lg shadow cursor-pointer hover:border-primary transition-colors"
                  onClick={() => navigate(`/produccion/ordenes/${orden.id_orden}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-primary font-bold text-sm">{orden.numero_orden}</span>
                    {orden.es_manual === 1 && (
                      <span className="bg-warning/20 text-warning text-[10px] px-2 py-0.5 rounded font-black tracking-widest">MANUAL</span>
                    )}
                  </div>
                  
                  <div className="text-mist font-medium text-sm leading-tight mb-3">
                    {orden.producto}
                  </div>

                  <div className="flex justify-between items-center text-xs mb-3 bg-carbon-light p-2 rounded">
                    <div>
                      <div className="text-wire text-[10px] uppercase">Planificado</div>
                      <div className="font-bold text-white">{parseFloat(orden.cantidad_planificada || 0).toFixed(0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-wire text-[10px] uppercase">Producido</div>
                      <div className={`font-bold ${parseFloat(orden.cantidad_producida) !== parseFloat(orden.cantidad_planificada) && orden.estado === 'Finalizada' ? 'text-danger' : 'text-success'}`}>
                        {parseFloat(orden.cantidad_producida || 0).toFixed(0)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {!orden.maquinista ? (
                      <div className="flex items-center gap-1.5 text-danger text-xs font-medium bg-danger/10 p-1 rounded">
                        <UserMinus size={14} /> Sin maquinista asignado
                      </div>
                    ) : (
                      <div className="text-xs text-mist flex items-center gap-1.5">
                         <span className="w-16 text-wire text-[10px] uppercase">Maquinista:</span>
                         <span className="font-bold truncate">{orden.maquinista}</span>
                      </div>
                    )}
                    {orden.turno && (
                       <div className="text-xs text-mist flex items-center gap-1.5">
                         <span className="w-16 text-wire text-[10px] uppercase">Turno:</span>
                         <span className="font-bold">{orden.turno}</span>
                       </div>
                    )}
                  </div>

                  {orden.observaciones && (
                    <div className="mt-3 pt-2 border-t border-steel/30 flex items-start gap-1.5">
                      <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                      <p className="text-[10px] text-wire line-clamp-2 italic" title={orden.observaciones}>
                        {orden.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {(!ordenesAgrupadas[columna.id] || ordenesAgrupadas[columna.id].length === 0) && (
                <div className="text-center p-6 text-wire text-sm font-medium border-2 border-dashed border-steel/30 rounded-lg">
                  No hay órdenes
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
