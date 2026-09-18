-- ============================================================
-- Padrón de empresas objetivo (reemplaza el "Descubrir todo" de Google Places).
-- Se llena UNA vez (y se refresca cada tanto) con el Padrón Reducido RUC de
-- SUNAT, ya FILTRADO a las empresas que interesan: personas jurídicas (RUC 20),
-- ACTIVAS y cuyo nombre calza con un sector objetivo (compradores de empaque).
-- El descubrimiento por zona lee de aquí (rápido, offline) y crea prospectos.
--
-- La carga la hace el script backend/scripts/import-padron.mjs (streaming, para
-- no cargar millones de filas en memoria ni en la BD).
-- ============================================================

CREATE TABLE IF NOT EXISTS padron_empresas (
  ruc           CHAR(11)     NOT NULL,
  razon_social  VARCHAR(255) NOT NULL,
  estado        VARCHAR(40)  DEFAULT NULL,   -- ACTIVO, BAJA, etc.
  condicion     VARCHAR(40)  DEFAULT NULL,   -- HABIDO / NO HABIDO
  ubigeo        CHAR(6)      DEFAULT NULL,   -- INEI (DD PP DD)
  departamento  VARCHAR(80)  DEFAULT NULL,
  provincia     VARCHAR(80)  DEFAULT NULL,
  distrito      VARCHAR(80)  DEFAULT NULL,
  direccion     VARCHAR(255) DEFAULT NULL,
  sector        VARCHAR(80)  DEFAULT NULL,   -- sector objetivo detectado por nombre
  fecha_import  DATETIME     DEFAULT NULL,
  PRIMARY KEY (ruc),
  KEY idx_padron_depto_sector (departamento, sector),
  KEY idx_padron_ubigeo (ubigeo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
