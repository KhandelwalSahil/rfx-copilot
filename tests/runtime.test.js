import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, requestUrl } from '../scripts/dev.mjs';
import worker from '../worker/index.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { sevenReference } from '../scripts/seven-reference.mjs';
import {buyerClarifications,validateClarificationSuggestions} from '../src/domain.js';

const appSource = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace('\nsave();render();', '');
function appFunction(name) {
  const declaration = appSource.match(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  const rest = appSource.slice(declaration.index + declaration[0].length);
  const next = rest.search(/^(?:async )?function /m);
  return declaration[0] + (next < 0 ? rest : rest.slice(0, next));
}

test('hosted AI status is non-interactive while local settings remain available', () => {
  const context = vm.createContext({ serverAiDefault: true, connected: true, config: { allowLive: true } });
  vm.runInContext(appFunction('modelStatus'), context);
  const hosted = vm.runInContext('modelStatus()', context);
  assert.match(hosted, /<span[^>]*role="status"[^>]*>AI connected<\/span>/);
  assert.doesNotMatch(hosted, /button|data-action|tabindex/);
  context.serverAiDefault = false;
  assert.match(vm.runInContext('modelStatus()', context), /<button data-action="settings">/);
});
test('a supplier query cannot open a permanently disabled composer during another operation',()=>{
 const flow=readFileSync(new URL('../src/flow.js',import.meta.url),'utf8');
 const code=flow.slice(flow.indexOf('function supplierQueryDialog('),flow.indexOf('\nasync function receiveSupplierReplies('));
 const notices=[],context=vm.createContext({busy:true,notify:message=>notices.push(message)});
 vm.runInContext(code,context);vm.runInContext("supplierQueryDialog('Rajan')",context);
 assert.match(notices[0],/wait for the current operation/);
});
test('New RFx clears documents, saved history and transient UI without disconnecting AI or reopening a stale preview',async()=>{
 const html=await (await worker.fetch(new Request('https://rfx.test/'))).text(),script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 const elements={'#root':{innerHTML:''},'#overlay':{innerHTML:''},'#status':{innerHTML:''}},saved=new Map(),revoked=[];
 let finishRead;const sourceRead=new Promise(resolve=>{finishRead=resolve;});
 const context=vm.createContext({structuredClone,setTimeout,clearTimeout,setInterval,clearInterval,File,Blob,atob,btoa,sourceRead,fixture:sevenReference({revised:true}),URL:{createObjectURL:()=> 'blob:previous-quote',revokeObjectURL:url=>revoked.push(url)},window:{addEventListener(){}},document:{querySelector:s=>elements[s]||null,querySelectorAll:()=>[]},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)}});
 vm.runInContext(script,context);
 vm.runInContext(`state={...state,rfx:fixture.rfx,data:fixture.data,threads:{Rajan:[{text:'Old conversation'}]},packages:{Rajan:{files:['old.docx']}},responseHistory:{Rajan:[{}]},extractionJobs:{Rajan:{status:'failed'}},outbound:{body:'Old email'},emailDraft:{subject:'Old subject'},previousQuotes:{Rajan:{}},packageHistory:[{}],decision:{reason:'Old decision'},decisionHistory:[{}],audit:[{}],chat:[{text:'Old answer'}],draftChat:[{text:'Old requirement'}],supplierQueryDrafts:{Rajan:'Old query'},clarificationDrafts:{Rajan:{text:'Old clarification'}},awaitingSuppliers:{NorthStar:{}},replyErrors:{Rajan:'Old error'},selectedVendors:['Rajan']};stored=structuredClone(state);draftInput='Old draft';askInput='Old question';clarificationAnswers={'Old clarification':'Old answer'};buyerSuggestions={context:'old',suggestions:[{}]};awardDraft={version:9,reason:'Old rationale',evidence:true,assumptions:true,pending:true};reviewFilter='review';qualityFilter=false;commonFilter=true;comparableOnly=true;insightsMode='ask';view='compare';inboxVendor='Rajan';rfqPdfCache={signature:'old',bytes:[1]};assets['old.docx']={base64:btoa('Old document'),displayName:'old.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};assets['old-outbound.pdf']={};workingFiles.Rajan=['old.docx'];config={base:'',model:'',key:'',allowLive:true};connected=true;prepare=()=>sourceRead;saveSoon();`,context);
 elements['#status'].innerHTML='Old progress';
 const preview=vm.runInContext("preview('old.docx')",context);
 await vm.runInContext("action('confirm-blank')",context);
 const reset=JSON.parse(vm.runInContext("JSON.stringify({state,assets:Object.keys(assets),workingFiles,stored,reviewFilter,qualityFilter,commonFilter,comparableOnly,insightsMode,inboxVendor,rfqPdfCache,buyerSuggestions,awardDraft,view,tab,config,connected})",context));
 finishRead({text:'Old document text'});await preview;
 assert.deepEqual(reset.assets,[]);assert.equal(reset.stored,null);assert.equal(reset.rfqPdfCache,null);
 assert.equal(reset.state.rfx.lines.length,0);assert.equal(reset.state.rfx.questions.length,0);
 for(const key of ['data','threads','packages','responseHistory','extractionJobs'])assert.deepEqual(reset.state[key],{});
 for(const key of ['audit','chat','draftChat','decisionHistory'])assert.deepEqual(reset.state[key],[]);
 for(const key of ['outbound','emailDraft','previousQuotes','packageHistory','supplierQueryDrafts','clarificationDrafts','awaitingSuppliers','replyErrors'])assert.equal(reset.state[key],undefined);
 assert.equal(reset.state.decision,null);assert.equal(reset.state.sent,false);assert.equal(reset.state.draft,null);
 assert(Object.values(reset.workingFiles).every(files=>files.length===0));
 assert.deepEqual(reset.state.ui,{draftInput:'',askInput:'',clarificationAnswers:{}});
 assert.deepEqual([reset.reviewFilter,reset.qualityFilter,reset.commonFilter,reset.comparableOnly,reset.insightsMode,reset.inboxVendor,reset.view,reset.tab],['all',true,false,false,'compare','Metro','define','prices']);
 assert.equal(reset.buyerSuggestions,null);assert.equal(reset.awardDraft.reason,'');assert.equal(reset.config.allowLive,true);assert.equal(reset.connected,true);
 assert.deepEqual(revoked,['blob:previous-quote']);assert.equal(elements['#overlay'].innerHTML,'');assert.equal(elements['#status'].innerHTML,'');
 assert.deepEqual(JSON.parse(saved.get('aerchain-v1')),reset.state);
});
test('real New RFx lifecycle and legacy recovery support extraction failures and successful retry',async()=>{
 const html=await (await worker.fetch(new Request('https://rfx.test/'))).text(),script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 const elements={'#root':{innerHTML:''},'#overlay':{innerHTML:''},'#status':{innerHTML:''}};
 const context=vm.createContext({structuredClone,setTimeout,clearTimeout,setInterval,clearInterval,File,Blob,atob,btoa,window:{addEventListener(){}},document:{querySelector:s=>elements[s]||null,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}}});
 vm.runInContext(script,context);
 vm.runInContext("buyerSuggestions={context:'previous request',suggestions:[]}",context);
 await vm.runInContext("action('confirm-blank')",context);
 assert.equal(vm.runInContext('buyerSuggestions',context),null);
 assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(Object.fromEntries(['threads','packages','responseHistory','extractionJobs'].map(k=>[k,typeof state[k]])))",context)),{threads:'object',packages:'object',responseHistory:'object',extractionJobs:'object'});
 vm.runInContext('delete state.extractionJobs',context);
 await assert.rejects(vm.runInContext("extract('Rajan')",context),/Approve and send/);
 assert.equal(vm.runInContext('state.extractionJobs.Rajan.status',context),'failed');
 context.fixture=sevenReference({revised:true});
 vm.runInContext(`state.rfx=fixture.rfx;state.sent=true;assets['test.txt']={mime:'text/plain',base64:btoa('A supplier source'),displayName:'test.txt'};workingFiles.Rajan=['test.txt'];workingFiles.Metro=['test.txt'];state.packages.Metro={signature:rfxSourceSignature(state.rfx)};prepare=async()=>({name:'test.txt',kind:'text',text:'A supplier source'});vendorInspector=()=>{};api=async({vendor})=>{if(vendor==='Metro')throw Error('Provider unavailable for Metro');return {result:fixture.data[vendor],files:fixture.data[vendor].meta.files,model:'mock',responseId:'mock'};};`,context);
 await vm.runInContext("extract('Rajan')",context);
 assert.equal(vm.runInContext('state.extractionJobs.Rajan.status',context),'complete');
 await assert.rejects(vm.runInContext("extract('Metro')",context),/Provider unavailable/);
 assert.match(vm.runInContext('responseProgress()',context),/Metro.*Provider unavailable for Metro/s);
 assert.match(vm.runInContext('responseProgress()',context),/Retry extraction/);
 assert(vm.runInContext('!!state.data.Rajan',context));
 vm.runInContext("api=async({vendor})=>({result:fixture.data[vendor],files:fixture.data[vendor].meta.files,model:'mock',responseId:'retry'});",context);
 await vm.runInContext("extract('Metro')",context);
 assert.equal(vm.runInContext('state.extractionJobs.Metro.status',context),'complete');
 assert.equal(vm.runInContext('responseProgress()',context),'');
});
test('operation progress updates a small status element and clears its timer even on failure',async()=>{
 const elements={'#status':{innerHTML:''},'#overlay':{innerHTML:''},'[data-progress-elapsed]':{textContent:''}};
 let tick,cleared=0,renders=0;
 const context=vm.createContext({busy:false,serverAiDefault:true,$:s=>elements[s],esc:s=>s,buyerError:s=>s,lockMutations(){},bindOverlay(){},render(){renders++;},setInterval(fn){tick=fn;return 12;},clearInterval(id){assert.equal(id,12);cleared++;}});
 vm.runInContext(appFunction('task'),context);
 context.check=()=>{tick();assert.match(elements['[data-progress-elapsed]'].textContent,/elapsed/);assert.equal(renders,0);};
 await vm.runInContext("task('Reading quotes',async()=>{check();throw Error('Failed read');})",context);
 assert.equal(cleared,1);assert.equal(renders,1);assert.equal(elements['#status'].innerHTML,'');assert.match(elements['#overlay'].innerHTML,/Failed read/);
});
test('buyer proposals never approve answers or change RFx and stale proposals are discarded',async()=>{
 const {rfx,data}=sevenReference({revised:true});rfx.buyerClarifications=['What payment terms?','What delivery duration?'];
 const state={rfx,data,version:8,draft:null,decision:{version:8}},before=structuredClone(state),suggestions=rfx.buyerClarifications.map(question=>({question,answer:'Editable proposal',rationale:'Requires buyer approval'}));
 const context=vm.createContext({state,structuredClone,buyerClarifications,validateClarificationSuggestions,buyerSuggestions:null,serverAiDefault:false,busy:false,api:async()=>({suggestions,model:'mock'}),task:async(message,fn)=>fn(),audit(){},save(){},render(){},notify(message){throw Error(message);}});
 vm.runInContext(appFunction('action'),context);
 await vm.runInContext("action('suggestClarifications')",context);
 assert.deepEqual(state,before);assert.equal(context.buyerSuggestions.suggestions.length,2);
 context.buyerSuggestions=null;context.api=async()=>{state.rfx.terms+=' Buyer changed terms';return {suggestions};};
 await assert.rejects(vm.runInContext("action('suggestClarifications')",context),/stale suggestions/);assert.equal(context.buyerSuggestions,null);
});

