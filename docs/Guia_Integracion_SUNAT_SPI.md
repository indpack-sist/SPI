# GUÍA MAESTRA DE INTEGRACIÓN NATIVA CON SUNAT — SPI / INDPACK PERÚ

**Facturación Electrónica SEE — Del Contribuyente (sin OSE / PSE / APIs de terceros)**

- **Alcance:** Facturas · Notas de Crédito y Débito · Comunicaciones de Baja (RA) · Consultas de estado y CDR · GRE Remitente (09) y Transportista (31) · Anulaciones · PDF con QR. Boletas de venta: fuera de alcance.
- **Stack:** React 18 + Vite (Vercel) · Node.js/Express ES Modules (Render) · MySQL (Railway) · JWT · Socket.IO · Cloudinary · pdfkit
- **Rama de desarrollo:** main (todo el código nuevo se implementa y despliega desde main)
- **Modo de trabajo:** primero TODO en Beta (SUNAT_MODE=BETA); Producción solo en la Fase 16
- **Series definitivas (ya insertadas en series_correlativos):** FE01 (facturas, 01) · FC01 (NC, 07) · FD01 (ND, 08) · TE01 (GRE Remitente, 09) · VE01 (GRE Transportista, 31)
- **Versión:** 1.1 — 20 de agosto de 2026

> Este archivo .md es la versión para IA/editores de la misma guía entregada en .docx. El contenido es idéntico.


---


# 0. Cómo usar esta guía (leer primero)

Esta guía está diseñada como una **secuencia estricta de fases**. Cada fase termina con un punto de control ("PUNTO DE CONTROL"). **No avances a la siguiente fase hasta que todos los ítems del punto de control estén marcados y verificados.** El orden no es opcional: la firma depende del certificado, el envío depende de la firma, las bajas dependen de comprobantes aceptados, y las guías dependen de credenciales API distintas a las de facturación.


## 0.1 Reglas de trabajo de esta implementación (v1.1)

- **Rama de desarrollo: `main`.** El branch anterior de facturación queda descartado como base; puede consultarse como referencia de la firma ya validada en Beta, pero TODO el código nuevo de esta guía se implementa y despliega desde `main` (Render despliega `main`). El backend actual NO tiene `config/sunat.js` ni el módulo `services/sunat/`: se construyen desde cero siguiendo las Fases 2, 4 y 5.
- **Beta primero, siempre.** Todo se desarrolla y prueba con `SUNAT_MODE=BETA` (credenciales `MODDATOS`/`moddatos`). Solo se cambia a `PROD` al ejecutar la Fase 16, nunca antes. En Beta puede firmarse con el certificado real de producción: el ambiente Beta no valida el certificado contra el registro de SOL.
- **Boletas de venta: NO se emitirán.** Todo lo relativo a boletas (tipo 03) y a Resúmenes Diarios (RC) queda fuera de alcance. La anulación de comprobantes se hace únicamente por Comunicación de Baja (RA), que aplica a facturas y sus notas.
- **Series definitivas (ya pactadas e insertadas en BD):** `FE01` facturas (01), `FC01` notas de crédito (07), `FD01` notas de débito (08), `TE01` GRE Remitente (09), `VE01` GRE Transportista (31). Todas nuevas, arrancan en 1. No usar las series antiguas del portal SOL.


## 0.2 Estado actual de los prerrequisitos (qué está hecho y qué falta)

| Ítem | Estado | Detalle |
| --- | --- | --- |
| Certificado digital tributario | COMPLETADO | Generado directamente en SUNAT (.p12). Activo en SOL, vigente 20/08/2026 → 19/08/2029. Serie 612689e…eebc16 |
| Conversión a PEM | COMPLETADO | private_key.pem + certificate.pem extraídos con OpenSSL; hashes de módulo verificados idénticos |
| Registro del certificado en SOL | COMPLETADO | Figura Activo en "Registro y Mantenimiento de Correo y Certificados Digitales" |
| Correo del SEE | COMPLETADO | Actualizado en la misma pantalla |
| Elección SEE - Del Contribuyente | COMPLETADO | Casilla marcada en SOL |
| Series en `series_correlativos` | COMPLETADO | Las 5 series insertadas con ultimo_numero = 0 |
| Variables SUNAT_CERT_B64 / SUNAT_KEY_B64 en Render | PENDIENTE VERIFICAR | Cargarlas si aún no están (Fase 2) |
| Usuario secundario SOL (SPIFACT01) | PENDIENTE | Fase 1.1 |
| Credenciales API GRE (client_id/secret) | PENDIENTE | Fase 1.4 |
| Todo el código backend/BD/frontend | PENDIENTE | Fases 2 a 15, en rama main |

| Fase | Contenido | Depende de |
| --- | --- | --- |
| 1 | Prerrequisitos administrativos en SUNAT (SOL, certificado, credenciales GRE, series) | — |
| 2 | Configuración del entorno (variables en Render, certificados) | Fase 1 |
| 3 | Actualización de la base de datos MySQL (Railway) | — |
| 4 | Arquitectura de código backend (servicios SUNAT) | Fases 2 y 3 |
| 5 | Certificado y firma digital XML-DSig | Fases 2 y 4 |
| 6 | Emisión de Facturas (UBL 2.1 + sendBill + CDR) | Fase 5 |
| 7 | Notas de Crédito y Débito | Fase 6 |
| 8 | Bajas: Comunicación de Baja (RA) | Fase 6 |
| 9 | Consultas de estado y CDR (getStatus / getStatusCdr / validez) | Fase 6 |
| 10 | GRE Remitente (tipo 09) por API REST | Fases 1.4 y 5 |
| 11 | GRE Transportista (tipo 31) | Fase 10 |
| 12 | Anulación / subsanación de guías | Fases 10–11 |
| 13 | Representación impresa (PDF) con código QR y hash | Fase 6 |
| 14 | Endpoints del API SPI y cambios en frontend | Fases 6–13 |
| 15 | Cola de reintentos, trazabilidad y contingencia | Fase 14 |
| 16 | Paso a producción: checklist final | Todas |

> **IMPORTANTE:** Tu sistema ya validó en Beta la generación UBL, la firma XML-DSig (RSA-SHA512 + C14N exclusiva) y la recepción de CDR aceptado con `ResponseCode = 0` para facturas de prueba. Esta guía reutiliza esa base: donde diga "ya validado en Beta" solo se ajusta configuración, no se reescribe código.

Convenciones usadas en toda la guía:

- `RUC_EMISOR` = RUC de INDPACK PERÚ (11 dígitos, empieza en 20).
- Nombres de archivo SUNAT: `{RUC}-{TIPO}-{SERIE}-{NUMERO}.xml` (ej.: `20601234567-01-FE01-00000123.xml`). El correlativo NO lleva ceros obligatorios en el XML, pero se recomienda 8 dígitos en el nombre de archivo por consistencia.
- Todos los ejemplos de backend son Node.js con ES Modules, coherentes con tu proyecto (`services/`, `controllers/`, `routes/`, `utils/`).
- Zona horaria: todas las fechas de emisión se calculan con `America/Lima` (UTC-5), igual que tu pool MySQL.


---


# FASE 1 — Prerrequisitos administrativos en SUNAT

Nada de esta fase es código. Son trámites y configuraciones en SUNAT Operaciones en Línea (SOL) que habilitan legalmente la emisión. Si algo de esta fase falta, producción devolverá errores como `0111` (sin perfil para enviar comprobantes) aunque el código sea perfecto.


## 1.1 Usuario secundario SOL para el sistema

Nunca uses la Clave SOL principal en el servidor. Crea un usuario secundario exclusivo para SPI:

1. Ingresar a SOL con la clave principal: **Empresas → Mi RUC y otros registros → Usuarios → Crear usuario secundario**.
2. Usuario sugerido: `SPIFACT01`. Asignar contraseña fuerte (se usará como variable de entorno, no se escribe en código).
3. En permisos, activar TODOS los relativos a **Comprobantes de pago electrónicos** (Factura electrónica, Boleta, Notas, Comunicaciones/Resúmenes, Guías de remisión) y **Registro de Certificado Digital**.
4. Guardar y **esperar hasta 24 horas**: SUNAT tarda en propagar el perfil del usuario secundario. Intentar enviar antes produce el error `0111`.


## 1.2 Certificado digital de producción — COMPLETADO

**Estado: ya cumplido.** INDPACK generó su Certificado Digital Tributario directamente en SUNAT (archivo `.p12` con contraseña), vigente del 20/08/2026 al 19/08/2029, y ya lo convirtió a PEM verificando que clave y certificado corresponden entre sí. Se documenta el procedimiento igualmente porque deberá repetirse al renovar el certificado (antes del 19/08/2029):

```
# 1) Extraer la clave privada (quedará cifrada con la misma contraseña)
openssl pkcs12 -in certificado.p12 -nocerts -nodes -out private_key.pem -legacy

# 2) Extraer el certificado público
openssl pkcs12 -in certificado.p12 -clcerts -nokeys -out certificate.pem -legacy

# 3) Verificar que corresponden entre sí (los dos hashes deben ser idénticos)
openssl rsa  -noout -modulus -in private_key.pem  | openssl md5
openssl x509 -noout -modulus -in certificate.pem  | openssl md5

# 4) Codificar en base64 para pegarlos como variables de entorno en Render
base64 -w0 private_key.pem  > private_key.b64
base64 -w0 certificate.pem  > certificate.b64
```

> **IMPORTANTE:** El `.pfx`, los `.pem` y los `.b64` **jamás** se suben a Git. Añade `certs/`, `*.pem`, `*.pfx`, `*.b64` a `.gitignore`. En producción viven solo como variables de entorno de Render (Fase 2).


## 1.3 Registro del certificado y alta en el SEE — Del Contribuyente — COMPLETADO

**Estado: ya cumplido.** El certificado figura **Activo** en SOL (Registro y Mantenimiento de Correo y Certificados Digitales), el correo del SEE está actualizado y la opción "Deseo emitir a través del SEE - Del Contribuyente" está marcada. Los pasos quedan como referencia para renovaciones:

1. En SOL: **Empresas → Comprobantes de pago → SEE Del contribuyente → Registro del Certificado Digital**. Subir el certificado público (formato `.cer`/`.pem` según pida el formulario). Sin este paso, producción rechaza la firma con error de certificado no registrado.
2. En la misma sección, verificar/registrar la **dirección de correo** para notificaciones de SUNAT.
3. Confirmar la condición de **emisor electrónico** por el SEE del contribuyente para los tipos: 01 (Factura), 03 (Boleta), 07 (NC), 08 (ND). Si INDPACK fue designada por SUNAT ya la tiene; si no, se comunica la elección desde el mismo menú.
4. Dar de alta las **series de producción** (paso 1.5) desde SOL cuando el sistema lo requiera (las series del SEE-contribuyente se informan con el primer envío, pero regístralas internamente primero).


## 1.4 Credenciales API para Guías de Remisión (GRE 2.0)

Las GRE **no** usan el canal SOAP de facturas: usan un API REST con OAuth2. Requiere generar un `client_id` y `client_secret` propios:

1. En SOL: **Empresas → Credenciales de API SUNAT → Gestión Credenciales de API** (menú "Empresas / Comprobantes de pago / Credenciales API").
2. Crear una aplicación nueva. Nombre: `SPI INDPACK`. URL: `https://spi.indpackperu.com`.
3. Marcar el alcance/servicio de **Guía de Remisión Electrónica (api-cpe)**.
4. Guardar el `client_id` y `client_secret` generados: van a variables de entorno en Render (Fase 2). El `client_secret` solo se muestra una vez.

> **IMPORTANTE:** Las credenciales GRE son independientes del certificado y de la clave SOL del canal SOAP, pero el token OAuth se pide con `username = RUC + usuario SOL` y `password = clave SOL` del usuario secundario de 1.1. Es decir: necesitas AMBAS cosas.


