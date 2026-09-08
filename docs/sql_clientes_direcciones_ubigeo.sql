-- UBIGEO por domicilio de cliente (Catálogo 13 SUNAT / código INEI de 6 dígitos).
-- El esquema actual YA contiene clientes_direcciones.ubigeo VARCHAR(10), por lo que NO se debe
-- ejecutar ADD COLUMN. La aplicación valida y guarda exactamente 6 dígitos.

-- 1) Normalizar valores ya almacenados (no modifica códigos válidos).
UPDATE clientes_direcciones
SET ubigeo = NULLIF(TRIM(ubigeo), '')
WHERE ubigeo IS NOT NULL;

-- 2) Recuperar automáticamente el ubigeo de la GRE más reciente cuando coinciden cliente y dirección.
-- Las filas que continúen en NULL deben completarse desde la ficha del cliente.
UPDATE clientes_direcciones cd
SET cd.ubigeo = (
  SELECT gr.ubigeo_llegada
  FROM guias_remision gr
  WHERE gr.id_cliente = cd.id_cliente
    AND TRIM(gr.direccion_llegada) = TRIM(cd.direccion)
    AND gr.ubigeo_llegada REGEXP '^[0-9]{6}$'
  ORDER BY gr.id_guia DESC
  LIMIT 1
)
WHERE cd.ubigeo IS NULL
  AND EXISTS (
    SELECT 1
    FROM guias_remision gr
    WHERE gr.id_cliente = cd.id_cliente
      AND TRIM(gr.direccion_llegada) = TRIM(cd.direccion)
      AND gr.ubigeo_llegada REGEXP '^[0-9]{6}$'
  );

-- 3) Control posterior: estas son las direcciones pendientes de regularizar desde la ficha del cliente.
SELECT cd.id_direccion, cd.id_cliente, c.razon_social, cd.direccion
FROM clientes_direcciones cd
INNER JOIN clientes c ON c.id_cliente = cd.id_cliente
WHERE cd.estado = 'Activo'
  AND (cd.ubigeo IS NULL OR cd.ubigeo NOT REGEXP '^[0-9]{6}$')
ORDER BY c.razon_social, cd.es_principal DESC;

-- 4) OPCIONAL, recomendado cuando la consulta anterior ya no devuelva códigos inválidos distintos
-- de NULL. Reduce la columna al tamaño real del Catálogo 13. Los NULL históricos siguen permitidos.
-- ALTER TABLE clientes_direcciones
--   MODIFY COLUMN ubigeo VARCHAR(6) NULL
--     COMMENT 'Código UBIGEO INEI/SUNAT de 6 dígitos del domicilio';
