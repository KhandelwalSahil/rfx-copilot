// Offline acceptance reference from known source schedules; never imported by the app or server.
// These records are not model extractions and must never be used as extraction accuracy evidence.
import fs from 'node:fs';
import {sevenSupplierScenario,sevenScenarioGuide} from '../src/scenario.js';
import {sevenRows,sevenTerms,sevenResolution,simulationDiscount} from '../src/simulation.js';
import {VENDORS,analyzeAward,comparison,quality,rfxSourceSignature,priceObservation} from '../src/domain.js';
export function sevenReference({revised=false}={}){
 const base=JSON.parse(fs.readFileSync(new URL('../dataset/rfx.json',import.meta.url))),rfx=sevenSupplierScenario(base,{guided:false});rfx.fx=95;rfx.fxDate='2026-11-06';
 const data={};
 for(const vendor of rfx.invitedVendors.filter(v=>v!=='NorthStar')){
  const i=VENDORS.indexOf(vendor),f=sevenResolution(revised?(sevenScenarioGuide.clarifications.find(([v])=>v===vendor)?.[1]||''):''),terms=sevenTerms(rfx,i,f);
  data[vendor]={quotes:sevenRows(rfx,i,Number(revised),f).map(row=>({lineId:row.id,price:row.price,currency:row.currency,unit:row.unit,state:'read',source:'REFERENCE_ONLY.txt line '+row.id,excerpt:'Known source schedule reference; not an extraction',availability:terms.availability})),answers:rfx.questions.map(q=>({questionId:q.id,answer:'Reference fixture only',source:'REFERENCE_ONLY.txt'})),evidence:rfx.questions.filter(q=>q.gate).map(q=>({questionId:q.id,result:i===5&&!f.evidence&&q.id==='Q3'?'unknown':'pass',validUntil:q.rule?.type==='date_on_or_after'?(i===2&&!f.evidence?'2020-01-01':q.rule.date):null,source:'REFERENCE_ONLY.txt',excerpt:'Known evidence reference; not an extraction'})),freight:{amount:terms.freight,state:terms.freight==null?'unknown':'known',source:'REFERENCE_ONLY.txt'},commercialTerms:Object.fromEntries(['delivery','payment','validity'].map(k=>[k,{value:terms[k],source:'REFERENCE_ONLY.txt'}])),discount:simulationDiscount(rfx,i),blockers:[],meta:{rfxSignature:rfxSourceSignature(rfx),model:'OFFLINE-REFERENCE-NOT-MODEL',responseId:'NOT-A-PROVIDER-RESPONSE',files:[{name:'REFERENCE_ONLY.txt',sha256:'a'.repeat(64)}]}};
 }
 if(revised)rfx.evaluationExclusions={Metro:{reason:'Buyer excluded the materially more expensive offer after comparing source-backed prices.',at:'2026-11-06T00:00:00Z'}};
 return {rfx,data};
}
export function sevenReferenceReport(){const initial=sevenReference(),final=sevenReference({revised:true});const a=analyzeAward(final.data,final.rfx);return {notice:'OFFLINE EXPECTED RESULTS ONLY. Computed from known generated source schedules; not actual AI extraction or live analyst output.',fx:'INR 95 per USD, dated 2026-11-06',initial:comparison(initial.data,initial.rfx).map(x=>({vendor:x.vendor,coverage:x.coverage,qualification:x.gate.status,total:x.total,reasons:x.reasons})),metroObservation:priceObservation('Metro',initial.data,initial.rfx),final:comparison(final.data,final.rfx).map(x=>({vendor:x.vendor,coverage:x.coverage,qualification:x.gate.status,total:x.total,reasons:x.reasons})),award:a};}
if(process.argv[1]===new URL(import.meta.url).pathname)console.log(JSON.stringify(sevenReferenceReport(),null,2));
