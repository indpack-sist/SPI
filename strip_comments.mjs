import fs from 'fs';

const PRESERVE = [
  'eslint', 'prettier', '@ts-', 'ts-ignore', 'ts-expect-error', 'ts-nocheck',
  'globals', 'global', '@vite-ignore', 'webpackChunkName', '@preserve',
  '@license', 'istanbul', 'c8 ', 'v8 ignore', 'sourceMappingURL', 'shebang'
];

function shouldPreserve(commentText) {
  return PRESERVE.some(p => commentText.includes(p));
}

function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code';
  let prevSignificant = '';
  const comments = [];

  function lastNonSpaceChar(s) {
    for (let k = s.length - 1; k >= 0; k--) {
      const c = s[k];
      if (c !== ' ' && c !== '\t') return c;
    }
    return '';
  }

  function regexAllowed() {
    const c = lastNonSpaceChar(out);
    if (c === '') return true;
    if (/[\w$)\]]/.test(c)) {
      const m = out.match(/([A-Za-z_$][\w$]*)\s*$/);
      if (m) {
        const kw = ['return','typeof','instanceof','in','of','new','delete','void','do','else','yield','await','case'];
        return kw.includes(m[1]);
      }
      return false;
    }
    return true;
  }

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === '/' && c2 === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      const text = src.slice(i, j);
      if (shouldPreserve(text) || src.slice(i, i + 3) === '///') {
        out += src.slice(i, j);
      } else {
        comments.push({ type: 'line', start: i, end: j });
        let k = out.length - 1;
        let onlyWs = true;
        while (k >= 0 && out[k] !== '\n') {
          if (out[k] !== ' ' && out[k] !== '\t') { onlyWs = false; break; }
          k--;
        }
        if (onlyWs) {
          out = out.slice(0, k + 1);
          if (j < n && src[j] === '\n') j++;
        } else {
          out = out.replace(/[ \t]+$/, '');
        }
      }
      i = j;
      continue;
    }

    if (c === '/' && c2 === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
      j = Math.min(j + 2, n);
      const text = src.slice(i, j);
      if (shouldPreserve(text)) {
        out += text;
        i = j;
        continue;
      }
      let k = out.length - 1;
      let onlyWs = true;
      while (k >= 0 && out[k] !== '\n') {
        if (out[k] !== ' ' && out[k] !== '\t') { onlyWs = false; break; }
        k--;
      }
      let after = j;
      let afterOnlyWs = true;
      while (after < n && src[after] !== '\n') {
        if (src[after] !== ' ' && src[after] !== '\t') { afterOnlyWs = false; break; }
        after++;
      }
      if (onlyWs && afterOnlyWs) {
        out = out.slice(0, k + 1);
        i = after;
        if (i < n && src[i] === '\n') i++;
      } else if (onlyWs) {
        out = out.slice(0, k + 1);
        i = j;
      } else {
        out = out.replace(/[ \t]+$/, '');
        i = j;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      out += c; i++;
      while (i < n) {
        out += src[i];
        if (src[i] === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
        if (src[i] === c) { i++; break; }
        i++;
      }
      continue;
    }

    if (c === '`') {
      out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        if (src[i] === '`') { out += src[i]; i++; break; }
        if (src[i] === '$' && src[i + 1] === '{') {
          out += '${'; i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            const cc = src[i];
            if (cc === '{') { depth++; out += cc; i++; }
            else if (cc === '}') { depth--; out += cc; i++; }
            else if (cc === '"' || cc === "'") {
              const q = cc; out += cc; i++;
              while (i < n) { out += src[i]; if (src[i] === '\\') { out += src[i+1] ?? ''; i += 2; continue; } if (src[i] === q) { i++; break; } i++; }
            } else if (cc === '`') {
              out += cc; i++;
              let d2 = 1;
              while (i < n && d2 > 0) { if (src[i] === '\\') { out += src[i]+(src[i+1]??''); i+=2; continue;} if (src[i]==='`'){out+=src[i];i++;break;} out+=src[i]; i++; }
            } else { out += cc; i++; }
          }
          continue;
        }
        out += src[i]; i++;
      }
      continue;
    }

    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      let ok = false;
      while (j < n) {
        const cc = src[j];
        if (cc === '\\') { j += 2; continue; }
        if (cc === '\n') break;
        if (cc === '[') inClass = true;
        else if (cc === ']') inClass = false;
        else if (cc === '/' && !inClass) { ok = true; break; }
        j++;
      }
      if (ok) {
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        out += src.slice(i, j);
        i = j;
        continue;
      }
    }

    out += c;
    i++;
  }

  return { out, count: comments.length };
}

const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');
const { out, count } = strip(src);
fs.writeFileSync(file, out);
console.log(`${file}: removed ${count} comments`);
