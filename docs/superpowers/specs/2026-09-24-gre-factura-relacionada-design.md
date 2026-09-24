# GRE venta: declarar factura(s) relacionada(s) (factura → guía)

Fecha: 2026-09-24
Estado: Aprobado (diseño)

## Problema

Cuando se emite **primero la factura y después la guía de remisión** de una venta, la
GRE debe declarar la factura como documento relacionado
(`cac:AdditionalDocumentReference` con `IssuerParty` = RUC del emisor). Hoy el motor
de GRE **solo** puebla `docRelacionado` para guías de **compra** (desde
`ordenes_compra`); en la rama de **venta** queda `undefined`, por lo que la guía sale
sin la referencia a la factura.

El caso inverso (guía primero → factura declara la GRE vía
`cac:DespatchDocumentReference`) ya funciona, con auto-carga desde el sistema + buscador
manual en el panel de factura. Este trabajo es su espejo.

Molde de referencia real (aceptado por SUNAT): `docs/muestra/…EG07-358.xml`, que declara
`FE01-44` con `DocumentTypeCode` 01 (cat.61), `DocumentType` "Factura" e `IssuerParty`
con el RUC de la propia empresa (20550932297).

## Alcance (decisiones tomadas)

- **Documentos declarables:** solo **facturas** (auto + agregado manual). No boletas ni
  otros tipos.
- **Auto-carga:** solo facturas **SEE 01 ACEPTADAS por SUNAT** (`sunat_estado='ACEPTADO'`,
  con serie-número reales).
- **UI:** edición en el **wizard de emisión** (paso "Vista previa"), no en un panel aparte.
- **PDF:** las facturas relacionadas se muestran **dentro del cuadro de datos de cabecera**
  de la GRE (junto a RUC, punto de llegada, punto de origen, etc.), no en una lista separada.
- **Almacenamiento:** **tabla nueva dedicada** (no reusar la de comex
  `guias_remision_doc_relacionado`, para evitar conflictos futuros).

Fuera de alcance: comercio exterior (comex) y compra conservan su comportamiento actual
sin cambios. Una guía es compra **o** venta doméstica **o** comex; los tres caminos de
documentos relacionados no se solapan.

## Arquitectura

### 1. Tabla nueva (ya creada en BD)

```sql
CREATE TABLE guias_remision_factura_referencia (
  id         INT NOT NULL AUTO_INCREMENT,
  id_guia    INT NOT NULL,
  tipo_cod   VARCHAR(2)   NOT NULL DEFAULT '01',      -- cat.61: 01 = Factura
  tipo_desc  VARCHAR(120) NOT NULL DEFAULT 'Factura',
  serie      VARCHAR(20)  NOT NULL,
  numero     VARCHAR(50)  NOT NULL,
  id_factura INT DEFAULT NULL,                         -- liga blanda a facturas_venta (sistema); NULL si manual
  PRIMARY KEY (id),
  UNIQUE KEY uq_guia_doc (id_guia, tipo_cod, serie, numero),   -- dedup
  KEY fk_grfr_guia (id_guia),
  CONSTRAINT fk_grfr_guia FOREIGN KEY (id_guia) REFERENCES guias_remision(id_guia) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Sin FK a `facturas_venta` (las manuales pueden no tener fila local); `id_factura` es
liga blanda/auditoría.

### 2. Lectura para pre-cargar (GET)

Extender `getGuiaRemisionById` (backend/controllers/guiasRemision.controller.js) para que,
en guías de **venta doméstica** (no compra, no comex), devuelva:

- `facturas_relacionadas`: filas ya guardadas en la tabla nueva (reabrir/editar una guía
  ya configurada).
- `facturas_sugeridas`: facturas **SEE 01 ACEPTADAS** de la OV de la guía
  (`codigo_tipo_sunat='01' AND sunat_estado='ACEPTADO' AND estado<>'Anulada'`), con
  `serie`, `numero`, `numero_factura`, `id_factura`.

Ambos arrays vacíos en guías de compra/comex (no aplica).

### 3. Wizard de emisión (frontend/src/pages/Ventas/NuevaGuiaRemision.jsx, paso Vista previa)

Nueva sección **"Documentos relacionados (Facturas)"**:

- Al abrir: si `facturas_relacionadas` tiene filas, se muestran (marcadas); si no, se
  **pre-marcan** las `facturas_sugeridas` (esto materializa el "jala automático").
- Checkboxes para incluir/excluir cada factura sugerida.
- Botón **"Agregar factura"** para ingreso manual (serie + número; tipo fijo Factura 01).
- Se refleja en el resumen de vista previa.
- Al emitir, envía en el body: `docs_relacionados_venta: [{ tipo_cod:'01', serie, numero, id_factura? }]`.

### 4. Persistencia autoritativa (backend/controllers/sunat.controller.js → emitirGuiaRemision)

Antes de llamar a `emitirGuiaGre`:

- Si `b.docs_relacionados_venta` es un array (incluida lista vacía): es **autoritativo** →
  `DELETE` de las filas de esa guía + `INSERT` de la lista, deduplicada por
  `tipo_cod|serie|numero`.
- Validación de formato de cada entrada (serie/número no vacíos; `tipo_cod` forzado a '01').
  Un error lanza `AppError` 400/422 **antes** de que `emitirGuiaGre` reserve el correlativo
  → no se quema numeración (mismo criterio que la validación previa existente).
- Si `b.docs_relacionados_venta` es `undefined` (cliente viejo / API directa): no se toca la
  tabla; se emite con lo que haya guardado (o nada). El "auto-jala" vive en el pre-fill del
  wizard, no en una derivación sorpresa al emitir.

### 5. Construcción del XML (backend/services/sunat/ubl-gre.service.js)

- Generalizar el bloque de documento relacionado a un **array** `d.docsRelacionadosVenta`.
  Cada elemento emite:

```xml
<cac:AdditionalDocumentReference>
  <cbc:ID><![CDATA[FE01-44]]></cbc:ID>
  <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte"
    listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">01</cbc:DocumentTypeCode>
  <cbc:DocumentType><![CDATA[Factura]]></cbc:DocumentType>
  <cac:IssuerParty>
    <cac:PartyIdentification>
      <cbc:ID schemeID="6" [SCHEME_DOC]><![CDATA[<RUC empresa>]]></cbc:ID>
    </cac:PartyIdentification>
  </cac:IssuerParty>