test('typing batches large workspace writes and pending input is flushed on page exit or explicit save', () => {
  const timers = new Map(),events = new Map(),writes = [];
  let next = 0;
  const context = vm.createContext({
    state: { data: {} },draftInput: '',askInput: '',clarificationAnswers: {},saveTimer: null,storageWarning: '',
    setTimeout: fn => { timers.set(++next,fn);return next; },
    clearTimeout: id => timers.delete(id),
    window: { addEventListener: (event,fn) => events.set(event,fn) },
    localStorage: { setItem: (key,value) => writes.push(JSON.parse(value)) },
  });
  vm.runInContext(appFunction('save') + appFunction('saveSoon'),context);
  for (const text of ['B','Buy','Buy paper']) {
    context.draftInput=text;
    vm.runInContext('saveSoon()',context);
  }
  assert.equal(writes.length,0);assert.equal(timers.size,1);
  events.get('pagehide')();
  assert.equal(writes[0].ui.draftInput,'Buy paper');assert.equal(timers.size,0);
  context.askInput='Which supplier?';
  vm.runInContext('saveSoon();save();',context);
  assert.equal(writes[1].ui.askInput,'Which supplier?');assert.equal(timers.size,0);
});

test('hosted settings entry points cannot open the editor or disconnect managed AI', async () => {
  let notices = 0;
  const context = vm.createContext({
    serverAiDefault: true,
    config: { allowLive: true },
    notify: () => { notices++; },
    $: () => { throw Error('Hosted settings must not access editor elements'); },
  });
  vm.runInContext(appFunction('settings'), context);
  vm.runInContext('settings()', context);
  vm.runInContext(appFunction('action'), context);
  for (const action of ['settings', 'disconnect', 'saveSettings', 'connect']) {
    await vm.runInContext(`action('${action}')`, context);
  }
  assert.equal(context.config.allowLive, true);
  assert.equal(notices, 5);
});

