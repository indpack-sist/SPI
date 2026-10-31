import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { zipSync } from 'fflate';
import { sunatAPI, dispararDescarga } from '../config/api';

const DescargaMasivaContext = createContext(null);
export const useDescargaMasiva = () => useContext(DescargaMasivaContext);

export const soportaDescargaCarpetas = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const sanear = (s) => String(s ?? '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'sin-nombre';

const ESTADO_INICIAL = {
  activa: false,
  total: 0,
  hechos: 0,
  actual: '',
  ok: 0,
  fallidos: [],
  omitidos: [],
  terminada: false,
  cancelada: false,
  carpeta: '',
  archivoZip: '',
};

export function DescargaMasivaProvider({ children }) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const cancelarRef = useRef(false);

  const cancelar = useCallback(() => { cancelarRef.current = true; }, []);
  const cerrar = useCallback(() => setEstado(ESTADO_INICIAL), []);

  const iniciarDescarga = useCallback(async (comprobantes, opciones, rango) => {
    if (!comprobantes?.length) throw new Error('No hay comprobantes seleccionados.');
    if (!opciones.pdf && !opciones.xml && !opciones.cdr) throw new Error('Elige al menos un tipo de archivo.');

    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const rangoTxt = (rango?.desde && rango?.hasta) ? `${rango.desde}_${rango.hasta}` : hoy;
    const carpetaPadre = sanear(`Comprobantes ${rangoTxt} (descarga ${hoy})`);
    const destino = await crearDestino(carpetaPadre);

    cancelarRef.current = false;
    setEstado({ ...ESTADO_INICIAL, activa: true, total: comprobantes.length, carpeta: carpetaPadre });

    let ok = 0;
    const fallidos = [];
    const omitidos = [];

    for (let i = 0; i < comprobantes.length; i++) {
      if (cancelarRef.current) break;
      const c = comprobantes[i];
      const doc = sanear(c.documento || `comprobante-${c.id_factura}`);
      setEstado((e) => ({ ...e, actual: doc, hechos: i }));

      let sub;
      try {
        sub = await destino.subcarpeta(doc);
      } catch (err) {
        console.error(`[descarga] carpeta ${doc}:`, err);
        fallidos.push({ documento: doc, archivo: 'carpeta', error: err?.message || 'no se pudo crear la carpeta' });
        continue;
      }

      const tareas = [];
      if (opciones.pdf) tareas.push({ tipo: 'PDF', nombre: `${doc}.pdf`, get: () => sunatAPI.obtenerBlobPdfComprobante(c.id_factura) });
      if (opciones.xml) {
        if (c.xml_url) tareas.push({ tipo: 'XML', nombre: `${doc}.xml`, get: () => sunatAPI.obtenerBlobDesdeUrl(c.xml_url) });
        else omitidos.push({ documento: doc, archivo: 'XML' });
      }
      if (opciones.cdr) {
        if (c.cdr_url) tareas.push({ tipo: 'CDR', nombre: `R-${doc}.zip`, get: () => sunatAPI.obtenerBlobDesdeUrl(c.cdr_url) });
        else omitidos.push({ documento: doc, archivo: 'CDR' });
      }

      let okArchivos = 0;
      let falloArchivos = 0;
      for (const t of tareas) {
        if (cancelarRef.current) break;
        try {
          const blob = await conReintento(t.get);
          await sub(t.nombre, blob);
          okArchivos += 1;
        } catch (err) {
          falloArchivos += 1;
          console.error(`[descarga] ${doc} ${t.tipo}:`, err);
          fallidos.push({ documento: doc, archivo: t.tipo, error: err?.message || 'error' });
        }
      }

      if (okArchivos > 0 && falloArchivos === 0) ok += 1;
      await new Promise((r) => setTimeout(r, 150));
    }

    let archivoZip = '';
    try {
      archivoZip = await destino.cerrar();
    } catch (err) {
      ok = 0;
      fallidos.push({ documento: carpetaPadre, archivo: 'ZIP', error: err?.message || 'no se pudo generar el ZIP' });
    }

    setEstado((e) => ({
      ...e,
      activa: false,
      terminada: true,
      cancelada: cancelarRef.current,
      hechos: comprobantes.length,
      actual: '',
      ok,
      fallidos,
      omitidos,
      archivoZip,
    }));
  }, []);

  const iniciarDescargaCompras = useCallback(async (comprobantes, periodo) => {
    if (!comprobantes?.length) throw new Error('No hay comprobantes para descargar.');

    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const carpetaPadre = sanear(`Compras ${periodo} (descarga ${hoy})`);
    const destino = await crearDestino(carpetaPadre);

    cancelarRef.current = false;
    setEstado({ ...ESTADO_INICIAL, activa: true, total: comprobantes.length, carpeta: carpetaPadre });

    let ok = 0;
    const fallidos = [];
    const omitidos = [];
    const glosas = {};
    const claves = comprobantes.map((c) => `${c.rucProveedor}-${c.tipoCP}-${c.serie}-${c.numero}`);

    for (let i = 0; i < comprobantes.length; i++) {
      if (cancelarRef.current) break;
      const c = comprobantes[i];
      const clave = `${c.rucProveedor}-${c.tipoCP}-${c.serie}-${c.numero}`;
      const doc = sanear(clave);
      setEstado((e) => ({ ...e, actual: doc, hechos: i }));

      try {
        const res = await sunatAPI.obtenerComprobanteCompra({
          ruc: c.rucProveedor, tipo: c.tipoCP, serie: c.serie, numero: c.numero
        });
        const data = res.data?.data || {};
        glosas[clave] = data.glosa || '';

        if (!data.xml && !data.pdf) {
          omitidos.push({ documento: doc, archivo: 'XML/PDF' });
          continue;
        }
        const sub = await destino.subcarpeta(doc);
        if (data.xml) await sub(data.xml.nombre, base64ABlob(data.xml.base64, 'application/xml'));
        else omitidos.push({ documento: doc, archivo: 'XML' });
        if (data.pdf) await sub(data.pdf.nombre, base64ABlob(data.pdf.base64, 'application/pdf'));
        else omitidos.push({ documento: doc, archivo: 'PDF' });
        ok += 1;
      } catch (err) {
        console.error(`[compras] ${doc}:`, err);
        fallidos.push({ documento: doc, archivo: 'comprobante', error: err?.error || err?.message || 'SUNAT no entregó el comprobante' });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    if (!cancelarRef.current) {
      try {
        setEstado((e) => ({ ...e, actual: 'Generando Excel con glosa…' }));
        const blob = await sunatAPI.obtenerBlobExcelCompras(periodo, glosas, claves);
        await destino.escribir(`compras-sunat-${periodo}.xlsx`, blob);
      } catch (err) {
        fallidos.push({ documento: `compras-sunat-${periodo}.xlsx`, archivo: 'Excel', error: err?.message || 'error' });
      }
    }

    let archivoZip = '';
    try {
      archivoZip = await destino.cerrar();
    } catch (err) {
      ok = 0;
      fallidos.push({ documento: carpetaPadre, archivo: 'ZIP', error: err?.message || 'no se pudo generar el ZIP' });
    }

    setEstado((e) => ({
      ...e, activa: false, terminada: true, cancelada: cancelarRef.current,
      hechos: comprobantes.length, actual: '', ok, fallidos, omitidos, archivoZip
    }));
  }, []);

  return (
    <DescargaMasivaContext.Provider value={{ estado, iniciarDescarga, iniciarDescargaCompras, cancelar, cerrar }}>
      {children}
    </DescargaMasivaContext.Provider>
  );
}

function base64ABlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function conReintento(fn, intentos = 2, esperaMs = 500) {
  let ultimo;
  for (let k = 0; k < intentos; k++) {
    try { return await fn(); }
    catch (e) { ultimo = e; if (k < intentos - 1) await new Promise((r) => setTimeout(r, esperaMs)); }
  }
  throw ultimo;
}

function crearDestino(nombre) {
  return soportaDescargaCarpetas() ? crearDestinoCarpeta(nombre) : crearDestinoZip(nombre);
}

async function crearDestinoCarpeta(nombre) {
  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  const padre = await dirHandle.getDirectoryHandle(nombre, { create: true });
  return {
    subcarpeta: async (sub) => {
      const dir = await padre.getDirectoryHandle(sub, { create: true });
      return (archivo, blob) => escribir(dir, archivo, blob);
    },
    escribir: (archivo, blob) => escribir(padre, archivo, blob),
    cerrar: async () => '',
  };
}

function crearDestinoZip(nombre) {
  const archivos = {};
  const agregar = async (ruta, blob) => {
    archivos[`${nombre}/${ruta}`] = new Uint8Array(await blob.arrayBuffer());
  };
  return {
    subcarpeta: async (sub) => (archivo, blob) => agregar(`${sub}/${sanear(archivo)}`, blob),
    escribir: (archivo, blob) => agregar(sanear(archivo), blob),
    cerrar: async () => {
      if (!Object.keys(archivos).length) return '';
      const nombreZip = `${nombre}.zip`;
      dispararDescarga(new Blob([zipSync(archivos, { level: 0 })], { type: 'application/zip' }), nombreZip);
      return nombreZip;
    },
  };
}

async function escribir(dirHandle, nombre, blob) {
  const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