</cac:AdditionalDocumentReference>
```

  Reutiliza la forma con `IssuerParty` que ya existe para compra (ubl-gre.service.js:252-259),
  pero con `issuerRuc = empresa.ruc`.
- Mismo slot del template: `${notaXml}${docRelXml}${docsVentaXml}${comexDocsXml}`, justo
  después de `DespatchAdviceTypeCode` y antes de `cac:Signature`. **No se modifica** el
  `docRelacionado` (compra) ni `comexDocsXml` (comex).

`backend/services/sunat/gre-emision.service.js` (rama venta, no compra/comex): lee las filas
de la tabla nueva y arma `docsRelacionadosVenta = filas.map(f => ({ tipo:f.tipo_cod,
tipo_desc:f.tipo_desc, numero: f.serie ? `${f.serie}-${f.numero}` : f.numero,
issuerRuc: empresa.ruc }))`.

### 6. PDF (backend/utils/pdfGenerators/guiaRemisionSunatPDF.js + snapshot)

- Mostrar las facturas relacionadas **dentro del cuadro de datos de cabecera** de la GRE
  (junto a RUC emisor/destinatario, punto de partida, punto de llegada, etc.), p. ej. una
  línea "Doc. relacionado: FE01-44" (varias facturas separadas por coma).
- Incluir las facturas en `construirSnapshotPdfGre` (gre-emision.service.js) para que la
  reimpresión histórica (incl. marca RECHAZADO) sea fiel: XML ↔ PDF congruentes.

## Manejo de errores / anti-rechazo

- Solo `tipo_cod='01'` (Factura) → código válido del catálogo 61.
- `IssuerParty` RUC de la empresa (11 díg.), `schemeID="6"` cat.06 — calcado del molde real
  `docs/muestra`.
- Dedup por índice UNIQUE `(id_guia, tipo_cod, serie, numero)`.
- Validación de formato antes de numerar (no se quema correlativo ante entrada inválida).
- Orden de nodos: `Note → AdditionalDocumentReference → cac:Signature` (verificado contra el
  molde).

## Pruebas

- **npm run test:gre**:
  - Guía de venta con 1 factura → XML contiene un `AdditionalDocumentReference` con serie FE,
    `DocumentTypeCode` 01, `DocumentType` Factura, `IssuerParty` con RUC de la empresa.
  - Con 2 facturas → dos nodos, en orden.
  - Sin facturas → ningún nodo (regresión: guías de venta actuales siguen pasando).
  - Compra y comex: sin cambios (regresión).
  - Aserción del orden de nodos y comparación estructural contra `docs/muestra/…EG07-358.xml`.
- **npm run test:pdf**:
  - La GRE de venta muestra la(s) factura(s) en el cuadro de cabecera.
  - Snapshot fiel (reimpresión).

## Archivos afectados (estimado)

- `backend/controllers/guiasRemision.controller.js` — getGuiaRemisionById (pre-fill).
- `backend/controllers/sunat.controller.js` — emitirGuiaRemision (persistencia autoritativa + validación).
- `backend/services/sunat/gre-emision.service.js` — rama venta (leer filas + snapshot).
- `backend/services/sunat/ubl-gre.service.js` — array de documentos relacionados de venta.
- `backend/utils/pdfGenerators/guiaRemisionSunatPDF.js` — cuadro de cabecera.
- `frontend/src/pages/Ventas/NuevaGuiaRemision.jsx` — sección editable en Vista previa.
- Scripts de prueba: `backend/scripts/test-gre-xml.js`, `test-pdf-sunat.js` (casos nuevos).
- DDL: tabla `guias_remision_factura_referencia` (ya creada en BD).
