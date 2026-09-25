import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { sunatAPI } from '../config/api';

const DescargaMasivaContext = createContext(null);
export const useDescargaMasiva = () => useContext(DescargaMasivaContext);

// ¿El navegador soporta escribir carpetas (File System Access API)?
export const soportaDescargaCarpetas = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// Sanea un nombre para usarlo como carpeta/archivo (quita caracteres inválidos en Windows).
const sanear = (s) => String(s ?? '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'sin-nombre';

const ESTADO_INICIAL = {
  activa: false,
  total: 0,
  hechos: 0,
  actual: '',          // correlativo en curso
  ok: 0,               // comprobantes procesados sin fallo
  fallidos: [],        // [{ documento, error }]
  omitidos: [],        // [{ documento, archivo }] (no existía XML/CDR)
  terminada: false,
  cancelada: false,
  carpeta: '',         // nombre de la carpeta padre
};

export function DescargaMasivaProvider({ children }) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const cancelarRef = useRef(false);

  const cancelar = useCallback(() => { cancelarRef.current = true; }, []);
  const cerrar = useCallback(() => setEstado(ESTADO_INICIAL), []);

  // comprobantes: [{ id_factura, documento, xml_url, cdr_url }]
  // opciones: { pdf: bool, xml: bool, cdr: bool }
  // rango: { desde, hasta }  → para nombrar la carpeta padre
  const iniciarDescarga = useCallback(async (comprobantes, opciones, rango) => {
    if (!soportaDescargaCarpetas()) {
      throw new Error('Tu navegador no permite descargar carpetas. Usa Google Chrome o Microsoft Edge.');
    }
    if (!comprobantes?.length) throw new Error('No hay comprobantes seleccionados.');
    if (!opciones.pdf && !opciones.xml && !opciones.cdr) throw new Error('Elige al menos un tipo de archivo.');

    // 1) Elegir carpeta destino (gesto del usuario). Debe llamarse desde el click.
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

    // 2) Crear la carpeta padre: rango consultado + día de descarga.
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
    const rangoTxt = (rango?.desde && rango?.hasta) ? `${rango.desde}_${rango.hasta}` : hoy;
    const carpetaPadre = sanear(`Comprobantes ${rangoTxt} (descarga ${hoy})`);
    const padre = await dirHandle.getDirectoryHandle(carpetaPadre, { create: true });

    cancelarRef.current = false;
    setEstado({ ...ESTADO_INICIAL, activa: true, total: comprobantes.length, carpeta: carpetaPadre });

    let ok = 0;
    const fallidos = [];
    const omitidos = [];

    // 3) Bucle SECUENCIAL (1 comprobante a la vez → no ahoga Render).
    for (let i = 0; i < comprobantes.length; i++) {
      if (cancelarRef.current) break;
      const c = comprobantes[i];
      const doc = sanear(c.documento || `comprobante-${c.id_factura}`);
      setEstado((e) => ({ ...e, actual: doc, hechos: i }));

      // Crear la subcarpeta del comprobante. Si esto falla, no hay dónde escribir → todo el comprobante falla.
      let sub;
      try {
        sub = await padre.getDirectoryHandle(doc, { create: true });
      } catch (err) {
        console.error(`[descarga] carpeta ${doc}:`, err);
        fallidos.push({ documento: doc, archivo: 'carpeta', error: err?.message || 'no se pudo crear la carpeta' });
        continue;
      }

      // Cada archivo se maneja por separado: un PDF que falla NO impide bajar el XML/CDR.
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
          const blob = await conReintento(t.get);   // reintenta ante fallos transitorios
          await escribir(sub, t.nombre, blob);
          okArchivos += 1;
        } catch (err) {
          falloArchivos += 1;
          console.error(`[descarga] ${doc} ${t.tipo}:`, err);
          fallidos.push({ documento: doc, archivo: t.tipo, error: err?.message || 'error' });
        }
      }

      if (okArchivos > 0 && falloArchivos === 0) ok += 1;
      // Respiro entre comprobantes: alivia la CPU del Render Free si se piden PDFs.
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

// Ejecuta una promesa con reintentos ante fallos transitorios (red, 5xx puntual bajo carga).
async function conReintento(fn, intentos = 2, esperaMs = 500) {
  let ultimo;
  for (let k = 0; k < intentos; k++) {
    try { return await fn(); }
    catch (e) { ultimo = e; if (k < intentos - 1) await new Promise((r) => setTimeout(r, esperaMs)); }
  }
  throw ultimo;
}

// Escribe un blob como archivo dentro de un directorio (File System Access API).
async function escribir(dirHandle, nombre, blob) {
  const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
