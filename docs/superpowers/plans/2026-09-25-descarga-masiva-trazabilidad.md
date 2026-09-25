# Descarga masiva de comprobantes (Trazabilidad SEE) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a Trazabilidad SEE una pestaña de consulta por rango de fechas + descarga masiva de comprobantes (PDF/XML/CDR) organizada en carpetas locales, ejecutada en segundo plano sin bloquear la navegación.

**Architecture:** Frontend-first. Un `DescargaMasivaProvider` (Context) montado en el root ejecuta un bucle **secuencial** que escribe archivos a disco con la File System Access API. Reúsa el endpoint existente `GET /sunat/trazabilidad/comprobantes` (único cambio backend: filtro `solo_sistema`). XML/CDR salen de Cloudinary (no tocan Render); PDF de `GET /sunat/comprobantes/:id/pdf` (pdfkit, ligero).

**Tech Stack:** React 18 + Vite, react-router-dom, lucide-react, File System Access API (`showDirectoryPicker`), Express + mysql2 (`pool.query`).

> **Nota de verificación:** el proyecto **no tiene framework de test frontend** (sin vitest/jest) y los tests backend son scripts a medida con BD. Por eso este plan **no usa TDD clásico**; cada tarea cierra con `npm run build` (que valida sintaxis/imports) + un smoke manual en Chrome/Edge y un commit. No se inventa infraestructura de test nueva.

> **Nota de commits:** el usuario commitea a mano en `main`. Los pasos "Commit" quedan como sugerencia; el ejecutor NO debe commitear salvo que el usuario lo pida. Trabajar siempre sobre `main`.

---

## Estructura de archivos

**Nuevos:**
- `frontend/src/context/DescargaMasivaContext.jsx` — provider, cola, progreso, bucle secuencial, escritura a disco.
- `frontend/src/components/Descargas/WidgetDescargaMasiva.jsx` — widget flotante de progreso (root).
- `frontend/src/components/Descargas/WidgetDescargaMasiva.css` — estilos del widget (tokens de tema).
- `frontend/src/components/Descargas/ModalDescargaMasiva.jsx` — modal de selección PDF/XML/CDR.
- `frontend/src/components/Descargas/ModalDescargaMasiva.css` — estilos del modal (tokens de tema).

**Modificados:**
- `backend/controllers/trazabilidad-see.controller.js` — filtro `solo_sistema`.
- `frontend/src/config/api.js` — helpers de blob (PDF/XML/CDR) para el bucle.
- `frontend/src/App.jsx` — montar `DescargaMasivaProvider` + widget en el root.
- `frontend/src/pages/Facturacion/TrazabilidadSee.jsx` — nueva pestaña "Descarga masiva".
- `frontend/src/pages/Facturacion/TrazabilidadSee.css` — estilos de la tabla nueva.

---

## Task 1: Backend — filtro `solo_sistema` en comprobantes

**Files:**
- Modify: `backend/controllers/trazabilidad-see.controller.js` (función `listarComprobantes`, ~L47-67)

Excluye las facturas manuales/legacy previas a la integración SEE. "Manual/legacy" = sin fila SUNAT: `codigo_tipo_sunat IS NULL AND sunat_estado IS NULL` (coincide con el cálculo de `es_manual` del propio controller). Cuando la query trae `solo_sistema=1`, solo quedan comprobantes con emisión electrónica real (incluye RECHAZADO/OBSERVADO/ENVIADO/PENDIENTE).

- [ ] **Step 1: Leer los parámetros y agregar el filtro**

En `listarComprobantes`, cambiar la desestructuración de `req.query` para incluir `solo_sistema`:

```javascript
const { tipo = 'all', estado = 'all', desde, hasta, q, solo_sistema } = req.query;
```

Y justo **después** del bloque de `tipo` (después de la línea que maneja `NOTA_DEBITO`, antes del bloque `if (estado ...)`), agregar:

```javascript
// solo_sistema=1 → únicamente comprobantes emitidos electrónicamente desde el sistema
// (excluye las facturas manuales/legacy cargadas antes de la integración SEE).
if (String(solo_sistema) === '1') {
  where.push(`NOT (fv.codigo_tipo_sunat IS NULL AND fv.sunat_estado IS NULL)`);
}
```

- [ ] **Step 2: Verificar que el backend arranca sin errores de sintaxis**