test('hosted failure dialogs do not expose model settings', async () => {
  for (const managed of [true, false]) {
    const elements = { '#status': { innerHTML: '' }, '#overlay': { innerHTML: '' } };
    const context = vm.createContext({
      serverAiDefault: managed,
      busy: false,
      setInterval: () => 1,
      clearInterval() {},
      $: selector => elements[selector],
      esc: value => value,
      buyerError: value => value,
      lockMutations() {},
      bindOverlay() {},
      render() {},
    });
    vm.runInContext(appFunction('task'), context);
    await vm.runInContext("task('Testing',async()=>{throw Error('Provider unavailable');})", context);
    assert.match(elements['#overlay'].innerHTML, /Provider unavailable/);
    assert.equal(elements['#overlay'].innerHTML.includes('data-action="settings"'), !managed);
  }
});

test('composed Ask page reopens saved answers and handles failures without dropping late helpers', async () => {
  const html = await (await worker.fetch(new Request('https://rfx.test/'))).text();
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const elements = { '#root': { innerHTML: '' }, '#overlay': { innerHTML: '' }, '#status': { innerHTML: '' } };
  const context = vm.createContext({
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    window: { addEventListener() {} },
    document: { querySelector: selector => elements[selector] || null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {} },
  });
  vm.runInContext(script, context);
  const { rfx, data } = sevenReference({ revised: true });
  context.fixture = { rfx, data };
  vm.runInContext(`
    state.rfx=fixture.rfx;state.data=fixture.data;state.sent=true;
    const scope=comparisonScope();
    state.chat=[{role:'assistant',text:'Saved supplier analysis',version:state.version,scope,
      traces:[{tool:'analyze_award',result:runTool('analyze_award',{},state.data,state.rfx)}]}];
    view='compare';insightsMode='compare';render();
    insightsMode='ask';render();
  `, context);
  assert.match(elements['#root'].innerHTML, /id="askform"/);
  assert.match(elements['#root'].innerHTML, /Saved supplier analysis/);
  assert.match(elements['#root'].innerHTML, /30 requested items\. Mandatory qualifications applied/);
  await vm.runInContext("task('Asking',async()=>{throw Error('Model request failed: unavailable');})", context);
  assert.match(elements['#overlay'].innerHTML, /We could not process this AI request/);
  assert.match(elements['#root'].innerHTML, /id="askform"/);
  assert.equal(vm.runInContext('busy', context), false);
});

