/**
 * Resuelve los datos del emisor según el ambiente.
 * Beta -> emisor de pruebas (homologación SUNAT). Producción -> empresa_config.
 */
import { pool } from '../../config/database.js';
import { AMBIENTE } from './config.js';

export const EMISOR_BETA = {
  ruc: '20000000001',
  razonSocial: 'EMPRESA DE PRUEBA SEE',
  nombreComercial: 'EMPRESA DE PRUEBA SEE',
  ubigeo: '150101',
  direccion: 'AV. PRUEBA 123',
  distrito: 'LIMA',
  provincia: 'LIMA',
  departamento: 'LIMA',
};

export async function getEmisor() {
  if (AMBIENTE !== 'produccion') return EMISOR_BETA;
  const [[c]] = await pool.query('SELECT * FROM empresa_config WHERE id=1');
  if (!c) throw new Error('empresa_config no configurada para Producción');
  return {
    ruc: c.ruc,
    razonSocial: c.razon_social,
    nombreComercial: c.nombre_comercial || c.razon_social,
    ubigeo: c.ubigeo,
    direccion: c.direccion,
    distrito: c.distrito,
    provincia: c.provincia,
    departamento: c.departamento,
  };
}