## 1.5 Definición de series de producción

**Estado: ya cumplido.** Las series definitivas están pactadas e insertadas en `series_correlativos` con `ultimo_numero = 0`. Son series NUEVAS (Camino B): no continúan la numeración del portal SOL, con lo que no hay riesgo de duplicados con lo emitido antes desde el portal. El portal SOL no debe volver a usarse para emitir con sus series antiguas una vez que SPI esté en producción.

| Tipo SUNAT | Documento | Serie | Regla de formato |
| --- | --- | --- | --- |
| 01 | Factura | FE01 | Alfanumérica de 4, inicia con F |
| 07 | Nota de crédito (de facturas) | FC01 | Debe iniciar con F (asociada a facturas) |
| 08 | Nota de débito (de facturas) | FD01 | Debe iniciar con F |
| 09 | GRE Remitente | TE01 | Inicia con T (emisión desde sistemas del contribuyente) |
| 31 | GRE Transportista | VE01 | Inicia con V |
| RA | Comunicación de baja | RA-fecha-### | Correlativo diario, se reinicia por fecha (tabla sunat_correlativos_diarios) |

> **IMPORTANTE:** Boletas (03) y Resumen Diario (RC) quedan fuera de alcance: INDPACK no emitirá boletas. Si a futuro se necesitaran, habrá que crear una serie tipo 03 que empiece con B (p. ej. BE01) e implementar el flujo RC.


## PUNTO DE CONTROL — Fase 1

- [ ] Usuario secundario `SPIFACT01` creado, con todos los permisos de facturación electrónica, y han pasado 24 h. (PENDIENTE)
- [ ] Certificado `.p12` convertido a `private_key.pem` + `certificate.pem`, módulos verificados. (HECHO)
- [ ] Certificado registrado y Activo en SOL, correo del SEE actualizado. (HECHO)
- [ ] Condición de emisor electrónico confirmada para tipos 01, 07, 08. (HECHO — SEE Del Contribuyente marcado)
- [ ] `client_id` y `client_secret` de GRE generados y guardados en un gestor de contraseñas. (PENDIENTE)
- [ ] Series definitivas insertadas en `series_correlativos`. (HECHO)


---


# FASE 2 — Configuración del entorno (Render)

Todo secreto vive en variables de entorno del servicio backend en Render (**Dashboard → tu servicio → Environment**). El código selecciona endpoints según `SUNAT_MODE`, de modo que pasar de Beta a Producción sea cambiar UNA variable.


## 2.1 Variables de entorno

| Variable | Valor / formato | Uso |
| --- | --- | --- |
| SUNAT_MODE | `BETA` o `PROD` | Selecciona endpoints en `config/sunat.js` |
| SUNAT_RUC | `20601234567` | RUC emisor |
| SUNAT_RAZON_SOCIAL | Razón social exacta de ficha RUC | XML (Supplier) |
| SUNAT_NOMBRE_COMERCIAL | Nombre comercial | XML |
| SUNAT_UBIGEO | `150101` (el de la ficha RUC) | XML dirección fiscal |
| SUNAT_DIRECCION | Dirección fiscal completa | XML |
| SUNAT_DISTRITO / SUNAT_PROVINCIA / SUNAT_DEPARTAMENTO | Texto | XML |
| SUNAT_SOL_USER | `SPIFACT01` | WS-Security (SOAP) y token GRE |
| SUNAT_SOL_PASS | clave del usuario secundario | Ídem |
| SUNAT_CERT_B64 | contenido de `certificate.b64` | Firma XML |
| SUNAT_KEY_B64 | contenido de `private_key.b64` | Firma XML |
| SUNAT_GRE_CLIENT_ID | de la Fase 1.4 | OAuth GRE |
| SUNAT_GRE_CLIENT_SECRET | de la Fase 1.4 | OAuth GRE |

En Beta se usa el mismo esquema con las credenciales de prueba: `SUNAT_SOL_USER=MODDATOS`, `SUNAT_SOL_PASS=moddatos`. Para el certificado puede usarse **el mismo certificado real** (SUNAT_CERT_B64 / SUNAT_KEY_B64 ya generados): el ambiente Beta no valida el certificado contra el registro de SOL, así que sirve tanto para Beta como para Producción sin cambiar variables.

> **IMPORTANTE:** Si las variables `SUNAT_CERT_B64` y `SUNAT_KEY_B64` ya fueron cargadas en Render (base64 de una sola línea de los .pem), márcalo verificado y no las regeneres. El resto de variables de la tabla 2.1 sí debe crearse.


## 2.2 Archivo de configuración central `backend/config/sunat.js`

```
// backend/config/sunat.js
import dotenv from 'dotenv';
dotenv.config();

const MODE = process.env.SUNAT_MODE || 'BETA';

const ENDPOINTS = {
  BETA: {
    // Facturas, boletas, notas, RA/RC
    FACTURACION: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    // Consulta de CDR/estado (solo existe en producción; en beta se omite)
    CONSULTA_CDR: null,
    // GRE REST: SUNAT no publica beta oficial del API GRE.
    // Las pruebas se hacen con datos reales controlados en producción
    // o contra un mock local (ver Fase 10.6).
    GRE_TOKEN: 'https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token',
    GRE_API:   'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem'
  },
  PROD: {
    FACTURACION: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    CONSULTA_CDR: 'https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService',
    GRE_TOKEN: 'https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token',
    GRE_API:   'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem'
  }
};

export const sunatConfig = {
  mode: MODE,
  ruc: process.env.SUNAT_RUC,
  razonSocial: process.env.SUNAT_RAZON_SOCIAL,
  nombreComercial: process.env.SUNAT_NOMBRE_COMERCIAL,
  ubigeo: process.env.SUNAT_UBIGEO,
  direccion: process.env.SUNAT_DIRECCION,
  distrito: process.env.SUNAT_DISTRITO,
  provincia: process.env.SUNAT_PROVINCIA,
  departamento: process.env.SUNAT_DEPARTAMENTO,
  solUser: process.env.SUNAT_SOL_USER,
  solPass: process.env.SUNAT_SOL_PASS,
  cert: Buffer.from(process.env.SUNAT_CERT_B64 || '', 'base64').toString('utf8'),
  key:  Buffer.from(process.env.SUNAT_KEY_B64  || '', 'base64').toString('utf8'),
  greClientId: process.env.SUNAT_GRE_CLIENT_ID,
  greClientSecret: process.env.SUNAT_GRE_CLIENT_SECRET,
  urls: ENDPOINTS[MODE]
};
```


## 2.3 Dependencias npm nuevas del backend

```
npm install xml-crypto xmldom adm-zip fast-xml-parser qrcode node-cron
```

| Paquete | Para qué |
| --- | --- |
| xml-crypto + xmldom | Firma XML-DSig enveloped (la misma que validaste en Beta) |
| adm-zip | Comprimir el XML a ZIP y descomprimir el CDR de respuesta |
| fast-xml-parser | Leer el CDR (ApplicationResponse) y respuestas SOAP |
| qrcode | Generar el PNG del QR para la representación impresa |
| node-cron | Job de reintentos y de envío nocturno de RC (Fase 15) |


## PUNTO DE CONTROL — Fase 2

- [ ] Todas las variables de la tabla 2.1 cargadas en Render (entorno Beta primero).
- [ ] `config/sunat.js` creado; `console.log(sunatConfig.mode)` imprime `BETA` al desplegar.
- [ ] El certificado se reconstruye desde base64 sin errores (probar `openssl x509 -in <(echo $CERT) -text` localmente).
- [ ] Dependencias npm instaladas y desplegadas en Render sin fallos de build.


---


# FASE 3 — Actualización de la base de datos (MySQL / Railway)

Tu esquema ya está bien encaminado: `facturas_venta` tiene `sunat_estado`, `sunat_ticket`, `xml_url`, `cdr_url`, `codigo_tipo_sunat`, `id_factura_ref`, `motivo_nota_codigo` y `tipo_operacion_sunat`; existe `series_correlativos` y `empresa_config`. Esta fase añade lo que falta para cubrir bajas, resúmenes, guías electrónicas, trazabilidad y reintentos. Ejecuta los bloques **en el orden dado**, dentro de una ventana de mantenimiento, y con backup previo (`mysqldump`).


## 3.1 Backup obligatorio antes de tocar nada

```
mysqldump -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> \
  --single-transaction --routines --triggers > backup_pre_sunat_$(date +%F).sql
```


## 3.2 Ampliar `facturas_venta`

```
ALTER TABLE facturas_venta
  ADD COLUMN sunat_digest_value VARCHAR(100) NULL COMMENT 'DigestValue de la firma (va en el QR y el PDF)' AFTER hash_see,
  ADD COLUMN sunat_qr_data     TEXT         NULL COMMENT 'Cadena pipe-separated del QR',
  ADD COLUMN sunat_nombre_xml  VARCHAR(120) NULL COMMENT 'Nombre archivo RUC-TIPO-SERIE-NUMERO',
  ADD COLUMN sunat_fecha_envio DATETIME     NULL,
  ADD COLUMN sunat_intentos    INT NOT NULL DEFAULT 0,
  ADD COLUMN id_baja           INT NULL COMMENT 'FK a sunat_bajas si fue dada de baja';

-- indices para la cola de envio y las consultas
CREATE INDEX idx_fv_sunat_estado ON facturas_venta (sunat_estado, sunat_intentos);
CREATE INDEX idx_fv_serie_numero ON facturas_venta (serie, numero);
```

El campo existente `tipo_comprobante ENUM('Factura','Boleta')` se mantiene por compatibilidad, pero **solo se usará 'Factura'** (boletas fuera de alcance); `codigo_tipo_sunat` guardará `01`, `07` o `08`. Las notas de crédito/débito se registran como filas de `facturas_venta` con `codigo_tipo_sunat` en `07`/`08`, `id_factura_ref` apuntando al comprobante afectado y `motivo_nota_codigo` con el catálogo 09/10 (ya tienes esos campos).


## 3.3 Nueva tabla: comunicaciones de baja (RA — facturas y sus notas, único mecanismo de anulación)

```
CREATE TABLE sunat_bajas (
  id_baja            INT AUTO_INCREMENT PRIMARY KEY,
  identificador      VARCHAR(30) NOT NULL UNIQUE COMMENT 'RA-YYYYMMDD-#####',
  fecha_referencia   DATE NOT NULL COMMENT 'Fecha de EMISION de los comprobantes a dar de baja',
  fecha_comunicacion DATE NOT NULL COMMENT 'Fecha en que se comunica la baja',
  correlativo        INT  NOT NULL,
  sunat_ticket       VARCHAR(60)  NULL,
  estado ENUM('GENERADO','ENVIADO','ACEPTADO','RECHAZADO','ERROR') NOT NULL DEFAULT 'GENERADO',
  response_code      VARCHAR(10) NULL,
  response_desc      TEXT NULL,
  xml_url            JSON NULL,
  cdr_url            JSON NULL,
  intentos           INT NOT NULL DEFAULT 0,
  id_registrado_por  INT NULL,
  fecha_registro     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_baja_emp FOREIGN KEY (id_registrado_por) REFERENCES empleados(id_empleado)
) ENGINE=InnoDB;

CREATE TABLE sunat_bajas_detalle (
  id_detalle     INT AUTO_INCREMENT PRIMARY KEY,
  id_baja        INT NOT NULL,
  id_factura     INT NOT NULL,
  tipo_documento VARCHAR(2)  NOT NULL COMMENT '01,07,08',
  serie          VARCHAR(4)  NOT NULL,
  numero         INT         NOT NULL,
  motivo         VARCHAR(200) NOT NULL,
  CONSTRAINT fk_bd_baja    FOREIGN KEY (id_baja)    REFERENCES sunat_bajas(id_baja),
  CONSTRAINT fk_bd_factura FOREIGN KEY (id_factura) REFERENCES facturas_venta(id_factura)
) ENGINE=InnoDB;
```

> **IMPORTANTE:** Regla SUNAT: la Comunicación de Baja (RA) aplica a **facturas y notas asociadas a facturas** — exactamente los tipos que emite SPI (01, 07, 08) — y solo dentro de los **7 días calendario** siguientes a la fecha de emisión (contados desde el día siguiente). Valida ese plazo en el backend antes de permitir la baja. (El Resumen Diario RC es solo para boletas y queda fuera de alcance.)


## 3.4 Resúmenes diarios (RC) — NO APLICA

Sin boletas no hay Resumen Diario: no se crean las tablas `sunat_resumenes` ni `sunat_resumenes_detalle`. Si en el futuro se emitieran boletas, esta sección deberá implementarse.


## 3.5 Correlativo diario para RA

```
CREATE TABLE sunat_correlativos_diarios (
  tipo   ENUM('RA') NOT NULL,
  fecha  DATE NOT NULL,
  ultimo INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (tipo, fecha)
) ENGINE=InnoDB;
```


## 3.6 Ampliar `guias_remision` (GRE Remitente, tipo 09)

```
ALTER TABLE guias_remision
  ADD COLUMN serie_sunat        VARCHAR(4)  NULL COMMENT 'TE01',
  ADD COLUMN numero_sunat       INT         NULL,
  ADD COLUMN sunat_estado ENUM('PENDIENTE','ENVIADO','ACEPTADO','RECHAZADO','ANULADA','ERROR')
             NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN sunat_ticket       VARCHAR(60)  NULL,
  ADD COLUMN sunat_digest_value VARCHAR(100) NULL,
  ADD COLUMN sunat_qr_url       VARCHAR(500) NULL COMMENT 'URL de consulta que va en el QR (la devuelve el CDR)',
  ADD COLUMN sunat_response_code VARCHAR(10) NULL,
  ADD COLUMN sunat_response_desc TEXT NULL,
  ADD COLUMN xml_url            JSON NULL,
  ADD COLUMN cdr_url            JSON NULL,
  ADD COLUMN sunat_fecha_envio  DATETIME NULL,
  ADD COLUMN sunat_intentos     INT NOT NULL DEFAULT 0,
  ADD COLUMN id_guia_reemplazo  INT NULL COMMENT 'Guia emitida en reemplazo si esta quedo sin efecto',
  ADD COLUMN motivo_traslado_cod VARCHAR(2) NULL COMMENT 'Catalogo 20: 01 Venta, 04 Traslado mismos, etc.',
  ADD COLUMN doc_relacionado_tipo VARCHAR(2) NULL COMMENT '01 si se relaciona a factura',
  ADD COLUMN doc_relacionado_num  VARCHAR(20) NULL;

CREATE INDEX idx_gr_sunat ON guias_remision (sunat_estado, sunat_intentos);
CREATE UNIQUE INDEX uq_gr_serie_num ON guias_remision (serie_sunat, numero_sunat);
```


## 3.7 Ampliar `guias_transportista` (GRE Transportista, tipo 31)

```
ALTER TABLE guias_transportista
  ADD COLUMN serie_sunat        VARCHAR(4)  NULL COMMENT 'VE01',
  ADD COLUMN numero_sunat       INT         NULL,
  ADD COLUMN sunat_estado ENUM('PENDIENTE','ENVIADO','ACEPTADO','RECHAZADO','ANULADA','ERROR')
             NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN sunat_ticket       VARCHAR(60)  NULL,
  ADD COLUMN sunat_digest_value VARCHAR(100) NULL,
  ADD COLUMN sunat_qr_url       VARCHAR(500) NULL,
  ADD COLUMN sunat_response_code VARCHAR(10) NULL,
  ADD COLUMN sunat_response_desc TEXT NULL,
  ADD COLUMN xml_url            JSON NULL,
  ADD COLUMN cdr_url            JSON NULL,
  ADD COLUMN sunat_fecha_envio  DATETIME NULL,
  ADD COLUMN sunat_intentos     INT NOT NULL DEFAULT 0,
  ADD COLUMN id_guia_reemplazo  INT NULL,
  ADD COLUMN ubigeo_partida     VARCHAR(6) NULL,
  ADD COLUMN ubigeo_llegada     VARCHAR(6) NULL,
  ADD COLUMN peso_bruto_kg      DECIMAL(10,2) NULL,
  ADD COLUMN ruc_remitente      VARCHAR(11) NULL,
  ADD COLUMN razon_social_remitente VARCHAR(255) NULL,
  ADD COLUMN ruc_destinatario   VARCHAR(11) NULL,
  ADD COLUMN razon_social_destinatario VARCHAR(255) NULL;
```


## 3.8 Token OAuth de GRE y log de trazabilidad

```
CREATE TABLE sunat_gre_token (
  id           TINYINT PRIMARY KEY DEFAULT 1,
  access_token TEXT NOT NULL,
  token_type   VARCHAR(20) NOT NULL DEFAULT 'Bearer',
  expira_en    DATETIME NOT NULL,
  actualizado  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE sunat_log (
  id_log        BIGINT AUTO_INCREMENT PRIMARY KEY,
  origen        ENUM('FACTURA','BOLETA','NOTA','BAJA','RESUMEN','GRE_REMITENTE','GRE_TRANSPORTISTA','CONSULTA','TOKEN') NOT NULL,
  referencia_id INT NULL COMMENT 'id del registro origen',
  evento        VARCHAR(60) NOT NULL COMMENT 'sendBill, sendSummary, getStatus, token, envioGRE...',
  exito         TINYINT(1) NOT NULL,
  http_status   INT NULL,
  detalle       TEXT NULL COMMENT 'faultcode/mensaje o resumen de respuesta',
  duracion_ms   INT NULL,
  fecha         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_log_ref (origen, referencia_id)
) ENGINE=InnoDB;
```


## 3.9 Poblar `series_correlativos` (YA EJECUTADO) y completar `empresa_config`

**Estado: el INSERT de series ya fue ejecutado y verificado** (las 5 filas existen con `ultimo_numero = 0`). Se deja el SQL como registro; con el ON DUPLICATE es idempotente (re-ejecutarlo no daña nada):

```
-- YA EJECUTADO -- series definitivas pactadas (Camino B, todas nuevas)
INSERT INTO series_correlativos (tipo_documento, serie, ultimo_numero) VALUES
  ('01', 'FE01', 0),   -- Facturas
  ('07', 'FC01', 0),   -- Nota de Credito (de facturas)
  ('08', 'FD01', 0),   -- Nota de Debito (de facturas)
  ('09', 'TE01', 0),   -- GRE Remitente
  ('31', 'VE01', 0)    -- GRE Transportista
ON DUPLICATE KEY UPDATE ultimo_numero = ultimo_numero;

-- empresa_config: datos de contacto usados en el XML/PDF
ALTER TABLE empresa_config
  ADD COLUMN telefono VARCHAR(20)  NULL,
  ADD COLUMN email    VARCHAR(100) NULL,
  ADD COLUMN codigo_establecimiento VARCHAR(4) NOT NULL DEFAULT '0000'
      COMMENT 'Codigo de establecimiento anexo SUNAT (0000 = domicilio fiscal)';
```

Obtención atómica de correlativos (patrón a usar SIEMPRE, dentro de una transacción, para evitar duplicados bajo concurrencia):

```
-- dentro de una transaccion del pool mysql2
UPDATE series_correlativos
   SET ultimo_numero = LAST_INSERT_ID(ultimo_numero + 1)
 WHERE tipo_documento = ? AND serie = ?;
SELECT LAST_INSERT_ID() AS numero;
```


## PUNTO DE CONTROL — Fase 3

- [ ] Backup `mysqldump` guardado fuera de Railway.
- [ ] Todos los ALTER/CREATE ejecutados sin error (verificar con `SHOW TABLES` y `DESCRIBE`).
- [ ] `series_correlativos` con las 5 series pactadas (YA HECHO — solo verificar con SELECT).
- [ ] Prueba de concurrencia del correlativo: dos requests simultáneos obtienen números distintos.
- [ ] `empresa_config` tiene RUC, razón social, ubigeo, dirección, distrito, provincia, departamento, teléfono y email reales.


---


# FASE 4 — Arquitectura de código en el backend

Crea un módulo SUNAT autocontenido dentro de tu estructura actual. Nada del código existente de ventas se toca todavía; primero se construye el módulo y se prueba de forma aislada.

```
backend/
├── config/
│   └── sunat.js                  # (Fase 2) endpoints + credenciales
├── services/sunat/
│   ├── certificado.service.js    # carga cert/clave desde env
│   ├── ubl.service.js            # constructores de XML UBL (01,03,07,08)
│   ├── ubl-baja.service.js       # VoidedDocuments (RA) y SummaryDocuments (RC)
│   ├── ubl-gre.service.js        # DespatchAdvice (09 y 31)
│   ├── firma.service.js          # XML-DSig (ya validado en Beta)
│   ├── zip.service.js            # empaquetar XML -> ZIP / leer CDR
│   ├── soap.service.js           # sendBill, sendSummary, getStatus, getStatusCdr
│   ├── gre.service.js            # token OAuth + envio/consulta REST GRE
│   ├── cdr.service.js            # parseo de ApplicationResponse (ya tienes sunat-parser)
│   ├── qr.service.js             # cadena y PNG del QR
│   └── numeracion.service.js     # correlativos atomicos
├── controllers/sunat.controller.js
├── routes/sunat.routes.js        # montado en /api/sunat
└── jobs/sunat-reintentos.job.js  # (Fase 15) cron de reintentos + RC nocturno
```

Reglas del módulo:

- Toda operación contra SUNAT escribe una fila en `sunat_log` (éxito o fallo, duración, detalle).
- Todo cambio de estado del comprobante ocurre dentro de una **transacción MySQL** con tu helper de `config/database.js`.
- Los XML firmados y CDR se suben a **Cloudinary** (carpeta `sunat/xml` y `sunat/cdr`, `resource_type: "raw"`) y las URLs se guardan en `xml_url` / `cdr_url` (JSON), igual que ya haces con otros archivos. Además conserva copia local temporal en `backend/sunat-output/` para depuración.
- El módulo expone funciones puras; los controllers solo orquestan y validan permisos (`verificarPermiso("facturacion")`).


## PUNTO DE CONTROL — Fase 4

- [ ] Estructura de carpetas creada y desplegada (aunque los servicios estén vacíos).
- [ ] Ruta `/api/sunat/ping` responde `{mode:"BETA"}` leyendo `sunatConfig`.
- [ ] Permiso `facturacion` agregado a `middleware/auth.js` y asignado a los roles Administrador y Administrativo.


---


# FASE 5 — Certificado y firma digital XML-DSig

Esta fase reutiliza tu Fase 1 ya validada en Beta (firma enveloped, **RSA-SHA512**, canonicalización **C14N exclusiva**). Solo se estandariza como servicio y se cambia la fuente del certificado a variables de entorno.


## 5.1 `certificado.service.js`

```
// services/sunat/certificado.service.js
import { sunatConfig } from '../../config/sunat.js';

export function getCredencialesFirma() {
  if (!sunatConfig.cert || !sunatConfig.key) {
    throw new Error('Certificado SUNAT no configurado (SUNAT_CERT_B64 / SUNAT_KEY_B64)');
  }
  // certificado sin cabeceras PEM, en una sola linea (para X509Certificate)
  const certDer = sunatConfig.cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  return { privateKeyPem: sunatConfig.key, certPem: sunatConfig.cert, certDer };
}
```


## 5.2 `firma.service.js` (xml-crypto)

