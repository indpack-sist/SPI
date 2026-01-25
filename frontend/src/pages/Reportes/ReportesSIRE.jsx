import { useState } from 'react';
import { FileText, Download, Filter, Search } from 'lucide-react';
import * as XLSX from 'xlsx'; // Necesitas instalar: npm install xlsx
import { api } from '../../config/api';
import Loading from '../../components/UI/Loading';
import Alert from '../../components/UI/Alert';

function ReportesSIRE() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [tipoReporte, setTipoReporte] = useState('ventas'); // 'ventas' o 'compras'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const meses = [
    { id: 1, nombre: 'Enero' }, { id: 2, nombre: 'Febrero' }, { id: 3, nombre: 'Marzo' },
    { id: 4, nombre: 'Abril' }, { id: 5, nombre: 'Mayo' }, { id: 6, nombre: 'Junio' },
    { id: 7, nombre: 'Julio' }, { id: 8, nombre: 'Agosto' }, { id: 9, nombre: 'Septiembre' },
    { id: 10, nombre: 'Octubre' }, { id: 11, nombre: 'Noviembre' }, { id: 12, nombre: 'Diciembre' }
  ];

  const handleConsultar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const endpoint = tipoReporte === 'ventas' 
        ? `/reportes/sire/ventas?mes=${mes}&anio=${anio}`
        : `/reportes/sire/compras?mes=${mes}&anio=${anio}`;
      
      const response = await api.get(endpoint);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      console.error(err);
      setError('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    if (data.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SIRE");
    XLSX.writeFile(wb, `Reporte_SIRE_${tipoReporte}_${mes}_${anio}.xlsx`);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <FileText className="text-primary" /> Reportes Tributarios SIRE
      </h1>

      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={handleConsultar} className="flex flex-wrap gap-4 items-end">
            <div className="form-group w-40">
              <label className="form-label">Tipo de Registro</label>
              <select 
                className="form-select"
                value={tipoReporte}
                onChange={(e) => { setTipoReporte(e.target.value); setData([]); }}
              >
                <option value="ventas">RVIE (Ventas)</option>
                <option value="compras">RCE (Compras)</option>
              </select>
            </div>

            <div className="form-group w-32">
              <label className="form-label">Mes</label>
              <select className="form-select" value={mes} onChange={(e) => setMes(e.target.value)}>
                {meses.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>

            <div className="form-group w-24">
              <label className="form-label">Año</label>
              <input 
                type="number" 
                className="form-input" 
                value={anio} 
                onChange={(e) => setAnio(e.target.value)} 
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={18} className="mr-2" /> Consultar
            </button>

            {data.length > 0 && (
              <button type="button" className="btn btn-success ml-auto" onClick={exportarExcel}>
                <Download size={18} className="mr-2" /> Exportar Excel
              </button>
            )}
          </form>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      
      {loading ? <Loading message="Generando reporte..." /> : (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Vista Previa ({data.length} registros)</h3>
          </div>
          <div className="card-body p-0 overflow-x-auto">
            {data.length > 0 ? (
              <table className="table table-sm text-xs">
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Emisión</th>
                    <th>Tipo</th>
                    <th>Serie</th>
                    <th>Número</th>
                    <th>Doc. Ident.</th>
                    <th>Razón Social</th>
                    <th className="text-right">Base Imp.</th>
                    <th className="text-right">IGV</th>
                    <th className="text-right">Total</th>
                    <th>Moneda</th>
                    <th>TC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className={row.estado_sunat === '2' ? 'bg-red-50 text-red-800' : ''}>
                      <td>{row.periodo}</td>
                      <td>{row.fecha_emision}</td>
                      <td>{row.tipo_comprobante}</td>
                      <td>{row.serie}</td>
                      <td>{row.numero}</td>
                      <td>{row.num_doc_cliente || row.num_doc_proveedor}</td>
                      <td className="truncate max-w-[200px]">{row.razon_social}</td>
                      <td className="text-right">{parseFloat(row.base_imponible).toFixed(2)}</td>
                      <td className="text-right">{parseFloat(row.igv).toFixed(2)}</td>
                      <td className="text-right font-bold">{parseFloat(row.total).toFixed(2)}</td>
                      <td>{row.moneda}</td>
                      <td>{parseFloat(row.tipo_cambio).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-muted">
                No hay datos para el periodo seleccionado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportesSIRE;