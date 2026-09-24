# GRE venta: factura relacionada (factura → guía) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando se factura antes de emitir la guía de remisión de una venta, declarar la(s) factura(s) en la GRE (`cac:AdditionalDocumentReference` con `IssuerParty` = RUC de la empresa), auto-cargadas desde la OV y editables en el wizard.

**Architecture:** El builder de XML gana un array `docsRelacionadosVenta` (reutiliza la forma con `IssuerParty` que ya existe para compra). La emisión lee las facturas de una tabla nueva `guias_remision_factura_referencia`; el wizard las pre-carga desde las facturas ACEPTADAS de la OV y envía la lista autoritativa, que se persiste (dedup) antes de numerar. El PDF las muestra en el cuadro de cabecera del destinatario.

**Tech Stack:** Node.js (ESM) + MySQL (mysql2), PDFKit, fast-xml-parser (tests). Frontend React.

> **Nota de flujo:** en este repo los commits los hace el usuario a mano en `main`. Los pasos "Commit" son **checkpoints**: deja el árbol listo y el usuario commitea. No crear ramas ni commitear salvo que lo pida.

> **DDL ya aplicado:** la tabla `guias_remision_factura_referencia` ya fue creada en la BD por el usuario (ver spec `docs/superpowers/specs/2026-09-24-gre-factura-relacionada-design.md`). No hace falta correr DDL.

---

### Task 1: Builder XML — array de facturas de venta

**Files:**
- Modify: `backend/services/sunat/ubl-gre.service.js` (bloque de documento relacionado ~246-264 y template ~335)
- Test: `backend/scripts/test-gre-xml.js` (agregar sección al final, antes del resumen)

- [ ] **Step 1: Escribir el test que falla** — añadir al final de `backend/scripts/test-gre-xml.js`, JUSTO ANTES del bloque que imprime el resumen (`console.log('\n=== Resultado`... o el cálculo final de pass/fail):

```js
// ── Documentos relacionados de VENTA (factura → guía) — molde EG07-358 ────────
console.log('\n=== Venta: factura(s) relacionada(s) (AdditionalDocumentReference) ===\n');
const datosConFactura = {
  ...datos,
  docsRelacionadosVenta: [
    { tipo: '01', tipo_desc: 'Factura', numero: 'FE01-44', issuerRuc: RUC },
    { tipo: '01', tipo_desc: 'Factura', numero: 'FE01-45', issuerRuc: RUC },
  ],
};
const { xml: xmlFact } = construirDespatchAdviceXML(datosConFactura);
const docFact = parser.parse(xmlFact).DespatchAdvice;
const refsRaw = docFact.AdditionalDocumentReference;
const refs = Array.isArray(refsRaw) ? refsRaw : (refsRaw ? [refsRaw] : []);
check('Venta: 2 AdditionalDocumentReference', refs.length === 2, `n=${refs.length}`);
check('Venta: ID = FE01-44', String(refs[0]?.ID) === 'FE01-44', `ID=${refs[0]?.ID}`);
check('Venta: DocumentTypeCode = 01', String(refs[0]?.DocumentTypeCode?.['#text']) === '01');
check('Venta: DocumentType = Factura', String(refs[0]?.DocumentType) === 'Factura');
check('Venta: IssuerParty RUC = emisor',
  String(refs[0]?.IssuerParty?.PartyIdentification?.ID?.['#text']) === RUC);
check('Venta: AdditionalDocumentReference antes de cac:Signature',
  xmlFact.indexOf('AdditionalDocumentReference') > -1 &&
  xmlFact.indexOf('AdditionalDocumentReference') < xmlFact.indexOf('<cac:Signature>'));
check('Regresión: guía base (sin facturas) NO trae AdditionalDocumentReference',
  da.AdditionalDocumentReference === undefined);
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `cd backend; npm run test:gre`
Expected: FALLAN los checks nuevos "Venta: …" (0 AdditionalDocumentReference porque el builder aún no soporta el array). Los demás siguen en verde.

- [ ] **Step 3: Implementar en `ubl-gre.service.js`** — justo DESPUÉS del bloque `const docRelXml = …` (termina ~línea 264), agregar:

```js
  // Documentos relacionados de VENTA (facturas): factura → guía. Array. Misma forma que la de
  // compra con cac:IssuerParty, pero el emisor de la factura es la propia empresa (issuerRuc lo
  // pasa el caller = empresa.ruc). Calcado del molde real aceptado docs/muestra/…EG07-358.xml.
  const docsVentaXml = (Array.isArray(d.docsRelacionadosVenta) ? d.docsRelacionadosVenta : [])
    .filter((doc) => doc && doc.numero)
    .map((doc) => `\n  <cac:AdditionalDocumentReference>
    <cbc:ID>${cdata(doc.numero)}</cbc:ID>
    <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">${cdata(doc.tipo || '01')}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${cdata(doc.tipo_desc || 'Factura')}</cbc:DocumentType>
    <cac:IssuerParty>
      <cac:PartyIdentification><cbc:ID schemeID="6" ${SCHEME_DOC}>${cdata(doc.issuerRuc)}</cbc:ID></cac:PartyIdentification>
    </cac:IssuerParty>
  </cac:AdditionalDocumentReference>`).join('');
