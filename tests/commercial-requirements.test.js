import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {commercialRequirements,commercialTrigger,comparison,awardReadiness,rfxSourceSignature,reviewQueue} from '../src/domain.js';
const base=JSON.parse(fs.readFileSync(new URL('../dataset/rfx.json',import.meta.url)));
const rfx={...base,scope:'Deliver within 14 calendar days from PO issuance to Bengaluru.',terms:'Payment within 30 days of invoice receipt. No advance payment.',lines:base.lines.slice(0,1),questions:[{id:'delivery',text:'Confirm delivery and payment commitments',gate:false}],invitedVendors:['Metro']};
const quote=()=>({quotes:[{lineId:1,price:10,currency:'INR',unit:'ream',state:'read',source:'offer.txt line 1',excerpt:'10 INR per ream'}],answers:[],evidence:[],blockers:[],freight:{state:'known',amount:0,source:'offer.txt line 2'},commercialTerms:{delivery:{value:'10 calendar days from PO issuance',source:'offer.txt delivery'},payment:{value:'Payment 30 days from invoice receipt; no advance',source:'offer.txt payment'}},meta:{responseId:'unit-test-only',model:'test',rfxSignature:rfxSourceSignature(rfx),files:[{name:'offer.txt',sha256:'a'.repeat(64)}]}});
test('absence of an extracted blocker cannot turn an unknown required delivery commitment into award readiness',()=>{const x=quote();delete x.commercialTerms.delivery;assert.equal(commercialRequirements(x,rfx).find(c=>c.field==='delivery').status,'unknown');assert.equal(comparison({Metro:x},rfx)[0].total,null);assert(reviewQueue({Metro:x},rfx).some(i=>/delivery commitment/.test(i.why)));assert.equal(awardReadiness({rfx,data:{Metro:x},version:1}).ready,false);});
test('explicit matching delivery and payment commitments allow a sourced award',()=>{const x=quote();assert(commercialRequirements(x,rfx).every(c=>c.status==='pass'));assert.equal(awardReadiness({rfx,data:{Metro:x},version:1}).ready,true);});
test('delivery basis and trigger must be comparable, not merely a smaller number',()=>{for(const value of ['10 working days from PO issuance','10 calendar days from advance payment','10 calendar days']){const x=quote();x.commercialTerms.delivery.value=value;assert.equal(commercialRequirements(x,rfx)[0].status,'unknown',value);assert.equal(comparison({Metro:x},rfx,{qualityOnly:false,includeReview:true})[0].total,null);}});
test('late delivery, contradictory advance terms, missing payment source and copied buyer terms do not pass',()=>{const late=quote();late.commercialTerms.delivery.value='21 calendar days from PO issuance';assert.equal(commercialRequirements(late,rfx)[0].status,'fail');const advance=quote();advance.commercialTerms.payment.value='30 days from invoice; 50% advance';assert.equal(commercialRequirements(advance,rfx)[1].status,'fail');const missing=quote();missing.commercialTerms.payment.source='';assert.equal(commercialRequirements(missing,rfx)[1].status,'unknown');const vague=quote();vague.commercialTerms.delivery.value='Buyer requirement: delivery within 14 calendar days from PO issuance';assert.equal(commercialRequirements(vague,rfx)[0].status,'unknown');});
test('optional commercial details do not become new mandatory requirements',()=>{assert.deepEqual(commercialRequirements(quote(),{...rfx,scope:'Supply to Bengaluru',terms:'Suppliers may propose delivery and payment terms.'}),[]);});

test('invoice receipt and acceptance, or PO issuance and receipt, are distinct commercial triggers',()=>{const x=quote();x.commercialTerms.payment.value='30 days after accepted invoice; no advance';assert.equal(commercialRequirements(x,rfx)[1].status,'unknown');x.commercialTerms.delivery.value='10 days from receipt of the purchase order';assert.equal(commercialRequirements(x,rfx)[0].status,'unknown');});

test('scope without a trailing full stop does not absorb the payment reference point',()=>{const x=quote(),r={...rfx,scope:rfx.scope.replace(/\.$/,'')};assert(commercialRequirements(x,r).every(c=>c.status==='pass'));});
test('later-of valid invoice receipt and goods acceptance is not invoice acceptance or invoice-only payment',()=>{
 const required='Payment is due within 30 calendar days of receiving a valid invoice and accepting the delivered goods, whichever occurs later; No advance payment is acceptable.';
 const r={...rfx,terms:required},x=quote();
 assert.equal(commercialTrigger(required),'invoice receipt and goods acceptance (whichever is later)');
 assert.equal(commercialRequirements(x,r).find(c=>c.field==='payment').status,'unknown');
 for(const offered of [
  '30 days after accepted invoice; no advance',
  '30 days after receiving a valid invoice or acceptance of the goods and no advance',
  '30 days after receipt of a valid invoice and goods acceptance is not required; no advance',
  '30 days after receipt of a valid invoice and acceptance of goods, whichever is later. Goods acceptance is not required; no advance',
  '30 days after receipt of a valid invoice and acceptance of goods, whichever is earlier; no advance',
  '30 days after invoice receipt and goods acceptance, whichever is later; no advance',
  '15 days after receiving a valid invoice and accepting the delivered goods, whichever occurs later; no advance',
 ]){
  x.commercialTerms.payment.value=offered;
  assert.equal(commercialRequirements(x,r).find(c=>c.field==='payment').status,'unknown',offered);
 }
 x.commercialTerms.payment.value='We accept these payment conditions: '+required;
 assert.equal(commercialRequirements(x,r).find(c=>c.field==='payment').status,'pass');
 x.meta.rfxSignature=rfxSourceSignature(r);
 assert.equal(awardReadiness({rfx:r,data:{Metro:x},version:1}).ready,true);
 x.commercialTerms.payment.source='';
 assert.equal(awardReadiness({rfx:r,data:{Metro:x},version:1}).ready,false);
});