test('comparison headers visibly distinguish incompatible, incomplete, complete, excluded and pending offers', async () => {
  const html = await (await worker.fetch(new Request('https://rfx.test/'))).text();
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const elements = { '#root': { innerHTML: '' }, '#overlay': { innerHTML: '' }, '#status': { innerHTML: '' } };
  const context = vm.createContext({
    structuredClone, setTimeout, clearTimeout,
    window: { addEventListener() {} },
    document: { querySelector: selector => elements[selector] || null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {} },
  });
  vm.runInContext(script, context);
  const { rfx, data } = sevenReference({ revised: true });
  data.Rajan.freight = { state: 'unknown', amount: null, source: '' };
  context.fixture = { rfx, data };
  vm.runInContext('state.rfx=fixture.rfx;state.data=fixture.data;state.sent=true;', context);
  const before = JSON.stringify(data);
  const headers = vm.runInContext('supplierOverview(comparison(state.data,state.rfx))', context).match(/<thead>[\s\S]*?<\/thead>/)[0];
  assert.match(headers, /<b>QuickDesk<\/b><span class="tag bad">Requirement not met<\/span>/);
  assert.match(headers, /<b>Rajan<\/b><span class="tag warn">Offer incomplete<\/span>/);
  assert.match(headers, /<b>Bharat<\/b><span class="tag ">Lowest comparable cost<\/span>/);
  assert.match(headers, /<b>Metro<\/b><span class="tag ">Excluded<\/span>/);
  assert.match(headers, /<b>NorthStar<\/b><span class="tag ">Awaiting response<\/span>/);
  assert.equal(JSON.stringify(data), before);
});