```

  Luego, en el template, insertar `${docsVentaXml}` en el slot de documentos relacionados. Cambiar:

```js
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>${notaXml}${docRelXml}${comexDocsXml}
```

  por:

```js
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>${notaXml}${docRelXml}${docsVentaXml}${comexDocsXml}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `cd backend; npm run test:gre`
Expected: TODOS en verde, incluidos los checks nuevos "Venta: …". Sin regresiones (compra/comex intactos).

- [ ] **Step 5: Checkpoint commit (lo hace el usuario)**

Árbol listo. Sugerencia de mensaje: `feat(gre): factura relacionada en XML de venta (AdditionalDocumentReference)`.

---

### Task 2: Emisión — leer facturas de la tabla y pasarlas al builder + snapshot

**Files:**
- Modify: `backend/services/sunat/gre-emision.service.js` (declaración ~249, rama venta ~272-287, `datos` ~481-485, `construirSnapshotPdfGre` params ~53-58 y return ~112-114)

- [ ] **Step 1: Declarar el acumulador** — en la línea donde hoy dice:

```js
    let destinatario, proveedor = null, docRelacionado = undefined;
```

  cambiar a:

```js
    let destinatario, proveedor = null, docRelacionado = undefined, docsRelacionadosVenta = [];
```

- [ ] **Step 2: Leer las facturas en la rama de venta** — dentro del bloque `} else {` de venta (después de fijar `destinatario` y el bloque comex, antes del `}` que cierra el else, ~línea 286), agregar:

```js
      // Documentos relacionados de VENTA (facturas declaradas): factura → guía. Solo venta
      // doméstica (comex maneja sus DAM aparte). El emisor de la factura es la propia empresa.
      if (!esComex) {
        const [refs] = await conn.query(
          `SELECT tipo_cod, tipo_desc, serie, numero
             FROM guias_remision_factura_referencia WHERE id_guia = ? ORDER BY id`, [idGuia]);
        docsRelacionadosVenta = refs.map((r) => ({
          tipo: r.tipo_cod,
          tipo_desc: r.tipo_desc,
          numero: r.serie ? `${r.serie}-${r.numero}` : r.numero,
          issuerRuc: empresa.ruc,
        }));
      }
```

- [ ] **Step 3: Pasar el array al builder** — en el objeto `datos` que se arma antes de `construirDespatchAdviceXML(datos)` (~481-485), añadir la propiedad. Cambiar:

```js
      observacion, comex, proveedor, docRelacionado
    };
```

  por:

