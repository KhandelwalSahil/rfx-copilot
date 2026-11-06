// Offline-only oracle. Never imported by the Worker or included in a model request.
import fs from 'node:fs';
import {simulationRows,simulationDiscount,sourceProfileV3} from '../src/simulation.js';
import {VENDORS,participatingVendors,normalize,quality} from '../src/domain.js';
if(!process.argv[2])throw Error('Usage: node scripts/score-run.mjs /absolute/path/workspace-record.json');
const run=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),errors=[],rows=[];
for(const vendor of participatingVendors(run.rfx)){
 const index=VENDORS.indexOf(vendor),pack=run.packages?.[vendor],data=run.data?.[vendor];
 if(!pack&&sourceProfileV3(run.rfx)&&vendor==='NorthStar')continue;
 if(![2,3].includes(pack?.generatorVersion))throw Error(vendor+': export a run using source generator v2 or v3. Legacy, uploaded or manually replaced packages require an independently authored oracle; do not compare them to this one.');
 if(!data){errors.push({vendor,error:'No genuine extraction saved'});continue;}
 const expected=simulationRows(run.rfx,index,pack.round,pack.resolved),historical=pack.generatorVersion===2&&index===4&&!pack.resolved?.offers&&!pack.resolved?.specs;
 for(const line of run.rfx.lines){
  const raw=expected.find(q=>q.id===line.id),actual=data.quotes.find(q=>q.lineId===line.id),slot={vendor,lineId:line.id,correct:false};
  if(!raw){slot.correct=!actual;if(actual)errors.push({vendor,lineId:line.id,error:'Invented omitted offer'});}
  else if(!actual)errors.push({vendor,lineId:line.id,error:'Missed quoted item'});
  else{
   // Independent arithmetic from the generated source rate and pack multiplier.
   const unitPrice=Number((raw.price*raw.conversionToTarget*(raw.currency==='USD'?run.rfx.fx:1)).toFixed(6)),observed=normalize(actual,line,run.rfx).price;
   const unknownBasis=/not stated/.test(raw.unit)||raw.currency==='USD'&&(!Number.isFinite(run.rfx.fx)||!run.rfx.fxDate);
   slot.correct=unknownBasis?observed===null&&actual.currency===raw.currency:observed!==null&&Math.abs(observed-unitPrice)<.000002&&actual.currency===raw.currency;
   if(!slot.correct)errors.push({vendor,lineId:line.id,error:'Price/currency/conversion mismatch',expected:unitPrice,actual:observed,expectedCurrency:raw.currency,actualCurrency:actual.currency});
   if(historical&&expected.indexOf(raw)>=2&&actual.state!=='review')errors.push({vendor,lineId:line.id,error:'Historical carry-forward requires review, not silent current-price approval'});
   if(!pack.files.some(k=>actual.source?.includes(pack.assets[k]?.displayName||k)))errors.push({vendor,lineId:line.id,error:'Source filename is not in this package'});
  }
  rows.push(slot);
 }
 const discount=simulationDiscount(run.rfx,index);
 if(discount&&(!data.discount||data.discount.rate!==discount.rate||data.discount.thresholdReams!==discount.thresholdReams||JSON.stringify([...data.discount.lineIds].sort())!==JSON.stringify([...discount.lineIds].sort())))errors.push({vendor,error:'Discount terms do not match source footnote'});
 if(((pack.generatorVersion===2&&index===4)||(pack.generatorVersion===3&&index===5))&&!pack.resolved?.freight&&data.freight?.state!=='unknown')errors.push({vendor,error:'Unknown freight was converted into a known charge'});
 const gate=quality(data,run.rfx);if(index===2&&!pack.resolved?.evidence&&run.rfx.questions.some(q=>q.gate&&q.rule?.type==='date_on_or_after')&&gate.status!=='fail')errors.push({vendor,error:'Expired certificate did not fail qualification'});
 if(data.quotes.some(q=>q.verified))errors.push({vendor,error:'Buyer corrections present: report raw AI accuracy separately from corrected results'});
}
const report={sourceGenerator:sourceProfileV3(run.rfx)?3:2,checkedSlots:rows.length,correctPricesOrExplicitGaps:rows.filter(r=>r.correct).length,accuracy:rows.length?rows.filter(r=>r.correct).length/rows.length:null,issues:errors,manualChecksRequired:['Literal source locator accuracy','Evidence relevance and document authenticity','Delivery/payment commitment fidelity','Photo uncertainty calibration'],limits:'Offline comparison against known synthetic source facts; does not establish production model quality. No provider requests are made.'};
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