Run: `node --check backend/controllers/trazabilidad-see.controller.js`
Expected: sin salida (exit 0) = sintaxis válida.

- [ ] **Step 3: Smoke manual del endpoint (con backend corriendo)**

Con el backend en marcha y un token válido, comparar conteos:

```
GET /api/sunat/trazabilidad/comprobantes?desde=2026-08-01&hasta=2026-09-30
GET /api/sunat/trazabilidad/comprobantes?desde=2026-08-01&hasta=2026-09-30&solo_sistema=1
```
Expected: la segunda devuelve ≤ que la primera; en la segunda, ningún ítem con `es_manual === true`.

- [ ] **Step 4: Commit (solo si el usuario lo pide)**

```bash
git add backend/controllers/trazabilidad-see.controller.js
git commit -m "feat(trazabilidad): filtro solo_sistema en comprobantes"
```

---

## Task 2: API — helpers de blob para el bucle de descarga

**Files:**
- Modify: `frontend/src/config/api.js` (dentro del objeto `sunatAPI`, junto a `verPdfComprobante` ~L1357)

El bucle de descarga necesita **obtener el contenido** (blob) de cada archivo sin dispararlo al navegador (lo escribe a disco él mismo). Se agregan 2 helpers reutilizables.

- [ ] **Step 1: Agregar helper de blob de PDF**

En `frontend/src/config/api.js`, dentro del objeto `sunatAPI`, **debajo** de la línea `verPdfComprobante: (id) => descargarPdfSunat(...)` agregar:

```javascript
  // Descarga masiva: obtiene el blob del PDF (representación impresa) sin dispararlo al navegador.
  obtenerBlobPdfComprobante: async (id) => {
    const response = await fetch(`${API_URL}/sunat/comprobantes/${id}/pdf`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      let msg = 'No se pudo generar el PDF';
      try { msg = (await response.json())?.error || msg; } catch { /* no-JSON */ }
      throw new Error(msg);
    }
    return response.blob();
  },
```

- [ ] **Step 2: Agregar helper de blob por URL pública (XML/CDR de Cloudinary)**

Justo debajo del helper anterior, agregar:

```javascript
  // Descarga masiva: obtiene el blob de un archivo público (XML firmado / CDR .zip en Cloudinary).
  obtenerBlobDesdeUrl: async (url) => {
    if (!url) throw new Error('Sin archivo');
    const response = await fetch(url);
    if (!response.ok) throw new Error('No se pudo descargar el archivo');
    return response.blob();
  },
```

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npm run build`
Expected: build OK, sin errores de sintaxis.

- [ ] **Step 4: Commit (solo si el usuario lo pide)**

```bash
git add frontend/src/config/api.js
git commit -m "feat(trazabilidad): helpers de blob para descarga masiva"
```

---

## Task 3: Context — `DescargaMasivaProvider`

**Files:**
- Create: `frontend/src/context/DescargaMasivaContext.jsx`

Provider en el root que ejecuta la descarga en segundo plano. Mantiene el `dirHandle`, recorre los comprobantes **de a uno**, crea la carpeta padre (rango + día de descarga) y una subcarpeta por comprobante, y escribe solo los archivos elegidos. Cancelable. Sobrevive a la navegación porque vive fuera de las páginas.

- [ ] **Step 1: Crear el archivo completo**

```jsx
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

      try {
        const sub = await padre.getDirectoryHandle(doc, { create: true });
        let algo = false;

        if (opciones.pdf) {
          const blob = await sunatAPI.obtenerBlobPdfComprobante(c.id_factura);
          await escribir(sub, `${doc}.pdf`, blob);
          algo = true;
        }
        if (opciones.xml) {
          if (c.xml_url) { await escribir(sub, `${doc}.xml`, await sunatAPI.obtenerBlobDesdeUrl(c.xml_url)); algo = true; }
          else omitidos.push({ documento: doc, archivo: 'XML' });
        }
        if (opciones.cdr) {
          if (c.cdr_url) { await escribir(sub, `R-${doc}.zip`, await sunatAPI.obtenerBlobDesdeUrl(c.cdr_url)); algo = true; }
          else omitidos.push({ documento: doc, archivo: 'CDR' });
        }

        if (algo) ok += 1;
        // Respiro entre comprobantes: alivia la CPU del Render Free si se piden PDFs.
        await new Promise((r) => setTimeout(r, 150));
      } catch (err) {
        fallidos.push({ documento: doc, error: err?.message || 'error' });
      }
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

