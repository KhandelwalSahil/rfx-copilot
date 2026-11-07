import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {sevenSupplierScenario,sevenSupplierTerms,scenarioSupplierStatus,sevenScenarioGuide} from '../src/scenario.js';
import {sevenRows,sevenTerms,sevenResolution,simulationRows,simulationText,simulationEvidence,supplierCatalogEntry} from '../src/simulation.js';
import {participatingVendors,vendorShortlist,rfxReadiness,buyerClarifications,comparison,commercialRequirements,quoteRedFlags,quoteSummary,priceObservation,normalize,analyzeAward,awardReadiness,freezeDecision} from '../src/domain.js';
import {sevenReference} from '../scripts/seven-reference.mjs';
const base=JSON.parse(fs.readFileSync(new URL('../dataset/rfx.json',import.meta.url)));
test('seven-supplier example is opt-in and preserves the original five-supplier benchmark',()=>{const r=sevenSupplierScenario(base);assert.equal(participatingVendors(base).length,5);assert.equal(vendorShortlist(base).length,5);assert.equal(participatingVendors(r).length,7);assert.equal(vendorShortlist(r).length,7);assert.equal(r.lines.length,30);assert.equal(r.questions.length,13);assert.deepEqual(r.requiredLocations,['Delhi','Bengaluru','Pune']);assert.deepEqual(base.lines.map(l=>l.quantity),r.lines.map(l=>l.quantity));});
test('guided requirements ask two real buyer decisions, not FX or fabricated missing quantities',()=>{const r=sevenSupplierScenario(base);assert.equal(buyerClarifications(r).length,2);assert.equal(rfxReadiness(r).ready,false);r.terms=sevenSupplierTerms();r.buyerClarifications=[];assert(rfxReadiness(r).ready);assert.equal(r.fx,null);assert.equal(r.fxDate,'');});
test('initial source facts create the intended meaningful exceptions without prefilled extraction',()=>{const {rfx,data}=sevenReference(),c=comparison(data,rfx);assert(c.find(v=>v.vendor==='Metro').total>100000000);assert.equal(c.find(v=>v.vendor==='Bharat').total,null);assert.equal(c.find(v=>v.vendor==='Jaipur Paper').coverage,27);assert.equal(c.find(v=>v.vendor==='Jaipur Paper').gate.status,'fail');assert.equal(c.find(v=>v.vendor==='Rajan').coverage,29);assert.equal(c.find(v=>v.vendor==='Pioneer').gate.status,'unknown');assert.equal(c.find(v=>v.vendor==='Pioneer').freight,null);assert.equal(c.find(v=>v.vendor==='NorthStar').coverage,0);assert.equal(data.NorthStar,undefined);assert.equal(scenarioSupplierStatus(rfx,'NorthStar'),'awaiting');});
test('non-delivery and advance-payment conflicts remain blockers even if extractor reports no blockers',()=>{const {rfx,data}=sevenReference(),x=data.QuickDesk;x.blockers=[];const checks=commercialRequirements(x,rfx);assert(checks.some(c=>c.field==='coverage'&&c.status==='fail'&&c.required.includes('Pune')));assert(checks.some(c=>c.field==='payment'&&c.status==='fail'));assert(quoteRedFlags(x,rfx).some(f=>f.field==='coverage'&&/Pune/.test(f.title)));assert.equal(comparison(data,rfx).find(c=>c.vendor==='QuickDesk').total,null);});
test('pending Pune coverage is unknown, not a pass or invented categorical failure',()=>{const {rfx,data}=sevenReference();const c=commercialRequirements(data.Pioneer,rfx).find(c=>c.field==='coverage'&&c.required.includes('Pune'));assert.equal(c.status,'unknown');assert(quoteSummary(data.Pioneer,rfx).issues.some(i=>/Pune/.test(i.detail)));});
test('clarification updates only requested topics and does not make QuickDesk accept incompatible terms',()=>{const r=sevenSupplierScenario(base,{guided:false}),f=sevenResolution('Please confirm freight.');assert(f.freight);assert.equal(f.coverage,false);assert.equal(f.evidence,false);assert.equal(f.offers,false);assert.equal(sevenTerms(r,5,f).freight,295000);assert.match(sevenTerms(r,5,f).delivery,/Pune coverage is not confirmed/);const all=sevenResolution('missing lines, freight, model, delivery commitment, evidence, pack size, all hubs, availability');assert.match(sevenTerms(r,4,all).payment,/100% advance/);assert.match(sevenTerms(r,4,all).delivery,/Pune is not served/);});
test('Rajan initial pack ambiguity is not silently normalized; typed clarification restores exact conversion',()=>{const r=sevenSupplierScenario(base,{guided:false}),l=r.lines[4],first=sevenRows(r,3).find(x=>x.id===5);assert.equal(normalize({...first,state:'read',source:'test'},l,r).price,null);const next=sevenRows(r,3,1,sevenResolution('Confirm pack count and offered model')).find(x=>x.id===5);assert.equal(next.unit,'100 pieces');assert.equal(normalize({...next,state:'read',source:'test'},l,r).price,7.04);});
test('USD source quotes exist before buyer FX setup and use supported dated conversion only when supplied',()=>{const r=sevenSupplierScenario(base,{guided:false}),row=sevenRows(r,1).find(l=>l.id===30),l=r.lines[29];assert.equal(row.currency,'USD');assert(Number.isFinite(row.price));assert.equal(normalize({...row,state:'read',source:'test'},l,r).price,null);r.fx=95;r.fxDate='2026-11-06';assert(Number.isFinite(normalize({...row,state:'read',source:'test'},l,r).price));for(const row of simulationRows({...base,fx:null},1))assert(Number.isFinite(row.price));});
test('final reference has exactly four complete comparable suppliers and a supported two-supplier award after freight',()=>{const {rfx,data}=sevenReference({revised:true}),c=comparison(data,rfx);assert.deepEqual(c.filter(v=>v.total!==null).map(v=>v.vendor),['Bharat','Jaipur Paper','Rajan','Pioneer']);const a=analyzeAward(data,rfx);assert.equal(a.split.complete,true);assert.equal(a.split.allocations.length,30);assert.equal(a.split.byVendor.length,2);assert.equal(a.bestSingle.vendor,'Bharat');assert.equal(a.bestSingle.total,38461600.93);assert.equal(a.split.total,37782937.5);assert.equal(a.savingsVsBestSingle,678663.43);assert.equal(a.split.byVendor.find(v=>v.vendor==='Bharat').discount,1483500);assert.equal(a.split.byVendor.reduce((s,v)=>s+v.freight,0),450000);});
test('high pricing is an observation, not an automatic exclusion or eligibility failure',()=>{const {rfx,data}=sevenReference();const o=priceObservation('Metro',data,rfx);assert(o.multiple>2);assert.equal(comparison(data,rfx).find(v=>v.vendor==='Metro').eligible,true);assert.equal(rfx.evaluationExclusions,undefined);});
test('pending supplier acknowledgement remains required but does not prevent analysis or recommendation',()=>{const {rfx,data}=sevenReference({revised:true}),s={rfx,data,version:1,sent:true,draft:null,audit:[],decisionHistory:[]};assert(awardReadiness(s).ready);assert.throws(()=>freezeDecision(s,{reason:'Use sourced complete offers',evidenceReviewed:true,assumptionsAccepted:true}),/Acknowledge/);const d=freezeDecision(s,{reason:'Use sourced complete offers',evidenceReviewed:true,assumptionsAccepted:true,pendingAccepted:true});assert.deepEqual(d.pendingSuppliers,['NorthStar']);});
test('source revisions supply only requested missing lines and evidence, with no stale values on final offers',()=>{const r=sevenSupplierScenario(base,{guided:false});assert.equal(sevenRows(r,2).length,27);const f=sevenResolution('Please quote missing lines and provide certificate evidence.');assert.equal(sevenRows(r,2,1,f).length,30);assert.match(simulationEvidence(r,'Jaipur Paper',2,1,f),/2028-03-31/);assert.doesNotMatch(simulationEvidence(r,'Jaipur Paper',2,1,f),/2020-01-01/);assert.match(simulationText(r,'QuickDesk',4),/100% advance/);assert.equal(simulationText(r,'NorthStar',6),'');assert(!/NaN|Infinity/.test(simulationText(r,'Bharat',1)));});

