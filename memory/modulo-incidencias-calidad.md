---
name: modulo-incidencias-calidad
description: Estado y diseño del módulo de Incidencias de Calidad (rol Calidad) para auditorías
metadata:
  type: project
---

Módulo nuevo para el rol **Calidad**: registrar incidencias / no conformidades, asociadas a Orden de Producción, producto, y opcionalmente Orden de Venta, para auditorías.

**Base de datos (creada el 2026-06-24 en BD `railway`):** `tipos_incidencia`, `incidencias_calidad`, `incidencias_adjuntos`, `incidencias_historial`. Todas las PK del sistema son `int`. Código correlativo `INC-YYYY-NNNN`. Workflow: Abierta → En análisis → En tratamiento → Verificación → Cerrada / Anulada. No se borra físicamente; todo cambio queda en `incidencias_historial`.

**Backend (FASE 2 COMPLETADA):**
- Permiso `incidencias` agregado en `backend/middleware/auth.js` a: Calidad, Administrador, Produccion, Supervisor (ui + api).
- `backend/controllers/incidencias.controller.js` y `backend/routes/incidencias.routes.js` creados.
- Registrado en `server.js`: `app.use('/api/calidad/incidencias', ...)`.
- Fotos: mismo patrón que `op_adjuntos` + Cloudinary (carpeta `indpack_incidencias`); subir/ver/eliminar disponibles tras crear la incidencia.

**Restricción clave:** ver [[calidad-sin-precios]] — al asociar a Orden de Venta solo se exponen correlativo, cliente, cantidad del producto y fecha de despacho (`fecha_entrega_real`).

**Frontend (FASE 3 COMPLETADA — build Vite OK):** `incidenciasAPI` en `frontend/src/config/api.js`; sección "Calidad" en `menuConfig.js`; páginas en `pages/Calidad/` (`Incidencias.jsx` lista, `IncidenciaDetalle.jsx` detalle+fotos+historial+workflow, `ModalNuevaIncidencia.jsx` reutilizable, `IncidenciasPorProducto.jsx`); rutas `/calidad/incidencias`, `/calidad/incidencias/:id`, `/calidad/incidencias-por-producto` en `app.jsx` (ojo: el archivo es `app.jsx` en minúscula); botón "Registrar Incidencia" en `pages/Produccion/OrdenDetalle.jsx` con prefill de OP/producto. Reutiliza clases CSS globales (card/btn/badge/form-input) y componentes UI (Table/Modal/Alert/Loading).

Helpers `getEstadoBadge`, `getSeveridadBadge`, `formatearFecha` se exportan desde `pages/Calidad/Incidencias.jsx` y se reusan en las otras páginas Calidad.

Nota: `frontend/src/index.css` tiene una advertencia CSS PREEXISTENTE (comentario suelto ~línea 2113), no relacionada con este módulo.

**Zona horaria (corregido):** el desfase de +5h era de visualización — `mysql2` (pool con `timezone: '-05:00'` en `config/database.js`) devuelve DATETIME como Date → JSON UTC con "Z", y el frontend no fijaba zona. Solución: `formatearFecha` en `pages/Calidad/Incidencias.jsx` ahora fija `America/Lima` y maneja texto plano (hora Perú ya guardada) vs ISO con Z. NO se tocó el pool. Las páginas Producción/Ventas/Compras tienen el mismo bug latente en sus propios `formatearFecha` (pendiente si lo piden). El backend ya guarda hora Perú vía `getFechaPeru()`.

**verificarCalidad estructurado (hecho):** ALTER TABLE en `ordenes_produccion` agregó `resultado_calidad` ENUM('Aprobado','Observado','Rechazado'), `id_verificado_calidad` (FK empleados), `fecha_verificacion_calidad`, `observacion_calidad`. `verificarCalidad` en `ordenes-produccion.controller.js` ahora recibe `{resultado, observacion}`, guarda en esas columnas con `getFechaPeru()`, mantiene la marca de texto en `observaciones` por compatibilidad con el listado, y si el resultado es Observado/Rechazado genera automáticamente una incidencia (Observado→Menor, Rechazado→Mayor) con su historial. Frontend: modal de resultado en `OrdenDetalle.jsx`; `api.js` `verificarCalidad(id, data)`.
