import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { sunatAPI } from '../config/api';

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
};

export function DescargaMasivaProvider({ children }) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const cancelarRef = useRef(false);

  const cancelar = useCallback(() => { cancelarRef.current = true; }, []);
  const cerrar = useCallback(() => setEstado(ESTADO_INICIAL), []);

  const iniciarDescarga = useCallback(async (comprobantes, opciones, rango) => {
    if (!soportaDescargaCarpetas()) {
      throw new Error('Tu navegador no permite descargar carpetas. Usa Google Chrome o Microsoft Edge.');
    }
    if (!comprobantes?.length) throw new Error('No hay comprobantes seleccionados.');
    if (!opciones.pdf && !opciones.xml && !opciones.cdr) throw new Error('Elige al menos un tipo de archivo.');

    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const rangoTxt = (rango?.desde && rango?.hasta) ? `${rango.desde}_${rango.hasta}` : hoy;
    const carpetaPadre = sanear(`Comprobantes ${rangoTxt} (descarga ${hoy})`);
    const padre = await dirHandle.getDirectoryHandle(carpetaPadre, { create: true });

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
        sub = await padre.getDirectoryHandle(doc, { create: true });
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
          await escribir(sub, t.nombre, blob);
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
    }));
  }, []);

  return (
    <DescargaMasivaContext.Provider value={{ estado, iniciarDescarga, cancelar, cerrar }}>
      {children}
    </DescargaMasivaContext.Provider>
  );
}

async function conReintento(fn, intentos = 2, esperaMs = 500) {
  let ultimo;
  for (let k = 0; k < intentos; k++) {
    try { return await fn(); }
    catch (e) { ultimo = e; if (k < intentos - 1) await new Promise((r) => setTimeout(r, esperaMs)); }
  }
  throw ultimo;
}

async function escribir(dirHandle, nombre, blob) {
  const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
