import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, UploadCloud, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, FileSpreadsheet, Edit3 } from 'lucide-react';
import { tipoCambioAPI } from '../../config/api';
import Alert from '../../components/UI/Alert';
import Loading from '../../components/UI/Loading';
import Modal from '../../components/UI/Modal';
import './HistorialTipoCambio.css';
import { CalendarCheck, CalendarX, Sigma, ArrowDownToLine, ArrowUpToLine, TrendingUp, PenLine } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { configOrigenTc } from './estadosFinanzas';
import './Finanzas.css';

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const HistorialTipoCambio = () => {
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
  const today = new Date(dateStr);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

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

  const diasDelMes = getDaysInMonth(currentMonth, currentYear);
  const primerDiaSemana = getFirstDayOfMonth(currentMonth, currentYear);
  const esMesActual = currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();
  const esMesPasado = currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth < today.getMonth() + 1);
  const diasTranscurridos = esMesActual ? today.getDate() : esMesPasado ? diasDelMes : 0;
  const nombreMes = monthNames[currentMonth - 1];

  const serieMes = historial
    .map(h => ({
      dia: typeof h.fecha === 'string' ? new Date(h.fecha.substring(0, 10) + 'T12:00:00').getDate() : new Date(h.fecha).getDate(),
      compra: parseFloat(h.compra),
      venta: parseFloat(h.venta)
    }))
    .filter(p => Number.isFinite(p.compra) && Number.isFinite(p.venta))
    .sort((a, b) => a.dia - b.dia);

  const diasConTc = new Set(serieMes.map(p => p.dia));
  const diasSinTc = Array.from({ length: diasTranscurridos }, (_, i) => i + 1).filter(d => !diasConTc.has(d));
  const sinTcHabiles = diasSinTc.filter(d => {
    const w = (primerDiaSemana + d - 1) % 7;
    return w !== 0 && w !== 6;
  }).length;
  const ultimoTc = serieMes[serieMes.length - 1];
  const promedioTc = (campo) => serieMes.reduce((s, p) => s + p[campo], 0) / serieMes.length;
  const extremoTc = (campo, gana) => serieMes.reduce((m, p) => (m === null || gana(p[campo], m[campo]) ? p : m), null);
  const minVenta = extremoTc('venta', (a, b) => a < b);
  const maxVenta = extremoTc('venta', (a, b) => a > b);
  const minCompra = extremoTc('compra', (a, b) => a < b);
  const maxCompra = extremoTc('compra', (a, b) => a > b);
  const hayTc = serieMes.length > 0;
  const tc3 = (v) => v.toFixed(3);

  const kpisTc = [
    {
      id: 'ultimo', label: 'Último del mes', tono: 'is-accent', icon: CalendarCheck,
      valor: hayTc ? <><small>V</small>{tc3(ultimoTc.venta)}</> : '—',
      foot: hayTc ? <>Compra <b>{tc3(ultimoTc.compra)}</b> · {ultimoTc.dia} de {nombreMes.toLowerCase()}</> : 'Sin registros en el mes'
    },
    {
      id: 'promedio', label: 'Promedio', tono: 'is-info', icon: Sigma,
      valor: hayTc ? <><small>V</small>{tc3(promedioTc('venta'))}</> : '—',
      foot: hayTc ? <>Compra <b>{tc3(promedioTc('compra'))}</b> · {serieMes.length} días</> : 'Sin registros en el mes'
    },
    {
      id: 'minimo', label: 'Mínimo', tono: '', icon: ArrowDownToLine,
      valor: hayTc ? <><small>V</small>{tc3(minVenta.venta)}</> : '—',
      foot: hayTc ? <>Día {minVenta.dia} · compra mín. <b>{tc3(minCompra.compra)}</b></> : 'Sin registros en el mes'
    },
    {
      id: 'maximo', label: 'Máximo', tono: '', icon: ArrowUpToLine,
      valor: hayTc ? <><small>V</small>{tc3(maxVenta.venta)}</> : '—',
      foot: hayTc ? <>Día {maxVenta.dia} · compra máx. <b>{tc3(maxCompra.compra)}</b></> : 'Sin registros en el mes'
    },
    {
      id: 'sin-tc', label: 'Días sin TC', tono: diasSinTc.length > 0 ? 'is-warning' : 'is-success', icon: diasSinTc.length > 0 ? CalendarX : CalendarCheck,
      valor: diasTranscurridos === 0 ? '—' : diasSinTc.length,
      foot: diasTranscurridos === 0
        ? 'El mes aún no empieza'
        : diasSinTc.length === 0
          ? `Los ${diasTranscurridos} días transcurridos tienen TC`
          : <>de {diasTranscurridos} transcurridos · <b>{sinTcHabiles}</b> hábiles</>
    }
  ];

  const renderTooltipTc = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const punto = payload[0].payload;
    return (
      <div className="pg-tooltip">
        <strong>{punto.dia} de {nombreMes.toLowerCase()}</strong>
        <div className="pg-tooltip-row" style={{ '--sw-c': 'var(--pg-s1)' }}><i />Venta<b>{tc3(punto.venta)}</b></div>
        <div className="pg-tooltip-row" style={{ '--sw-c': 'var(--pg-s2)' }}><i />Compra<b>{tc3(punto.compra)}</b></div>
      </div>
    );
  };

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

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-cell empty" aria-hidden="true"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const data = dataMap[day];
      const diaSemana = (firstDay + day - 1) % 7;
      const esFinde = diaSemana === 0 || diaSemana === 6;
      const esHoy = esMesActual && day === today.getDate();
      const esFuturo = day > diasTranscurridos;
      const origen = data ? configOrigenTc(data.origen) : null;
      const IconoOrigen = origen?.icon;
      const estadoCelda = data ? 'has-data' : esFuturo ? 'is-future' : 'is-missing';
      const descripcion = data
        ? `compra ${parseFloat(data.compra).toFixed(3)}, venta ${parseFloat(data.venta).toFixed(3)}, ${origen.label}`
        : 'sin tipo de cambio registrado';
      days.push(
        <button
          type="button"
          key={day}
          className={`calendar-cell interactive-cell ${estadoCelda}${esFinde ? ' is-weekend' : ''}${esHoy ? ' is-today' : ''}`}
          onClick={() => handleDayClick(day, data)}
          title="Clic para editar o agregar"
          aria-label={`${day} de ${nombreMes.toLowerCase()}${esHoy ? ', hoy' : ''}${esFinde ? ', fin de semana' : ''}: ${descripcion}. Editar`}
        >
          <span className="calendar-day-header">
            <span className="calendar-day-num">{day}</span>
            {esFinde && <span className="calendar-day-dow">{diaSemana === 0 ? 'Dom' : 'Sáb'}</span>}
            {esHoy && <span className="calendar-day-today">Hoy</span>}
            {IconoOrigen && <span className="calendar-day-origen" title={origen.label}><IconoOrigen size={11} aria-hidden="true" /></span>}
            <Edit3 size={12} className="edit-icon" aria-hidden="true" />
          </span>
          {data ? (
            <span className="calendar-day-data">
              <span className="tc-row">
                <span className="tc-label">C:</span>
                <span className="tc-value">{parseFloat(data.compra).toFixed(3)}</span>
              </span>
              <span className="tc-row">
                <span className="tc-label">V:</span>
                <span className="tc-value">{parseFloat(data.venta).toFixed(3)}</span>
              </span>
            </span>
          ) : (
            <span className="calendar-day-empty-data">
              {esFuturo ? '—' : <><CalendarX size={13} aria-hidden="true" /><span>Sin TC</span></>}
            </span>
          )}
        </button>
      );
    }

    return (
      <div className="calendar-container">
        <div className="calendar-grid-header" aria-hidden="true">
            <div className="is-weekend">Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div className="is-weekend">Sáb</div>
        </div>
        <div className="calendar-grid">
            {days}
        </div>
      </div>
    );
  };

  const compraValida = Number.isFinite(parseFloat(editData.compra));
  const ventaValida = Number.isFinite(parseFloat(editData.venta));

  return (
    <div className="pg-page historial-tc-page">
      <header className="pg-header">
        <div>
          <span className="pg-eyebrow"><CalendarIcon size={13} /> Finanzas</span>
          <h1 className="pg-title">Historial Tipo de Cambio SUNAT</h1>
          <p className="pg-subtitle">Visualiza y carga los tipos de cambio mensuales provistos por SUNAT.</p>
        </div>
        <div className="pg-actions">
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
      </header>

      <div className="pg-stack">
        {alert.show && (
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert({ ...alert, show: false })}
          />
        )}

        <div className="pg-kpis">
          {kpisTc.map(k => {
            const Icono = k.icon;
            return (
              <div key={k.id} className={`pg-kpi ${k.tono}`}>
                <div className="pg-kpi-top">
                  <span className="pg-kpi-label">{k.label}</span>
                  <span className="pg-kpi-icon"><Icono size={16} /></span>
                </div>
                <span className="pg-kpi-value">{k.valor}</span>
                <span className="pg-kpi-foot">{k.foot}</span>
              </div>
            );
          })}
        </div>

        <div className="pg-grid pg-grid-2">
          <section className="pg-panel">
            <div className="pg-panel-head">
              <h2 className="pg-panel-title"><CalendarIcon size={16} /> {nombreMes} {currentYear}</h2>
              <div className="fn-monthnav">
                <span className="pg-panel-meta"><b>{serieMes.length}</b> de {diasDelMes} días con TC</span>
                <button type="button" onClick={handlePrevMonth} className="pg-iconbtn" aria-label="Mes anterior" title="Mes anterior"><ChevronLeft size={16} /></button>
                <button type="button" onClick={handleNextMonth} className="pg-iconbtn" aria-label="Mes siguiente" title="Mes siguiente"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="pg-panel-body fn-cal-body">
              <p className="pg-hint fn-cal-tip"><Edit3 size={12} />Tip: Haz clic en cualquier día del calendario para ingresar o editar el tipo de cambio manualmente.</p>
              {loading ? (
                 <div className="pg-loading fn-cal-loading"><Loading size="lg" /></div>
              ) : (
                 renderCalendar()
              )}
              <ul className="fn-cal-legend" aria-label="Leyenda del calendario">
                <li><span className="fn-cal-key is-today">Hoy</span>Día de hoy</li>
                <li><span className="fn-cal-key is-missing"><CalendarX size={11} /></span>Sin TC registrado</li>
                <li><span className="fn-cal-key is-weekend">Sáb</span>Fin de semana</li>
                <li><FileSpreadsheet size={12} />Excel SUNAT</li>
                <li><PenLine size={12} />Ingreso manual</li>
              </ul>
            </div>
          </section>

          <div className="pg-stack">
            <section className="pg-panel">
              <div className="pg-panel-head">
                <h2 className="pg-panel-title"><TrendingUp size={16} /> Evolución del mes</h2>
                <ul className="pg-legend">
                  <li style={{ '--sw-c': 'var(--pg-s1)' }}><i />Venta</li>
                  <li style={{ '--sw-c': 'var(--pg-s2)' }}><i />Compra</li>
                </ul>
              </div>
              {!hayTc ? (
                <div className="pg-empty fn-chart-empty">
                  <TrendingUp size={28} />
                  <strong>Sin tipos de cambio en {nombreMes.toLowerCase()}</strong>
                  <span>Carga el Excel de SUNAT o registra un día desde el calendario.</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={triggerFileInput} disabled={uploading}>
                    <FileSpreadsheet size={14} /> Cargar Excel SUNAT
                  </button>
                </div>
              ) : (
                <div className="pg-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serieMes} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--pg-grid)" />
                      <XAxis dataKey="dia" type="number" domain={[1, diasDelMes]} allowDecimals={false}
                        tickLine={false} axisLine={{ stroke: 'var(--steel)' }}
                        tick={{ fill: 'var(--pg-axis)', fontSize: 11 }} minTickGap={12} />
                      <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} width={44}
                        tick={{ fill: 'var(--pg-axis)', fontSize: 11 }}
                        tickFormatter={(v) => Number(v).toFixed(2)} />
                      <RechartsTooltip content={renderTooltipTc} cursor={{ stroke: 'var(--steel-light)', strokeWidth: 1 }} />
                      <Line type="monotone" dataKey="venta" name="Venta" stroke="var(--pg-s1)" strokeWidth={2}
                        dot={serieMes.length === 1 ? { r: 4, strokeWidth: 0, fill: 'var(--pg-s1)' } : false}
                        activeDot={{ r: 5, stroke: 'var(--bg-primary)', strokeWidth: 2, fill: 'var(--pg-s1)' }}
                        isAnimationActive={false} />
                      <Line type="monotone" dataKey="compra" name="Compra" stroke="var(--pg-s2)" strokeWidth={2}
                        dot={serieMes.length === 1 ? { r: 4, strokeWidth: 0, fill: 'var(--pg-s2)' } : false}
                        activeDot={{ r: 5, stroke: 'var(--bg-primary)', strokeWidth: 2, fill: 'var(--pg-s2)' }}
                        isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <aside className="fn-note is-warning">
              <AlertTriangle size={16} />
              <div>
                <strong>Formato de Excel requerido</strong>
                <p>El sistema espera que el Excel descargado de la SUNAT tenga al menos las siguientes columnas: <b>FECHA, TC. COMER., VENTA FP, COMPRA FP</b>. Los datos deben comenzar en la segunda fila.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Tipo de Cambio para: ${editData.fecha}`}
      >
        <form onSubmit={handleSaveManual}>
          {alert.show && alert.type === 'error' && (
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert({ ...alert, show: false })}
            />
          )}
          <div className="pg-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="tc-compra">Compra</label>
              <input
                id="tc-compra"
                type="number"
                step="0.001"
                min="0"
                required
                className="form-input fn-num"
                value={editData.compra}
                onChange={(e) => setEditData({ ...editData, compra: e.target.value })}
                placeholder="Ej: 3.750"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tc-venta">Venta</label>
              <input
                id="tc-venta"
                type="number"
                step="0.001"
                min="0"
                required
                className="form-input fn-num"
                value={editData.venta}
                onChange={(e) => setEditData({ ...editData, venta: e.target.value })}
                placeholder="Ej: 3.780"
              />
            </div>
          </div>
          {compraValida && ventaValida && (
            <p className="pg-hint">Diferencia venta − compra: <b className="fn-num">{(parseFloat(editData.venta) - parseFloat(editData.compra)).toFixed(3)}</b></p>
          )}
          <p className="pg-hint"><PenLine size={11} />Se guarda como ingreso manual y reemplaza el valor registrado para esa fecha.</p>
          <div className="pg-modal-actions">
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
