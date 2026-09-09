-- Conserva el detalle original del comprobante del proveedor sin cambiar el
-- producto de catálogo que recibe el stock.
--
-- Ejecutar una sola vez antes de desplegar el código asociado.

ALTER TABLE detalle_orden_compra
  ADD COLUMN codigo_documento VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    AFTER descripcion_manual,
  ADD COLUMN descripcion_documento VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    AFTER codigo_documento,
  ADD COLUMN unidad_documento_sunat VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    AFTER descripcion_documento;

ALTER TABLE detalle_guia_remision
  ADD COLUMN id_detalle_compra INT NULL
    AFTER id_detalle_orden,
  ADD COLUMN codigo_documento VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    AFTER descripcion,
  ADD KEY idx_detalle_guia_compra (id_detalle_compra),
  ADD CONSTRAINT fk_detalle_guia_compra
    FOREIGN KEY (id_detalle_compra) REFERENCES detalle_orden_compra (id_detalle)
    ON DELETE SET NULL;

-- Los registros históricos quedan en NULL porque la descripción/código exactos
-- del XML ya no pueden reconstruirse con certeza desde el catálogo interno.
-- La aplicación mantiene compatibilidad usando los datos de productos como fallback.
