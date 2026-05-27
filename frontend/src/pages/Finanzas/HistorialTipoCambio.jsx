import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, UploadCloud, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { tipoCambioAPI } from '../../config/api';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import './HistorialTipoCambio.css';

const HistorialTipoCambio = () => {
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
  const today = new Date(dateStr);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  
  const fileInputRef = useRef(null);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const res = await tipoCambioAPI.obtenerHistorial({ mes: currentMonth, anio: currentYear });
      // El interceptor de axios ya devuelve data directo en res, o a veces envuelto.
      // Verificamos si res tiene data y es array, o si res.data es array.
      let dataArray = [];
      if (Array.isArray(res)) dataArray = res;
      else if (res.data && Array.isArray(res.data)) dataArray = res.data;
      else if (res.data && res.data.data && Array.isArray(res.data.data)) dataArray = res.data.data;
      
      setHistorial(dataArray);
    } catch (err) {
      showAlert('error', err.error || 'Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, [currentMonth, currentYear]);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('excel', file);
    formData.append('mes', currentMonth);
    formData.append('anio', currentYear);

    try {
      setUploading(true);
      const res = await tipoCambioAPI.subirHistorialExcel(formData);
      showAlert('success', res.data.message || 'Archivo cargado correctamente');
      fetchHistorial();
    } catch (err) {
      showAlert('error', err.error || 'Error al procesar el archivo Excel');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper para generar el calendario
  const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month - 1, 1).getDay();

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];
    
    // Map data
    const dataMap = {};
    historial.forEach(h => {
        // h.fecha might be an ISO string like "2026-01-01T05:00:00.000Z" from MySQL
        let d;
        if (typeof h.fecha === 'string') {
           // Tomamos solo la parte YYYY-MM-DD para evitar problemas de zona horaria
           const datePart = h.fecha.substring(0, 10);
           d = new Date(datePart + 'T12:00:00').getDate(); // Mediodía para asegurar el mismo día
        } else {
           d = new Date(h.fecha).getDate();
        }
        dataMap[d] = h;
    });

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Rellenar días en blanco al inicio (Ajuste para que Lunes sea 0 o Domingo sea 0 según preferencia, aquí asumimos Domingo=0 de getDay())
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const data = dataMap[day];
      days.push(
        <div key={day} className={`calendar-cell ${data ? 'has-data' : ''}`}>
          <div className="calendar-day-header">{day}</div>
          {data ? (
            <div className="calendar-day-data">
              <div className="tc-row">
                <span className="tc-label">C:</span>
                <span className="tc-value">{data.compra.toFixed(3)}</span>
              </div>
              <div className="tc-row">
                <span className="tc-label">V:</span>
                <span className="tc-value">{data.venta.toFixed(3)}</span>
              </div>
            </div>
          ) : (
             <div className="calendar-day-empty-data">-</div>
          )}
        </div>
      );
    }

    return (
      <div className="calendar-container">
        <div className="calendar-header">
            <button onClick={handlePrevMonth} className="btn-nav"><ChevronLeft size={20}/></button>
            <h3>{monthNames[currentMonth - 1]} {currentYear}</h3>
            <button onClick={handleNextMonth} className="btn-nav"><ChevronRight size={20}/></button>
        </div>
        <div className="calendar-grid-header">
            <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
        </div>
        <div className="calendar-grid">
            {days}
        </div>
      </div>
    );
  };

  return (
    <div className="historial-tc-page">
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert({ ...alert, show: false })}
        />
      )}

      <div className="page-header">
        <div className="header-title">
          <div className="header-icon">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1>Historial Tipo de Cambio SUNAT</h1>
            <p>Visualiza y carga los tipos de cambio mensuales provistos por SUNAT.</p>
          </div>
        </div>
        <div className="header-actions">
           <input 
              type="file" 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handleFileUpload}
           />
           <button 
             className="btn btn-primary" 
             onClick={triggerFileInput}
             disabled={uploading}
           >
              {uploading ? <Loading size="sm" color="white" /> : <FileSpreadsheet size={18} />}
              {uploading ? 'Cargando...' : 'Cargar Excel SUNAT'}
           </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ minHeight: '400px' }}>
          {loading ? (
             <div className="flex justify-center items-center h-64"><Loading size="lg" /></div>
          ) : (
             renderCalendar()
          )}
        </div>
      </div>
      
      <div className="info-box mt-4">
         <div className="flex items-start gap-3 text-sm text-muted">
            <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
               <p className="font-semibold text-white mb-1">Formato de Excel requerido</p>
               <p>El sistema espera que el Excel descargado de la SUNAT tenga al menos las siguientes columnas: <strong>FECHA, TC. COMER., VENTA FP, COMPRA FP</strong>. Los datos deben comenzar en la segunda fila.</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default HistorialTipoCambio;