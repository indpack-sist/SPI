import { listarComprasPeriodo } from '../services/sunat/sire-compras.service.js';
import { filaATabla } from '../services/sunat/sire-compras.parser.js';
import { generarComprasSireXLSX } from '../utils/excelGenerators/comprasSireXLSX.js';

export const listar = async (req, res) => {
  try {
    const filas = await listarComprasPeriodo(req.query.periodo);
    const data = filas.map(filaATabla);
    res.json({ success: true, data, resumen: { total: data.length } });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
};

export const exportarExcel = async (req, res) => {
  try {
    const periodo = req.query.periodo;
    const filas = await listarComprasPeriodo(periodo);
    const buffer = await generarComprasSireXLSX(filas, periodo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="compras-sunat-${periodo}.xlsx"`);
    res.send(buffer);
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
};
