import axios from 'axios';

// Prueba directa a ruc.pe para un RUC: ¿responde 200 con contenido, o bloquea?
const ruc = process.argv[2] || '20483968010';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function probar(url) {
  try {
    const r = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 4,
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es-PE,es;q=0.9' },
      responseType: 'text',
      validateStatus: () => true,
    });
    const html = typeof r.data === 'string' ? r.data : '';
    console.log(`\n${url}`);
    console.log('  status:', r.status, '| longitud:', html.length);
    console.log('  ¿menciona el RUC?:', html.includes(ruc));
    console.log('  ¿Cloudflare/challenge?:', /cloudflare|challenge|captcha|attention required/i.test(html));
    console.log('  primeros 300 chars:', html.slice(0, 300).replace(/\s+/g, ' '));
  } catch (e) {
    console.log(`\n${url}\n  ERROR: ${e.code || ''} ${e.message}`);
  }
}

console.log('Probando fuentes de RUC para', ruc);
await probar(`https://ruc.pe/?s=${ruc}`);
await probar(`https://www.datosperu.org/buscar.php?buscar=${ruc}`);
process.exit(0);
