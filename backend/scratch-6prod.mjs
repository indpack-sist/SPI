import { generarGuiaRemisionSunatPDF } from './utils/pdfGenerators/guiaRemisionSunatPDF.js';

const emisor = {
  razon_social: 'INDPACK S.A.C.', ruc: '20550932297',
  direccion: 'AV. EL SOL MZA. LL-1 LOTE. 4 B', urbanizacion: 'COO. LAS VERTIENTES',
  telefono: '013127858', email: 'informes@indpackperu.com'
};
const cliente = { razon_social: 'DANPER TRUJILLO S.A.C.', ruc: '20170040938' };

const detalle = [
  { codigo: 'EPV200G001', nombre: 'ESQUINERO PLASTICO VERDE 0.85 MTS', cantidad: 500, codigo_unidad_sunat: 'NIU' },
  { codigo: 'EPV200G003', nombre: 'ESQUINERO PLASTICO VERDE 0.95 MTS', cantidad: 3000, codigo_unidad_sunat: 'NIU' },
  { codigo: 'EPV200G007', nombre: 'ESQUINERO PLASTICO VERDE 1.03 MTS', cantidad: 2500, codigo_unidad_sunat: 'NIU' },
  { codigo: 'EPV200G011', nombre: 'ESQUINERO PLASTICO VERDE 1.15 MTS', cantidad: 650, codigo_unidad_sunat: 'NIU' },
  { codigo: 'EPV200G051', nombre: 'ESQUINERO PLASTICO VERDE 1.20 MTS', cantidad: 500, codigo_unidad_sunat: 'NIU' },
  { codigo: 'EPV200G031', nombre: 'ESQUINERO PLASTICO VERDE 1.44 MTS', cantidad: 3000, codigo_unidad_sunat: 'NIU' }
];

const paginasDe = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

const pdf = await generarGuiaRemisionSunatPDF({
  guia: {
    serie_sunat: 'TE01', numero_sunat: 7, fecha_emision: '24/09/2026 09:30:00', fecha_traslado: '24/09/2026',
    motivo_traslado_cod: '01', peso_bruto_kg: 2246.5,
    ubigeo_partida: '150142', direccion_partida: 'AV. EL SOL MZA. LL-1 LOTE. 4 B',
    ubigeo_llegada: '040901', direccion_llegada: 'SECCION NRO. E2 --- IRRIGACION MAJES (ALTO LA COLINA) AREQUIPA - CAYLLOMA - MAJES',
    sunat_estado: 'ACEPTADO', observaciones: 'OC: 4600591972'
  },
  emisor, cliente, detalle,
  vehiculos: [{ placa: 'ANA848' }],
  conductor: { nombre_completo: 'GONZALES RUIZ JUAN ARMANDO', dni: '09698047', licencia_conducir: 'Q09698047' }
});
console.log('Paginas:', paginasDe(pdf), '  bytes:', pdf.length);