```js
      observacion, comex, proveedor, docRelacionado, docsRelacionadosVenta
    };
```

- [ ] **Step 4: Incluir en el snapshot del PDF** — en `construirSnapshotPdfGre`, añadir el parámetro y el campo de retorno. En la firma (~53-58) agregar `docsRelacionadosVenta,` junto a `docRelacionado,`. En el return (~113) después de la línea `docRelacionado: …,` agregar:

```js
    docsRelacionadosVenta: Array.isArray(docsRelacionadosVenta)
      ? docsRelacionadosVenta.map((doc) => ({ tipo_desc: doc.tipo_desc, numero: doc.numero }))
      : [],
```

  Y en la llamada a `construirSnapshotPdfGre({ … })` (~537-541) agregar `docsRelacionadosVenta,` a los argumentos (junto a `docRelacionado,`).

- [ ] **Step 5: Regresión** — el test offline no toca BD, pero verifica que nada se rompió al compilar/ejecutar el pipeline mock:

Run: `cd backend; npm run test:gre`
Expected: TODO en verde (los checks de Task 1 siguen pasando; el pipeline mock corre sin error).

- [ ] **Step 6: Checkpoint commit (lo hace el usuario)**

Sugerencia: `feat(gre): emisión de venta lee facturas relacionadas + snapshot PDF`.

---

### Task 3: Persistencia autoritativa + validación (antes de numerar)

**Files:**
- Modify: `backend/controllers/sunat.controller.js` → `emitirGuiaRemision` (~1181-1286, antes de `const observacion = …`)

- [ ] **Step 1: Implementar el bloque de persistencia** — justo ANTES de la línea:

```js
    // Si el panel envía `observaciones` (editable, prellenado con la OC) se usa tal cual como
```

  insertar:

```js
    // ── Documentos relacionados de VENTA (facturas): factura → guía ────────────────
    // Lista AUTORITATIVA del wizard: si viene un array (aunque sea vacío), reemplaza lo guardado.
    // Se valida el formato ANTES de numerar (un error tira 400 sin quemar correlativo). Solo
    // facturas (tipo_cod forzado a '01'); dedup por (id_guia, tipo_cod, serie, numero) vía UNIQUE.
    if (Array.isArray(b.docs_relacionados_venta)) {
      const limpias = [];
      const vistos = new Set();
      for (const d of b.docs_relacionados_venta) {
        const serie = String(d?.serie || '').trim().toUpperCase();
        const numero = String(d?.numero || '').trim();
        if (!serie || !numero) throw new AppError('Documento relacionado inválido: falta serie o número de la factura', 400);
        if (!/^[A-Z0-9]{1,20}$/.test(serie)) throw new AppError(`Serie de factura inválida: "${serie}"`, 400);
        if (!/^[0-9]{1,50}$/.test(numero)) throw new AppError(`Número de factura inválido: "${numero}"`, 400);
        const clave = `01|${serie}|${numero}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        limpias.push({ serie, numero, id_factura: d?.id_factura ? Number(d.id_factura) : null });
      }
      await pool.query('DELETE FROM guias_remision_factura_referencia WHERE id_guia = ?', [idGuia]);
      if (limpias.length) {
        await pool.query(
          `INSERT IGNORE INTO guias_remision_factura_referencia
             (id_guia, tipo_cod, tipo_desc, serie, numero, id_factura) VALUES ?`,
          [limpias.map((x) => [idGuia, '01', 'Factura', x.serie, x.numero, x.id_factura])]);
      }
    }
