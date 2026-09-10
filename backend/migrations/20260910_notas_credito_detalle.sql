-- Ejecutar una vez antes de desplegar el flujo de NC 07 / motivo 09.
-- Conserva las líneas exactas enviadas a SUNAT para PDF, historial y control acumulado.
CREATE TABLE IF NOT EXISTS facturas_notas_detalle (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_factura INT NOT NULL,
  id_detalle_ref INT NULL,
  modo_disminucion ENUM('item', 'global') NULL,
  codigo VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  codigo_unidad_sunat VARCHAR(10) NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  valor_unitario DECIMAL(18,6) NOT NULL,
  codigo_afectacion_igv VARCHAR(2) NOT NULL,
  valor_venta DECIMAL(18,2) NOT NULL,
  igv DECIMAL(18,2) NOT NULL,
  importe_total DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_nota_detalle_factura (id_factura),
  KEY idx_nota_detalle_ref (id_detalle_ref)
);
