import { PDFParse } from 'pdf-parse';
import fs from 'node:fs';

const archivo = process.argv[2];
const texto = (await new PDFParse({ data: fs.readFileSync(archivo) }).getText()).text;

const lineas = texto.split(/\r?\n/);
const claves = /(consultacpe|\/v1\/|contribuyente\/|descarg|represent|GET |POST |\/01|\/02|\/03|api-cpe|api\.sunat|scope|recurso|endpoint|servicio web|método|metodo)/i;

console.log('== lineas con claves ==');
lineas.forEach((l, i) => {
  if (claves.test(l) && l.trim().length > 3) {
    console.log(String(i).padStart(4), l.trim().slice(0, 160));
  }
});