```

- [ ] **Step 2: Verificar que no rompe la emisión existente**

Run: `cd backend; npm run test:gre`
Expected: TODO en verde (este archivo no lo cubre el test offline, pero debe seguir importándose sin error de sintaxis; el runner importa el builder, no el controller — confirmar que `node -c` no falla).

Run: `cd backend; node --check controllers/sunat.controller.js`
Expected: sin salida (sintaxis OK).

- [ ] **Step 3: Checkpoint commit (lo hace el usuario)**

Sugerencia: `feat(gre): persistir facturas relacionadas de la guía (autoritativo, valida antes de numerar)`.

---

### Task 4: Pre-carga en el detalle de la guía (GET)

**Files:**
- Modify: `backend/controllers/guiasRemision.controller.js` → `getGuiaRemisionById`, bloque de comex ~282-294

- [ ] **Step 1: Implementar** — DESPUÉS del bloque `if (Number(guia.es_comercio_exterior) === 1) { … } else { … }` que setea `guia.docs_relacionados`/`guia.contenedores` (~294), agregar:

```js
    // Venta doméstica: facturas relacionadas ya guardadas + facturas SEE ACEPTADAS de la OV
    // (sugeridas para pre-marcar en el wizard). Comex/compra no aplican → arrays vacíos.
    if (guia.tipo_origen !== 'Compra' && Number(guia.es_comercio_exterior) !== 1) {
      const relacionadasResult = await executeQuery(
        `SELECT tipo_cod, tipo_desc, serie, numero, id_factura
           FROM guias_remision_factura_referencia WHERE id_guia = ? ORDER BY id`, [id]);
      guia.facturas_relacionadas = relacionadasResult.success ? relacionadasResult.data : [];
      let sugeridas = [];
      if (guia.id_orden_venta) {
        const sugeridasResult = await executeQuery(
          `SELECT id_factura, numero_factura, serie, numero
             FROM facturas_venta
            WHERE id_orden_venta = ? AND codigo_tipo_sunat = '01'
              AND estado <> 'Anulada' AND sunat_estado = 'ACEPTADO'
            ORDER BY id_factura`, [guia.id_orden_venta]);
        sugeridas = sugeridasResult.success ? sugeridasResult.data : [];
      }
      guia.facturas_sugeridas = sugeridas;
    } else {
      guia.facturas_relacionadas = [];
      guia.facturas_sugeridas = [];
    }
```

- [ ] **Step 2: Verificar sintaxis**

Run: `cd backend; node --check controllers/guiasRemision.controller.js`
Expected: sin salida (OK).

- [ ] **Step 3: Verificación manual (con backend levantado)**

Con una guía de venta cuya OV ya tiene una factura ACEPTADA, `GET /api/ventas/guias-remision/:id` debe devolver `facturas_sugeridas` con esa factura y `facturas_relacionadas` (vacío si aún no se configuró). Confirmar en la respuesta JSON.

- [ ] **Step 4: Checkpoint commit (lo hace el usuario)**

Sugerencia: `feat(gre): getGuiaRemisionById expone facturas_sugeridas/relacionadas (venta)`.

---

### Task 5: PDF — factura relacionada en el cuadro de cabecera

**Files:**
- Modify: `backend/utils/pdfGenerators/guiaRemisionSunatPDF.js` (destructure ~93 y sección "Datos del destinatario" ~331-347)
- Test: `backend/scripts/test-pdf-sunat.js` (agregar un caso GRE con facturas)

- [ ] **Step 1: Escribir el test que falla** — en `backend/scripts/test-pdf-sunat.js`, después del bloque del `pdfGre` (Ripley, tras la línea `await fs.writeFile(path.join(outDir, 'test-TE01-1.pdf'), pdfGre);` ~146), agregar:

```js
  // GRE de venta con factura(s) relacionada(s) → cuadro "Datos del destinatario"
  const pdfGreFact = await generarGuiaRemisionSunatPDF({
    guia: {
      serie_sunat: 'TE01', numero_sunat: 2, fecha_emision: '18/09/2026 10:59:00', fecha_traslado: '18/09/2026',
      motivo_traslado_cod: '01', peso_bruto_kg: 100,
      ubigeo_partida: '150142', direccion_partida: 'COO. LAS VERTIENTES - VILLA EL SALVADOR',
      ubigeo_llegada: '110108', direccion_llegada: 'FUNDO GENETICA - ICA',
      sunat_estado: 'ACEPTADO', sunat_digest_value: digestPara('TE01-2'),
    },
    emisor, cliente: clienteRipley,
    detalle: [{ codigo: 'RBT60G008', nombre: 'ROLLO BURBUPACK 1.50 x 100 MTS', cantidad: 100, codigo_unidad_sunat: 'NIU' }],
    vehiculos: [{ placa: 'BKK901' }],
    conductor: { nombre_completo: 'DIAZ ORIZANO MIRCO', dni: '80334861', licencia_conducir: 'M80334861' },
    docsRelacionadosVenta: [
      { tipo_desc: 'Factura', numero: 'FE01-44' },
      { tipo_desc: 'Factura', numero: 'FE01-45' },
    ],
    qrBuffer: qrGre
  });
  check('GRE con factura relacionada genera PDF válido', esPdf(pdfGreFact), `${pdfGreFact.length} bytes`);
  const txtGreFact = await textoDe(pdfGreFact);
  check('GRE imprime la(s) factura(s) relacionada(s) en cabecera',
    txtGreFact.includes('Documento relacionado') && txtGreFact.includes('FE01-44') && txtGreFact.includes('FE01-45'));
  await fs.writeFile(path.join(outDir, 'test-TE01-2-factura.pdf'), pdfGreFact);
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `cd backend; npm run test:pdf`
Expected: FALLA el check "GRE imprime la(s) factura(s) relacionada(s)…" (el PDF aún no recibe ni pinta `docsRelacionadosVenta`).

