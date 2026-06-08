import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, UploadCloud, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, FileSpreadsheet, Edit3 } from 'lucide-react';
import { tipoCambioAPI } from '../../config/api';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
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
  
  // Estado para el modal de edición manual
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState({ fecha: '', compra: '', venta: '' });
  const [savingManual, setSavingManual] = useState(false);

  const fileInputRef = useRef(null);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const res = await tipoCambioAPI.obtenerHistorial({ mes: currentMonth, anio: currentYear });
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
      showAlert('success', res.data?.message || res.message || 'Archivo cargado correctamente');
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

  const handleDayClick = (day, data) => {
    const formattedDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (data) {
      setEditData({ fecha: formattedDate, compra: data.compra, venta: data.venta });
    } else {
      setEditData({ fecha: formattedDate, compra: '', venta: '' });
    }
    setModalOpen(true);
  };

  const handleSaveManual = async (e) => {
    e.preventDefault();
    try {
      setSavingManual(true);
      await tipoCambioAPI.guardarManual({
        fecha: editData.fecha,
        compra: parseFloat(editData.compra),
        venta: parseFloat(editData.venta)
      });
      showAlert('success', 'Tipo de cambio guardado manualmente.');
      setModalOpen(false);
      fetchHistorial();
    } catch (error) {
      showAlert('error', error.error || 'Error al guardar manualmente.');
    } finally {
      setSavingManual(false);
    }
  };

  const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month - 1, 1).getDay();

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];
    
    const dataMap = {};
    historial.forEach(h => {
        let d;
        if (typeof h.fecha === 'string') {
           const datePart = h.fecha.substring(0, 10);
           d = new Date(datePart + 'T12:00:00').getDate();
        } else {
           d = new Date(h.fecha).getDate();
        }
        dataMap[d] = h;
    });

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const data = dataMap[day];
      days.push(
        <div 
          key={day} 
          className={`calendar-cell ${data ? 'has-data' : ''} interactive-cell`}
          onClick={() => handleDayClick(day, data)}
          title="Clic para editar o agregar"
          style={{ cursor: 'pointer' }}
        >
          <div className="calendar-day-header">
            {day}
            <Edit3 size={12} className="edit-icon text-muted opacity-50 ml-auto inline-block" />
          </div>
          {data ? (
            <div className="calendar-day-data">
              <div className="tc-row">
                <span className="tc-label">C:</span>
                <span className="tc-value">{parseFloat(data.compra).toFixed(3)}</span>
              </div>
              <div className="tc-row">
                <span className="tc-label">V:</span>
                <span className="tc-value">{parseFloat(data.venta).toFixed(3)}</span>
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
          <div className="mb-4 text-sm text-muted">
            <em>💡 Tip: Haz clic en cualquier día del calendario para ingresar o editar el tipo de cambio manualmente.</em>
          </div>
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Tipo de Cambio para: ${editData.fecha}`}
      >
        <form onSubmit={handleSaveManual} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Compra</label>
            <input
              type="number"
              step="0.001"
              min="0"
              required
              className="form-control"
              value={editData.compra}
              onChange={(e) => setEditData({ ...editData, compra: e.target.value })}
              placeholder="Ej: 3.750"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Venta</label>
            <input
              type="number"
              step="0.001"
              min="0"
              required
              className="form-control"
              value={editData.venta}
              onChange={(e) => setEditData({ ...editData, venta: e.target.value })}
              placeholder="Ej: 3.780"
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
              disabled={savingManual}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingManual}
            >
              {savingManual ? <Loading size="sm" color="white" /> : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HistorialTipoCambio;