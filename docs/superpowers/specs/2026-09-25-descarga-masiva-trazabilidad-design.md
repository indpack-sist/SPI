# Descarga masiva de comprobantes — Módulo Trazabilidad SEE

**Fecha:** 2026-09-25
**Estado:** Diseño aprobado — pendiente de plan de implementación

## Objetivo

Agregar al módulo **Trazabilidad SEE** un consultador y descargador masivo de
comprobantes electrónicos (facturas + notas de crédito/débito), al estilo del
descargador masivo del portal SUNAT: el usuario consulta por rango de fechas,
selecciona los comprobantes que quiere y descarga en lote sus archivos (PDF, XML,
CDR) organizados automáticamente en carpetas locales, con progreso en segundo
plano que no interrumpe el trabajo en otros módulos.

## Alcance

- **Solo comprobantes emitidos electrónicamente desde el sistema.** Se excluyen
  las facturas manuales/legacy cargadas antes de la integración SEE (las que no
  tienen fila/estado SUNAT, marcadas hoy como `es_manual` en el controller).
- **Incluye todos los estados de emisión**: ACEPTADO, OBSERVADO, ENVIADO,
  PENDIENTE, **RECHAZADO** y ANULADA.
- Solo comprobantes (facturas 01, notas 07/08). Las guías de remisión quedan
  fuera de esta funcionalidad (mantienen su descarga individual actual).
- Solo lectura + descarga. No modifica comprobantes.

## Arquitectura

### Ubicación
Nueva pestaña **"Descarga masiva"** dentro de `frontend/src/pages/Facturacion/TrazabilidadSee.jsx`,
junto a "Comprobantes" y "Guías de Remisión". No modifica las pestañas de
auditoría existentes.

La pestaña de auditoría "Comprobantes" seguirá igual (fila expandible, motivos,
drawer de orden). La nueva pestaña es una tabla plana orientada a selección y
descarga en lote, replicando el layout del portal SUNAT.

### Descarga en segundo plano (clave)
El proceso de descarga **no vive en el componente de la página** (se cancelaría al
desmontarse al navegar). Se implementa como:

- **`DescargaMasivaProvider`** (React Context) montado en el **root** de la app
  (`App.jsx`, por fuera del `Router`). Contiene: estado de la cola, progreso (%),
  contadores (ok / fallidos / avisos), el `dirHandle` elegido, y el bucle de
  descarga secuencial. Expone `iniciarDescarga(comprobantes, opciones, dirHandle)`,
  `cancelar()` y el estado del progreso.
- La pestaña "Descarga masiva" solo **dispara** la tarea; el provider la ejecuta.
- **Widget flotante de progreso** (esquina inferior, también en el root): barra de
  porcentaje, línea "23 / 300 · F001-45", botón cancelar, y al terminar un resumen
  (✔ correctos · ✖ fallidos con detalle · ⚠ archivos omitidos).
- **`beforeunload`**: si hay una descarga en curso y el usuario intenta cerrar o
  recargar (F5), el navegador muestra el aviso nativo de "cambios sin guardar".

**Límite conocido:** la descarga sobrevive a la navegación dentro de la SPA, pero
se corta si el usuario recarga o cierra la pestaña (el navegador no permite
escribir archivos sin la pestaña viva). Aceptado.

### Mecanismo de escritura a disco
**File System Access API** (`window.showDirectoryPicker()`), nativa de Chrome/Edge,
gratuita, sin librerías. Requiere contexto seguro (HTTPS — Render ya lo provee) y
gesto del usuario (clic en el botón).

- Si el navegador **no soporta** `showDirectoryPicker` (ej. Firefox), se muestra un
  mensaje claro indicando usar Chrome o Edge. (Sin fallback a ZIP en esta versión.)

## Flujo de usuario

1. Entra a Trazabilidad → pestaña **Descarga masiva**.
2. Elige **rango de fechas obligatorio** (desde / hasta) → consulta.
3. Se muestra la tabla con los comprobantes del rango (solo emitidos por el sistema).
4. Marca comprobantes con checkbox (o "seleccionar todo").
5. Clic en **"Descargar seleccionados (N)"** → abre el **modal**.
6. En el modal marca qué archivos: **PDF (representación impresa)**, **XML**, **CDR**.
7. Al aceptar → `showDirectoryPicker()` → elige carpeta destino.
8. Arranca el proceso en segundo plano; aparece el widget de progreso. El usuario
   puede navegar a otros módulos; la descarga continúa.

## Tabla (columnas)

Tabla plana (sin fila expandible), consulta por rango obligatorio:

| Columna | Fuente |
|---|---|
| ☐ checkbox | selección (+ "seleccionar todo" en el encabezado) |
| Fecha de emisión | `fecha_emision` |
| Nº comprobante electrónico | `documento` (serie-número) |
| Receptor | `razon_social` + `ruc` (una celda, dos líneas) |
| Importe total | `total` con `moneda` |
| Fecha de rechazo | `sunat_fecha_envio` **solo si** `estado_final === 'RECHAZADO'`, si no `—` |
| Anulado | badge Sí/No (`estado_final === 'ANULADA'`) |
| Acciones | 👁 Ver CP (abre PDF) · ⬇ XML · ⬇ CDR · ⬇ PDF (descargas individuales existentes) |