test('Jaipur declaration cannot override its contradictory expired evidence',()=>{const r=sevenSupplierScenario(base,{guided:false});assert.match(simulationText(r,'Jaipur Paper',2),/certificate meets the contract qualification/);assert.match(simulationEvidence(r,'Jaipur Paper',2),/2020-01-01/);});
test('supplier sources preserve offer validity and constrained genuine HP toner models',()=>{
 const r=sevenSupplierScenario(base,{guided:false});r.terms='Offers must remain valid until 31 December 2026.';
 for(const [index,vendor] of ['Metro','Bharat','Jaipur Paper','Rajan','QuickDesk','Pioneer'].entries()){
  const text=simulationText(r,vendor,index,1,sevenResolution('Quote the missing lines.'));assert.match(text,/Quotation valid through 31 December 2026/);
  for(const model of ['12A','88A','05A'])assert.match(text,new RegExp('offered brand HP, model '+model));
 }
});
test('supplier paper catalog matches confirmed grades whether in name or specification',()=>{
 for(const [grade,id] of [[75,1],[70,2],[80,3]])assert.equal(supplierCatalogEntry({name:'A4 paper',spec:grade+' GSM, white, 500 sheets per ream',unit:'reams'}).id,id);
 assert.equal(supplierCatalogEntry({name:'A3 paper',spec:'75 GSM, white, 500 sheets per ream',unit:'reams'}).id,4);
 assert.equal(supplierCatalogEntry({name:'A4 paper',spec:'A new unpriced grade',unit:'reams'}),null);
});
test('generic commercial replies preserve replacement trigger and QuickDesk refused freight scope',()=>{
 const r=sevenSupplierScenario(base,{guided:false});r.questions=[{id:'terms',text:'Confirm acceptance of our commercial terms and all exceptions.',gate:false}];
 assert.match(simulationText(r,'Metro',0),/within 7 calendar days of notification at no additional cost/);
 const quick=simulationText(r,'QuickDesk',4);
 assert.match(quick,/Fixed freight \d+ INR for all awarded items at Delhi and Bengaluru only; Pune is not served/);
 assert.match(quick,/100% advance/);
});

