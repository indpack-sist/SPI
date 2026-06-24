---
name: calidad-sin-precios
description: El rol Calidad y el módulo de Incidencias nunca deben exponer precios ni importes
metadata:
  type: feedback
---

El rol **Calidad** tiene `verPrecios: false` en `backend/middleware/auth.js`. Cualquier consulta del módulo de Incidencias de Calidad que haga JOIN a `ordenes_venta` o ventas NO debe seleccionar campos de precio/importe (precio unitario, subtotal, total, IGV, etc.).

Al asociar una incidencia a una Orden de Venta, solo se permite mostrar: correlativo (`ordenes_venta.numero_orden`), cliente (`clientes.razon_social`), cantidad del producto (`detalle_orden_venta.cantidad`) y fecha de despacho (`ordenes_venta.fecha_entrega_real`).

**Why:** Calidad sirve para auditorías de no conformidades, no necesita información financiera y no debe verla.

**How to apply:** En `incidencias.controller.js` y cualquier vista del módulo Calidad, excluir columnas monetarias en los SELECT. Relacionado con [[modulo-incidencias-calidad]].
