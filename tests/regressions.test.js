import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {normalize,quality,validateExtraction,validateRfx,reviewQueue,correctQuote,recoverState,draftDiff,rfxReadiness,analyzeAward,runTool,invalidateState,freezeDecision,awardReadiness,gateRule,prepareDraftGates,normalizeDraftText,retainBuyerAllocation} from '../src/domain.js';
const rfx=JSON.parse(fs.readFileSync(new URL('../dataset/rfx.json',import.meta.url)));
function vendor(p=10){return {blockers:[],quotes:rfx.lines.map(l=>({lineId:l.id,price:p,currency:'INR',unit:l.unit,state:'read',source:'test.pdf page 1',excerpt:'Literal test quote'})),answers:[],evidence:rfx.questions.filter(q=>q.gate).map(q=>({questionId:q.id,result:'pass',validUntil:'2028-12-31',source:'test.pdf page 1',excerpt:'Literal evidence'})),freight:{amount:0,state:'known',source:'test.pdf included'},meta:{model:'test-only model',responseId:'test-only response',rfxSignature:JSON.stringify(rfx),files:[{name:'test.pdf',sha256:'a'.repeat(64)}]}};}
const state=()=>({schemaVersion:2,rfx:structuredClone(rfx),data:Object.fromEntries(['Metro','Bharat','Jaipur Paper','Rajan','QuickDesk'].map(v=>[v,vendor()])),audit:[],version:1,approved:false,decision:null,decisionHistory:[],chat:[],draftChat:[]});
test('15-ream carton uses all digits of pack size',()=>assert.equal(normalize({price:1500,currency:'INR',unit:'carton (15 reams)',state:'read'},rfx.lines[0],rfx).price,100));
test('100 kg basis is not one kg',()=>assert.equal(normalize({price:144,currency:'INR',unit:'100 kg',state:'read'},rfx.lines[21],rfx).price,.72));
test('1100 pieces basis is not 100 pieces',()=>assert.equal(normalize({price:1100,currency:'INR',unit:'1100 pieces',state:'read'},rfx.lines[4],rfx).price,1));
test('fractional sub-paise unit prices retain extension precision',()=>{let x=vendor();x.quotes[25].price=.0036;const a=analyzeAward({Metro:x},rfx);assert.equal(a.split.allocations.find(c=>c.lineId===26).cost,1080);});
test('unclear pack wording is excluded rather than loosely matched',()=>assert.equal(normalize({price:100,currency:'INR',unit:'carton maybe 5 or 15 reams',state:'read'},rfx.lines[0],rfx).price,null));
test('unreadable price stays in review queue with source',()=>{let x=vendor();x.quotes[0].price=null;let q=reviewQueue({Metro:x},rfx);assert.equal(q.length,1);assert.equal(q[0].kind,'price');assert.match(q[0].why,/unreadable/i);});
test('a missing offer is a gap, not an unreadable price',()=>{let x=vendor();x.quotes=x.quotes.slice(1);assert.equal(reviewQueue({Metro:x},rfx)[0].kind,'gap');});
test('blank freight correction is rejected without changing unknown value',()=>{let data={Metro:vendor()};data.Metro.freight={amount:null,state:'unknown'};assert.throws(()=>correctQuote(data,rfx,{vendor:'Metro',lineId:0,price:'',source:'test.pdf page 1',reason:'Evidence reviewed'}),/blank/);assert.equal(data.Metro.freight.state,'unknown');});
test('explicit zero freight is allowed only with source and reason',()=>{let data={Metro:vendor()};data.Metro.freight={amount:null,state:'unknown'};correctQuote(data,rfx,{vendor:'Metro',lineId:0,price:'0',source:'test.pdf page 1',reason:'Freight explicitly included'});assert.equal(data.Metro.freight.amount,0);assert.equal(data.Metro.freight.state,'known');});
test('sourced unit correction resolves unknown basis and preserves audit old value',()=>{let data={Metro:vendor()};data.Metro.quotes[0].unit='carton unspecified';const event=correctQuote(data,rfx,{vendor:'Metro',lineId:1,price:'1500',unit:'carton (15 reams)',currency:'INR',source:'test.pdf page 2',excerpt:'1500/carton of 15 reams',reason:'Revised pack definition'});assert.equal(event.old.unit,'carton unspecified');assert.equal(normalize(data.Metro.quotes[0],rfx.lines[0],rfx).price,100);});
test('new missing-line quote requires valid evidence and unit',()=>{let data={Metro:vendor()};data.Metro.quotes=data.Metro.quotes.slice(1);correctQuote(data,rfx,{vendor:'Metro',lineId:1,price:250,unit:'ream',currency:'INR',source:'new.pdf page 1',reason:'Supplier added omitted line'});assert.equal(data.Metro.quotes.length,30);});
test('changed expiry rule changes quality outcome',()=>{const r=structuredClone(rfx);r.questions[0].text='Quality certificate valid through 31 Mar 2030';r.questions[0].rule.date='2030-03-31';assert.equal(quality(vendor(),r).status,'fail');});
test('wording and structured gate conflict cannot pass',()=>{const r=structuredClone(rfx);r.questions[0].text='Valid through 31 Mar 2030';assert.equal(quality(vendor(),r).status,'unknown');assert.throws(()=>validateRfx(r),/Invalid gate/);});
test('contract scope dates do not turn sample and paper evidence into expiry gates',()=>{
 const r=structuredClone(rfx);r.questions=[
  {id:'paper',text:'Product test evidence for all four paper grades for 1 April 2027 to 31 March 2028.',gate:true,rule:{type:'evidence_pass'}},
  {id:'sample',text:'Recorded approved samples covering every offered specification for 2027-04-01 to 2028-03-31.',gate:true,rule:{type:'evidence_pass'}},
  {id:'certificate',text:'For the contract beginning 1 April 2027, supply a certificate valid through 31 March 2028.',gate:true,rule:{type:'date_on_or_after',date:'2028-03-31'}}
 ];
 assert.doesNotThrow(()=>validateRfx(r));assert.equal(gateRule(r.questions[2]).date,'2028-03-31');
 r.questions[2].text='Certificate valid through 31 March 2028 for the contract starting 2027-04-01.';
 assert.equal(gateRule(r.questions[2]).date,'2028-03-31');
});
test('common explicit expiry wordings still reject a conflicting structured deadline',()=>{
 for(const text of ['Certificate expires on 31 March 2030.','Certificate expiry date: 31 March 2030.','Certificate valid to 31 March 2030.','Certificate valid till 31 March 2030.']){
  assert.equal(gateRule({text,gate:true,rule:{type:'date_on_or_after',date:'2028-03-31'}}).type,'invalid');
 }
});
test('draft gate repairs only represent explicit validity deadlines and retain real conflicts',()=>{
 const r=structuredClone(rfx);r.questions=[
  {id:'cert',text:'Certificate valid through 31 March 2028.',gate:true,rule:{type:'evidence_pass'}},
  {id:'test',text:'Paper evidence covering the 2027-04-01 to 2028-03-31 contract.',gate:true,rule:null}
 ];
 const before=structuredClone(r),result=prepareDraftGates(r);
 assert.deepEqual(r,before);assert.deepEqual(result.draft.questions[0].rule,{type:'date_on_or_after',date:'2028-03-31'});
 assert.deepEqual(result.draft.questions[1].rule,{type:'evidence_pass'});assert.equal(result.repairs.length,2);
 r.questions[0].rule={type:'date_on_or_after',date:'2030-03-31'};
 assert.throws(()=>validateRfx(prepareDraftGates(r).draft),/conflict/);
});
test('known attributes inside item names populate empty spec without inventing missing details',()=>{
 const draft={...structuredClone(rfx),lines:['Blue refillable whiteboard markers','A4 two-ring binders','A4 polypropylene document folders','Eight-inch stainless-steel scissors','A4 paper','Blue pens'].map((name,i)=>({id:i+1,name,spec:'',quantity:10,unit:'piece'}))};
 const result=normalizeDraftText(draft);
 assert.deepEqual(result.draft.lines.map(l=>l.spec),['Blue, refillable','A4, two-ring','A4, polypropylene','Eight-inch, stainless-steel','','']);
 assert(draft.lines.every(l=>l.spec===''));assert.equal(result.repairs.length,4);
});
test('explicit buyer location allocation and rounding survive model omission or wrong percentages',()=>{
 const policy='For each item, allocate approximately 40% to Delhi, 35% to Bengaluru and 25% to Pune. Round Delhi and Bengaluru allocations down and assign the remainder to Pune.';
 const draft=structuredClone(rfx);draft.scope='Office supplies.';draft.terms='Payment within 30 days. Allocate 50% to Delhi and 50% to Pune. Round Delhi down and assign the remainder to Pune. Fixed freight once.';
 const repaired=retainBuyerAllocation(draft,policy);
 assert(repaired.terms.includes(policy.replace('. Round','.\nRound')));assert.doesNotMatch(repaired.terms,/50%/);
 assert.match(repaired.terms,/Payment within 30 days/);assert.match(repaired.terms,/Fixed freight once/);assert.match(draft.terms,/50%/);
 const changed=retainBuyerAllocation(repaired,'Allocate 50% to Delhi and 50% to Bengaluru.');
 assert.doesNotMatch(changed.terms,/40%|35%|25%|remainder to Pune/);assert.match(changed.terms,/50%/);
 assert.equal(retainBuyerAllocation(draft,'Please recommend an allocation policy?'),draft);
});
test('invalid calendar date cannot clear a certificate gate',()=>{const x=vendor();x.evidence[0].validUntil='2028-02-30';assert.equal(quality(x,rfx).status,'unknown');});
test('numeric gates use observed evidence, not a Yes flag',()=>{const r=structuredClone(rfx);r.questions.push({id:'Q13',text:'Capacity at least 20000 reams',gate:true,rule:{type:'number_at_least',minimum:20000}});const x=vendor();x.evidence.push({questionId:'Q13',result:'pass',value:18000,source:'test.pdf page 1',excerpt:'Capacity 18000'});assert.equal(quality(x,r).status,'fail');});
test('blank RFx can be drafted but not sent',()=>{const r={title:'',scope:'',deadline:'',currency:'INR',fx:null,fxDate:'',terms:'',lines:[],questions:[]};assert.doesNotThrow(()=>validateRfx(r,{partial:true}));assert.equal(rfxReadiness(r).ready,false);assert.throws(()=>validateRfx(r),/1–100 line/);});
test('incomplete positive-quantity requirement is enforced at readiness',()=>{const r=structuredClone(rfx);r.lines[0].quantity=null;assert.doesNotThrow(()=>validateRfx(r,{partial:true}));assert.equal(rfxReadiness(r).ready,false);});
test('draft diff catches omitted-summary changes to quantities, terms and rules',()=>{const r=structuredClone(rfx);r.lines[0].quantity=72600;r.terms+=' Changed delivery basis.';r.questions[0].rule.date='2030-03-31';const d=draftDiff(rfx,r);assert(d.some(x=>x.path==='Line 1 · quantity'));assert(d.some(x=>x.path==='terms'));assert(d.some(x=>x.path==='Question Q1'));});
test('reload archives frozen record and increments snapshot if custom source vanishes',()=>{const s=state();s.data.Metro.meta.custom=true;s.approved=true;s.decision={version:1,reason:'prior record'};const r=recoverState(s);assert.equal(r.data.Metro,undefined);assert.equal(r.approved,false);assert.equal(r.version,2);assert.equal(r.decision,null);assert.equal(r.decisionHistory.length,1);});
test('ordinary reload retains genuine default source cache and snapshot',()=>{const s=state(),r=recoverState(s);assert.equal(r.version,1);assert.equal(Object.keys(r.data).length,5);});
test('legacy calculation data cannot silently remain approved',()=>{const s=state();delete s.schemaVersion;s.approved=true;const r=recoverState(s);assert.equal(r.approved,false);assert.equal(Object.keys(r.data).length,0);assert.equal(r.version,2);});
test('deterministic tool computes savings and percentage',()=>{const data={Metro:vendor(10),Bharat:vendor(11)};data.Bharat.quotes[0].price=9;const a=runTool('analyze_award',{},data,rfx);assert.equal(a.savingsVsBestSingle,a.bestSingle.total-a.split.total);assert(a.savingsVsBestSingle>0);assert.equal(a.savingsPercent,Math.round(a.savingsVsBestSingle/a.bestSingle.total*1e6)/1e4);});
test('exclusion follow-up changes allocation without changing underlying offers',()=>{const data={Metro:vendor(10),Bharat:vendor(11)};const a=analyzeAward(data,rfx,{excludedVendors:['Metro']});assert(a.split.complete);assert.equal(a.split.allocations.length,30);assert(a.split.allocations.every(c=>c.vendor==='Bharat'));assert.equal(data.Metro.quotes.length,30);});
test('FX sensitivity returns computed current-data deltas',()=>{const data={Metro:vendor(100)};data.Metro.quotes[27]={...data.Metro.quotes[27],price:10,currency:'USD'};const x=runTool('fx_sensitivity',{rates:[84,90]},data,rfx);assert.equal(x.deltas[1].splitDelta,60*rfx.lines[27].quantity);});
test('empty line scope cannot produce a zero-cost apparent bid',()=>assert.throws(()=>analyzeAward({Metro:vendor()},rfx,{lineIds:[]}),/nonempty/));
test('exploratory quality opt-out is always labelled hypothetical and not eligibility',()=>{let x=vendor();x.evidence[0].validUntil='2026-09-30';const a=analyzeAward({Metro:x},rfx,{qualityOnly:false});assert.equal(a.hypothetical,true);assert(a.split.complete);assert.equal(quality(x,rfx).status,'fail');});
test('freeze requires provenance, checks and immutable copy of allocation',()=>{const s=state();assert(awardReadiness(s).ready);assert.throws(()=>freezeDecision(s,{reason:'',evidenceReviewed:true,assumptionsAccepted:true}),/rationale/);const d=freezeDecision(s,{reason:'Reviewed equivalent goods and evidence',evidenceReviewed:true,assumptionsAccepted:true});s.data.Metro.quotes[0].price=999;assert.equal(d.data.Metro.quotes[0].price,10);assert.equal(d.version,1);});
test('any evidence mutation reopens decision and archives old snapshot',()=>{const s=state();s.decision=freezeDecision(s,{reason:'Reviewed',evidenceReviewed:true,assumptionsAccepted:true});s.approved=true;invalidateState(s,'test correction',{lineId:1});assert.equal(s.approved,false);assert.equal(s.decision,null);assert.equal(s.decisionHistory[0].version,1);assert.equal(s.version,2);});
test('invalid source-less known freight fails extraction validation',()=>{let x=vendor();x.freight.source='';assert.throws(()=>validateExtraction(x,rfx),/Known freight/);});