test('the exact copyable walkthrough messages produce the required source revisions',()=>{const r=sevenSupplierScenario(base,{guided:false});const flags=Object.fromEntries(sevenScenarioGuide.clarifications.map(([v,m])=>[v,sevenResolution(m)]));assert(flags.Bharat.delivery);assert.match(sevenTerms(r,1,flags.Bharat).delivery,/12 calendar days/);assert(flags['Jaipur Paper'].offers&&flags['Jaipur Paper'].evidence);assert(flags.Rajan.units&&flags.Rajan.specs);assert(flags.Pioneer.coverage&&flags.Pioneer.availability&&flags.Pioneer.freight&&flags.Pioneer.evidence);});
test('payment clarification changes actual normal supplier sources to the full buyer condition, not QuickDesk or unrelated topics',()=>{
 const r=sevenSupplierScenario(base,{guided:false});
 r.terms='Payment is due within 30 calendar days of receiving a valid invoice and accepting the delivered goods, whichever occurs later; No advance payment is acceptable.';
 const f=sevenResolution('Confirm acceptance of our payment terms ('+r.terms+'). State any exception explicitly.');
 assert(f.payment);
 for(const [i,v] of ['Metro','Bharat','Jaipur Paper','Rajan','QuickDesk','Pioneer'].entries()){
  const prior=sevenTerms(r,i,sevenResolution('Confirm freight.')).payment;
  const revised=sevenTerms(r,i,f).payment;
  const payment=commercialRequirements({answers:[],commercialTerms:{payment:{value:revised,source:'supplier-offer'}}},r).find(c=>c.field==='payment');
  if(i===4){assert.equal(prior,revised);assert.equal(payment.status,'fail');}
  else{
   assert.match(prior,/from invoice receipt/);
   assert.match(revised,/receiving a valid invoice and accepting the delivered goods, whichever occurs later/);
   assert.equal(payment.status,'pass',v);
   assert(simulationText(r,v,i,1,f).includes(revised));
  }
 }
 assert.equal(sevenResolution('Confirm freight.').payment,false);
});
