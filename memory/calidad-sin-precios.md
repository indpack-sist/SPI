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

**Compras (hecho 2026-06):** Calidad tiene acceso a Compras pero NO debe ver montos, facturas, ni condiciones (forma de pago, cuentas, cuotas, letras, reembolsos). Implementado con `tienePermiso('verPrecios')` (= `verMontos`) en `pages/Compras/Compras.jsx` (oculta stats, alertas, columnas Total/Pago/Forma Pago/Comprador, filtros financieros y botón Registrar) y `pages/Compras/DetalleCompra.jsx` (oculta tarjetas de totales/saldo/reembolso, pestañas Pagos/Letras, columnas Precio/Total y pie de la tabla de items, cuenta de pago, cuotas, botones de pago/PDF/Ver Comprobante, y la columna Total del historial de ingresos). Calidad sí ve: proveedor, productos, cantidades, recepción y fechas (incl. fecha de ingreso). NOTA: es gating de FRONTEND — el backend de compras aún envía los montos en el JSON (visibles en devtools); si se requiere ocultarlos a nivel API es trabajo adicional.