test('stale extraction signature prevents a frozen award',()=>{const s=state();s.rfx.lines[0].quantity+=1;assert.equal(awardReadiness(s).ready,false);assert.throws(()=>freezeDecision(s,{reason:'Reviewed',evidenceReviewed:true,assumptionsAccepted:true}),/complete/);});
test('missing source hashes prevent a frozen award',()=>{const s=state();s.data.Metro.meta.files[0].sha256=null;assert.equal(awardReadiness(s).ready,false);});
test('solver matches exhaustive independent oracle for freight and conditional discounts',()=>{
 const ids=[1,2,3,4],names=['Metro','Bharat','Rajan'],data=Object.fromEntries(names.map((v,i)=>[v,vendor(10+i)]));
 data.Metro.freight.amount=1000;data.Bharat.freight.amount=2000;data.Rajan.freight.amount=0;
 data.Metro.discount={rate:.1,thresholdReams:80000,lineIds:ids,source:'test discount'};
 data.Bharat.quotes[0].price=9.5;data.Rajan.quotes[2].price=9.6;data.Rajan.quotes[3].price=9.4;
 let best=Infinity;
 function walk(selected){if(selected.length<4){for(const v of names)walk([...selected,v]);return;}let total=0;for(const v of names){const own=ids.filter((_,i)=>selected[i]===v);if(!own.length)continue;let cost=own.reduce((s,id)=>s+data[v].quotes.find(q=>q.lineId===id).price*rfx.lines.find(l=>l.id===id).quantity,0);if(v==='Metro'&&own.reduce((s,id)=>s+rfx.lines.find(l=>l.id===id).quantity,0)>=80000)cost-=Math.round(cost*.1*100)/100;total+=cost+data[v].freight.amount;}best=Math.min(best,total);}
 walk([]);const a=analyzeAward(data,rfx,{lineIds:ids});assert(a.split.complete);assert.equal(a.split.total,Math.round(best*100)/100);
});

