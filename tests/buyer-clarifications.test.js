import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {buyerClarifications,clarificationReply,reconcileBuyerClarifications,retainBuyerCommercialAnswers,commercialTrigger} from '../src/domain.js';
const rfx=JSON.parse(fs.readFileSync(new URL('../dataset/rfx.json',import.meta.url)));
test('approved buyer answers keep question context without treating suggested numbers in questions as facts',()=>{
 const questions=['What payment terms do you require?','What delivery lead time do you require?'];
 const answers={[questions[0]]:'30 calendar days after receipt of a valid invoice and acceptance of delivered goods, whichever occurs later, with no advance payment.',[questions[1]]:'Deliver within 14 calendar days of purchase-order issuance.'};
 const draft={...structuredClone(rfx),buyerClarifications:questions};
 assert.deepEqual(reconcileBuyerClarifications(draft,{questions,confirmedText:clarificationReply(questions,answers).message}),[]);
 const unanswered='What payment terms do you require, for example payment within 30 days of invoice receipt and no advance?';
 assert(reconcileBuyerClarifications(draft,{questions:[unanswered],confirmedText:unanswered}).length);
});
test('complete approved commercial answers retain precise triggers instead of model paraphrases',()=>{
 const questions=['What delivery lead time?','What payment terms?'];
 const answers={[questions[0]]:'Delivery required within 14 calendar days from purchase-order issuance to all three offices.',[questions[1]]:'Payment due within 30 calendar days after receipt of a valid invoice and acceptance of delivered goods, whichever occurs later; no advance payment.'};
 const draft={...structuredClone(rfx),scope:'Annual office supplies.',terms:'Delivery within 14 calendar days of each purchase order; Payment within 30 days of invoice receipt; No advance payment; Fixed annual freight. Delivery of damaged goods replacements within seven calendar days.'};
 const result=retainBuyerCommercialAnswers(draft,clarificationReply(questions,answers).message);
 for(const answer of Object.values(answers))assert(result.terms.includes(answer));
 assert.doesNotMatch(result.terms,/of each purchase order/);assert.match(result.terms,/Fixed annual freight/);
 assert.match(result.terms,/Delivery of damaged goods replacements/);
 assert.equal(commercialTrigger(answers[questions[0]]),'PO issuance');
 assert.equal(commercialTrigger('14 days from purchase-order receipt'),'PO receipt');
 assert.equal(retainBuyerCommercialAnswers(draft,clarificationReply(questions,{[questions[1]]:'Standard payment terms'}).message),draft);
});
test('missing business fields join the same buyer clarification list',()=>{const r={...rfx,deadline:'',fx:null,fxDate:'',buyerClarifications:['What pen tip size is required?']};const q=buyerClarifications(r);assert.equal(q.length,2);assert.match(q[0],/tip size/);assert(q.some(s=>/submit their quotations/.test(s)));assert(!q.some(s=>/exchange rate/.test(s)));});
test('already-listed quote deadline and FX questions are not duplicated',()=>{const q=buyerClarifications({...rfx,deadline:'',fx:null,fxDate:'',buyerClarifications:['What is the quotation deadline?','Which exchange rate and date should we use?']});assert.equal(q.length,1);});
test('completed fields disappear from generated questions without inventing answers',()=>{assert.deepEqual(buyerClarifications(rfx),[]);assert.equal(buyerClarifications({...rfx,deadline:''}).length,1);assert.deepEqual(buyerClarifications({...rfx,deadline:'2026-11-20'}),[]);});
test('blank draft waits for the initial buyer message instead of dumping a checklist',()=>assert.deepEqual(buyerClarifications({lines:[],questions:[],buyerClarifications:[]}),[]));
test('initial Define checks expose conflicting colors and unfinished terms together',async()=>{const {rfxReadiness,validateRfx}=await import('../src/domain.js');const r={...structuredClone(rfx),terms:'Commercial terms to be confirmed by buyer',lines:[{id:1,name:'Black permanent marker',spec:'2mm alcohol-based red ink',quantity:200,unit:'pcs'}],buyerClarifications:[]};const q=buyerClarifications(r);assert(q.some(x=>/Which color/.test(x)));assert(q.some(x=>/payment and delivery conditions/.test(x)));assert.equal(rfxReadiness(r).ready,false);assert.throws(()=>validateRfx(r),/unfinished/);r.lines[0].spec='2mm alcohol-based black ink';r.terms='Payment net 30 days; delivery within 14 days of PO; freight included; GST separately.';assert.deepEqual(buyerClarifications(r),[]);assert.equal(rfxReadiness(r).ready,true);});
test('every missing business field is visible before reviewing vendors',()=>{const q=buyerClarifications({...structuredClone(rfx),title:'',scope:'',terms:'',deadline:'',currency:'USD',fx:null,fxDate:'',questions:[],lines:[{id:1,name:'Pen',spec:'',quantity:null,unit:''}]});for(const pattern of [/call this purchase/,/delivered/,/specifications/,/quantity/,/counted/,/payment/,/submit their quotations/,/INR/])assert(q.some(x=>pattern.test(x)),String(pattern));});
