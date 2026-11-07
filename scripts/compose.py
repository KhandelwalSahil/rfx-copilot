from pathlib import Path
import json,base64,mimetypes,re
P=Path(__file__).resolve().parents[1]
assets={}
domain=(P/'src/domain.js').read_text().replace('export ','')+'\n'+re.sub(r'^import .*?;\r?\n', '', (P/'src/simulation.js').read_text(), flags=re.M).replace('export ','')
app=(P/'src/app.js').read_text().replace('/*DOMAIN*/',domain).replace('/*RFX*/',(P/'dataset/rfx.json').read_text()).replace('/*ASSETS*/',json.dumps(assets))
fontAssets={f.name:base64.b64encode(f.read_bytes()).decode() for f in (P/'src/fonts').glob('*.ttf')}
app=(P/'src/rfq-pdf.js').read_text().replace('export ','')+'\nconst rfqFontAssets='+json.dumps(fontAssets)+';\n'+app
startup=r'^save\(\);render\(\);\r?$'
if not re.search(startup,app,flags=re.M):raise RuntimeError('App initialization marker is missing')
app=re.sub(startup,'',app,count=1,flags=re.M)+'\n'+(P/'src/flow.js').read_text()+"\nsave();render();if(serverAiDefault)task('Connecting to configured AI...',()=>api({action:'ping'}));"
page=(P/'src/page.html').read_text().replace('/*APP*/',app).replace('/*JSZIP*/',(P/'src/jszip.min.js').read_text()).replace('/*PDFLIB*/',(P/'src/vendor/pdf-lib.min.js').read_text()).replace('/*FONTKIT*/',(P/'src/vendor/fontkit.umd.min.js').read_text())
server=re.sub(r'^import .*?;\n', '', (P/'src/server.js').read_text(), flags=re.M).replace('export ', '')
worker=domain+'\nconst page='+json.dumps(page)+';\n'+server+'''
export default {async fetch(request,env){const p=new URL(request.url).pathname;if(p==='/api')return handleAPI(request,env);if(p!=='/')return new Response('Not found',{status:404});const auto=env?.RFX_AUTO_CONNECT==='true'&&Boolean(env.OPENAI_API_KEY);const html=page.replace('/*SERVER_AI_DEFAULT*/false',String(auto));return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}};
'''
(P/'worker/index.js').write_text(worker)
# Preview serves same HTML via worker-compatible dev server, not a separate mock.
(P/'src/preview.html').write_text(page)
print('Worker composed:',len(worker),'bytes')