```
// services/sunat/firma.service.js
import { SignedXml } from 'xml-crypto';
import { getCredencialesFirma } from './certificado.service.js';

const C14N_EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const RSA_SHA512 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512';
const SHA512 = 'http://www.w3.org/2001/04/xmlenc#sha512';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Firma un XML UBL. La firma se inserta dentro de
 * ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent (nodo vacio reservado).
 * Devuelve { xmlFirmado, digestValue }.
 */
export function firmarXml(xml) {
  const { privateKeyPem, certDer } = getCredencialesFirma();

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    canonicalizationAlgorithm: C14N_EXC,
    signatureAlgorithm: RSA_SHA512,
    getKeyInfoContent: () =>
      '<X509Data><X509Certificate>' + certDer + '</X509Certificate></X509Data>'
  });

  // Referencia al documento completo (URI=""), transform enveloped + c14n-exc
  sig.addReference({
    xpath: '/*',
    transforms: [ENVELOPED, C14N_EXC],
    digestAlgorithm: SHA512,
    uri: '',
    isEmptyUri: true
  });

  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name()='ExtensionContent']",
      action: 'append'
    },
    prefix: 'ds',
    attrs: { Id: 'SignatureSP' }
  });

  const xmlFirmado = sig.getSignedXml();
  const digestValue = /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(xmlFirmado)?.[1] || '';
  return { xmlFirmado, digestValue };
}
```

> **IMPORTANTE:** El `digestValue` extraído es el que exige la Resolución 193-2020 para el **código QR y la representación impresa**. Guárdalo en `facturas_venta.sunat_digest_value` en cuanto firmes (Fase 6.4).


## PUNTO DE CONTROL — Fase 5

- [ ] Un XML de prueba se firma y valida con `xmlsec1 --verify` o con tu validación previa de Beta.
- [ ] El certificado usado por la firma es el de la variable de entorno (borrar temporalmente la variable debe romper la firma).
- [ ] `digestValue` no vacío tras firmar.


---


# FASE 6 — Emisión de Facturas (01)

Flujo completo por comprobante: **numerar → construir XML UBL 2.1 → firmar → comprimir ZIP → sendBill (SOAP) → procesar CDR → persistir**. Todo dentro de un solo caso de uso `emitirComprobante(id_orden_venta)`.


## 6.1 Nombre de archivo y estructura del ZIP

| Elemento | Formato | Ejemplo |
| --- | --- | --- |
| XML | `{RUC}-{TIPO}-{SERIE}-{NUM}.xml` | 20601234567-01-FE01-00000123.xml |
| ZIP | mismo nombre con `.zip` | 20601234567-01-FE01-00000123.zip |
| Contenido ZIP | solo el XML, en la raíz (sin carpetas) | — |
| CDR de respuesta | `R-{mismo nombre}.zip` → contiene `R-....xml` | R-20601234567-01-FE01-00000123.zip |


## 6.2 XML UBL 2.1 de Factura — estructura obligatoria completa

Plantilla real mínima-completa aceptada por SUNAT (operación gravada IGV 18 %, catálogos indicados en comentarios). Tu `ubl.service.js` la genera con template literals a partir de la orden de venta, su detalle, el cliente y `empresa_config`:

```
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension> <!-- aqui se inserta la firma -->
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>FE01-123</cbc:ID>
  <cbc:IssueDate>2026-08-20</cbc:IssueDate>
  <cbc:IssueTime>10:30:00</cbc:IssueTime>
  <cbc:DueDate>2026-09-19</cbc:DueDate>
  <!-- listID = tipo de operacion, catalogo 51: 0101 venta interna, 0200 exportacion -->
  <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
  <!-- monto en letras: usa tu utils/numeroALetras -->
  <cbc:Note languageLocaleID="1000"><![CDATA[UN MIL CIENTO OCHENTA CON 00/100 SOLES]]></cbc:Note>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>SignatureSP</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>20601234567</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name><![CDATA[INDPACK PERU S.A.C.]]></cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#SignatureSP</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeAgencyName="PE:SUNAT"
          schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">20601234567</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name><![CDATA[INDPACK]]></cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[INDPACK PERU S.A.C.]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>150101</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode> <!-- codigo_establecimiento -->
          <cbc:CityName>LIMA</cbc:CityName>
          <cbc:CountrySubentity>LIMA</cbc:CountrySubentity>
          <cbc:District>LIMA</cbc:District>
          <cac:AddressLine><cbc:Line><![CDATA[AV. INDUSTRIAL 123]]></cbc:Line></cac:AddressLine>
          <cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <!-- schemeID: 6=RUC, 1=DNI, 0=sin documento (catalogo 06) -->
        <cbc:ID schemeID="6">20512345678</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[CLIENTE INDUSTRIAL S.A.]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cac:AddressLine><cbc:Line><![CDATA[AV. CLIENTE 456, LIMA]]></cbc:Line></cac:AddressLine>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <!-- FormaPago obligatorio desde 2021 -->
  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>
  <!-- Si es CREDITO: PaymentMeansID=Credito + monto pendiente + una PaymentTerms por cuota:
  <cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>
    <cbc:Amount currencyID="PEN">1180.00</cbc:Amount></cac:PaymentTerms>
  <cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Cuota001</cbc:PaymentMeansID>
    <cbc:Amount currencyID="PEN">1180.00</cbc:Amount>
    <cbc:PaymentDueDate>2026-09-19</cbc:PaymentDueDate></cac:PaymentTerms> -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">180.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">1000.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">180.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">1000.00</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">1180.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">1180.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">10</cbc:InvoicedQuantity> <!-- productos.codigo_unidad_sunat -->
    <cbc:LineExtensionAmount currencyID="PEN">1000.00</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">118.00</cbc:PriceAmount> <!-- precio CON IGV -->
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode> <!-- catalogo 16 -->
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="PEN">180.00</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="PEN">1000.00</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="PEN">180.00</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18.00</cbc:Percent>
          <!-- catalogo 07: 10 gravado, 20 exonerado, 30 inafecto, 40 exportacion -->
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description><![CDATA[BOLSA POLIETILENO 20x30 x100 UND]]></cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>PROD-0001</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="PEN">100.00</cbc:PriceAmount></cac:Price> <!-- SIN IGV -->
  </cac:InvoiceLine>
</Invoice>
```

Reglas de mapeo desde tu BD (respétalas al pie de la letra, son la causa nº 1 de rechazos):

- `cbc:ID` = `serie` + "-" + `numero` de `facturas_venta` (sin ceros a la izquierda en el número).
- `InvoiceTypeCode listID` = `ordenes_venta.es_exportacion ? "0200" : ordenes_venta.tipo_impuesto` mapeado al catálogo 51; tu campo `tipo_operacion_sunat` (default `0101`) ya lo guarda.
- `unitCode` = `productos.codigo_unidad_sunat` (NIU unidades, KGM kilos, MTR metros, ZZ servicios). Complétalo para todos los productos ANTES de emitir.
- Boletas (03): FUERA DE ALCANCE — el endpoint debe rechazar cualquier `tipo` distinto de `01`, `07` u `08`.
- Exoneradas/inafectas: `TaxScheme ID` 9997/9998, `TaxExemptionReasonCode` 20/30, y los montos van en `TaxableAmount` con `TaxAmount` 0.00; en `LegalMonetaryTotal` no cambia la mecánica.
- Moneda USD: `DocumentCurrencyCode` = `USD` y TODOS los `currencyID` = `USD` (nunca mezclar).
- Redondeo: cada monto a 2 decimales con redondeo half-up; los totales deben cuadrar exactamente (suma de líneas = LineExtensionAmount total) o SUNAT observa con error 2xxx/3xxx.


## 6.3 Empaquetado ZIP — `zip.service.js`

```
// services/sunat/zip.service.js
import AdmZip from 'adm-zip';

export function zipXml(nombreXml, xmlFirmado) {
  const zip = new AdmZip();
  zip.addFile(nombreXml, Buffer.from(xmlFirmado, 'utf8'));
  return zip.toBuffer(); // Buffer del .zip
}

export function extraerCdr(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find(e => e.entryName.endsWith('.xml'));
  if (!entry) throw new Error('CDR sin XML interno');
  return entry.getData().toString('utf8');
}
```


## 6.4 Envío SOAP — `soap.service.js` (método sendBill)

La trama SOAP es exactamente esta (WS-Security UsernameToken; `Username` = RUC + usuario SOL concatenados):

```
// services/sunat/soap.service.js
import axios from 'axios';
import { sunatConfig } from '../../config/sunat.js';

function envelope(bodyInner) {
  const user = sunatConfig.ruc + sunatConfig.solUser; // ej: 20601234567SPIFACT01
  return '<?xml version="1.0" encoding="UTF-8"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:ser="http://service.sunat.gob.pe" ' +
    'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    '<soapenv:Header><wsse:Security><wsse:UsernameToken>' +
      '<wsse:Username>' + user + '</wsse:Username>' +
      '<wsse:Password>' + sunatConfig.solPass + '</wsse:Password>' +
    '</wsse:UsernameToken></wsse:Security></soapenv:Header>' +
    '<soapenv:Body>' + bodyInner + '</soapenv:Body>' +
  '</soapenv:Envelope>';
}

async function post(xml, soapAction, url = sunatConfig.urls.FACTURACION) {
  const { data, status } = await axios.post(url, xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction },
    timeout: 60000,
    validateStatus: () => true // los faults llegan como HTTP 500 con XML
  });
  return { data, status };
}

/** Envia factura/boleta/nota. Devuelve el CDR (zip base64) o lanza AppError. */
export async function sendBill(nombreZip, zipBuffer) {
  const body = '<ser:sendBill>' +
    '<fileName>' + nombreZip + '</fileName>' +
    '<contentFile>' + zipBuffer.toString('base64') + '</contentFile>' +
  '</ser:sendBill>';
  const { data, status } = await post(envelope(body), 'urn:sendBill');
  const cdrB64 = /<applicationResponse>([^<]+)<\/applicationResponse>/.exec(data)?.[1];
  if (!cdrB64) {
    const faultCode = /<faultcode>([^<]*)<\/faultcode>/.exec(data)?.[1] || String(status);
    const faultMsg  = /<faultstring>([\s\S]*?)<\/faultstring>/.exec(data)?.[1] || 'Sin detalle';
    const err = new Error('SUNAT fault ' + faultCode + ': ' + faultMsg);
    err.faultCode = faultCode.replace(/\D/g, ''); // p.ej. "soap-env:Client.1033" -> "1033"
    throw err;
  }
  return Buffer.from(cdrB64, 'base64'); // ZIP del CDR
}

/** Envia RA (baja) o RC (resumen). Devuelve numero de ticket. */
export async function sendSummary(nombreZip, zipBuffer) {
  const body = '<ser:sendSummary>' +
    '<fileName>' + nombreZip + '</fileName>' +
    '<contentFile>' + zipBuffer.toString('base64') + '</contentFile>' +
  '</ser:sendSummary>';
  const { data } = await post(envelope(body), 'urn:sendSummary');
  const ticket = /<ticket>([^<]+)<\/ticket>/.exec(data)?.[1];
  if (!ticket) throw new Error('sendSummary sin ticket: ' + data.slice(0, 400));
  return ticket;
}

/** Consulta ticket de sendSummary. statusCode 0=aceptado, 98=en proceso, 99=con errores */
export async function getStatus(ticket) {
  const body = '<ser:getStatus><ticket>' + ticket + '</ticket></ser:getStatus>';
  const { data } = await post(envelope(body), 'urn:getStatus');
  const statusCode = /<statusCode>([^<]+)<\/statusCode>/.exec(data)?.[1];
  const contentB64 = /<content>([^<]+)<\/content>/.exec(data)?.[1] || null;
  return { statusCode, cdrZip: contentB64 ? Buffer.from(contentB64, 'base64') : null };
}

/** Consulta CDR de un comprobante ya enviado (solo PRODUCCION, solo 01/07/08). */
export async function getStatusCdr(tipo, serie, numero) {
  if (!sunatConfig.urls.CONSULTA_CDR) throw new Error('Consulta CDR no disponible en BETA');
  const body = '<ser:getStatusCdr>' +
    '<rucComprobante>' + sunatConfig.ruc + '</rucComprobante>' +
    '<tipoComprobante>' + tipo + '</tipoComprobante>' +
    '<serieComprobante>' + serie + '</serieComprobante>' +
    '<numeroComprobante>' + numero + '</numeroComprobante>' +
  '</ser:getStatusCdr>';
  const { data } = await post(envelope(body), 'urn:getStatusCdr', sunatConfig.urls.CONSULTA_CDR);
  const statusCode = /<statusCode>([^<]+)<\/statusCode>/.exec(data)?.[1];
  const statusMessage = /<statusMessage>([\s\S]*?)<\/statusMessage>/.exec(data)?.[1] || '';
  const contentB64 = /<content>([^<]+)<\/content>/.exec(data)?.[1] || null;
  return { statusCode, statusMessage, cdrZip: contentB64 ? Buffer.from(contentB64, 'base64') : null };
}
```


