import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const stripExports = text => text.replaceAll('export ', '');
const domain = stripExports(await read('src/domain.js')) + '\n' + stripExports(await read('src/simulation.js'));
const fontAssets = {};
for (const name of await readdir(new URL('src/fonts/', root))) {
  if (name.endsWith('.ttf')) {
    fontAssets[name] = (await readFile(new URL('src/fonts/' + name, root))).toString('base64');
  }
}
const rfx = await read('dataset/rfx.json');
// Use function replacements so document text containing "$" is preserved literally.
let app = (await read('src/app.js'))
  .replace('/*DOMAIN*/', () => domain)
  .replace('/*RFX*/', () => rfx)
  .replace('/*ASSETS*/', '{}');
app = stripExports(await read('src/rfq-pdf.js')) + '\nconst rfqFontAssets=' + JSON.stringify(fontAssets) + ';\n' + app;
const end = app.lastIndexOf('save();render();');
if (end < 0) throw new Error('App initialization marker is missing');
app = app.slice(0, end) + await read('src/flow.js') + "\nsave();render();if(serverAiDefault)task('Connecting to configured AI...',()=>api({action:'ping'}));";
let page = await read('src/page.html');
for (const [marker, value] of [
  ['/*APP*/', app],
  ['/*JSZIP*/', await read('src/jszip.min.js')],
  ['/*PDFLIB*/', await read('src/vendor/pdf-lib.min.js')],
  ['/*FONTKIT*/', await read('src/vendor/fontkit.umd.min.js')],
]) {
  page = page.replace(marker, () => value);
}
const server = stripExports((await read('src/server.js')).replace(/^import .*?;\r?\n/gm, ''));
const worker = domain + '\nconst page=' + JSON.stringify(page) + ';\n' + server + `
export default {async fetch(request,env){const p=new URL(request.url).pathname;if(p==='/api')return handleAPI(request,env);if(p!=='/')return new Response('Not found',{status:404});const auto=env?.RFX_AUTO_CONNECT==='true'&&Boolean(env.OPENAI_API_KEY);const html=page.replace('/*SERVER_AI_DEFAULT*/false',String(auto));return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}};
`;
await mkdir(new URL('worker/', root), { recursive: true });
await writeFile(new URL('worker/index.js', root), worker);
await writeFile(new URL('src/preview.html', root), page);
console.log('Worker composed:', Buffer.byteLength(worker), 'bytes');