- [ ] **Step 3: Implementar** — en `guiaRemisionSunatPDF.js`:

  (a) Añadir al destructure (~93, junto a `docRelacionado = null,`):

```js
  docsRelacionadosVenta = [],
```

  (b) En el cálculo de altura de "Datos del destinatario", después del bloque `if (docRelacionado?.numero) { destinatarioBodyHeight += … }` (~334-337), agregar:

```js
      const facturasVentaPdf = (Array.isArray(docsRelacionadosVenta) ? docsRelacionadosVenta : []).filter((f) => f?.numero);
      if (facturasVentaPdf.length) {
        const textoFacturas = facturasVentaPdf.map((f) => `${f.tipo_desc || 'Factura'} N° ${f.numero}`).join(' · ');
        destinatarioBodyHeight += fullWidthHeight('Documento relacionado:', textoFacturas, { labelWidth: 125 });
      }
```

  (c) En el render (después del `if (docRelacionado?.numero) { fullWidthRow(…) }` ~344-347, dentro de la misma sección antes de `sectionEnd(top);`), agregar:

```js
      if (facturasVentaPdf.length) {
        const textoFacturas = facturasVentaPdf.map((f) => `${f.tipo_desc || 'Factura'} N° ${f.numero}`).join(' · ');
        fullWidthRow('Documento relacionado:', textoFacturas, { labelWidth: 125 });
      }
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `cd backend; npm run test:pdf`
Expected: TODO en verde, incluido el check nuevo. El PDF `test-TE01-2-factura.pdf` se genera en el outDir.

- [ ] **Step 5: Checkpoint commit (lo hace el usuario)**

Sugerencia: `feat(gre): PDF muestra factura relacionada en el cuadro del destinatario`.

---

### Task 6: Wizard — sección editable de facturas relacionadas

**Files:**
- Modify: `frontend/src/pages/Ventas/NuevaGuiaRemision.jsx` (paso "Vista previa" del wizard de emisión)

- [ ] **Step 1: Estado + carga inicial** — al montar/abrir el wizard de emisión, cuando ya se tiene la guía (respuesta del GET con `facturas_relacionadas` y `facturas_sugeridas`), inicializar el estado de la lista. Lógica: si `facturas_relacionadas.length > 0` usarlas (todas marcadas); si no, pre-marcar las `facturas_sugeridas`. Agregar estado:

```jsx
const [facturasRel, setFacturasRel] = useState([]); // [{ serie, numero, id_factura, incluida }]

