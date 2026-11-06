// Generates fictional source documents only; comparison data still requires extraction.
export function simulationResolution(message='',prior={}){
 const t=message.toLowerCase();return {offers:!!prior.offers||/missing.*(?:line|offer)|unquoted|omitted|all.*lines|please quote this requested item|confirm.*(?:current|historical|last year|rates|prices)/.test(t),freight:!!prior.freight||/freight|shipping|delivery charg/.test(t),specs:!!prior.specs||/brand|model|specification|deviation/.test(t),delivery:!!prior.delivery||/delivery date|lead time|delivery commitment|\d+\s+(?:(?:calendar|business|working)\s+)?days/.test(t),evidence:!!prior.evidence||/evidence|certificate|certification|gst|quality/.test(t)};
}
const simFlags=(round,resolved)=>resolved??{offers:!!round,freight:!!round,specs:!!round,delivery:!!round,evidence:!!round};
export function simulationRows(rfx,vendorIndex,round=0,resolved=null){
 if(sourceProfileV3(rfx))return sevenRows(rfx,vendorIndex,round,resolved);
 const flags=simFlags(round,resolved);
 return rfx.lines.filter((l,i)=>flags.offers||vendorIndex!==2||i<Math.max(1,rfx.lines.length-Math.min(3,rfx.lines.length-1))).map((l,i)=>{
 const reference=Number.isFinite(l.baseline)&&l.baseline>0?l.baseline:10+(l.id*17%190);
 const paper=/\b(?:paper|ream)\b/i.test(l.name+' '+l.unit),group=i%4;
 const factors=paper?[1.00,.96,.84,i===0?.89:1.04,.95]:[[.91,1.02,.85,.97,.95],[1.01,.92,.86,.98,.94],[1.00,.99,.83,.90,.96],[.97,.95,.84,1.01,.91]][group];
 const rate=Number((reference*(factors[vendorIndex]??1.1)).toFixed(2));
 const counted=/^(?:piece|pcs|ream|pack|box|roll|can|cartridge|pad)s?$/i.test(l.unit),countUnit={piece:'pieces',box:'boxes',ream:'reams',pack:'packs',roll:'rolls',can:'cans',cartridge:'cartridges',pad:'pads'}[l.unit]||l.unit;
 const pack=vendorIndex===3&&counted?(paper?5:100):1,currency=vendorIndex===1&&i>=Math.max(0,rfx.lines.length-3)?'USD':'INR';
 const mass=vendorIndex===4&&Number.isFinite(l.massKgPerUnit)&&l.massKgPerUnit>0?l.massKgPerUnit:null;
 const sourceFx=Number.isFinite(rfx.fx)&&rfx.fx>0?rfx.fx:95;
 const price=Number((rate*(mass?1/mass:pack)/(currency==='USD'?sourceFx:1)).toFixed(4)),conversionToTarget=mass??1/pack;
 return {id:l.id,name:l.name,spec:l.spec,quantity:l.quantity,unit:mass?'kg':pack===1?l.unit:paper?`carton of ${pack} ${countUnit}`:`${pack} ${countUnit}`,packSize:pack,conversionToTarget,price,currency,extended:Number((price*l.quantity*conversionToTarget*(currency==='USD'?sourceFx:1)).toFixed(2))};
 });
}
const simEvidenceQuestions=rfx=>rfx.questions.filter(q=>q.gate||/evidence|certificate|certification|test report|sample approval/i.test(q.text));
const simFreight=(rfx,index,flags)=>index===4&&!flags.freight?'To be confirmed':(1200+index*350)+' INR '+(/annual|yearly|monthly call.off|contract period/i.test(rfx.scope+' '+rfx.terms)?'fixed annual charge for this RFx':'fixed charge for this order');
function simDelivery(rfx,q,index,flags){
 const match=(rfx.scope+' '+rfx.terms+' '+q.text).match(/(?:within|in)\s+(\d+)\s*(?:calendar\s*)?days/i),target=match?Number(match[1]):null;
 const days=target?(index===1&&!flags.delivery?target+7:Math.max(1,target-index)):7+index;
 const trigger=/po issuance|purchase order|po date/i.test(rfx.scope+' '+rfx.terms+' '+q.text)?'from PO issuance':'from receipt of the purchase order (supplier proposal; buyer acceptance required)';
 return `${days} calendar days ${trigger} for quoted lines only. ${target?(days>target?'EXCEPTION: exceeds the requested '+target+' days; revised commitment needs clarification.':'Meets requested '+target+'-day lead time.'):'This is a synthetic supplier proposal, not a buyer-defined deadline.'} Delivery scope: ${rfx.scope}. An absolute date depends on the actual order date.`;
}
function simAnswer(rfx,q,vendor,index,round,flags,rows){
 const text=q.text.toLowerCase(),evidenceFile=vendor.replaceAll(' ','-')+'-evidence-r'+(round+1)+'.txt';
 // Evidence takes priority over incidental words such as "specifications".
 if(q.gate&&index===2&&!flags.evidence)return 'Yes, we confirm the requested qualification. See the attached certificate record (fictional supplier declaration; verify its expiry).';
 if(q.gate||/evidence|certificate|certification|test report|sample approval/.test(text))return index===4&&!flags.evidence?'Requested supporting evidence NOT PROVIDED. No certificate or compliance conclusion is claimed.':`See ${evidenceFile}, record ${q.id}. Labelled synthetic evidence for this requirement; no verified external certification or real buyer approval is claimed.`;
 if(/gst|registration identifier/.test(text))return index===4&&!flags.evidence?'GST registration detail NOT PROVIDED.':`Fictional registration reference DEMO-${vendor.replace(/\W/g,'').toUpperCase()}-GST. Not a real GSTIN; registry verification not performed.`;
 if(/brand|model|specification|deviation/.test(text)){
  const referenced=rfx.lines.filter(l=>text.includes(l.name.toLowerCase())||l.name.toLowerCase().split(/\W+/).filter(w=>w.length>3).some(w=>text.includes(w)));
  return (referenced.length?referenced:rfx.lines).map(l=>{
   if(!rows.some(x=>x.id===l.id))return `Line ${l.id} (${l.name}): NOT QUOTED. No compliance claim for this line.`;
   if(index===3&&!flags.specs&&l.id===rfx.lines[0].id)return `Line ${l.id} (${l.name}): brand ${vendor} Demo; model NOT PROVIDED; offered specification ${l.spec}. Model confirmation outstanding.`;
   return `Line ${l.id} (${l.name}): fictional brand ${vendor} Demo, model DEMO-L${l.id}; offered specification ${l.spec}; no supplier-proposed deviation.`;
  }).join(' ');
 }
 if(/delivery|lead time|achievable date/.test(text)&&!/charg/.test(text))return simDelivery(rfx,q,index,flags);
 if(/freight|shipping/.test(text))return 'Freight: '+simFreight(rfx,index,flags)+'.';
 if(/valid until|validity/.test(text))return 'Quotation valid through '+rfx.deadline+'.';
 if(/capacity/.test(text)){
  const reams=rfx.lines.filter(l=>/ream/i.test(l.unit));
  return reams.length?`Synthetic declared monthly capacity ${Math.ceil(reams.reduce((s,l)=>s+l.quantity,0)/12*(1.2+index*.2))} reams for requested paper lines ${reams.map(l=>l.id).join(', ')}. Fictional supplier declaration, not verified capacity.`:'Capacity answer NOT PROVIDED for these requested units; no paper capacity is assumed.';
 }
 if(/returns|replacement/.test(text))return 'Supplier proposal: replace damaged or nonconforming quoted items within 7 days of accepted defect notification. No real warranty is represented; buyer acceptance required.';
 if(/subcontract/.test(text))return 'No subcontracting proposed for quoted lines in this synthetic offer.';
 if(/commercial|payment|invoic|acceptance|tax/.test(text))return `For quoted lines, buyer-defined terms are: ${rfx.terms}. Freight is disclosed separately. ${index===1&&!flags.delivery&&/within\s+\d+\s+days/i.test(rfx.scope+' '+rfx.terms)?'Delivery exception: '+simDelivery(rfx,q,index,flags):'No additional exception to these stated terms is proposed.'} Any missing line remains unquoted. ${/payment/i.test(text)&&!/payment|net\s*\d+/i.test(rfx.terms)?'Supplier proposes net 30 days after accepted invoice; buyer acceptance required.':''}`;
 return 'Answer NOT PROVIDED for this question. Request a specific supplier response; no compliance is inferred.';
}
export function simulationDiscount(rfx,index){const ids=rfx.lines.filter(l=>/ream/i.test(l.unit)).slice(0,4).map(l=>l.id);return index===1&&ids.length?{rate:.05,thresholdReams:Math.max(1,Math.ceil(rfx.lines.filter(l=>ids.includes(l.id)).reduce((n,l)=>n+l.quantity,0)*.8)),lineIds:ids}:null;}
export function simulationHistoryName(vendor,round=0){return vendor.replaceAll(' ','-')+'-prior-rates-r'+(round+1)+'.txt';}
export function simulationHistory(rfx,vendor,index,round=0,resolved=null){return ['SYNTHETIC PRIOR AGREEMENT - DEMO ONLY',vendor+' prior rates schedule', 'Previous-period rates; use only if the current offer explicitly renews them. No freight amount is stated here.',...simulationRows(rfx,index,round,resolved).map(l=>`${l.name}: ${l.price} ${l.currency} / ${l.unit}. Specification: ${l.spec}.`)].join('\n');}
export function simulationText(rfx,vendor,index,round=0,resolved=null){
 if(sourceProfileV3(rfx))return sevenText(rfx,vendor,index,round,resolved);
 const flags=simFlags(round,resolved),rows=simulationRows(rfx,index,round,flags),omitted=rfx.lines.filter(l=>!rows.some(x=>x.id===l.id)),discount=simulationDiscount(rfx,index);
 const header=['SYNTHETIC VENDOR QUOTATION - DEMONSTRATION ONLY',vendor+' Supplies | quotation revision '+(round+1),rfx.title];
 const answers=rfx.questions.map(q=>`${q.id} — ${q.text}\n${simAnswer(rfx,q,vendor,index,round,flags,rows)}`);
 const terms=['Freight: '+simFreight(rfx,index,flags),'Payment and commercial conditions: '+rfx.terms,'Valid through '+rfx.deadline+'. Prices exclude recoverable GST. No minimum order quantity.',omitted.length?'Items not offered: '+omitted.map(l=>l.name).join('; ')+'.':'All requested items offered.'];
 const rates=rows.map(l=>({name:l.name,qty:l.quantity,unit:rfx.lines.find(x=>x.id===l.id).unit,spec:l.spec,rate:l.price,currency:l.currency,pack:l.unit}));
 if(index===0)return [...header,'Our item schedule is on the Offer sheet; commercial conditions and questionnaire replies are on Terms.',...terms,...answers].join('\n');
 if(index===1)return [...header,'COMMERCIAL OFFER',...rates.slice().reverse().flatMap(l=>[l.name+' — '+l.spec,`Required quantity ${l.qty} ${l.unit}; our price ${l.currency} ${l.rate} per ${l.pack}.`]),...terms,...answers,discount?`Small-print discount condition: deduct 5% from the offered prices of ${rfx.lines.filter(l=>discount.lineIds.includes(l.id)).map(l=>l.name).join(', ')} only if their COMBINED AWARDED quantity is at least ${discount.thresholdReams} reams. No discount below that threshold. Other items are not discounted.`:'No additional discount.'].join('\n');
 if(index===2)return [...header,'Dear procurement team, please find our offer below.',...rates.map(l=>`For ${l.name} (${l.spec}), we can supply ${l.qty} ${l.unit}. The price is ${l.rate} ${l.currency} per ${l.pack}.`),'Commercial conditions: '+terms.join(' '),'Our questionnaire response follows.',...answers].join('\n\n');
 if(index===3)return [...header,'PRINTED RATE CARD / requested quantities',...rates.flatMap(l=>[l.name+' | '+l.qty+' '+l.unit+' requested',`${l.currency} ${l.rate} / ${l.pack}`]),...terms,'Questionnaire and product details:',...answers].join('\n');
 const history=simulationHistoryName(vendor,round),fresh=flags.offers||round>0&&flags.specs;
 return [...header,'Hello,',...(fresh?rates:rates.slice(0,2)).map(l=>`${l.name}: ${l.rate} ${l.currency}/${l.pack}; requested ${l.qty} ${l.unit}; ${l.spec}.`),fresh?'The prices above replace our previous schedule.':`For the remaining requested items, renew the rates in the attached ${history}; no other prior-period terms are renewed. Please use that attachment for those prices.`,...terms,'Answers to your questions:',...answers,'Thanks, '+vendor].join('\n');
}
// Minimal standards-compliant text PDF, paginated with byte-correct xref.
export function textPdf(text){
 const clean=s=>s.replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&');
 const lines=text.split('\n').flatMap(s=>s.match(/.{1,95}/g)||['']);const pages=[];for(let i=0;i<lines.length;i+=48)pages.push(lines.slice(i,i+48));
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const kids=[];
 for(const lines of pages){const p=objects.length,c=p+1;kids.push(`${p} 0 R`);const content='BT /F1 9 Tf 40 800 Td 14 TL '+lines.map((l,i)=>(i?'T* ':'')+'('+clean(l)+') Tj').join('\n')+' ET';objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${c} 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);}
 objects[2]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.join(' ')}] >>`;let out='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(out.length);out+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const start=out.length;out+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return new TextEncoder().encode(out);
}


export function simulationEvidence(rfx,vendor,index,round=0,resolved=null){
 if(sourceProfileV3(rfx))return sevenEvidence(rfx,vendor,index,round,resolved);
 const flags=simFlags(round,resolved),questions=simEvidenceQuestions(rfx),rows=simulationRows(rfx,index,round,flags);
 return ['SYNTHETIC EVIDENCE - DEMONSTRATION ONLY - NOT A REAL CERTIFICATE',vendor,`RFx: ${rfx.title}`,`Quoted scope: ${rows.map(l=>'Line '+l.id+' '+l.name+' ('+l.spec+')').join('; ')}`,...questions.map(q=>{
  if(index===4&&!flags.evidence)return q.id+' | '+q.text+' | Supporting document NOT PROVIDED. Status unknown.';
  const rule=q.rule||{type:'evidence_pass'};let value='Inspection record DEMO-'+index+'-'+q.id+' dated '+rfx.fxDate+': offered items were assessed against the stated criterion. Observation: quoted specifications conform for the listed scope. Result: CONFORMS within this fictional scenario.';
  if(/sample.*(?:approval|evidence)|(?:approval|approved).*sample/i.test(q.text))value='Buyer QA sample approval record DEMO-SAMPLE-'+index+'-'+q.id+' dated '+rfx.fxDate+'. Decision: APPROVED for the quoted items and specifications listed above. Fictional buyer QA sign-off for this demonstration.';
  else if(/test (?:evidence|report|result)/i.test(q.text))value='Product test report DEMO-TEST-'+index+'-'+q.id+' dated '+rfx.fxDate+'. Tested scope: '+rows.map(l=>l.name+' ('+l.spec+')').join('; ')+'. Observation: tested specifications conform to the requested scope. Result: CONFORMS within this fictional scenario.';
  if(/gst/i.test(q.text))value='Fictional registration record; scenario status ACTIVE. Record DEMO-'+vendor.replace(/\W/g,'').toUpperCase()+'-GST. Registered entity: '+vendor+' Demo Supplies. Deliberately not a real GSTIN. Registry verification not performed; no official certificate represented.';
  else if(rule.type==='date_on_or_after')value='Certificate valid until '+(index===2&&!flags.evidence?'2020-01-01':rule.date)+'; synthetic record for this criterion and quoted scope only.';
  else if(rule.type==='number_at_least')value='Observed value '+rule.minimum+'; synthetic assessment for this criterion and quoted scope only.';
  return q.id+' | '+q.text+' | '+value;
 }),questions.length?'':'No supporting evidence was requested.'].join('\n');
}

// Seven-supplier rehearsal sources. This module never writes extraction or analyst results.
export function sevenResolution(message='',prior={}){
 const t=message.toLowerCase(),base=simulationResolution(message,prior);
 return {...base,units:!!prior.units||/pack|carton|100.piece|pricing unit|typed.*(?:rate|schedule)/.test(t),coverage:!!prior.coverage||/pune|hub|location|coverage/.test(t),availability:!!prior.availability||/availability|stock|supply commitment/.test(t)};
}
export function sevenRows(rfx,index,round=0,resolved=null){
 if(index===6)return [];
 const f=resolved||sevenResolution(round?'missing lines, freight, models, delivery commitment, evidence, pack size, all hubs, availability':'');
 return rfx.lines.filter((l,i)=>index!==2||f.offers||i<Math.max(1,rfx.lines.length-3)).map(l=>{
  const catalog=supplierCatalogEntry(l),reference=catalog?.price??l.baseline??(10+l.id*17%190),sku=catalog?.id??l.id,paper=/ream/i.test(l.unit)&&/paper/i.test(l.name),stationery=sku>=5&&sku<=17;
  let factor=index===0?2.6:index===1?(paper?.92:[.99,.95,.97,1.0][sku%4]):index===2?(paper?.90:[7,10,13,16].includes(sku)?.84:1.03):index===3?(paper?1.0:stationery?.88:1.01):index===4?.93:paper?1.02:stationery?1.02:.86;
  const target=Number((reference*factor).toFixed(2)),pack=index===3?(paper?5:100):1,currency=index===1&&/toner/i.test(l.name)?'USD':'INR';
  const ambiguous=index===3&&/ballpoint/i.test(l.name)&&/blue/i.test(l.name+' '+l.spec)&&!f.units,unit=ambiguous?'pack (count not stated)':pack===1?l.unit:paper?'carton of 5 reams':'100 '+(l.unit==='box'?'boxes':l.unit+(l.unit.endsWith('s')?'':'s'));
  const price=Number((target*pack/(currency==='USD'?95:1)).toFixed(4));
  return {id:l.id,name:l.name,spec:l.spec,quantity:l.quantity,unit,packSize:pack,conversionToTarget:1/pack,price,currency,extended:Number((price*l.quantity/pack*(currency==='USD'?95:1)).toFixed(2))};
 });
}
export function sevenTerms(rfx,index,flags){
 const all='Delhi, Bengaluru and Pune',delivery=index===4?'10 calendar days from PO issuance to Delhi and Bengaluru only. Pune is not served. No subcontractor or alternative Pune delivery is available.':index===5&&!flags.coverage?'12 calendar days from PO issuance to Delhi and Bengaluru. Pune coverage is not confirmed; route and supply availability require confirmation.':(index===1&&!flags.delivery?'21':'12')+' calendar days from PO issuance to '+all+'. We commit to this lead time for every awarded line and monthly call-off.',payment=index===4?'100% advance payment before dispatch is mandatory and non-negotiable. No credit period offered.':'Payment within 30 calendar days from invoice receipt. No advance payment required.';
 return {delivery,payment,freight:index===5&&!flags.freight?null:sourceFreight(rfx,index),validity:sourceValidity(rfx),availability:index===5&&!flags.availability?'Supply availability for Pune is not confirmed. Other hubs can be served.':index===4?'Supply availability confirmed for Delhi and Bengaluru only. Pune is not served.':'Supply availability confirmed for the full forecast and monthly call-offs at Delhi, Bengaluru and Pune. No MOQ or minimum volume commitment.'};
}
function sevenAnswer(rfx,q,vendor,index,round,f,rows,terms){
 const t=q.text.toLowerCase(),evidence=vendor.replaceAll(' ','-')+'-evidence-r'+(round+1)+'.txt';
 if(q.gate){if(index===2&&!f.evidence&&q.rule?.type==='date_on_or_after')return 'We confirm that our quality-system certificate meets the contract qualification requirement. See '+evidence+', record '+q.id+'.';if(index===5&&!f.evidence&&/sample.*(?:approval|evidence)|(?:approval|approved).*sample/i.test(q.text))return 'Buyer sample approval evidence is not attached; request the outstanding record.';return 'See '+evidence+', record '+q.id+'. The source record governs any validity check.';}
 if(/availability|stock/.test(t))return terms.availability;
 if(/delivery|lead time/.test(t))return terms.delivery;
 if(/payment|advance/.test(t))return terms.payment;
 if(/freight/.test(t))return terms.freight==null?'Freight is not confirmed for all three hubs. A fixed annual all-hub charge will be supplied on request.':(annualSource(rfx)?'Fixed annual freight ':'Fixed freight ')+terms.freight+' INR for all allocated items'+(index===4?' to Delhi and Bengaluru only. Pune is not served.':' to Delhi, Bengaluru and Pune combined. No location surcharge. Charged once per selected supplier.');
 if(/validity|valid until|fixed prices/.test(t))return terms.validity;
 if(/brand|model|specification|pack size/.test(t))return rfx.lines.map(l=>{
  const row=rows.find(r=>r.id===l.id);if(!row)return 'Line '+l.id+' ('+l.name+'): NOT QUOTED.';
  return 'Line '+l.id+' ('+l.name+'): offered brand '+vendor+', model '+(index===3&&l.id===rfx.lines[0].id&&!f.specs?'NOT PROVIDED':vendor.toUpperCase().replace(/\W/g,'')+'-L'+l.id)+'; specification '+l.spec+'; pricing unit '+row.unit+'. No specification deviation.';
 }).join('\n');
 if(/commercial|exception|terms|conditions/.test(t))return terms.delivery+' '+terms.payment+' '+terms.validity+' '+(terms.freight==null?'Freight not confirmed.':'Fixed freight '+terms.freight+' INR for all awarded items at Delhi, Bengaluru and Pune; no location surcharge.')+' Prices exclude GST, shown separately. No MOQ or guaranteed annual purchase volume is required. Damaged or nonconforming goods are replaced within 7 calendar days at no additional cost. Exceptions are stated above.';
 if(/capacity/.test(t))return 'Monthly paper supply capacity 20,000 reams. Forecast call-off capacity confirmed for requested paper grades.';
 if(/replacement|returns/.test(t))return 'We replace damaged or nonconforming supplied items within 7 calendar days of notification at no additional charge.';
 if(/subcontract/.test(t))return 'No subcontracted fulfilment proposed.';
 if(/gst/.test(t))return 'Registration reference DEMO-'+vendor.toUpperCase().replace(/\W/g,'')+'-GST. See attached registration statement; not an official GSTIN.';
 return 'Answer not provided for this additional question; please request a specific response.';
}
export function sevenText(rfx,vendor,index,round=0,resolved=null){
 if(index===6)return '';
 const f=resolved||sevenResolution(round?'missing lines, freight, models, delivery commitment, evidence, pack size, all hubs, availability':''),rows=sevenRows(rfx,index,round,f),terms=sevenTerms(rfx,index,f),discount=simulationDiscount(rfx,index),missing=rfx.lines.filter(l=>!rows.some(r=>r.id===l.id));
 const header=['SYNTHETIC VENDOR QUOTATION — DEMONSTRATION ONLY',vendor+' | quotation revision '+(round+1),rfx.title],body=[];
 if(index===0)body.push('Item schedule is on the Offer sheet. Commercial conditions and questionnaire replies are on Terms.');
 else for(const row of (index===1?[...rows].reverse():rows)){
  body.push(row.name+(index===3?'':' — '+row.spec));
  body.push('Requested annual quantity '+row.quantity+' '+rfx.lines.find(l=>l.id===row.id).unit+'; quoted price '+row.price+' '+row.currency+' per '+row.unit+'.');
  if(index===3&&row.id===5&&!f.units)body.push('Pack count for this line is not stated in this rate card. Ask for a typed confirmation before comparing.');
 }
 body.push('Delivery commitment: '+terms.delivery,'Payment: '+terms.payment,'Availability: '+terms.availability,'Freight: '+(terms.freight==null?'Not confirmed':terms.freight+' INR '+(annualSource(rfx)?'fixed annual charge ':'fixed charge for this order ')+(index===4?'for Delhi and Bengaluru only':'for Delhi, Bengaluru and Pune together, charged once, all awarded items included; no location surcharge')),terms.validity,'Prices exclude recoverable GST. Show GST separately. No minimum order quantity. Quoted packs are pricing bases; split packs may be ordered without surcharge.',missing.length?'Items not offered: '+missing.map(l=>'Line '+l.id+' '+l.name).join('; '):'All '+rfx.lines.length+' requested lines offered.');
 if(index===3)body.push('Questionnaire and product details:');
 for(const q of rfx.questions)body.push(q.id+' — '+q.text+'\n'+sevenAnswer(rfx,q,vendor,index,round,f,rows,terms));
 if(discount)body.push('Conditional paper discount: deduct 5% only from lines '+discount.lineIds.join(', ')+' if the COMBINED AWARDED quantity on these lines reaches '+discount.thresholdReams+' reams. No discount below the threshold. No discount on other lines.');
 return [...header,...body].join('\n');
}
export function sevenEvidence(rfx,vendor,index,round=0,resolved=null){
 const f=resolved||sevenResolution(round?'evidence':''),rows=sevenRows(rfx,index,round,f);
 return ['SYNTHETIC EVIDENCE — DEMONSTRATION ONLY — NOT REAL CERTIFICATES',vendor+' evidence register, revision '+(round+1),rfx.title,'Offered scope: '+rows.map(l=>'Line '+l.id+' '+l.name).join('; '),...rfx.questions.filter(q=>q.gate).map(q=>{
  if(index===5&&!f.evidence&&/sample.*(?:approval|evidence)|(?:approval|approved).*sample/i.test(q.text))return q.id+' | Sample approval document NOT PROVIDED. Qualification unknown.';
  if(q.rule?.type==='number_at_least')return q.id+' | Observed value '+q.rule.minimum+' | Assessed criterion: '+q.text+'.';
  if(q.rule?.type==='date_on_or_after')return q.id+' | Quality-system certificate record '+vendor+'-QA-'+(round+1)+' | Valid until '+(index===2&&!f.evidence?'2020-01-01':q.rule.date)+'.';
  if(/certificate/i.test(q.text))return q.id+' | Quality-system certificate record '+vendor+'-QA-'+(round+1)+' | '+(q.text.match(/ISO\s*\d+(?::\d+)?/i)?.[0]||'Quality system')+' | Result: CONFORMS to the stated criterion.';
  if(/test/i.test(q.text))return q.id+' | Product test report. Tested '+rows.filter(l=>l.id<=4).map(l=>l.name+' — '+l.spec).join('; ')+'. Result: CONFORMS within this fictional scenario.';
  if(/OEM|genuine.*toner/i.test(q.text))return q.id+' | OEM product declaration: '+rows.filter(l=>/toner|cartridge/i.test(l.name)).map(l=>'L'+l.id+' Brand: HP; Model: '+(l.name.match(/HP\s*(12A|88A|05A)/i)?.[1]||l.name)+'; Genuine OEM; Factory-sealed').join(' / ')+'.';
  if(/delivery|lead time/i.test(q.text))return q.id+' | Supplier delivery commitment: '+sevenTerms(rfx,index,f).delivery;
  if(/payment|advance/i.test(q.text))return q.id+' | Supplier payment commitment: '+sevenTerms(rfx,index,f).payment;
  if(!/sample|approval/i.test(q.text))return q.id+' | Supporting record NOT PROVIDED for: '+q.text;
  return q.id+' | Buyer sample approval record for all quoted line specifications: '+rows.map(l=>'L'+l.id+' '+l.spec).join('; ')+'. Decision: APPROVED within this fictional scenario.';
 })].join('\n');
}

// Supplier-side source catalog, not buyer-entered reference prices or extracted answers.
const supplierCatalog=[{"id":1,"name":"A4 paper 75 GSM","unit":"ream","price":270},{"id":2,"name":"A4 paper 70 GSM","unit":"ream","price":245},{"id":3,"name":"A4 paper 80 GSM","unit":"ream","price":295},{"id":4,"name":"A3 paper 75 GSM","unit":"ream","price":540},{"id":5,"name":"Blue ballpoint pen","unit":"piece","price":8},{"id":6,"name":"Black ballpoint pen","unit":"piece","price":8},{"id":7,"name":"Sticky notes","unit":"pad","price":25},{"id":8,"name":"Permanent marker","unit":"piece","price":18},{"id":9,"name":"Whiteboard marker","unit":"piece","price":24},{"id":10,"name":"Lever arch file","unit":"piece","price":85},{"id":11,"name":"Ring binder","unit":"piece","price":55},{"id":12,"name":"Document folder","unit":"piece","price":15},{"id":13,"name":"Staple pins","unit":"box","price":12},{"id":14,"name":"Stapler","unit":"piece","price":110},{"id":15,"name":"Notebook","unit":"piece","price":45},{"id":16,"name":"Packing tape","unit":"roll","price":38},{"id":17,"name":"Scissors","unit":"piece","price":65},{"id":18,"name":"Desk tissue","unit":"box","price":35},{"id":19,"name":"Toilet tissue","unit":"roll","price":22},{"id":20,"name":"Hand towel","unit":"pack","price":45},{"id":21,"name":"Floor cleaner","unit":"can","price":340},{"id":22,"name":"Garbage bags","unit":"pack","price":75},{"id":23,"name":"Hand wash","unit":"can","price":360},{"id":24,"name":"Nitrile gloves","unit":"box","price":210},{"id":25,"name":"Microfibre cloth","unit":"piece","price":35},{"id":26,"name":"Paper cup","unit":"piece","price":0.8},{"id":27,"name":"Wooden stirrer","unit":"piece","price":0.35},{"id":28,"name":"Toner HP 12A","unit":"cartridge","price":2300},{"id":29,"name":"Toner HP 88A","unit":"cartridge","price":2400},{"id":30,"name":"Toner HP 05A","unit":"cartridge","price":3100}];
export function sourceProfileV3(rfx){return rfx.responseProfile==='supplier-v3'||rfx.scenarioId==='seven-supplier-2027';}
export function supplierResponseStatus(rfx,vendor){return sourceProfileV3(rfx)&&vendor==='NorthStar'?'awaiting':null;}
const sourceUnit=s=>String(s).toLowerCase().replace(/^(?:pcs?|pieces?)$/,'piece').replace(/boxes$/,'box').replace(/(ream|pack|roll|can|cartridge|pad)s$/,'$1');
export function supplierCatalogEntry(line){const name=line.name.toLowerCase();return supplierCatalog.find(c=>sourceUnit(c.unit)===sourceUnit(line.unit)&&(c.name.toLowerCase().match(/[a-z]+|[0-9]+/g)||[]).every(w=>name.includes(w)))||null;}

const annualSource=rfx=>/annual|yearly|monthly (?:PO|purchase.order|call.off)|contract period/i.test(rfx.scope+' '+rfx.terms);
const sourceFreight=(rfx,index)=>annualSource(rfx)?120000+index*35000:1200+index*350;
function sourceValidity(rfx){const v=String(rfx.terms).match(/quot(?:e|ation)[^.;\n]*?valid(?:ity)?[^.;\n]*?(?:through|until)\s+([^.;\n]+)/i),period=String(rfx.scope+' '+rfx.terms).match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*(?:to|through|[-–—])\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}/i);return 'Quotation valid through '+(v?v[1]:rfx.deadline)+'. Prices fixed in the quoted currency '+(period?'for '+period[0]:'for the requested contract or order period')+'. We accept that price period.';}
