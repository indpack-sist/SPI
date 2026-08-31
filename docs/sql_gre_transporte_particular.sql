-- ============================================================================
-- GRE: transporte "particular" (carro común del cliente) + wizard de emisión
-- ----------------------------------------------------------------------------
-- Contexto: modalidad 02 (Privado) cuando el CLIENTE (o un particular que NO es
-- empresa de transporte) traslada con su propio carro/camioneta. Se declara
-- conductor + placa de TEXTO LIBRE (no de la flota). Estructura calcada del XML
-- aceptado docs/20550932297-09-EG07-256.xml.
--
-- Estas columnas son NULLABLE y no rompen las guías existentes: si están vacías,
-- la emisión sigue usando la flota (id_conductor/id_vehiculo) o el tercero
-- (id_transportista) como hasta ahora.
--
-- ⚠️ EJECUTAR ANTES de desplegar el nuevo wizard de emisión: el backend persiste
--    transporte_modo / es_comercio_exterior al emitir; sin estas columnas el
--    UPDATE fallaría.
-- ============================================================================

ALTER TABLE guias_remision
  ADD COLUMN transporte_modo       VARCHAR(20)  NULL COMMENT 'flota | particular | tercero (origen de los datos de transporte)',
  ADD COLUMN transporte_placa      VARCHAR(20)  NULL COMMENT 'Placa del vehículo (modo particular, texto libre)',
  ADD COLUMN transporte_dni        VARCHAR(15)  NULL COMMENT 'DNI del conductor (modo particular)',
  ADD COLUMN transporte_conductor  VARCHAR(250) NULL COMMENT 'Nombre del conductor (modo particular)',
  ADD COLUMN transporte_licencia   VARCHAR(30)  NULL COMMENT 'Licencia de conducir (modo particular)',
  ADD COLUMN es_comercio_exterior  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = operación de comercio exterior (motivos 08/09)';
