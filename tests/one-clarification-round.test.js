import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {sevenReference} from '../scripts/seven-reference.mjs';import {quoteSummary,clarificationMessage,comparison,normalize,actionableBlockers,supplierOfferStatus,rfxSourceSignature} from '../src/domain.js';import {spreadsheetQuoteSupported,extractionResponseFormat} from '../src/server.js';import {sevenResolution,sevenRows,sevenTerms} from '../src/simulation.js';import vm from 'node:vm';
test('30 technical citation checks are not turned into 30 new supplier questions',()=>{const {rfx,data}=sevenReference({revised:true}),x=data.Rajan;x.quotes.forEach(q=>{q.state='review';q.validationIssue='excerpt_mismatch';});const s=quoteSummary(x,rfx);assert.equal(s.internalReviews.length,30);assert.equal(s.issues.length,0);assert.equal(clarificationMessage('Rajan',rfx,x),'');assert.equal(comparison(data,rfx).find(c=>c.vendor==='Rajan').total,null);});
test('saved old extraction warnings migrate to internal review without hiding missing offers',()=>{const {rfx,data}=sevenReference({revised:true}),x=data.Rajan;x.quotes=x.quotes.slice(0,29);x.quotes.forEach(q=>q.state='review');x.notes=x.quotes.map(q=>'Line '+q.lineId+': excerpt could not be matched literally; inspect original.');const s=quoteSummary(x,rfx);assert.equal(s.internalReviews.length,29);assert.equal(s.issues.length,1);assert.equal(s.issues[0].lineId,30);});
test('spreadsheet grounding verifies row, item, raw unit, currency and price rather than prose formatting',()=>{const {rfx}=sevenReference(),item=rfx.lines[0],file={kind:'text',text:'SHEET xl/worksheets/sheet1.xml\nA2=Stock code | B2=Pack / quoted unit | C2=Unit rate | D2=Currency | E2=Description\nA3=MT-1001 | B3=carton of 5 reams | C3=1400 | D3=INR | E3='+item.name+'\n'},q={lineId:item.id,price:1400,currency:'INR',unit:'carton of 5 reams',source:'Rajan.xlsx sheet1 C3'};assert(spreadsheetQuoteSupported(q,file,rfx));for(const changes of [{price:1401},{currency:'USD'},{unit:'ream'},{lineId:rfx.lines[1].id},{source:'Rajan.xlsx C8'}])assert(!spreadsheetQuoteSupported({...q,...changes},file,rfx));});
test('all clarification entry paths enforce a single round and offer outcome/review instead',()=>{const flow=fs.readFileSync(new URL('../src/flow.js',import.meta.url),'utf8');assert.match(flow,/if\(round>1\)throw Error/);assert.match(flow,/if\(state.packages\[v\]\?\.round>0\)return notify\('Clarification completed/g);assert.match(flow,/supplierOfferStatus\(state.data,state.rfx,v\)/);assert.match(flow,/Ready for comparison/);assert.match(flow,/outcome.reasons/);});
test('model uncertainty about otherwise readable prices remains an internal check, not a supplier questionnaire',()=>{const {rfx,data}=sevenReference({revised:true}),x=data.Rajan;x.quotes.forEach(q=>q.state='review');const s=quoteSummary(x,rfx);assert.equal(s.internalReviews.length,30);assert.equal(s.issues.length,0);});
test('explicit unquoted null-price records request the missing offers, not pack clarification',()=>{
 const {rfx,data}=sevenReference(),x=data['Jaipur Paper'];
 for(const line of rfx.lines.slice(-3))x.quotes.push({lineId:line.id,price:null,currency:'INR',unit:line.unit,state:'review',source:'quote.docx paragraph 5',excerpt:'Line '+line.id+' ('+line.name+'): NOT QUOTED.'});
 x.blockers=['Lines 28-30 are not quoted.'];
 const message=clarificationMessage('Jaipur Paper',rfx,x),flags=sevenResolution(message);
 assert.match(message,/Quote missing items/);assert.doesNotMatch(message,/pack quantity/);
 assert(flags.offers);assert.equal(sevenRows(rfx,2,1,flags).length,30);
 const unreadable={...x.quotes.at(-1),excerpt:'The quoted price is unreadable.'};
 assert.equal(normalize(unreadable,rfx.lines.at(-1),rfx).state,'review');
 assert.equal(normalize({...unreadable,excerpt:'NOT QUOTED.'},rfx.lines.at(-1),rfx).state,'missing');
});
test('prior clarification wording resolves omitted lines and an explicit available-quantity request',()=>{
 const {rfx}=sevenReference();
 assert(sevenResolution('Lines 28-30 are not quoted.').offers);
 const flags=sevenResolution('Confirm whether the full requested quantity is available. Confirm coverage and freight for Pune.');
 assert(flags.availability);assert.doesNotMatch(sevenTerms(rfx,5,flags).availability,/not confirmed/);
 assert.match(sevenTerms(rfx,4,flags).availability,/Pune is not served/);
});
test('missing buyer FX is visible as an evaluation decision, not a supplier price question',()=>{
 const {rfx,data}=sevenReference({revised:true});rfx.fx=null;rfx.fxDate='';
 for(const x of Object.values(data))x.meta.rfxSignature=rfxSourceSignature(rfx);
 const status=supplierOfferStatus(data,rfx,'Bharat');
 assert.equal(status.code,'evaluation');assert.match(status.reasons[0],/buyer-approved/);
 assert.equal(clarificationMessage('Bharat',rfx,data.Bharat),'');
 assert.equal(comparison(data,rfx).find(v=>v.vendor==='Bharat').total,null);
});
test('pure demonstration disclaimers do not disqualify a sourced bid, but genuine conflicts remain',()=>{
 const {rfx,data}=sevenReference({revised:true}),x=data.Pioneer;
 const disclaimer='The quotation is a synthetic demonstration document; treat extracted commercial terms and evidence as unverified source data.';
 x.blockers=[disclaimer];assert.deepEqual(actionableBlockers(x,rfx),[]);
 assert.equal(supplierOfferStatus(data,rfx,'Pioneer').ready,true);
 for(const conflict of ['The synthetic demonstration document requires advance payment; treat extracted terms as unverified source data.','The synthetic demonstration document has expired; treat extracted terms as unverified source data.','The synthetic demonstration document lists freight as not confirmed; treat extracted terms as unverified source data.','The quotation is a synthetic demonstration document; cannot meet the mandatory delivery commitment; treat extracted commercial terms and evidence as unverified source data.']){
  x.blockers=[conflict];assert.deepEqual(actionableBlockers(x,rfx),[conflict]);assert.equal(supplierOfferStatus(data,rfx,'Pioneer').ready,false);
 }
});
test('discount schema constrains fraction units while invalid saved rates remain ineligible',()=>{
 const rate=extractionResponseFormat.schema.properties.discount.anyOf[1].properties.rate;
 assert.equal(rate.maximum,1);assert.match(rate.description,/5% is 0\.05/);
 const {rfx,data}=sevenReference({revised:true});data.Bharat.discount.rate=5;
 assert.equal(comparison(data,rfx).find(v=>v.vendor==='Bharat').total,null);
});
test('repairing an old simulated reply reuses its first clarification without touching uploaded sources',()=>{
 const {rfx}=sevenReference(),message='Dear Jaipur Paper,\nPlease confirm these points for your quotation:\n1. Lines 28-30 are not quoted.';
 const state={rfx,packages:{'Jaipur Paper':{round:1,generatorVersion:3,signature:rfxSourceSignature(rfx),files:['offer'],resolved:sevenResolution('')}},threads:{'Jaipur Paper':[{role:'buyer',text:message}]}};
 const assets={offer:{generated:true}},context=vm.createContext({state,assets,sevenResolution,rfxSourceSignature});
 const flow=fs.readFileSync(new URL('../src/flow.js',import.meta.url),'utf8');
 vm.runInContext(flow.slice(flow.indexOf('function revisedSimulationRepair('),flow.indexOf('\nfunction supplierClarificationComposer(')),context);
 assert.equal(vm.runInContext("revisedSimulationRepair('Jaipur Paper').clarification",context),message);
 assert.equal(state.packages['Jaipur Paper'].resolved.offers,false);
 assets.offer.custom=true;assert.equal(vm.runInContext("revisedSimulationRepair('Jaipur Paper')",context),null);
 assets.offer.custom=false;state.packages['Jaipur Paper'].resolved=sevenResolution(message);assert.equal(vm.runInContext("revisedSimulationRepair('Jaipur Paper')",context),null);
 state.packages['Jaipur Paper'].round=2;assert.equal(vm.runInContext("revisedSimulationRepair('Jaipur Paper')",context),null);
});