test('automatic AI opt-in requires a server flag and credential, without exposing the credential', async () => {
  for (const [env, enabled] of [
    [{}, false],
    [{ RFX_AUTO_CONNECT: 'true' }, false],
    [{ OPENAI_API_KEY: 'private-runtime-test-key' }, false],
    [{ RFX_AUTO_CONNECT: 'true', OPENAI_API_KEY: 'private-runtime-test-key' }, true],
  ]) {
    const response = await worker.fetch(new Request('https://rfx.test/'), env);
    const html = await response.text();
    assert.ok(html.includes(`const serverAiDefault=${enabled};`));
    assert.ok(!html.includes('private-runtime-test-key'));
  }
});

test('Azure requests use the canonical HTTPS origin, not forwarded client headers', () => {
  const req = { url: '/api', headers: { host: 'localhost:8080', 'x-forwarded-proto': 'http', 'x-forwarded-host': 'other.test' } };
  assert.equal(requestUrl(req, { WEBSITE_HOSTNAME: 'rfx.azurewebsites.net' }).href, 'https://rfx.azurewebsites.net/api');
  assert.equal(requestUrl(req, {}).href, 'http://localhost:8080/api');
  assert.equal(requestUrl(req, { PUBLIC_ORIGIN: 'https://rfx.example.com' }).href, 'https://rfx.example.com/api');
});

test('Node runtime serves the worker and accepts same-origin Azure API requests', async t => {
  const server = createServer({ WEBSITE_HOSTNAME: 'rfx.azurewebsites.net' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  await page.arrayBuffer();
  const response = await fetch(base + '/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://rfx.azurewebsites.net' },
    body: JSON.stringify({ action: 'ping', config: { allowLive: false } }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Live AI is disabled/);
  const crossOrigin = await fetch(base + '/api', {
    method: 'POST',
    headers: { origin: 'https://other.test' },
    body: '{}',
  });
  assert.equal(crossOrigin.status, 403);
});