test('sub-precision prices cannot silently become free offers',()=>assert.equal(normalize({price:0.00000001,currency:'INR',unit:'piece',state:'read'},rfx.lines[4],rfx).price,null));
test('buyer can use an informational questionnaire without invented mandatory gates',()=>{const r=structuredClone(rfx);r.questions=[{id:'Q1',text:'Delivery lead time?',gate:false}];assert.doesNotThrow(()=>validateRfx(r));assert.equal(rfxReadiness(r).ready,true);assert.doesNotThrow(()=>validateRfx({...r,questions:[]}));});
test('outstanding buyer decisions block sending even with nonempty specification text',()=>{const r=structuredClone(rfx);r.buyerClarifications=['What pen tip size is required?'];assert.equal(rfxReadiness(r).ready,false);assert.throws(()=>validateRfx(r),/Resolve buyer specifications/);r.buyerClarifications=[];assert.equal(rfxReadiness(r).ready,true);assert.doesNotThrow(()=>validateRfx(r));});
test('an otherwise award-ready workspace cannot freeze while RFx changes await review',()=>{const s=state();assert.equal(awardReadiness(s).ready,true);s.draft={draft:structuredClone(s.rfx)};assert.equal(awardReadiness(s).ready,false);assert.throws(()=>freezeDecision(s,{reason:'Review evidence',evidenceReviewed:true,assumptionsAccepted:true}),/complete, sourced/);});
test('award completeness follows invited recipients rather than the full five-vendor directory',()=>{const s=state();s.rfx.invitedVendors=['Metro','Rajan'];s.data=Object.fromEntries(Object.entries(s.data).filter(([v])=>s.rfx.invitedVendors.includes(v)));for(const x of Object.values(s.data))x.meta.rfxSignature=JSON.stringify(s.rfx);assert.equal(awardReadiness(s).ready,true);const d=freezeDecision(s,{reason:'Selected vendors confirmed coverage',evidenceReviewed:true,assumptionsAccepted:true});assert.deepEqual(d.rfx.invitedVendors,['Metro','Rajan']);assert(d.analysis.split.allocations.every(a=>s.rfx.invitedVendors.includes(a.vendor)));});