// Escribe un blob como archivo dentro de un directorio (File System Access API).
async function escribir(dirHandle, nombre, blob) {
  const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
```

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build`
Expected: build OK.

- [ ] **Step 3: Commit (solo si el usuario lo pide)**

```bash
git add frontend/src/context/DescargaMasivaContext.jsx
git commit -m "feat(trazabilidad): provider de descarga masiva en segundo plano"
```

---

## Task 4: Widget flotante de progreso

**Files:**
- Create: `frontend/src/components/Descargas/WidgetDescargaMasiva.jsx`
- Create: `frontend/src/components/Descargas/WidgetDescargaMasiva.css`

Widget en el root, visible en cualquier ruta cuando hay descarga activa o recién terminada. Barra de %, "hechos / total · actual", cancelar, y resumen final (ok / fallidos / omitidos). También pone el guard `beforeunload` mientras hay descarga activa.

- [ ] **Step 1: Crear `WidgetDescargaMasiva.jsx`**

```jsx
import { useEffect } from 'react';
import { CheckCircle2, Download, Loader2, X, AlertTriangle, XCircle } from 'lucide-react';
import { useDescargaMasiva } from '../../context/DescargaMasivaContext';
import './WidgetDescargaMasiva.css';

export default function WidgetDescargaMasiva() {
  const { estado, cancelar, cerrar } = useDescargaMasiva();
  const { activa, terminada, total, hechos, actual, ok, fallidos, omitidos, cancelada } = estado;

  // Aviso nativo si intenta cerrar/recargar con una descarga en curso.
  useEffect(() => {
    if (!activa) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activa]);

  if (!activa && !terminada) return null;

  const pct = total ? Math.round((hechos / total) * 100) : 0;

  return (
    <div className="dm-widget" role="status" aria-live="polite">
      {activa ? (
        <>
          <div className="dm-widget-head">
            <Loader2 className="dm-spin" size={16} />
            <strong>Descargando comprobantes…</strong>
            <button className="dm-widget-x" onClick={cancelar} title="Cancelar"><X size={15} /></button>
          </div>
          <div className="dm-bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="dm-widget-info">
            <span>{hechos} / {total} · {pct}%</span>
            {actual && <span className="dm-widget-actual">{actual}</span>}
          </div>
        </>
      ) : (
        <>
          <div className="dm-widget-head">
            <CheckCircle2 size={16} className="dm-ok-icon" />
            <strong>{cancelada ? 'Descarga cancelada' : 'Descarga completa'}</strong>
            <button className="dm-widget-x" onClick={cerrar} title="Cerrar"><X size={15} /></button>
          </div>
          <ul className="dm-resumen">
            <li><Download size={13} /> {ok} comprobante(s) descargado(s)</li>
            {fallidos.length > 0 && (
              <li className="dm-fail"><XCircle size={13} /> {fallidos.length} con error
                <small>{fallidos.slice(0, 5).map((f) => f.documento).join(', ')}{fallidos.length > 5 ? '…' : ''}</small>
              </li>
            )}
            {omitidos.length > 0 && (
              <li className="dm-warn"><AlertTriangle size={13} /> {omitidos.length} archivo(s) omitido(s) (sin XML/CDR)</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `WidgetDescargaMasiva.css`**

```css
.dm-widget {
  position: fixed; right: 20px; bottom: 20px; z-index: 4000;
  width: 320px; padding: 14px 16px;
  background: var(--card-bg, #fff); color: var(--text-color, #0f172a);
  border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,.18);
}
.dm-widget-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.dm-widget-head strong { flex: 1; font-size: 13px; }
.dm-widget-x { background: transparent; border: none; color: inherit; cursor: pointer; opacity: .6; padding: 2px; }
.dm-widget-x:hover { opacity: 1; }
.dm-bar { height: 8px; border-radius: 6px; background: var(--border-color, #e2e8f0); overflow: hidden; }
.dm-bar span { display: block; height: 100%; background: #22c55e; transition: width .2s ease; }
.dm-widget-info { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 12px; opacity: .85; }
.dm-widget-actual { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }
.dm-resumen { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.dm-resumen li { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dm-resumen small { width: 100%; opacity: .7; padding-left: 19px; }
.dm-ok-icon { color: #22c55e; }
.dm-fail { color: #ef4444; }
.dm-warn { color: #f59e0b; }
.dm-spin { animation: dm-spin 1s linear infinite; }
@keyframes dm-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Verificar build** (aún no montado, solo compila)

Run: `cd frontend && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit (solo si el usuario lo pide)**

```bash
git add frontend/src/components/Descargas/WidgetDescargaMasiva.jsx frontend/src/components/Descargas/WidgetDescargaMasiva.css
git commit -m "feat(trazabilidad): widget flotante de progreso de descarga"
```

---

## Task 5: Modal de selección de archivos

**Files:**
- Create: `frontend/src/components/Descargas/ModalDescargaMasiva.jsx`
- Create: `frontend/src/components/Descargas/ModalDescargaMasiva.css`

Modal con 3 checkboxes (PDF/XML/CDR). Al confirmar, llama `onConfirmar({ pdf, xml, cdr })`. Es un componente controlado: `abierto`, `cantidad`, `onCerrar`, `onConfirmar`.

- [ ] **Step 1: Crear `ModalDescargaMasiva.jsx`**

```jsx
import { useState } from 'react';
import { FileText, FileCode2, FileCheck2, X, Download } from 'lucide-react';
import './ModalDescargaMasiva.css';

export default function ModalDescargaMasiva({ abierto, cantidad, onCerrar, onConfirmar }) {
  const [opciones, setOpciones] = useState({ pdf: true, xml: true, cdr: true });
  if (!abierto) return null;

  const toggle = (k) => setOpciones((o) => ({ ...o, [k]: !o[k] }));
  const ninguno = !opciones.pdf && !opciones.xml && !opciones.cdr;

  const items = [
    { k: 'pdf', icon: FileText, label: 'Representación impresa (PDF)', desc: 'El comprobante en PDF (CP).' },
    { k: 'xml', icon: FileCode2, label: 'XML firmado', desc: 'El XML UBL enviado a SUNAT.' },
    { k: 'cdr', icon: FileCheck2, label: 'CDR (constancia)', desc: 'La respuesta de SUNAT (.zip).' },
  ];

  return (
    <div className="dmm-scrim" onClick={onCerrar}>
      <div className="dmm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Descargar comprobantes">
        <header className="dmm-head">
          <h3>Descargar {cantidad} comprobante(s)</h3>
          <button className="dmm-x" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <p className="dmm-sub">Elige qué archivos incluir. Se creará una carpeta por comprobante dentro de la carpeta que elijas.</p>
        <div className="dmm-opts">
          {items.map(({ k, icon: Icon, label, desc }) => (
            <label key={k} className={`dmm-opt ${opciones[k] ? 'on' : ''}`}>
              <input type="checkbox" checked={opciones[k]} onChange={() => toggle(k)} />
              <Icon size={18} />
              <span className="dmm-opt-txt"><b>{label}</b><small>{desc}</small></span>
            </label>
          ))}
        </div>
        <footer className="dmm-foot">
          <button className="dmm-btn dmm-ghost" onClick={onCerrar}>Cancelar</button>
          <button className="dmm-btn dmm-primary" disabled={ninguno} onClick={() => onConfirmar(opciones)}>
            <Download size={15} /> Elegir carpeta y descargar
          </button>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `ModalDescargaMasiva.css`**

```css
.dmm-scrim { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; z-index: 4100; padding: 16px; }
.dmm-modal { width: 100%; max-width: 440px; background: var(--card-bg, #fff); color: var(--text-color, #0f172a);
  border: 1px solid var(--border-color, #e2e8f0); border-radius: 14px; padding: 20px; }
.dmm-head { display: flex; align-items: center; gap: 8px; }
.dmm-head h3 { flex: 1; margin: 0; font-size: 16px; }
.dmm-x { background: transparent; border: none; color: inherit; cursor: pointer; opacity: .6; }
.dmm-x:hover { opacity: 1; }
.dmm-sub { font-size: 13px; opacity: .8; margin: 8px 0 16px; }
.dmm-opts { display: flex; flex-direction: column; gap: 10px; }
.dmm-opt { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--border-color, #e2e8f0); transition: border-color .15s, background .15s; }
.dmm-opt.on { border-color: #22c55e; background: color-mix(in srgb, #22c55e 8%, transparent); }
.dmm-opt input { width: 16px; height: 16px; accent-color: #22c55e; }
.dmm-opt-txt { display: flex; flex-direction: column; }
.dmm-opt-txt small { opacity: .7; font-size: 12px; }
.dmm-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.dmm-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; font-size: 13px;
  font-weight: 600; cursor: pointer; border: 1px solid var(--border-color, #e2e8f0); }
.dmm-ghost { background: transparent; color: inherit; }
.dmm-primary { background: #22c55e; color: #fff; border-color: #22c55e; }
.dmm-primary:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit (solo si el usuario lo pide)**

```bash
git add frontend/src/components/Descargas/ModalDescargaMasiva.jsx frontend/src/components/Descargas/ModalDescargaMasiva.css
git commit -m "feat(trazabilidad): modal de selección de archivos para descarga masiva"
```

---

## Task 6: Montar provider + widget en el root

**Files:**
- Modify: `frontend/src/App.jsx` (imports arriba; envoltura en `L71-586`)

El provider debe envolver TODO lo que persiste durante la navegación. Se monta dentro de los providers existentes, envolviendo `<Routes>`, y el widget se renderiza como hermano de `<Routes>` para verse en cualquier ruta.

- [ ] **Step 1: Agregar imports**

Después de la línea `import { ThemeProvider } from './context/ThemeContext';` (L5) agregar:

```javascript
import { DescargaMasivaProvider } from './context/DescargaMasivaContext';
import WidgetDescargaMasiva from './components/Descargas/WidgetDescargaMasiva';
```

- [ ] **Step 2: Envolver el árbol de rutas con el provider + montar el widget**

Reemplazar el bloque que empieza en `<PermisosProvider>` (L74) y sus `<Routes>...</Routes>` internos. Concretamente, envolver el primer `<Routes>` (L75) así:

De:
```jsx
        <PermisosProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
```
A:
```jsx
        <PermisosProvider>
          <DescargaMasivaProvider>
          <WidgetDescargaMasiva />
          <Routes>
            <Route path="/login" element={<Login />} />
```

Y su cierre. De:
```jsx
          </Routes>
        </PermisosProvider>
```
A:
```jsx
          </Routes>
          </DescargaMasivaProvider>
        </PermisosProvider>
```

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npm run build`
Expected: build OK, sin errores de import.

- [ ] **Step 4: Commit (solo si el usuario lo pide)**

```bash
git add frontend/src/App.jsx
git commit -m "feat(trazabilidad): montar provider + widget de descarga en el root"
```

---

## Task 7: Pestaña "Descarga masiva" en TrazabilidadSee

**Files:**
- Modify: `frontend/src/pages/Facturacion/TrazabilidadSee.jsx`
- Modify: `frontend/src/pages/Facturacion/TrazabilidadSee.css`

Nueva pestaña con tabla plana, rango de fechas, checkboxes + "seleccionar todo", y botón "Descargar seleccionados (N)" que abre el modal. Reúsa `sunatAPI.trazabilidadComprobantes` con `solo_sistema: 1`.

- [ ] **Step 1: Imports y nueva entrada de TAB**

En `TrazabilidadSee.jsx`, agregar `DownloadCloud` y `CheckSquare` a la importación de `lucide-react` (línea ~3-7):

```jsx
import {
  ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, Download, FileCheck2,
  FileText, Filter, Layers, Link2, Loader2, Package, RefreshCw, RotateCcw, Search,
  ShieldCheck, Truck, X, XCircle, DownloadCloud
} from 'lucide-react';
```

Agregar imports del hook y modal después de la línea `import './TrazabilidadSee.css';`:

```jsx
import { useDescargaMasiva, soportaDescargaCarpetas } from '../../context/DescargaMasivaContext';
import ModalDescargaMasiva from '../../components/Descargas/ModalDescargaMasiva';
```

Extender el array `TABS` (línea ~205-208):

```jsx
const TABS = [
  { id: 'comprobantes', label: 'Comprobantes', icon: FileText },
  { id: 'guias', label: 'Guías de Remisión', icon: Truck },
  { id: 'descarga', label: 'Descarga masiva', icon: DownloadCloud },
];
```

- [ ] **Step 2: Renderizar la nueva pestaña**

En el `return` de `TrazabilidadSee`, dentro de `<section className="tz-table-wrap">`, la cadena ternaria termina hoy con `tab === 'comprobantes' ? <TablaComprobantes.../> : <TablaGuias.../>`. Cambiar para que la pestaña `descarga` renderice su propio panel. Reemplazar el bloque final del ternario:

De:
```jsx
        ) : tab === 'comprobantes'
          ? <TablaComprobantes data={visibles} expandido={expandido} setExpandido={setExpandido} onOrden={setDrawerOrden} onDescargar={descargar} />
          : <TablaGuias data={visibles} expandido={expandido} setExpandido={setExpandido} onOrden={setDrawerOrden} onDescargar={descargar} />}
```
A:
```jsx
        ) : tab === 'comprobantes'
          ? <TablaComprobantes data={visibles} expandido={expandido} setExpandido={setExpandido} onOrden={setDrawerOrden} onDescargar={descargar} />
          : tab === 'guias'
          ? <TablaGuias data={visibles} expandido={expandido} setExpandido={setExpandido} onOrden={setDrawerOrden} onDescargar={descargar} />
          : null}
```

**Importante:** la pestaña `descarga` NO usa el flujo `cargar()` general (que no pide fechas obligatorias ni checkboxes). Se implementa como componente propio `PanelDescargaMasiva`, renderizado por fuera del bloque condicional de `tz-table-wrap`. Añadir, **justo después** del cierre de `</section>` de `tz-table-wrap` y antes de `{drawerOrden && ...}`:

```jsx
      {tab === 'descarga' && (
        <PanelDescargaMasiva onOrden={setDrawerOrden} onDescargarUno={descargar} />
      )}
```

Y para que la pestaña `descarga` no muestre la toolbar/chips/tabla genéricas, envolver esas tres `<section>` (toolbar, chips, table-wrap) para que solo se rendericen cuando `tab !== 'descarga'`. Envolver desde `<section className="tz-toolbar">` hasta el cierre de `</section>` de `tz-table-wrap` con:

```jsx
      {tab !== 'descarga' && (<>
        {/* ...toolbar, chips, aviso, table-wrap existentes... */}
      </>)}
```

(El `aviso` toast puede quedar dentro; no molesta.)

- [ ] **Step 3: Implementar `PanelDescargaMasiva` (al final del archivo, antes de `function DetItem`)**

```jsx
/* ------------------------- Pestaña: descarga masiva ----------------------- */
function PanelDescargaMasiva({ onOrden, onDescargarUno }) {
  const { estado: estadoDescarga, iniciarDescarga } = useDescargaMasiva();
  const [rango, setRango] = useState({ desde: '', hasta: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [consultado, setConsultado] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [modal, setModal] = useState(false);
  const [aviso, setAviso] = useState(null);

  const consultar = useCallback(async () => {
    if (!rango.desde || !rango.hasta) { setError('Elige la fecha de inicio y de fin.'); return; }
    setLoading(true); setError(null); setSel(new Set());
    try {
      const res = await sunatAPI.trazabilidadComprobantes({ desde: rango.desde, hasta: rango.hasta, solo_sistema: 1 });
      setRows(res.data?.data || []);
      setConsultado(true);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'No se pudo consultar.');
      setRows([]);
    } finally { setLoading(false); }
  }, [rango.desde, rango.hasta]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todos = rows.length > 0 && sel.size === rows.length;
  const toggleTodos = () => setSel(todos ? new Set() : new Set(rows.map((r) => r.id_factura)));

  const abrirModal = () => {
    if (!soportaDescargaCarpetas()) { setAviso('Tu navegador no permite descargar carpetas. Usa Google Chrome o Microsoft Edge.'); return; }
    if (!sel.size) { setAviso('Selecciona al menos un comprobante.'); return; }
    setAviso(null); setModal(true);
  };

  const confirmar = async (opciones) => {
    setModal(false);
    const elegidos = rows.filter((r) => sel.has(r.id_factura))
      .map((r) => ({ id_factura: r.id_factura, documento: r.documento, xml_url: r.xml_url, cdr_url: r.cdr_url }));
    try {
      await iniciarDescarga(elegidos, opciones, rango);
    } catch (e) {
      setAviso(e?.message || 'No se pudo iniciar la descarga.');
    }
  };

  return (
    <div className="tz-descarga">
      <div className="tz-descarga-bar">
        <label className="tz-field tz-field-date">
          <CalendarDays size={13} />
          <input type="date" value={rango.desde} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} title="Fecha de inicio" />
        </label>
        <label className="tz-field tz-field-date">
          <span className="tz-date-sep">→</span>
          <input type="date" value={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} title="Fecha de fin" />
        </label>
        <button className="tz-btn tz-btn-primary" onClick={consultar} disabled={loading}>
          {loading ? <Loader2 className="tz-spin" size={15} /> : <Search size={15} />} Consultar
        </button>
        <div className="tz-descarga-spacer" />
        <button className="tz-btn tz-btn-primary" onClick={abrirModal} disabled={!sel.size || estadoDescarga.activa}>
          <DownloadCloud size={15} /> Descargar seleccionados ({sel.size})
        </button>
      </div>

      {aviso && <div className="tz-toast" onClick={() => setAviso(null)}><XCircle size={15} /> {aviso}</div>}
      {estadoDescarga.activa && <div className="tz-descarga-nota">Hay una descarga en curso. Puedes seguir usando el sistema; no cierres ni recargues la pestaña.</div>}

      {error ? (
        <div className="tz-state"><XCircle size={26} /><strong>No se pudo consultar</strong><span>{error}</span></div>
      ) : loading ? (
        <div className="tz-state"><Loader2 className="tz-spin" size={26} /><strong>Consultando…</strong></div>
      ) : !consultado ? (
        <div className="tz-state"><CalendarDays size={26} /><strong>Elige un rango de fechas</strong><span>Selecciona inicio y fin, luego pulsa Consultar.</span></div>
      ) : !rows.length ? (
        <div className="tz-state"><FileCheck2 size={26} /><strong>Sin comprobantes</strong><span>No hay comprobantes emitidos por el sistema en ese rango.</span></div>
      ) : (
        <table className="tz-table tz-table-descarga">
          <thead>
            <tr>
              <th className="tz-col-check"><input type="checkbox" checked={todos} onChange={toggleTodos} title="Seleccionar todo" /></th>
              <th>Fecha emisión</th>
              <th>Nº comprobante</th>
              <th>Receptor</th>
              <th className="tz-num">Importe</th>
              <th>Fecha rechazo</th>
              <th>Anulado</th>
              <th className="tz-col-acc">Archivos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id_factura} className={sel.has(r.id_factura) ? 'sel' : ''}>
                <td className="tz-col-check"><input type="checkbox" checked={sel.has(r.id_factura)} onChange={() => toggle(r.id_factura)} /></td>
                <td className="tz-nowrap">{fmtDia(r.fecha_emision)}</td>
                <td><div className="tz-doc"><TipoTag clase={r.clase} /><b>{r.documento}</b></div></td>
                <td><div className="tz-cli"><b>{r.cliente || '—'}</b><small>{r.ruc_cliente || ''}</small></div></td>
                <td className="tz-num tz-nowrap">{fmtMoneda(r.total, r.moneda)}</td>
                <td className="tz-nowrap">{r.estado_final === 'RECHAZADO' && r.sunat_fecha_envio ? fmtDia(r.sunat_fecha_envio) : '—'}</td>
                <td>{r.estado_final === 'ANULADA' ? <span className="tz-anulado-si">Sí</span> : <span className="tz-muted">No</span>}</td>
                <td className="tz-col-acc" onClick={(e) => e.stopPropagation()}>
                  <div className="tz-acc">
                    <IconBtn icon={FileText} label="Ver CP (PDF)" onClick={() => onDescargarUno(() => sunatAPI.verPdfComprobante(r.id_factura), 'el PDF')} />
                    <IconBtn icon={Download} label="XML" disabled={!r.xml_url}
                      onClick={() => onDescargarUno(() => sunatAPI.descargarArchivoUrl(r.xml_url, `${r.documento}.xml`), 'el XML')} />
                    <IconBtn icon={FileCheck2} label="CDR" disabled={!r.cdr_url}
                      onClick={() => onDescargarUno(() => sunatAPI.descargarArchivoUrl(r.cdr_url, `R-${r.documento}.zip`), 'el CDR')} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ModalDescargaMasiva abierto={modal} cantidad={sel.size} onCerrar={() => setModal(false)} onConfirmar={confirmar} />
    </div>
  );
}
```

- [ ] **Step 4: Estilos en `TrazabilidadSee.css`**

Agregar al final de `frontend/src/pages/Facturacion/TrazabilidadSee.css`:

```css
/* --- Pestaña descarga masiva --- */
.tz-descarga { display: flex; flex-direction: column; gap: 14px; }
.tz-descarga-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tz-descarga-spacer { flex: 1; }
.tz-descarga-nota { font-size: 12px; padding: 8px 12px; border-radius: 8px;
  background: color-mix(in srgb, #f59e0b 12%, transparent); color: var(--text-color); }
.tz-col-check { width: 40px; text-align: center; }
.tz-col-check input { width: 16px; height: 16px; accent-color: #22c55e; cursor: pointer; }
.tz-table-descarga tr.sel { background: color-mix(in srgb, #22c55e 8%, transparent); }
.tz-anulado-si { color: #a855f7; font-weight: 600; }
```

- [ ] **Step 5: Verificar build**

Run: `cd frontend && npm run build`
Expected: build OK.

- [ ] **Step 6: Commit (solo si el usuario lo pide)**

```bash
git add frontend/src/pages/Facturacion/TrazabilidadSee.jsx frontend/src/pages/Facturacion/TrazabilidadSee.css
git commit -m "feat(trazabilidad): pestaña de consulta + descarga masiva"
```

---

## Task 8: Smoke manual end-to-end (Chrome/Edge)

**Files:** ninguno (verificación).

- [ ] **Step 1: Levantar backend y frontend**

Run: backend `npm run dev` (carpeta `backend`) y frontend `npm run dev` (carpeta `frontend`). Abrir en **Chrome o Edge**.

- [ ] **Step 2: Verificar la pestaña**

Ir a Facturación → Trazabilidad → pestaña **Descarga masiva**.
Expected: pide rango de fechas; al consultar, muestra la tabla con columnas Fecha emisión, Nº comprobante, Receptor (RUC+razón social), Importe con moneda, Fecha rechazo, Anulado, Archivos. No aparecen facturas manuales/legacy.

- [ ] **Step 3: Verificar descarga masiva**

Seleccionar 2-3 comprobantes → "Descargar seleccionados" → marcar PDF+XML+CDR → elegir carpeta.
Expected: aparece el widget con barra de progreso; al navegar a otro módulo (ej. Dashboard) el widget sigue y la descarga continúa. En disco: carpeta `Comprobantes <rango> (descarga <hoy>)/` con una subcarpeta por comprobante y dentro los archivos elegidos. Un comprobante rechazado sin CDR se cuenta como "omitido" sin frenar el resto.

- [ ] **Step 4: Verificar guard de recarga**

Con una descarga activa, intentar recargar (F5).
Expected: el navegador muestra el aviso nativo "¿Salir del sitio?".

- [ ] **Step 5: Commit final (solo si el usuario lo pide)**

Confirmar árbol limpio; si hay ajustes de smoke, commitearlos.

---

## Self-Review (cobertura del spec)

- **Pestaña nueva "Descarga masiva":** Task 7. ✔
- **Rango de fechas obligatorio + consulta:** Task 7 Step 3 (`consultar` valida desde/hasta). ✔
- **Columnas exactas (fecha emisión, nº, receptor RUC+razón, importe+moneda, fecha rechazo, anulado, acciones):** Task 7 Step 3 tabla. ✔
- **CP=PDF (ver CP abre PDF):** Task 7 (IconBtn "Ver CP (PDF)" usa `verPdfComprobante`). ✔
- **Checkboxes + seleccionar todo:** Task 7 (`sel`, `toggleTodos`). ✔
- **Modal PDF/XML/CDR:** Task 5. ✔
- **showDirectoryPicker + estructura carpeta padre(rango+día)/correlativo/archivos:** Task 3. ✔
- **Segundo plano + sobrevive navegación + widget %:** Tasks 3, 4, 6. ✔
- **beforeunload en F5/cierre:** Task 4 Step 1. ✔
- **Incluye RECHAZADO/OBSERVADO; excluye manual/legacy:** Task 1 (`solo_sistema`). ✔
- **Fecha de rechazo derivada de sunat_fecha_envio:** Task 7 tabla. ✔
- **Render Free: secuencial + respiro; XML/CDR de Cloudinary:** Task 3 (bucle secuencial + setTimeout 150ms; XML/CDR vía `obtenerBlobDesdeUrl`). ✔
- **Omitir archivo faltante sin frenar / resumen ok/fallidos/omitidos:** Tasks 3 y 4. ✔
- **Fuera de alcance (ZIP, guías, persistencia tras recarga):** no implementado, correcto. ✔