## 6.5 Procesamiento del CDR — `cdr.service.js`

```
// services/sunat/cdr.service.js  (evolucion de tu sunat-parser.service.js)
import { XMLParser } from 'fast-xml-parser';
import { extraerCdr } from './zip.service.js';

export function parsearCdr(cdrZipBuffer) {
  const xml = extraerCdr(cdrZipBuffer);
  const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const doc = p.parse(xml);
  const resp = doc.ApplicationResponse?.DocumentResponse?.Response || {};
  return {
    responseCode: String(resp.ResponseCode ?? ''),   // '0' = aceptado
    description: resp.Description ?? '',
    notas: [].concat(doc.ApplicationResponse?.Note || []), // observaciones 4xxx
    referenceId: doc.ApplicationResponse?.DocumentResponse?.DocumentReference?.ID ?? '',
    xmlCdr: xml
  };
}
```

| ResponseCode del CDR | Significado | Acción en BD |
| --- | --- | --- |
| 0 | ACEPTADO (puede traer notas 4xxx = observaciones) | `sunat_estado='ACEPTADO'`, guardar CDR |
| 0100–1999 | Error del emisor/sistema (fault, no hay CDR) | Mantener `ENVIADO`→ reintentar (Fase 15) |
| 2000–3999 | RECHAZADO (hay CDR de rechazo) | `sunat_estado='RECHAZADO'`; corregir y emitir NUEVO correlativo |
| 4000+ | Observaciones (el doc está aceptado) | Aceptado + guardar observaciones en `sunat_response_desc` |

> **IMPORTANTE:** Un comprobante RECHAZADO (2000–3999) **nunca se reenvía con el mismo número**: legalmente no existe. Se corrige la causa y se emite con el siguiente correlativo. Los faults 0100–1999 (p. ej. `1033` ya existe, `0111` sin perfil) sí permiten reintento o consulta.


## 6.6 Caso de uso completo — `emitirComprobante` (controller)

```
// controllers/sunat.controller.js (fragmento)
import { obtenerCorrelativo } from '../services/sunat/numeracion.service.js';
import { construirInvoiceXML } from '../services/sunat/ubl.service.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { zipXml } from '../services/sunat/zip.service.js';
import { sendBill } from '../services/sunat/soap.service.js';
import { parsearCdr } from '../services/sunat/cdr.service.js';
import { generarQr } from '../services/sunat/qr.service.js';
import { subirRaw } from '../services/cloudinary.service.js';
import { withTransaction } from '../config/database.js';
import { sunatConfig } from '../config/sunat.js';

export async function emitirComprobante(req, res, next) {
  const { id_orden_venta } = req.body;
  const tipo = '01'; // solo facturas (boletas fuera de alcance)
  try {
    const resultado = await withTransaction(async (conn) => {
      // 1) Datos + candado de la OV
      const [[ov]] = await conn.query(
        'SELECT * FROM ordenes_venta WHERE id_orden_venta=? FOR UPDATE', [id_orden_venta]);
      if (!ov) throw new AppError('Orden de venta no existe', 404);
      if (ov.facturado_sunat) throw new AppError('La OV ya fue facturada', 409);

      const [detalle] = await conn.query(
        'SELECT d.*, p.codigo, p.nombre, p.codigo_unidad_sunat FROM detalle_orden_venta d ' +
        'JOIN productos p ON p.id_producto=d.id_producto WHERE d.id_orden_venta=?', [id_orden_venta]);
      const [[cliente]] = await conn.query(
        'SELECT * FROM clientes WHERE id_cliente=?', [ov.id_cliente]);
      const [[empresa]] = await conn.query('SELECT * FROM empresa_config WHERE id=1');

      // 2) Correlativo atomico
      const serie = 'FE01';
      const numero = await obtenerCorrelativo(conn, tipo, serie);

      // 3) XML -> firma -> zip
      const xml = construirInvoiceXML({ tipo, serie, numero, ov, detalle, cliente, empresa });
      const { xmlFirmado, digestValue } = firmarXml(xml);
      const nombre = sunatConfig.ruc + '-' + tipo + '-' + serie + '-' +
                     String(numero).padStart(8, '0');
      const zipBuf = zipXml(nombre + '.xml', xmlFirmado);

      // 4) Insertar factura en estado ENVIADO (antes del envio, para trazabilidad)
      const qr = generarQr({ tipo, serie, numero, ov, cliente, digestValue });
      const [ins] = await conn.query(
        `INSERT INTO facturas_venta (numero_factura,id_orden_venta,id_cliente,tipo_comprobante,
          serie,numero,subtotal,igv,total,moneda,estado,codigo_tipo_sunat,tipo_operacion_sunat,
          sunat_estado,sunat_digest_value,sunat_qr_data,sunat_nombre_xml,sunat_fecha_envio,
          id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,'Emitida',?,?,'ENVIADO',?,?,?,NOW(),?)`,
        [serie + '-' + numero, id_orden_venta, ov.id_cliente,
         'Factura', serie, numero,
         ov.subtotal, ov.igv, ov.total, ov.moneda, tipo,
         ov.es_exportacion ? '0200' : '0101', digestValue, qr.data, nombre, req.user.id]);
      const idFactura = ins.insertId;

      // 5) Enviar y procesar CDR
      const cdrZip = await sendBill(nombre + '.zip', zipBuf);
      const cdr = parsearCdr(cdrZip);
      const aceptado = cdr.responseCode === '0';

      // 6) Subir XML + CDR a Cloudinary y cerrar estado
      const xmlUrl = await subirRaw(Buffer.from(xmlFirmado), 'sunat/xml/' + nombre + '.xml');
      const cdrUrl = await subirRaw(cdrZip, 'sunat/cdr/R-' + nombre + '.zip');
      await conn.query(
        `UPDATE facturas_venta SET sunat_estado=?, sunat_response_code=?, sunat_response_desc=?,
           xml_url=?, cdr_url=?, hash_see=? WHERE id_factura=?`,
        [aceptado ? 'ACEPTADO' : 'RECHAZADO', cdr.responseCode,
         cdr.description + (cdr.notas.length ? ' | OBS: ' + cdr.notas.join('; ') : ''),
         JSON.stringify({ url: xmlUrl }), JSON.stringify({ url: cdrUrl }),
         digestValue, idFactura]);

      if (aceptado) {
        await conn.query(
          `UPDATE ordenes_venta SET facturado_sunat=1, fecha_facturacion_sunat=NOW(),
             numero_comprobante_sunat=?, id_facturador=? WHERE id_orden_venta=?`,
          [serie + '-' + numero, req.user.id, id_orden_venta]);
      }
      return { idFactura, serie, numero, ...cdr };
    });
    res.json({ ok: true, ...resultado });
  } catch (e) { next(e); }
}
```

> **IMPORTANTE:** Si `sendBill` lanza un fault (timeout, 1033, caída), la transacción hace rollback del UPDATE final pero el INSERT ya está confirmado con estado `ENVIADO`. Estructura el código para que el INSERT se confirme en una transacción propia y el envío quede fuera de ella, de modo que el job de reintentos (Fase 15) encuentre la fila `ENVIADO` sin CDR y use `getStatusCdr` para averiguar la verdad antes de reintentar. Con el fault `1033` ("el comprobante ya fue registrado") la respuesta correcta es consultar el CDR, no reenviar.


## 6.7 Pruebas obligatorias en Beta antes de continuar

1. Factura contado PEN, 1 ítem gravado → CDR `0`.
2. Factura crédito USD con 2 cuotas → CDR `0` (verificar bloque PaymentTerms).
3. Factura de exportación (`es_exportacion=1`, listID 0200, IGV 0) → CDR `0`.
4. Enviar el mismo ZIP dos veces → segundo intento fault `1033` y tu código lo maneja con getStatusCdr/registro.
5. Comprobante con total descuadrado a propósito → rechazo 2xxx/3xxx registrado como `RECHAZADO`.
6. Solicitar tipo `03` (boleta) al endpoint → respuesta 400 "fuera de alcance" (validación activa).


## PUNTO DE CONTROL — Fase 6

- [ ] Las 6 pruebas de 6.7 pasan en Beta y quedan registradas en `facturas_venta` + `sunat_log`.
- [ ] XML y CDR visibles en Cloudinary y descargables desde el sistema.
- [ ] `series_correlativos` avanza sin huecos ni duplicados.
- [ ] El error handler central traduce faults SUNAT a mensajes legibles para el usuario.


---


# FASE 7 — Notas de Crédito (07) y Notas de Débito (08)

Una nota es un comprobante independiente (su propia serie/correlativo, su propio XML, su propio sendBill y CDR) que **referencia** al comprobante que modifica. Se registra como una fila más en `facturas_venta` con `codigo_tipo_sunat` = `07`/`08` e `id_factura_ref` apuntando al documento afectado.


## 7.1 Reglas de negocio previas (validar en backend)

- Solo se emite nota sobre un comprobante con `sunat_estado = "ACEPTADO"` y `estado <> "Anulada"`.
- La serie de la nota debe empezar con la misma letra que el documento afectado: `FC01` (NC) y `FD01` (ND), ambas asociadas a facturas FE01. (Notas de boleta: fuera de alcance.)
- Moneda de la nota = moneda del comprobante afectado. Siempre.
- NC de anulación total (motivo 01): tras su aceptación marca el comprobante original con `estado = "Anulada"` a nivel de negocio (SUNAT no lo "borra": queda anulado contablemente por la NC).


## 7.2 Diferencias del XML respecto a la factura

```
<!-- Raiz y tipo -->
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" ...mismos xmlns...>
  ...
  <cbc:ID>FC01-45</cbc:ID>
  <!-- Motivo: catalogo 09 (NC) o 10 (ND) -->
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>FE01-123</cbc:ReferenceID>      <!-- comprobante afectado -->
    <cbc:ResponseCode>01</cbc:ResponseCode>          <!-- 01 Anulacion de la operacion -->
    <cbc:Description><![CDATA[ANULACION DE LA OPERACION]]></cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>FE01-123</cbc:ID>
      <cbc:DocumentTypeCode>01</cbc:DocumentTypeCode> <!-- tipo del doc afectado -->
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <!-- lineas: cac:CreditNoteLine con cbc:CreditedQuantity (en ND: DebitNoteLine / DebitedQuantity) -->
  <!-- totales: en CreditNote NO existe LegalMonetaryTotal->PayableAmount distinto:
       se usa cac:LegalMonetaryTotal igual que factura -->
</CreditNote>

<!-- Para Nota de Debito la raiz es:
<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" ...>
  con cac:RequestedMonetaryTotal en lugar de cac:LegalMonetaryTotal -->
```