// Al recibir la guía (dentro del efecto/handler que ya carga sus datos):
const relacionadas = guia.facturas_relacionadas || [];
const sugeridas = guia.facturas_sugeridas || [];
const base = relacionadas.length
  ? relacionadas.map((f) => ({ serie: f.serie, numero: f.numero, id_factura: f.id_factura || null, incluida: true }))
  : sugeridas.map((f) => ({ serie: f.serie, numero: String(f.numero), id_factura: f.id_factura, incluida: true }));
setFacturasRel(base);
```

- [ ] **Step 2: UI en el paso Vista previa** — agregar una sección (solo para guías de venta, es decir cuando NO es comex y NO es compra) con la lista editable:

```jsx
<div className="wizard-seccion">
  <h4>Documentos relacionados (Facturas)</h4>
  {facturasRel.length === 0 && <p className="text-muted">Sin facturas. Agrega una si corresponde.</p>}
  {facturasRel.map((f, i) => (
    <div key={`${f.serie}-${f.numero}-${i}`} className="fila-factura">
      <label>
        <input type="checkbox" checked={f.incluida}
          onChange={(e) => setFacturasRel((prev) => prev.map((x, j) => j === i ? { ...x, incluida: e.target.checked } : x))} />
        {' '}Factura {f.serie}-{f.numero}
      </label>
      <button type="button" onClick={() => setFacturasRel((prev) => prev.filter((_, j) => j !== i))}>Quitar</button>
    </div>
  ))}
  <FacturaManualInput onAdd={(serie, numero) =>
    setFacturasRel((prev) => [...prev, { serie: serie.toUpperCase(), numero, id_factura: null, incluida: true }])} />
</div>
```

  `FacturaManualInput` = par de inputs (serie, número) + botón "Agregar factura" (validación mínima: ambos no vacíos). Seguir el estilo de los inputs existentes del wizard.

- [ ] **Step 3: Enviar en el body de emisión** — donde el wizard arma el body del POST de emisión (`emitirGuiaRemision`), añadir:

```jsx
docs_relacionados_venta: facturasRel
  .filter((f) => f.incluida && f.serie && f.numero)
  .map((f) => ({ tipo_cod: '01', serie: f.serie, numero: String(f.numero), id_factura: f.id_factura || null })),
```

- [ ] **Step 4: Verificación manual (end-to-end)**

Con backend+frontend levantados y una OV con factura ACEPTADA:
1. Crear/abrir la guía de venta y entrar al wizard de emisión.
2. En "Vista previa" debe aparecer la factura pre-marcada. Quitarla/agregar otra y emitir.
3. Confirmar que el XML emitido contiene `cac:AdditionalDocumentReference` con la(s) factura(s) elegida(s) y que el PDF la muestra en el cuadro del destinatario.

- [ ] **Step 5: Checkpoint commit (lo hace el usuario)**

Sugerencia: `feat(gre): wizard permite auto-cargar/editar facturas relacionadas de la guía`.

---

## Verificación final

- [ ] `cd backend; npm run test:gre` → todo verde (incluye casos de venta con 1/2/0 facturas + regresión compra/comex).
- [ ] `cd backend; npm run test:pdf` → todo verde (incluye factura en cabecera).
- [ ] Prueba manual end-to-end del wizard (Task 6, Step 4).
- [ ] Comparar el XML generado contra `docs/muestra/…EG07-358.xml`: mismo nodo `AdditionalDocumentReference` (ID, DocumentTypeCode 01, DocumentType Factura, IssuerParty RUC emisor), en el orden `Note → AdditionalDocumentReference → cac:Signature`.
