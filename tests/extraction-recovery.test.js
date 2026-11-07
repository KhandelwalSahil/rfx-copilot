import test from 'node:test';import assert from 'node:assert/strict';import {withOperationTimeout,extractionCandidates,rfxSourceSignature,extractAvailable,validateExtraction} from '../src/domain.js';import {sevenReference} from '../scripts/seven-reference.mjs';import fs from 'node:fs';import vm from 'node:vm';
test('bulk extraction retries technical reviews and skips current complete quotes',()=>{const {rfx,data}=sevenReference({revised:true});const packages=Object.fromEntries(['Rajan','Pioneer'].map(v=>[v,{files:['offer'],signature:rfxSourceSignature(rfx)}]));data.Rajan.quotes.forEach(q=>{q.state='review';q.validationIssue='excerpt_mismatch';});assert.deepEqual(extractionCandidates(['Rajan','Pioneer'],packages,data,rfx),['Rajan']);});
test('stalled file preparation rejects visibly and completed preparation clears its deadline',async()=>{await assert.rejects(withOperationTimeout(()=>new Promise(()=>{}),5,'File preparation timed out'),/File preparation timed out/);assert.equal(await withOperationTimeout(async()=>42,100,'timeout'),42);});
test('bulk extraction overlaps two suppliers, retains successes, and reports failures in supplier order',async()=>{
 const pending=new Map(),started=[],progress=[];
 const run=extractAvailable(['Metro','Bharat','Rajan'],v=>{started.push(v);return new Promise((resolve,reject)=>pending.set(v,{resolve,reject}));},p=>progress.push(p));
 assert.deepEqual(started,['Metro','Bharat']);
 pending.get('Bharat').reject(Error('Unreadable source'));await Promise.resolve();await Promise.resolve();
 assert.deepEqual(started,['Metro','Bharat','Rajan']);
 pending.get('Rajan').resolve();pending.get('Metro').resolve();
 const result=await run;
 assert.deepEqual(result.completed,['Metro','Rajan']);assert.deepEqual(result.failed,[{vendor:'Bharat',message:'Unreadable source'}]);
 assert(progress.every(p=>p.active.length<=2));assert.equal(progress.at(-1).active.length,0);
});
function extractionContext(){
 const {rfx,data}=sevenReference({revised:true}),pending=new Map();
 const context=vm.createContext({
  state:{rfx,data:{},version:1},workingFiles:{Metro:['metro'],Bharat:['bharat']},assets:{metro:{},bharat:{}},
  structuredClone,rfxSourceSignature,validateExtraction,
  withOperationTimeout:operation=>operation(),original:name=>({name}),prepare:async f=>({name:f.name,sha256:'hash',kind:'text',text:'source'}),
  api:body=>new Promise(resolve=>pending.set(body.vendor,()=>resolve({result:data[body.vendor],model:'test',responseId:'test-'+body.vendor,at:'2026-11-07',files:body.files}))),
  invalidate(){context.state.version++;},render(){},
 });
 const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('async function extract('),source.indexOf('\nasync function ask(')),context);
 return {context,pending};
}
test('independent supplier completions do not discard each other as stale global versions',async()=>{
 const {context,pending}=extractionContext();
 const metro=vm.runInContext("extract('Metro')",context),bharat=vm.runInContext("extract('Bharat')",context);
 await new Promise(resolve=>setImmediate(resolve));pending.get('Bharat')();await bharat;pending.get('Metro')();await metro;
 assert(context.state.data.Metro);assert(context.state.data.Bharat);assert.equal(context.state.version,3);
});
test('extraction still rejects changed requirements, replaced files, and edits to the same supplier',async()=>{
 for(const change of [
  ctx=>{ctx.state.rfx.terms+=' Changed payment.';},
  ctx=>{ctx.workingFiles.Metro=['replacement'];},
  ctx=>{ctx.state.data.Metro={quotes:[],notes:['Buyer correction']};},
 ]){
  const {context,pending}=extractionContext(),read=vm.runInContext("extract('Metro')",context);
  await new Promise(resolve=>setImmediate(resolve));change(context);pending.get('Metro')();
  await assert.rejects(read,/stale result was discarded/);
  assert.notEqual(context.state.data.Metro?.meta?.responseId,'test-Metro');
 }
});