| Catálogo 09 (NC) — código | Motivo |
| --- | --- |
| 01 | Anulación de la operación |
| 02 | Anulación por error en el RUC |
| 03 | Corrección por error en la descripción |
| 04 | Descuento global |
| 05 | Descuento por ítem |
| 06 | Devolución total |
| 07 | Devolución por ítem |
| 08 | Bonificación |
| 09 | Disminución en el valor |
| 13 | Ajustes – montos y/o fechas de pago (facturas al crédito) |

| Catálogo 10 (ND) — código | Motivo |
| --- | --- |
| 01 | Intereses por mora |
| 02 | Aumento en el valor |
| 03 | Penalidades / otros conceptos |

Nombre de archivo: `{RUC}-07-FC01-45.xml` / `{RUC}-08-FD01-12.xml`. El envío usa **el mismo `sendBill`** de la Fase 6 y el mismo procesamiento de CDR. Enlaza el flujo con tu módulo de Calidad: una incidencia con `decision_final = "Nota de crédito"` debe poder generar la NC pre-llenada.


## PUNTO DE CONTROL — Fase 7

- [ ] NC total (motivo 01) sobre factura aceptada en Beta → CDR 0; la factura queda `estado="Anulada"` en el sistema.
- [ ] NC parcial por devolución de ítem (motivo 07) → CDR 0, montos parciales correctos.
- [ ] ND por interés (motivo 01 de catálogo 10) → CDR 0.
- [ ] Intento de NC sobre comprobante RECHAZADO es bloqueado por el backend con mensaje claro.


---


# FASE 8 — Bajas: Comunicación de Baja (RA)

Como SPI solo emite facturas y sus notas, el ÚNICO mecanismo de anulación de comprobantes es la Comunicación de Baja (RA). Mapa definitivo:

| Documento a anular | Mecanismo | Método SOAP | Plazo |
| --- | --- | --- | --- |
| Factura (01) y sus NC/ND (07/08) | Comunicación de Baja — VoidedDocuments (RA) | sendSummary + getStatus | 7 días calendario desde el día siguiente a la emisión |
| GRE (09/31) | NO tiene baja: se subsana (Fase 12) | — | — |
| Pasados los 7 días | Nota de Crédito (Fase 7, motivo 01 anulación de la operación) | sendBill | Sin plazo |

> **IMPORTANTE:** La aceptación de una RA es **asíncrona**: `sendSummary` devuelve un **ticket**, y el CDR se obtiene después con `getStatus(ticket)`. `statusCode` 98 significa "aún en proceso" (reintenta en 30–60 s); 0 aceptado; 99 rechazado con CDR de error.


## 8.1 XML de Comunicación de Baja (RA)

```
<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>RA-20260820-00001</cbc:ID>
  <cbc:ReferenceDate>2026-08-19</cbc:ReferenceDate>  <!-- fecha de EMISION de los docs -->
  <cbc:IssueDate>2026-08-20</cbc:IssueDate>           <!-- fecha de la comunicacion -->
  <cac:Signature> ...igual que factura... </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>20601234567</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party><cac:PartyLegalEntity>
      <cbc:RegistrationName><![CDATA[INDPACK PERU S.A.C.]]></cbc:RegistrationName>
    </cac:PartyLegalEntity></cac:Party>
  </cac:AccountingSupplierParty>
  <sac:VoidedDocumentsLine>
    <cbc:LineID>1</cbc:LineID>
    <cbc:DocumentTypeCode>01</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>FE01</sac:DocumentSerialID>
    <sac:DocumentNumberID>123</sac:DocumentNumberID>
    <sac:VoidReasonDescription><![CDATA[ERROR EN DATOS DEL CLIENTE]]></sac:VoidReasonDescription>
  </sac:VoidedDocumentsLine>
  <!-- una linea por cada comprobante de la MISMA fecha de emision -->
</VoidedDocuments>
```

- Nombre de archivo: `{RUC}-RA-{YYYYMMDD}-{correlativo}.xml` donde la fecha es la de **la comunicación** (IssueDate). Ej.: `20601234567-RA-20260820-00001.zip`.
- Un RA agrupa solo comprobantes emitidos en la **misma fecha** (`ReferenceDate`); si hay documentos de fechas distintas, genera varias RA.
- El correlativo diario sale de `sunat_correlativos_diarios` (tipo RA, fecha de hoy) con el mismo patrón atómico de la Fase 3.9.
- Se firma con `firmarXml` igual que una factura.


## 8.2 Flujo completo de baja de una factura

```
// controllers/sunat.controller.js (fragmento)
export async function darDeBajaFactura(req, res, next) {
  const { id_factura, motivo } = req.body;
  try {
    // 1) Validaciones
    const f = await getFactura(id_factura);
    if (f.sunat_estado !== 'ACEPTADO') throw new AppError('Solo se dan de baja comprobantes ACEPTADOS', 422);
    if (!['01','07','08'].includes(f.codigo_tipo_sunat))
      throw new AppError('Tipo de documento no admite Comunicacion de Baja', 422);
    const dias = diffDiasLima(f.fecha_emision, hoyLima());
    if (dias > 7) throw new AppError('Plazo de 7 dias vencido: emitir Nota de Credito', 422);

    // 2) Crear RA + detalle en BD (estado GENERADO), correlativo diario atomico
    const ra = await crearRA([ { factura: f, motivo } ]);

    // 3) XML -> firmar -> zip -> sendSummary
    const xml = construirVoidedDocumentsXML(ra);
    const { xmlFirmado } = firmarXml(xml);
    const nombre = `${sunatConfig.ruc}-RA-${ra.fechaComunicacion}-${String(ra.correlativo).padStart(5,'0')}`;
    const ticket = await sendSummary(nombre + '.zip', zipXml(nombre + '.xml', xmlFirmado));
    await actualizarRA(ra.id, { estado: 'ENVIADO', sunat_ticket: ticket });

    // 4) Poll de getStatus (aqui inline con 3 intentos; el job de Fase 15 lo termina si queda 98)
    for (let i = 0; i < 3; i++) {
      await sleep(15000);
      const st = await getStatus(ticket);
      if (st.statusCode === '98') continue;
      const cdr = st.cdrZip ? parsearCdr(st.cdrZip) : null;
      const ok = st.statusCode === '0' && cdr?.responseCode === '0';
      await cerrarRA(ra.id, ok, cdr, st.cdrZip);
      if (ok) {
        await marcarFacturasBaja(ra.id); // sunat_estado='BAJA', estado='Anulada', motivo, fecha
        // ademas: revertir stock/OV segun tu regla de negocio y registrar en facturas_anuladas_ov
      }
      return res.json({ ok, ticket, cdr });
    }
    res.status(202).json({ ok: null, ticket, mensaje: 'En proceso; el job de reintentos lo cerrara' });
  } catch (e) { next(e); }
}
```


## 8.3 Resumen Diario (RC) — NO APLICA

El RC existe solo para boletas (informarlas o anularlas). Como SPI no emite boletas, no se implementa. Cualquier anulación de comprobantes de SPI pasa por RA (≤7 días) o por Nota de Crédito (>7 días).


## PUNTO DE CONTROL — Fase 8

- [ ] Baja RA de una factura aceptada en Beta: ticket obtenido, getStatus 0, CDR 0, factura en `sunat_estado="BAJA"` y `estado="Anulada"`, fila en `facturas_anuladas_ov` creada.
- [ ] Intento de baja fuera de plazo (simular fecha) → bloqueado con mensaje "emitir Nota de Crédito".
- [ ] Ticket que queda en 98 es cerrado después por el job (probar apagando el poll inline).


---


# FASE 9 — Consultas de estado, CDR y validez


## 9.1 getStatusCdr (SOAP, solo producción, tipos 01/07/08)

Ya implementado en `soap.service.js` (Fase 6.4). Úsalo para: (a) recuperar un CDR perdido, (b) resolver faults `1033`, (c) verificar el estado real tras un timeout. Códigos de respuesta:

| statusCode | Significado |
| --- | --- |
| 0001 | El comprobante existe y está ACEPTADO (adjunta CDR) |
| 0002 | El comprobante existe pero está en estado RECHAZADO |
| 0003 | Existe pero con BAJA (anulado por RA) |
| 0004 / 0098 | No existe / en proceso |


## 9.2 Consulta de validez (API REST pública `validarcomprobante`)

Para verificar comprobantes propios o de proveedores (útil en Compras). Requiere otro par de credenciales (menú SOL → Credenciales API, alcance "consulta integrada"). Flujo:

```
# 1) Token (form-urlencoded)
POST https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token
grant_type=client_credentials&scope=https://api.sunat.gob.pe/v1/contribuyente/contribuyentes
&client_id={client_id}&client_secret={client_secret}

# 2) Consulta
POST https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/{RUC_CONSULTANTE}/validarcomprobante
Authorization: Bearer {token}
Content-Type: application/json
{
  "numRuc": "20601234567", "codComp": "01",
  "numeroSerie": "FE01", "numero": "123",
  "fechaEmision": "20/08/2026", "monto": "1180.00"
}
# Respuesta: { success:true, data: { estadoCp: "1", estadoRuc:"00", ... } }
# estadoCp: 0=NO EXISTE 1=ACEPTADO 2=ANULADO 3=AUTORIZADO 4=NO AUTORIZADO
```


## 9.3 Endpoint interno de reconciliación

Expón `GET /api/sunat/comprobantes/:id/estado` que: (1) lee el estado en BD, (2) si `SUNAT_MODE=PROD` y el documento está `ENVIADO` sin CDR, llama `getStatusCdr`, actualiza BD y devuelve el resultado. El frontend lo usa con un botón "Verificar en SUNAT" en el detalle del comprobante.


## PUNTO DE CONTROL — Fase 9

- [ ] `getStatusCdr` recupera el CDR de una factura aceptada (probar en producción durante la Fase 16, en Beta queda mockeado).
- [ ] Credenciales de consulta integrada generadas y guardadas.
- [ ] Botón "Verificar en SUNAT" operativo en el frontend.


---


# FASE 10 — GRE Remitente (tipo 09) por API REST

Las guías NO viajan por SOAP: usan el **API REST de la nueva plataforma GRE** con token OAuth2. El XML sigue siendo UBL (DespatchAdvice) firmado igual que una factura; cambia el transporte.


## 10.1 Obtención y cacheo del token — `gre.service.js`

