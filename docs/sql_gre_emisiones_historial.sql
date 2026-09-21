-- Historial de emisiones SUNAT por GRE Remitente (09).
-- Objetivo: que un intento RECHAZADO/ERROR no se pierda al reemitir (hoy la fila guias_remision
-- se sobrescribe con el nuevo correlativo). Cada intento queda archivado aquí con el estado, el
-- motivo del rechazo y un snapshot INMUTABLE de los datos con que se emitió, para reimprimir su
-- PDF (con marca de agua RECHAZADO) fielmente aunque la guía cambie después.
-- Es aditivo y "hacia adelante": solo registra intentos posteriores a correr este script.

CREATE TABLE IF NOT EXISTS guias_remision_emisiones (
  id_emision            INT AUTO_INCREMENT PRIMARY KEY,
  id_guia               INT NOT NULL,
  serie_sunat           VARCHAR(4)    NULL,
  numero_sunat          INT           NULL,
  sunat_estado          VARCHAR(20)   NULL,   -- ENVIADO / ACEPTADO / RECHAZADO / ERROR
  sunat_response_code   VARCHAR(10)   NULL,
  sunat_response_desc   VARCHAR(4000) NULL,
  sunat_ticket          VARCHAR(120)  NULL,
  sunat_digest_value    VARCHAR(200)  NULL,
  xml_url               TEXT          NULL,   -- JSON {"url":...} (mismo formato que guias_remision)
  cdr_url               TEXT          NULL,
  sunat_qr_url          TEXT          NULL,
  snapshot_json         JSON          NULL,   -- args PDF-ready del intento (transporte, ruta, detalle, comex)
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gre_emisiones_guia (id_guia),
  CONSTRAINT fk_gre_emisiones_guia FOREIGN KEY (id_guia)
    REFERENCES guias_remision (id_guia) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
