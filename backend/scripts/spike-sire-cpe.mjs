import axios from 'axios';
import AdmZip from 'adm-zip';
import { sunatConfig } from '../config/sunat.js';

const TOKEN_URL = sunatConfig.urls.GRE_TOKEN.replace('{client_id}', String(sunatConfig.greClientId).trim());

async function token(scope) {
  const body = new URLSearchParams({
    grant_type: 'password',
    scope,
    client_id: String(sunatConfig.greClientId).trim(),
    client_secret: String(sunatConfig.greClientSecret).trim(),
    username: sunatConfig.ruc + sunatConfig.solUser,
    password: sunatConfig.solPass
  });
  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000
  });
  return data.access_token;
}

const periodo = process.argv[2] || '202609';
const SIRE = 'https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv';
const CPE = 'https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe';

function dump(label, obj) {
  console.log(`\n== ${label} ==`);
  console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

(async () => {
  try {
    const tSire = await token('https://api-sire.sunat.gob.pe');
    console.log('OK token SIRE len', tSire.length);

    const solicitar = await axios.get(
      `${SIRE}/libros/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta`,
      { params: { codTipoArchivo: 0, codOrigenEnvio: 1 }, headers: { Authorization: `Bearer ${tSire}` }, timeout: 60000 });
    dump('solicitar propuesta', solicitar.data);
    const numTicket = solicitar.data.numTicket;

    let estado;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const est = await axios.get(
        `${SIRE}/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`,
        { params: { numTicket, perIni: periodo, perFin: periodo, page: 1, perPage: 20 },
          headers: { Authorization: `Bearer ${tSire}` }, timeout: 30000 });
      estado = est.data;
      const reg = (estado.registros || [])[0];
      console.log(`intento ${i} codEstadoProceso=${reg?.codEstadoProceso} archivo=${reg?.archivoReporte || JSON.stringify(reg?.archivos || [])}`);
      if (reg && ['03', '04', '06'].includes(reg.codEstadoProceso)) break;
      if (reg && ['07', '09'].includes(reg.codEstadoProceso)) break;
    }
    dump('estado ticket final', estado);

    const reg = (estado.registros || [])[0];
    const entrada = (reg?.archivoReporte || [])[0];
    const nomArchivo = entrada?.nomArchivoReporte;
    const codTipo = entrada?.codTipoAchivoReporte || '00';
    console.log('\nnomArchivo =', nomArchivo, 'codTipo =', codTipo);

    if (nomArchivo) {
      const combos = [
        { nomArchivoReporte: nomArchivo, codTipoArchivoReporte: codTipo, codLibro: '080000', perTributario: periodo },
        { nomArchivoReporte: nomArchivo, codTipoArchivoReporte: codTipo, codProceso: '10', perTributario: periodo },
        { nomArchivoReporte: nomArchivo, codLibro: '080000' },
        { nomArchivoReporte: nomArchivo },
        { nomArchivoReporte: nomArchivo, codTipoArchivoReporte: codTipo, codLibro: '080000', perTributario: periodo, codProceso: '10', numTicket },
      ];
      const endpoints = [
        `${SIRE}/libros/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`,
        `${SIRE}/libros/rce/propuesta/web/propuesta/${periodo}/archivopropuesta`,
        `${SIRE}/libros/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta/archivo`,
      ];
      let arch = null;
      for (const url of endpoints) {
        for (const params of combos) {
          try {
            const r = await axios.get(url, { params, headers: { Authorization: `Bearer ${tSire}` }, responseType: 'arraybuffer', timeout: 120000 });
            console.log('OK 200 ->', url, JSON.stringify(params));
            arch = r; break;
          } catch (e) {
            const body = e.response?.data ? Buffer.from(e.response.data).toString('utf8').slice(0, 120) : e.message;
            console.log(`  ${e.response?.status} ${url.split('/web/')[1] || url.split('/migeigv/')[1]} ${JSON.stringify(params)} -> ${body}`);
          }
        }
        if (arch) break;
      }
      if (arch) {
        let texto = '';
        try {
          const zip = new AdmZip(Buffer.from(arch.data));
          texto = zip.getEntries().map((en) => en.getData().toString('utf8')).join('\n');
        } catch {
          texto = Buffer.from(arch.data).toString('utf8');
        }
        const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
        dump('primeras 5 lineas del archivo', lineas.slice(0, 5).join('\n'));
        console.log('total lineas =', lineas.length);
        const primera = lineas.find((l) => l.includes('|') && /\|\d{2}\|/.test(l));
        if (primera) {
          const c = primera.split('|');
          console.log('\ncolumnas de la primera fila (indice: valor):');
          c.forEach((v, i) => console.log(`  [${i}] ${v}`));
        }
      } else {
        console.log('Ninguna combinacion devolvio 200.');
      }
    }

    console.log('\n== Credencial de CONSULTA (separada) ==');
    const consultaId = String(process.env.SUNAT_CONSULTA_CLIENT_ID || '').trim();
    const consultaSecret = String(process.env.SUNAT_CONSULTA_CLIENT_SECRET || '').trim();
    if (!consultaId || !consultaSecret) {
      console.log('Faltan SUNAT_CONSULTA_CLIENT_ID / SUNAT_CONSULTA_CLIENT_SECRET en .env. Agregalos y reintenta.');
      process.exit(0);
    }

    const tokenConsulta = async (scope) => {
      const url = `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${consultaId}/oauth2/token`;
      const body = new URLSearchParams({
        grant_type: 'client_credentials', scope, client_id: consultaId, client_secret: consultaSecret
      });
      const { data } = await axios.post(url, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
      return data.access_token;
    };

    const cp = { ruc: '20610334416', tipo: '01', serie: 'E001', numero: '1' };
    const id = `${cp.ruc}-${cp.tipo}-${cp.serie}-${cp.numero}`;

    for (const scope of ['https://api.sunat.gob.pe/v1/contribuyente/contribuyentes', 'https://api-cpe.sunat.gob.pe']) {
      console.log(`\n-- scope ${scope} --`);
      let tk;
      try { tk = await tokenConsulta(scope); console.log('token OK len', tk.length); }
      catch (e) { console.log('token FALLO', e.response?.status, JSON.stringify(e.response?.data || e.message)); continue; }

      try {
        const v = await axios.post(
          `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${sunatConfig.ruc}/validarcomprobante`,
          { numRuc: cp.ruc, codComp: cp.tipo, numeroSerie: cp.serie, numero: cp.numero, fechaEmision: '04/09/2026', monto: '4667.73' },
          { headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, timeout: 30000 });
        console.log('VALIDAR OK 200 ->', JSON.stringify(v.data).slice(0, 300));
      } catch (e) {
        const body = e.response?.data ? (Buffer.isBuffer(e.response.data) ? Buffer.from(e.response.data).toString('utf8') : JSON.stringify(e.response.data)) : e.message;
        console.log(`VALIDAR ${e.response?.status} -> ${String(body).slice(0, 200)}`);
      }

      const C = `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${sunatConfig.ruc}`;
      const paths = [
        `${C}/comprobante/${id}`,
        `${C}/comprobante/${id}/01`,
        `${C}/comprobante/${cp.ruc}/${cp.tipo}/${cp.serie}/${cp.numero}`,
        `${C}/descargacomprobante/${id}`,
        `${C}/descarga/${id}/02`,
        `${C}/comprobante/${id}/xml`,
      ];
      for (const url of paths) {
        try {
          const r = await axios.get(url, { headers: { Authorization: `Bearer ${tk}` }, responseType: 'arraybuffer', timeout: 45000 });
          console.log('CPE OK 200 ->', url, 'ct=', r.headers['content-type'], 'bytes=', r.data.byteLength);
          console.log('inicio:', Buffer.from(r.data).toString('utf8').slice(0, 160));
        } catch (e) {
          const body = e.response?.data ? Buffer.from(e.response.data).toString('utf8').slice(0, 120) : e.message;
          console.log(`CPE ${e.response?.status} ${url.replace('https://','')} -> ${body}`);
        }
      }
    }
  } catch (e) {
    const status = e.response?.status;
    let cuerpo = e.response?.data;
    if (cuerpo instanceof Buffer || cuerpo instanceof ArrayBuffer) cuerpo = Buffer.from(cuerpo).toString('utf8').slice(0, 1000);
    console.error('FALLO', status, typeof cuerpo === 'object' ? JSON.stringify(cuerpo) : cuerpo || e.message);
    process.exit(1);
  }
})();