```
// services/sunat/gre.service.js
import axios from 'axios';
import crypto from 'crypto';
import { sunatConfig } from '../../config/sunat.js';
import { pool } from '../../config/database.js';

export async function obtenerTokenGre() {
  // 1) intenta usar el token cacheado en sunat_gre_token
  const [[t]] = await pool.query(
    'SELECT access_token FROM sunat_gre_token WHERE id=1 AND expira_en > DATE_ADD(NOW(), INTERVAL 2 MINUTE)');
  if (t) return t.access_token;

  // 2) pide uno nuevo
  const url = sunatConfig.urls.GRE_TOKEN.replace('{client_id}', sunatConfig.greClientId);
  const body = new URLSearchParams({
    grant_type: 'password',
    scope: 'https://api-cpe.sunat.gob.pe',
    client_id: sunatConfig.greClientId,
    client_secret: sunatConfig.greClientSecret,
    username: sunatConfig.ruc + sunatConfig.solUser,  // RUC + usuario SOL
    password: sunatConfig.solPass
  });
  const { data } = await axios.post(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000
  });
  // data: { access_token, token_type:'Bearer', expires_in: 3600 }
  await pool.query(
    `INSERT INTO sunat_gre_token (id, access_token, expira_en)
      VALUES (1, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE access_token=VALUES(access_token), expira_en=VALUES(expira_en)`,
    [data.access_token, data.expires_in - 60]);
  return data.access_token;
}

/** Envia el ZIP de la guia. nombreDoc = RUC-09-TE01-00000001 (sin extension) */
export async function enviarGuia(nombreDoc, zipBuffer) {
  const token = await obtenerTokenGre();
  const hashZip = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const { data } = await axios.post(
    sunatConfig.urls.GRE_API + '/comprobantes/' + nombreDoc,
    { archivo: { nomArchivo: nombreDoc + '.zip',
                 arcGreZip: zipBuffer.toString('base64'),
                 hashZip } },
    { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 60000 });
  return data.numTicket; // ej: "1703831236547"
}

/** Consulta el ticket. codRespuesta: '0' aceptado, '98' en proceso, '99' con errores */
export async function consultarGuia(numTicket) {
  const token = await obtenerTokenGre();
  const { data } = await axios.get(
    sunatConfig.urls.GRE_API + '/comprobantes/envios/' + numTicket,
    { headers: { Authorization: 'Bearer ' + token }, timeout: 30000 });
  return {
    codRespuesta: String(data.codRespuesta),
    cdrZip: data.arcCdr ? Buffer.from(data.arcCdr, 'base64') : null,
    indCdrGenerado: data.indCdrGenerado,          // '1' si hay CDR
    error: data.error || null                     // { numError, desError } cuando 99
  };
}
```


## 10.2 XML DespatchAdvice (GRE Remitente) — estructura completa

```
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>TE01-1</cbc:ID>
  <cbc:IssueDate>2026-08-20</cbc:IssueDate>
  <cbc:IssueTime>09:00:00</cbc:IssueTime>
  <cbc:DespatchAdviceTypeCode>09</cbc:DespatchAdviceTypeCode>
  <cac:Signature>...igual que factura...</cac:Signature>
  <!-- REMITENTE (INDPACK) -->
  <cac:DespatchSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="6">20601234567</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[INDPACK PERU S.A.C.]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>
  <!-- DESTINATARIO (cliente) -->
  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="6">20512345678</cbc:ID></cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[CLIENTE INDUSTRIAL S.A.]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado"
      listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">01</cbc:HandlingCode>
    <cbc:HandlingInstructions><![CDATA[VENTA]]></cbc:HandlingInstructions>
    <cbc:GrossWeightMeasure unitCode="KGM">520.50</cbc:GrossWeightMeasure>
    <cac:ShipmentStage>
      <!-- catalogo 18: 01 transporte PUBLICO (tercero), 02 PRIVADO (flota propia) -->
      <cbc:TransportModeCode listName="Modalidad de traslado"
        listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">02</cbc:TransportModeCode>
      <cac:TransitPeriod><cbc:StartDate>2026-08-20</cbc:StartDate></cac:TransitPeriod>
      <!-- SOLO transporte PUBLICO (01): datos del transportista -->
      <!-- <cac:CarrierParty>
        <cac:PartyIdentification><cbc:ID schemeID="6">20487654321</cbc:ID></cac:PartyIdentification>
        <cac:PartyLegalEntity><cbc:RegistrationName>TRANSPORTES XYZ SAC</cbc:RegistrationName>
        </cac:PartyLegalEntity></cac:CarrierParty> -->
      <!-- SOLO transporte PRIVADO (02): conductor principal -->
      <cac:DriverPerson>
        <cbc:ID schemeID="1">45671234</cbc:ID> <!-- DNI conductor (tabla empleados) -->
        <cbc:FirstName><![CDATA[JUAN]]></cbc:FirstName>
        <cbc:FamilyName><![CDATA[PEREZ QUISPE]]></cbc:FamilyName>
        <cbc:JobTitle>Principal</cbc:JobTitle>
        <cac:IdentityDocumentReference><cbc:ID>Q45671234</cbc:ID></cac:IdentityDocumentReference> <!-- licencia -->
      </cac:DriverPerson>
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:ID schemeAgencyName="PE:INEI">150142</cbc:ID> <!-- ubigeo LLEGADA -->
        <cac:AddressLine><cbc:Line><![CDATA[AV. CLIENTE 456 - VILLA EL SALVADOR]]></cbc:Line></cac:AddressLine>
      </cac:DeliveryAddress>
      <cac:Despatch>
        <cac:DespatchAddress>
          <cbc:ID schemeAgencyName="PE:INEI">150101</cbc:ID> <!-- ubigeo PARTIDA -->
          <cac:AddressLine><cbc:Line><![CDATA[AV. INDUSTRIAL 123 - LIMA]]></cbc:Line></cac:AddressLine>
        </cac:DespatchAddress>
      </cac:Despatch>
    </cac:Delivery>
    <!-- SOLO transporte PRIVADO: vehiculo principal (tabla flota) -->
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment><cbc:ID>ABC-123</cbc:ID></cac:TransportEquipment>
    </cac:TransportHandlingUnit>
  </cac:Shipment>
  <cac:DespatchLine>
    <cbc:ID>1</cbc:ID>
    <cbc:DeliveredQuantity unitCode="NIU">100</cbc:DeliveredQuantity>
    <cac:OrderLineReference><cbc:LineID>1</cbc:LineID></cac:OrderLineReference>
    <cac:Item>
      <cbc:Description><![CDATA[BOLSA POLIETILENO 20x30]]></cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>PROD-0001</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
  </cac:DespatchLine>
</DespatchAdvice>
```

- Mapeo desde tu BD: `guias_remision` (fecha_traslado, ubigeo_partida/llegada, peso_bruto_kg, motivo_traslado_cod) + `detalle_guia_remision` + `flota.placa` + `empleados` (conductor: DNI y licencia — añade el campo licencia si falta) + cliente.
- Documento relacionado: si el traslado es por venta con factura emitida, añade `cac:AdditionalDocumentReference` con el `FE01-123` y `DocumentTypeCode 01` (usa `doc_relacionado_*` de la Fase 3.6).
- Modalidad: tu campo `tipo_entrega` mapea así — "Vehiculo Empresa" → 02 privado (DriverPerson + placa); "Transporte Privado" (tercero) → 01 público (CarrierParty, sin conductor ni placa obligatorios).
- Nombre archivo: `{RUC}-09-TE01-{numero}` (el path del POST NO lleva extensión; `nomArchivo` del body sí lleva `.zip`).


## 10.3 Flujo de emisión de GRE (asíncrono con ticket)

1. Correlativo atómico de `series_correlativos` (tipo 09, serie TE01).
2. Construir XML → `firmarXml` → `zipXml`.
3. `enviarGuia(nombre, zip)` → guarda `numTicket`, `sunat_estado="ENVIADO"`.
4. Poll `consultarGuia(ticket)` (15 s × 3; luego lo hereda el job): `0` → parsear CDR, `sunat_estado="ACEPTADO"`, guardar `sunat_qr_url` (viene dentro del CDR como nota/atributo con la URL de consulta pública de la GRE) y digest; `99` → `RECHAZADO` + `error.desError`.
5. Subir XML y CDR a Cloudinary; actualizar `xml_url`/`cdr_url`.


## 10.4 Requisito legal del PDF de la GRE

> **IMPORTANTE:** Desde la GRE 2.0, la representación impresa **debe llevar el código QR que contiene la URL devuelta por SUNAT** (campo guardado en `sunat_qr_url`). Sin ese QR la guía impresa no es válida para el traslado. Genera el PDF solo cuando el estado sea ACEPTADO.


## 10.5 Advertencia sobre pruebas de GRE

SUNAT **no publica un ambiente Beta oficial** para el API REST de GRE. Estrategia recomendada: (1) prueba unitaria del XML validándolo contra los XSD oficiales de DespatchAdvice; (2) implementa un **mock local** del API (mismo contrato request/response de 10.1) activado con `SUNAT_MODE=BETA`; (3) las primeras guías reales se emiten en producción con traslados internos de bajo riesgo (motivo 04 "traslado entre establecimientos") antes de usarlo con clientes.


## PUNTO DE CONTROL — Fase 10

- [ ] Token OAuth real obtenido y cacheado en `sunat_gre_token` (probar con credenciales reales: el endpoint de token sí puede probarse sin emitir).
- [ ] XML DespatchAdvice pasa validación XSD local.
- [ ] Mock local devuelve ticket y CDR simulado; el flujo completo funciona de punta a punta.
- [ ] PDF de guía bloqueado hasta estado ACEPTADO.


---


# FASE 11 — GRE Transportista (tipo 31)

Aplica cuando INDPACK actúa como transportista de bienes de terceros o SUNAT lo exija para su flota. Es el mismo canal REST y el mismo flujo de la Fase 10 con estas diferencias:

| Elemento | GRE Remitente (09) | GRE Transportista (31) |
| --- | --- | --- |
| Serie | TE01 | VE01 |
| DespatchAdviceTypeCode | 09 | 31 |
| Emisor | DespatchSupplierParty = INDPACK | cac:CarrierParty (raíz) = INDPACK |
| Partes | Remitente + Destinatario | Remitente (`ruc_remitente`), Destinatario, y opcional subcontratado |
| Datos vehiculares | Solo si modalidad privada | SIEMPRE: placa(s), conductor(es) con licencia, y **Registro MTC** del transportista (`certificado_habilitacion` de tu tabla) en `cac:TransportEquipment/ApplicableTransportMeans` |
| GRE relacionada | — | `cac:AdditionalDocumentReference` con la GRE remitente (09) vinculada (`id_guia_remision` de tu tabla) |
| Tabla origen | guias_remision | guias_transportista |

Nombre de archivo: `{RUC}-31-VE01-{numero}`. El envío usa `enviarGuia`/`consultarGuia` sin cambios.


## PUNTO DE CONTROL — Fase 11

- [ ] XML tipo 31 con dos conductores y dos placas pasa validación XSD.
- [ ] Referencia cruzada a la GRE 09 correcta (serie-número reales).
- [ ] Flujo mock completo OK; campos nuevos de `guias_transportista` poblados.


---


# FASE 12 — Anulación / subsanación de guías

> **IMPORTANTE:** En la plataforma GRE 2.0 **no existe "comunicación de baja" para guías**. Una GRE aceptada con error se subsana emitiendo una **nueva GRE correcta**; la errada queda sin efecto operativo si el traslado no se inició (SUNAT valida el traslado real, no exige anular la anterior). Tu sistema debe modelarlo explícitamente:

1. Acción "Dejar sin efecto" sobre una guía ACEPTADA cuyo traslado no inició: pide motivo, marca `sunat_estado="ANULADA"` (estado interno), conserva XML/CDR, y bloquea su PDF con marca de agua "SIN EFECTO".
2. Si corresponde reemplazo: el formulario "Emitir guía de reemplazo" clona los datos, corrige y emite una GRE nueva (Fase 10); al aceptarse, guarda `id_guia_reemplazo` en la guía original.
3. Si el traslado ya inició y hay un evento (transbordo, vehículo malogrado, reinicio), lo que corresponde es una **GRE por Eventos** — regístrala como mejora futura; mientras tanto el procedimiento manual es emitirla desde el portal SOL y adjuntar su número en `observaciones`.
4. Reflejar la anulación aguas arriba: si la guía estaba ligada a una OV/salida, tu lógica actual de guias (estado "Anulada" del enum existente) se sincroniza con `sunat_estado`.


## PUNTO DE CONTROL — Fase 12

- [ ] Guía sin efecto no imprimible sin marca de agua; trazabilidad al reemplazo funcionando.
- [ ] Reglas de negocio: no se puede dejar sin efecto una guía con salida despachada/entregada sin autorización de Administrador.


---


# FASE 13 — Representación impresa (PDF) con QR y hash


## 13.1 Contenido del QR (comprobantes 01/03/07/08)

Cadena pipe-separated exigida (RS 193-2020/SUNAT):

```
RUC | TIPO | SERIE | NUMERO | IGV | TOTAL | FECHA_EMISION | TIPO_DOC_CLIENTE | NUM_DOC_CLIENTE |
-- ejemplo:
20601234567|01|FE01|123|180.00|1180.00|2026-08-20|6|20512345678|
```

```
// services/sunat/qr.service.js
import QRCode from 'qrcode';
export function generarQr({ tipo, serie, numero, ov, cliente, digestValue }) {
  const data = [
    process.env.SUNAT_RUC, tipo, serie, numero,
    Number(ov.igv).toFixed(2), Number(ov.total).toFixed(2),
    ov.fecha_emision_str,                       // YYYY-MM-DD en hora Lima
    cliente.tipo_documento === 'RUC' ? '6' : '1',
    cliente.ruc, ''
  ].join('|');
  return { data, png: () => QRCode.toBuffer(data, { width: 200, margin: 1 }) };
}
```

- Además del QR, imprime el **valor resumen** (`sunat_digest_value`) al pie del PDF y la leyenda "Representación impresa del Comprobante de Pago Electrónico".
- Integra esto en tus `utils/pdfGenerators/` existentes (pdfkit): añade el QR (imagen PNG) y el hash a las plantillas de factura/boleta/nota.
- Para la GRE el QR NO es esta cadena: es la **URL** que devolvió SUNAT (`sunat_qr_url`, Fase 10.4).
- El PDF final se sube a Cloudinary y su URL va en `facturas_venta.url_pdf` (campo ya existente).


## PUNTO DE CONTROL — Fase 13

- [ ] PDF de factura con QR escaneable (probar con el lector del app SUNAT) y hash visible.
- [ ] PDF de nota de crédito indica el comprobante afectado y motivo.
- [ ] PDF de GRE muestra el QR-URL de SUNAT y solo se genera en estado ACEPTADO.


---


# FASE 14 — Endpoints del API SPI y cambios de frontend


## 14.1 `routes/sunat.routes.js`

```
import { Router } from 'express';
import { verificarToken, verificarPermiso } from '../middleware/auth.js';
import * as c from '../controllers/sunat.controller.js';
const r = Router();
r.use(verificarToken, verificarPermiso('facturacion'));

// Emision
r.post('/comprobantes/emitir', c.emitirComprobante);        // {id_orden_venta} -> siempre factura 01
r.post('/notas/emitir', c.emitirNota);                      // {id_factura_ref, tipo:'07'|'08', motivo_codigo, items?}
// Bajas
r.post('/bajas/factura', c.darDeBajaFactura);               // RA (unico mecanismo; sin boletas no hay RC)
r.get('/bajas/:id', c.obtenerBaja);                         // estado + CDR
// Consultas
r.get('/comprobantes/:id/estado', c.verificarEstado);       // BD + getStatusCdr
r.get('/comprobantes/:id/xml', c.descargarXml);
r.get('/comprobantes/:id/cdr', c.descargarCdr);
r.post('/validar-comprobante', c.validarComprobanteTercero); // 9.2
// Guias
r.post('/gre/remitente/:id_guia/emitir', c.emitirGreRemitente);
r.post('/gre/transportista/:id_guia/emitir', c.emitirGreTransportista);
r.get('/gre/:tipo/:id/estado', c.consultarGre);             // re-poll de ticket
r.post('/gre/:tipo/:id/sin-efecto', c.dejarSinEfectoGuia);
r.post('/gre/:tipo/:id/reemplazar', c.emitirGuiaReemplazo);
// Utilidades
r.get('/ping', c.ping);
export default r;

// server.js:  app.use('/api/sunat', sunatRoutes);
```


## 14.2 Frontend (React) — cambios mínimos

- En **Órdenes de Venta**: botón "Emitir factura" (visible si `estado_verificacion="Aprobada"` y `facturado_sunat=0`), modal de confirmación con vista previa de totales; al aceptar llama `POST /api/sunat/comprobantes/emitir` y muestra el resultado del CDR.
- Badge de estado SUNAT en listas: PENDIENTE (gris), ENVIADO (ámbar), ACEPTADO (verde), RECHAZADO (rojo), BAJA/ANULADA (negro). Reutiliza tus tokens de tema claro/oscuro.
- Detalle de comprobante: descargas de XML/CDR/PDF, botón "Verificar en SUNAT", acción "Dar de baja" (solo ≤7 días, con motivo) y "Emitir NC/ND".
- En **Guías**: botón "Enviar a SUNAT", polling visual del ticket (Socket.IO: emite evento `gre:actualizada` cuando el job cierre el ticket), y bloqueo de impresión hasta ACEPTADO.
- Notificaciones (tabla `notificaciones` + Socket.IO) para: comprobante rechazado, baja aceptada, ticket cerrado por el job.


## PUNTO DE CONTROL — Fase 14

- [ ] Todo el ciclo se opera desde la UI sin tocar Postman.
- [ ] Permisos verificados: un rol sin `facturacion` no ve los botones ni puede llamar los endpoints.
- [ ] Eventos Socket.IO llegan y actualizan la UI sin recargar.


---


# FASE 15 — Cola de reintentos, trazabilidad y contingencia


## 15.1 Job `jobs/sunat-reintentos.job.js` (node-cron, cada 5 minutos)

```
import cron from 'node-cron';

cron.schedule('*/5 * * * *', async () => {
  // 1) Comprobantes ENVIADO sin CDR hace > 2 min (fault/timeout en el envio)
  //    -> getStatusCdr (PROD). 0001: cerrar como ACEPTADO. 0004: re-sendBill.
  //    Maximo 5 intentos; al 6to marcar ERROR y notificar a Administracion.
  // 2) RA/RC con estado ENVIADO y ticket -> getStatus(ticket) y cerrar.
  // 3) GRE con ticket abierto -> consultarGuia(ticket) y cerrar (+ evento socket).
  // Cada accion inserta en sunat_log.
}, { timezone: 'America/Lima' });
```

- Backoff: reintento 1 a los 5 min, luego 15, 30, 60, 120. Campo `sunat_intentos` controla el tope.
- Render duerme los servicios free: si tu plan lo permite, usa un servicio tipo Cron Job de Render apuntando a `POST /api/sunat/jobs/tick` (protegido por un token interno) en lugar de node-cron, para garantizar la ejecución.
- **Contingencia por caída de SUNAT**: el comprobante queda `ENVIADO` y el negocio continúa (el despacho usa la guía; la factura se regulariza cuando SUNAT vuelva). Nunca bloquees la operación logística por un fault de SUNAT — sí bloquéala si el comprobante fue RECHAZADO.
- Panel "Monitor SUNAT" (Reportes): conteo por estado, últimos rechazos con su código, tickets abiertos, y errores del log. Es tu herramienta de soporte diario.


## PUNTO DE CONTROL — Fase 15

- [ ] Matar el proceso a mitad de un envío deja el sistema consistente y el job lo repara solo.
- [ ] Simular caída (endpoint inválido) genera reintentos con backoff y alerta al 6º fallo.
- [ ] Monitor SUNAT operativo con datos reales de Beta.


---


# FASE 16 — Paso a producción: checklist final

Ejecutar en este orden, un solo responsable, con ventana de al menos medio día:

- [ ] 1. Todas las fases 1–15 con sus puntos de control completos (repasar uno por uno).
- [ ] 2. Variables Render actualizadas: `SUNAT_MODE=PROD`, `SUNAT_SOL_USER/PASS` del usuario secundario real, `SUNAT_CERT_B64/KEY_B64` del certificado de producción.
- [ ] 3. `series_correlativos` en cero para las series de producción (verificar que no arrastren números de Beta) y respaldo de la BD tomado.
- [ ] 4. Emitir la **primera factura real de monto pequeño** a un cliente interno/controlado → CDR 0 → verificar en el portal SUNAT (consulta de validez) que aparece ACEPTADA.
- [ ] 5. Emitir NC de prueba sobre la factura del paso 4 (motivo 01) → CDR 0 → comprobar el ciclo completo de anulación.
- [ ] 6. Dar de baja (RA) un comprobante de prueba emitido el mismo día → getStatus 0.
- [ ] 7. Emitir primera GRE remitente real con traslado interno (motivo 04) → ACEPTADO → validar el QR-URL desde un celular.
- [ ] 8. Si aplica flota para terceros: primera GRE transportista.
- [ ] 9. Revisar el Monitor SUNAT y `sunat_log` durante 48 h; recién entonces habilitar el permiso `facturacion` a los usuarios de Ventas/Administración.
- [ ] 10. Mantener Beta disponible como entorno de staging (variable SUNAT_MODE en un servicio de pruebas o local) para futuros cambios; el desarrollo sigue en la rama main.

> **IMPORTANTE:** Homologación formal: para el SEE-Del Contribuyente actual SUNAT ya no exige el antiguo proceso de homologación con casos de prueba; la validación es directa en producción. Aun así, conserva los CDR de Beta como evidencia técnica interna.


---


# ANEXO A — Catálogos SUNAT usados por el sistema

| Catálogo | Contenido | Dónde se usa |
| --- | --- | --- |
| 01 | Tipo de documento: 01 Factura, 03 Boleta, 07 NC, 08 ND, 09 GRE-R, 31 GRE-T | `codigo_tipo_sunat`, nombres de archivo |
| 02 | Monedas ISO: PEN, USD | `DocumentCurrencyCode` |
| 03 | Unidades: NIU, KGM, MTR, LTR, ZZ, BX, PK... | `productos.codigo_unidad_sunat` |
| 06 | Doc. identidad: 0 SinDoc, 1 DNI, 4 CE, 6 RUC, 7 Pasaporte | `schemeID` del cliente |
| 07 | Afectación IGV: 10 gravado, 20 exonerado, 30 inafecto, 40 exportación | `TaxExemptionReasonCode` |
| 09 | Motivos NC (tabla en Fase 7) | `motivo_nota_codigo` |
| 10 | Motivos ND | `motivo_nota_codigo` |
| 16 | Tipo de precio: 01 precio unitario con IGV, 02 valor referencial gratuito | `PriceTypeCode` |
| 18 | Modalidad traslado: 01 público, 02 privado | GRE `TransportModeCode` |
| 20 | Motivo traslado: 01 venta, 02 compra, 04 traslado entre establecimientos, 08 importación, 09 exportación, 13 otros | GRE `HandlingCode` |
| 51 | Tipo operación: 0101 venta interna, 0200 exportación, 1001 detracción... | `InvoiceTypeCode listID` |
| Tributos | 1000 IGV/VAT, 9995 EXP, 9997 EXO, 9998 INA, 9996 GRA | `TaxScheme` |


# ANEXO B — Errores frecuentes y solución

| Código | Mensaje típico | Causa y solución |
| --- | --- | --- |
| 0111 | No tiene el perfil para enviar comprobantes | Usuario secundario sin permisos o creado hace <24 h → revisar Fase 1.1 |
| 0130 / 0160 | ZIP vacío / archivo no cumple formato | XML fuera de la raíz del ZIP o nombre distinto entre ZIP y XML |
| 1033 | El comprobante fue registrado previamente | Reenvío duplicado → NO reenviar: `getStatusCdr` y cerrar con su resultado |
| 1034 | RUC del nombre de archivo no coincide | Nombre mal armado → revisar 6.1 |
| 2017 / 2022 | Firma inválida / certificado no coincide | Certificado no registrado en SOL (1.3) o clave/cert desparejados (1.2 paso 3) |
| 2324 | Fecha de emisión fuera de plazo | Emisión con fecha >3 días atrás → corregir reloj/zona horaria Lima |
| 3038 / series | Serie o correlativo inválido | Correlativo repetido o con huecos → revisar patrón atómico 3.9 |
| 4xxx | Observaciones | El doc está ACEPTADO; corregir la causa para futuros envíos |
| 422 (GRE token) | invalid_client / unauthorized | client_id/secret errados o app sin alcance GRE → Fase 1.4 |
| 99 (GRE) | codRespuesta 99 con desError | Error de contenido de la guía → leer `error.desError`, corregir y emitir nueva |

Documentación oficial de referencia: Manual del Programador SEE-SCP y catálogos en `cpe.sunat.gob.pe` (Guías y Manuales), Manual de Servicios Web de la Plataforma Nueva GRE, y Resolución 193-2020/SUNAT (representación impresa y QR).


---