Nota: **CP = PDF** (representación impresa). "Ver CP" abre el PDF; no hay archivo
CP distinto.

## Estructura de carpetas generada

Dentro de la carpeta que elija el usuario:

```
📁 Comprobantes 2026-09-01_2026-09-25 (descarga 2026-09-25)/
   📁 F001-45/
      F001-45.pdf
      F001-45.xml
      R-F001-45.zip        (CDR)
   📁 F001-46/
      F001-46.pdf
      F001-46.xml
      R-F001-46.zip
   ...
```

- Carpeta padre = **rango consultado + día de descarga**.
- Una subcarpeta por comprobante, nombrada con su correlativo (serie-número).
- Dentro, solo los archivos marcados en el modal.
- Nombres de archivo: `SERIE-NUMERO.pdf`, `SERIE-NUMERO.xml`, `R-SERIE-NUMERO.zip`.

## Origen de cada archivo e impacto en Render (plan Free)

| Archivo | Origen | ¿Pasa por Render? | Costo |
|---|---|---|---|
| XML | `xml_url` (Cloudinary CDN) | ❌ No | Cero |
| CDR | `cdr_url` (Cloudinary CDN) | ❌ No | Cero |
| PDF | `GET /sunat/comprobantes/:id/pdf` (pdfkit) | ✅ Sí | Ligero, sin GPU |

- **PDF = pdfkit** (JS puro), no Puppeteer/Chrome headless → CPU/RAM bajos, **cero GPU**.
- **Descarga estrictamente secuencial (1 archivo a la vez)** con un pequeño respiro
  entre PDFs, para no ahogar la CPU del Free (evita el patrón que congeló HTTP/WS
  con el worker de prospección concurrencia 8). Nunca hay ráfaga de requests.
- Si no se marca PDF, la descarga **no toca Render** (todo sale de Cloudinary).
- Cada blob se escribe a disco y se libera → sin acumulación de RAM en el navegador.

## Manejo de errores

- Si un comprobante **no tiene** XML o CDR (rechazado, sin CDR, etc.), se **omite ese
  archivo**, se cuenta como aviso (⚠) y **no frena** el resto de la cola.
- Si falla la descarga de un archivo (red, 500), se registra como fallido (✖) con el
  correlativo y se continúa con el siguiente.
- El widget final muestra: total procesados, ✔ correctos, ✖ fallidos (con lista de
  correlativos), ⚠ archivos omitidos.
- Cancelar detiene el bucle tras el archivo en curso; lo ya descargado queda en disco.

## Backend

- **Reúso del endpoint existente** `GET /sunat/trazabilidad/comprobantes`
  (`trazabilidad-see.controller.js` → `listarComprobantes`), que ya devuelve
  `fecha_emision`, `documento`, `cliente`, `ruc_cliente`, `total`, `moneda`,
  `estado_final`, `sunat_fecha_envio`, `xml_url`, `cdr_url`, `es_manual`.
- **Único cambio backend:** agregar filtro opcional `solo_sistema=1` que descarte
  los `es_manual` (facturas manuales/legacy sin fila SUNAT), para cumplir el alcance.
  La nueva pestaña siempre lo envía en `1`.
- PDF individual/masivo: endpoint `GET /sunat/comprobantes/:id/pdf` ya existe, sin cambios.

## Componentes nuevos / modificados

**Nuevos:**
- `frontend/src/context/DescargaMasivaContext.jsx` — provider + bucle secuencial +
  escritura vía File System Access API.
- `frontend/src/components/.../WidgetDescargaMasiva.jsx` — widget flotante de progreso.
- `frontend/src/components/.../ModalDescargaMasiva.jsx` — modal de selección de archivos.
- Sub-vista/tab "Descarga masiva" dentro de `TrazabilidadSee.jsx` (tabla con checkboxes).

**Modificados:**
- `frontend/src/App.jsx` — montar `DescargaMasivaProvider` + widget en el root.
- `frontend/src/pages/Facturacion/TrazabilidadSee.jsx` — nueva pestaña.
- `frontend/src/pages/Facturacion/TrazabilidadSee.css` — estilos de la tabla nueva,
  modal y widget (tokens de tema claro/oscuro, sin colores fijos).
- `frontend/src/config/api.js` — helper de consulta con `solo_sistema` (si aplica) +
  helper para obtener el blob del PDF (`GET /comprobantes/:id/pdf`) reutilizable por
  el bucle de descarga.
- `backend/controllers/trazabilidad-see.controller.js` — filtro `solo_sistema`.

## Fuera de alcance (YAGNI)

- Descarga masiva de guías de remisión.
- Fallback a ZIP para navegadores sin File System Access API.
- Persistencia de la descarga tras recargar/cerrar la pestaña.
- Columna real `sunat_fecha_rechazo` en BD (se deriva de `sunat_fecha_envio`).
