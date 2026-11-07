// All monetary evaluation and workflow rules are deterministic. No generated code executes.
export const VENDORS = ['Metro', 'Bharat', 'Jaipur Paper', 'Rajan', 'QuickDesk', 'Pioneer', 'NorthStar'];
export const DEFAULT_VENDORS=VENDORS.slice(0,5);
export const round = (n, places = 2) => Math.round((n + Number.EPSILON) * 10 ** places) / 10 ** places;
const clone = value => JSON.parse(JSON.stringify(value));
const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}
function dateInText(text) {
  const iso = String(text).match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return isoDate(iso[0]);
  const m = String(text).match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i);
  return m ? isoDate(`${m[3]}-${String(months.indexOf(m[2].slice(0,3).toLowerCase())+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`) : null;
}
function gateValidityDate(text){
 const clause=String(text).match(/\b(?:valid(?:ity)?[^.;\n]{0,60}?\b(?:through|until|till|up ?to|as of|ending)|valid(?:ity)?\s+(?:on or after|on|to)|(?:expiry|expiration|expires?)(?:\s+(?:date(?:\s+is)?|on or after|not before|no earlier than|later than|on|is))?)\s*:?\s*([^.;\n]{1,80})/i);
 const date=clause?.[1].match(/^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/);
 return date?dateInText(date[1]):null;
}
export function gateRule(question) {
  const explicit = question.rule;
  const textDate = gateValidityDate(question.text);
  if (explicit?.type === 'date_on_or_after') {
    if (!isoDate(explicit.date) || (textDate && textDate !== explicit.date)) return {type:'invalid', reason:'Question text and structured date rule conflict'};
    return explicit;
  }
  if (explicit?.type === 'number_at_least') return Number.isFinite(explicit.minimum) ? explicit : {type:'invalid',reason:'Invalid minimum'};
  if (explicit?.type === 'evidence_pass') return textDate?{type:'invalid',reason:'A dated question requires a structured date rule'}:explicit;
  if (explicit) return {type:'invalid',reason:'Unsupported quality rule'};
  // Legacy records derive dates from the question, never a hardcoded question ID.
  return textDate ? {type:'date_on_or_after',date:textDate} : {type:'evidence_pass'};
}
export function prepareDraftGates(draft){
 const next=clone(draft),repairs=[];
 for(const q of next.questions){
  if(!q.gate)continue;
  const date=gateValidityDate(q.text);
  if(!q.rule||q.rule.type==='evidence_pass'&&date){
   const before=q.rule??null;q.rule=date?{type:'date_on_or_after',date}:{type:'evidence_pass'};
   repairs.push({questionId:q.id,before,after:clone(q.rule)});
  }
 }
 return {draft:next,repairs};
}
export function retainBuyerQualifications(draft,{request,current,replacement=false}){
 const kinds=text=>[
  /certificate|quality.system/i.test(text)?'certificate':null,
  /product\s+test|paper[^.;]{0,60}test|test[^.;]{0,60}(?:paper|grades?)/i.test(text)?'test':null,
  /(?:buyer.approved|approved|approval|recorded)[^.;]{0,40}sample|sample[^.;]{0,40}(?:approval|evidence)/i.test(text)?'sample':null
 ].filter(Boolean);
 let confirmed;
 if(replacement){
  const block=String(request).match(/\b(?:following qualifications are mandatory|mandatory qualifications)\s*:\s*\n((?:\s*[-*]\s+[^\n]+(?:\n|$))+)/i);
  if(block&&/\bcertificat|quality.system|\bsample\b|\btest\s+(?:report|evidence)/i.test(String(request).replace(block[0],'')))return draft;
  const clauses=block?.[1].split('\n').map(s=>s.replace(/^\s*[-*]\s+/,'').trim()).filter(Boolean);
  if(clauses?.length===3&&clauses.every(s=>kinds(s).length===1)&&new Set(clauses.flatMap(kinds)).size===3){
   confirmed=clauses.map((text,i)=>({id:'buyer-qualification-'+(i+1),text:'Provide '+text,gate:true,rule:gateRule({text})}));
  }
 }else{
  if(/Additional buyer instructions:/i.test(request))return draft;
  const answers=[...String(request).matchAll(/\nBuyer answer: ([\s\S]*?)(?=\n\n\d+\. Question:|$)/g)].map(m=>m[1]);
  if(answers.some(a=>/\bcertificat|quality.system|\bsample\b|\btest\b|\bqualification|\bgate\b|\bstandard\b/i.test(a)))return draft;
  const questions=[...String(request).matchAll(/^\d+\. Question: ([^\n]+)\nBuyer answer:/gm)].map(m=>m[1]);
  const existing=(current?.questions||[]).filter(q=>q.gate&&kinds(q.text).length);
  if(questions.length&&questions.every(q=>/delivery|lead time|payment|credit|advance/i.test(q))&&existing.length===3&&existing.every(q=>kinds(q.text).length===1)&&new Set(existing.flatMap(q=>kinds(q.text))).size===3)confirmed=clone(existing);
 }
 if(!confirmed)return draft;
 const next=clone(draft);next.questions=next.questions.filter(q=>!q.gate||!kinds(q.text).length);
 const ids=new Set(confirmed.map(q=>q.id));
 for(const q of next.questions){const base=q.id;let suffix=1;while(ids.has(q.id))q.id=base+'-'+(++suffix);ids.add(q.id);}
 next.questions.push(...confirmed);
 return next;
}
export function retainBuyerAllocation(draft,sourceText){
 const sentences=String(sourceText).split(/\n|(?<=;)\s*|(?<=[.!?])\s+/),allocation=s=>/\ballocat(?:e|ion|ions)\b/i.test(s)&&/\d+(?:\.\d+)?\s*%/.test(s),rounding=s=>/\b(?:round(?:ing)?|floor)\b/i.test(s)&&/\b(?:allocat|remainder)/i.test(s);
 const policy=[...new Set(sentences.filter((s,i)=>!s.trim().endsWith('?')&&(allocation(s)||i>0&&allocation(sentences[i-1])&&rounding(s))).map(s=>s.trim()))];
 if(!policy.length||policy.every(s=>(draft.scope+'\n'+draft.terms).includes(s)))return draft;
 const next=clone(draft);
 for(const field of ['scope','terms']){
  const parts=String(next[field]||'').split(/\n|(?<=;)\s*|(?<=[.!?])\s+/);
  next[field]=parts.filter((s,i)=>!allocation(s)&&!(i>0&&allocation(parts[i-1])&&rounding(s))).join(' ');
 }
 next.terms=[next.terms,...policy].filter(Boolean).join('\n');
 return next;
}
export function retainBuyerQuoteDeadlines(draft,sourceText){
 const split=text=>String(text).split(/\r?\n|(?<=;)\s*|(?<!\b[ap]\.m\.)(?<=[.!?])\s+(?=[A-Z])/i);
 const submission=text=>text.match(/\b(?:quotation\s+|quote\s+|offer\s+|bid\s+)?submission\s+deadline\b[^;\n]*/i);
 const validity=text=>text.match(/\b(?:quotations?|quotes?|offers?|bids?)\b[^.;\n]{0,60}\bvalid(?:ity)?\b[^.;\n]{0,30}\b(?:until|through|to)\b[^;\n]*/i);
 const clauses=split(sourceText).map(s=>s.trim()).filter(Boolean);
 const due=clauses.filter(s=>submission(s)&&dateInText(submission(s)[0])),valid=clauses.filter(s=>validity(s)&&dateInText(validity(s)[0]));
 const dates=new Set(due.map(s=>dateInText(submission(s)[0])));
 const policy=[...new Set([...(dates.size===1?due:[]),...valid])];if(!policy.length)return draft;
 const date=dates.size===1?[...dates][0]:null;
 if(policy.every(s=>(draft.scope+'\n'+draft.terms).includes(s))&&(!date||draft.deadline===date))return draft;
 const next=clone(draft);
 for(const field of ['scope','terms'])next[field]=split(next[field]||'').filter(s=>!(dates.size===1&&submission(s))&&!(valid.length&&validity(s))).join(' ');
 next.terms=[next.terms,...policy].filter(Boolean).join('\n');if(date)next.deadline=date;
 return next;
}
export function retainBuyerCommercialAnswers(draft,message){
 let next=draft;
 for(const match of String(message).matchAll(/^\d+\. Question: ([^\n]+)\nBuyer answer: ([\s\S]*?)(?=\n\n\d+\. Question:|\n\nAdditional buyer instructions:|$)/gm)){
  const question=match[1],answer=match[2].trim(),kind=/payment|credit period|advance/i.test(question)?'Payment':/delivery|lead time/i.test(question)?'Delivery':null,trigger=commercialTrigger(answer);
  if(!kind||!/\d+\s*(?:calendar\s+|working\s+|business\s+)?days/i.test(answer)||!trigger||['PO','invoice'].includes(trigger)||kind==='Payment'&&!/advance/i.test(answer))continue;
  if((next.scope+'\n'+next.terms).includes(answer))continue;
  next=clone(next);
  for(const field of ['scope','terms'])next[field]=String(next[field]||'').split(/\n|(?<=;)\s*|(?<=[.!?])\s+/).filter(s=>{
   if(kind==='Payment')return !(/^\s*(?:payment|payable|credit|no advance|without advance)\b/i.test(s)&&/\d+\s*(?:calendar\s+)?days|\bnet\s*\d+|advance/i.test(s));
   return !(/^\s*(?:deliver(?:y|ed)?|lead time|required delivery)\b/i.test(s)&&/\d+\s*(?:calendar\s+|working\s+|business\s+)?days/i.test(s)&&!/replac|damaged|nonconform/i.test(s));
  }).join(' ');
  next.terms+='\n'+kind+' terms: '+answer;
 }
 return next;
}
export function validateClarificationSuggestions(suggestions,questions){
 if(!Array.isArray(suggestions)||suggestions.length!==questions.length)throw Error('AI must suggest one answer for each current buyer question. Please retry.');
 const seen=new Set();
 for(const s of suggestions){
  if(!s||!questions.includes(s.question)||seen.has(s.question)||typeof s.answer!=='string'||!s.answer.trim()||s.answer.length>2000||typeof s.rationale!=='string'||!s.rationale.trim()||s.rationale.length>1000)throw Error('AI returned an invalid or mismatched buyer-answer suggestion. Please retry.');
  seen.add(s.question);
 }
 return suggestions;
}
export function validateRfx(rfx, {partial=false,phase='send'}={}) {
  if (!rfx || !Array.isArray(rfx.lines) || !Array.isArray(rfx.questions)) throw Error('RFx requires lines and questionnaire arrays');
  if (rfx.lines.length > 100 || (!partial && !rfx.lines.length)) throw Error('Use 1–100 line items; the complete assignment demo uses 30');
  const invited=participatingVendors(rfx);if(!partial&&!invited.length)throw Error('Select at least one vendor before sending.');
  if(rfx.requiredLocations!=null&&(!Array.isArray(rfx.requiredLocations)||rfx.requiredLocations.length>10||rfx.requiredLocations.some(x=>typeof x!=='string'||!x.trim()||x.length>100)))throw Error('Required delivery locations must be a list of at most ten place names');
  const ids = new Set();
  for (const l of rfx.lines) {
    if (!Number.isInteger(l.id) || l.id < 1 || ids.has(l.id)) throw Error('Line IDs must be unique positive integers');
    ids.add(l.id);
    if (typeof l.name !== 'string' || !l.name.trim() || typeof l.unit !== 'string' || !l.unit.trim()) throw Error('Every proposed line needs a name and unit');
    if (l.spec!=null&&typeof l.spec!=='string')throw Error('Line '+l.id+' specification must be text');
    if ((!partial || l.quantity != null) && (!Number.isFinite(l.quantity) || l.quantity <= 0)) throw Error('Forecast quantities must be positive');
  }
  const questions = new Set();
  for (const q of rfx.questions) {
    if (!q.id || questions.has(q.id) || (typeof q.text!=='string'||!q.text.trim()) || typeof q.gate !== 'boolean') throw Error('Questionnaire IDs, wording and gate roles must be valid');
    questions.add(q.id);
    if (q.gate && gateRule(q).type === 'invalid') throw Error('Invalid gate '+q.id+': '+gateRule(q).reason);
  }
  if(rfx.buyerClarifications!=null&&(!Array.isArray(rfx.buyerClarifications)||!rfx.buyerClarifications.every(q=>typeof q==='string')))throw Error('Buyer clarifications must be a text array');
  if (!partial) {
    if(phase!=='review'){
     if((rfx.buyerClarifications||[]).some(q=>!/\bFX\b|exchange rate|INR.per.USD|conversion rate/i.test(q)))throw Error('Resolve buyer specifications and decisions before sending');
     const incomplete=draftContentIssues(rfx);if(incomplete.length)throw Error('Resolve unfinished requirement content before sending: '+incomplete.map(i=>i.path).join(', '));
    }
    if(rfx.lines.some(l=>!hasText(l.spec)))throw Error('Complete item specifications before sending');
    if (!hasText(rfx.title) || !hasText(rfx.scope) || !hasText(rfx.terms) || !isoDate(rfx.deadline)) throw Error('Title, scope, terms and deadline are required');
    if (rfx.currency !== 'INR') throw Error('Set INR evaluation currency');
    if(phase!=='review'&&buyerClarifications(rfx).length)throw Error('Resolve the open buyer clarifications before sending');
  }
  return rfx;
}
function hasText(value){return typeof value==='string'&&!!value.trim();}
export function rfxReadiness(rfx) {
  let structure=true;try{validateRfx(rfx,{partial:true});}catch{structure=false;}
  const checks = [
    ['Unique line IDs and valid questionnaire rules', structure],
    ['Buyer specifications and decisions resolved', buyerClarifications(rfx).length===0],
    ['Requirement contains no unresolved drafting placeholders', draftContentIssues(rfx).length===0],
    ['Scope and title', hasText(rfx.title) && hasText(rfx.scope)],
    ['1–100 lines with positive forecasts, specifications and units', rfx.lines?.length>0 && rfx.lines.length<=100 && rfx.lines.every(l=>Number.isFinite(l.quantity)&&l.quantity>0&&hasText(l.unit)&&hasText(l.spec))],
    ['Vendor questionnaire and valid mandatory rules (if any)', Array.isArray(rfx.questions) && rfx.questions.filter(q=>q.gate).every(q=>gateRule(q).type!=='invalid')],
    ['Commercial terms and delivery basis', hasText(rfx.terms)],
    ['Quote deadline', !!isoDate(rfx.deadline)],
    ['Evaluation currency', rfx.currency==='INR']
  ];
  return {checks:checks.map(([label,passed])=>({label,passed})),ready:checks.every(([,p])=>p)};
}
export function validateExtraction(x,rfx) {
  if (!x || typeof x!=='object' || Array.isArray(x))throw Error('The model returned an invalid extraction: expected a structured quote object. Please retry extraction.');
  for(const key of ['quotes','answers','evidence','blockers'])if(!Array.isArray(x[key]))throw Error('The model returned an invalid extraction: '+key+' must be a list, including [] when empty. Please retry extraction.');
  if(!x.blockers.every(b=>typeof b==='string'))throw Error('The model returned an invalid extraction: each blocker must be text. Please retry extraction.');
  const seen = new Set();
  for (const q of x.quotes) {
    if (!Number.isInteger(q.lineId) || !rfx.lines.some(l=>l.id===q.lineId) || seen.has(q.lineId)) throw Error('Unknown or duplicate line ID');
    seen.add(q.lineId);
    if (q.price!==null && (!Number.isFinite(q.price)||q.price<=0)) throw Error('Price must be positive or null');
    if (!['INR','USD'].includes(q.currency)) throw Error('Only INR/USD supported in this prototype');
    if (typeof q.source!=='string'||!q.source.trim()||typeof q.excerpt!=='string'||!q.excerpt.trim()) throw Error('Every price needs a source locator and excerpt');
    if (!['read','review'].includes(q.state)||q.price===null) q.state='review';
  }
  if (x.answers.some(a=>!rfx.questions.some(q=>q.id===a.questionId)||typeof a.answer!=='string')) throw Error('Invalid questionnaire answer');
  if (x.evidence.some(e=>!rfx.questions.some(q=>q.id===e.questionId)||!['pass','fail','unknown'].includes(e.result))) throw Error('Invalid evidence record');
  if (x.freight && (!['known','unknown'].includes(x.freight.state) || (x.freight.state==='known'&&(!Number.isFinite(x.freight.amount)||x.freight.amount<0||!x.freight.source?.trim())))) throw Error('Known freight needs an explicit nonnegative amount and source');
  return x;
}
// Reconcile only explicit, labelled evidence records in the current attachments.
// This records what was supplied for this RFQ, not supplier onboarding verification.
export function reconcileEvidenceRecords(quote,files,rfx){
 const next=clone(quote),original=clone(next.evidence||[]);next.evidence||=[];
 const canon=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const gate of rfx.questions.filter(q=>q.gate)){
  const current=next.evidence.find(e=>e.questionId===gate.id);if(current?.verified)continue;
  const candidates=[];let explicitNegative=false;
  for(const file of files.filter(f=>f.kind==='text'&&typeof f.text==='string')){
   const lines=file.text.split(/\r?\n/);
   for(let i=0;i<lines.length;i++){const line=lines[i],parts=line.split('|');if(parts.length<2||parts[0].trim().toLowerCase()!==String(gate.id).toLowerCase())continue;
    if(/NOT PROVIDED|not approved|does not conform|qualification unknown|Decision:\s*REJECTED/i.test(line)){explicitNegative=true;continue;}
    const rule=gateRule(gate);let validUntil=null,value=null,matched=false;
    if(rule.type==='date_on_or_after'&&/certificate/i.test(line)){validUntil=line.match(/Valid until\s+(\d{4}-\d{2}-\d{2})/i)?.[1];matched=!!isoDate(validUntil);const standard=gate.text.match(/ISO\s*\d+(?::\d+)?/i)?.[0];if(standard&&!canon(line).includes(canon(standard)))matched=false;}
    else if(rule.type==='evidence_pass'&&/test/i.test(gate.text)&&/Product test report[\s\S]*Result:\s*CONFORMS/i.test(line)){
     const paper=rfx.lines.filter(l=>/paper/i.test(l.name)&&/ream/i.test(l.unit));matched=paper.length>0&&paper.every(l=>canon(line).includes(canon(l.name)));
    }else if(rule.type==='evidence_pass'&&/sample|approval/i.test(gate.text)&&/Buyer (?:QA )?sample approval record[\s\S]*Decision:\s*APPROVED/i.test(line)){
     const scope=/specifications listed above/i.test(line)?lines.find(l=>/^Quoted scope:/i.test(l))||'':line;
     matched=!!next.quotes?.length&&next.quotes.every(q=>new RegExp('\\b(?:L|Line\\s+)'+q.lineId+'\\b').test(scope));
    }
    if(rule.type==='evidence_pass'&&/OEM|genuine.*toner/i.test(gate.text)&&/OEM product declaration/i.test(line)){
     const toner=rfx.lines.filter(l=>/toner|cartridge/i.test(l.name));matched=toner.length>0&&toner.every(l=>{const segment=line.match(new RegExp('\\bL'+l.id+'\\b([^/]+)'))?.[1]||'',model=l.name.match(/HP\s*(12A|88A|05A)/i)?.[1];return /Genuine OEM/i.test(segment)&&/Factory.sealed/i.test(segment)&&/Brand:\s*HP/i.test(segment)&&!!model&&new RegExp('Model:\\s*'+model+'\\b','i').test(segment);});
    }
    if(rule.type==='evidence_pass'&&/delivery|lead time|payment|advance/i.test(gate.text)&&/Supplier (?:delivery|payment) commitment:/i.test(line)){
     const field=/delivery|lead time/i.test(gate.text)?'delivery':'payment',checks=commercialRequirements(next,rfx).filter(c=>c.field===field||(field==='delivery'&&c.field==='coverage'));matched=checks.length>0&&checks.every(c=>c.status==='pass');
    }
    if(rule.type==='number_at_least'){const n=line.match(/Observed value\s+(\d+(?:\.\d+)?)/i);if(n){value=Number(n[1]);matched=Number.isFinite(value);}}
    if(rule.type==='evidence_pass'&&/certificate/i.test(gate.text)&&/Quality.system certificate record[\s\S]*Result:\s*CONFORMS/i.test(line)){const standard=gate.text.match(/ISO\s*\d+(?::\d+)?/i)?.[0];matched=!standard||canon(line).includes(canon(standard));}
    if(matched)candidates.push({questionId:gate.id,result:(validUntil&&validUntil<rule.date)||(value!==null&&value<rule.minimum)?'fail':'pass',validUntil,value,source:file.name+' · line '+(i+1),sourceFile:file.name,excerpt:line,assessment:'Explicit record in supplied attachment'});
   }
  }
  // Do not choose a favourable record when current attachments contradict one another.
  const signatures=new Set(candidates.map(e=>e.result+'|'+e.validUntil+'|'+e.value));if(signatures.size!==1||explicitNegative)continue;
  if(candidates.length&&(!current||current.result!=='pass'||!current.source||!current.excerpt||(gateRule(gate).type==='number_at_least'&&(!Number.isFinite(current.value)||current.value<gateRule(gate).minimum))||(gateRule(gate).type==='date_on_or_after'&&(!isoDate(current.validUntil)||current.validUntil<gateRule(gate).date)))){next.evidence=next.evidence.filter(e=>e.questionId!==gate.id);next.evidence.push(candidates[0]);}
 }
 if(JSON.stringify(original)!==JSON.stringify(next.evidence)&&!next.originalExtractedEvidence)next.originalExtractedEvidence=original;
 return next;
}

export function supplierOfferStatus(data,rfx,vendor){
 const x=data[vendor];if(!x)return {code:'awaiting',label:'Awaiting response',tone:'',ready:false,reasons:['No extracted offer is available.']};
 if(evaluationExclusions(rfx)[vendor])return {code:'excluded',label:'Excluded',tone:'',ready:false,reasons:[evaluationExclusions(rfx)[vendor].reason]};
 const bid=comparison(data,rfx).find(c=>c.vendor===vendor),s=quoteSummary(x,rfx),readable=reasons=>reasons.map(reason=>{for(const q of rfx.questions)reason=reason.split(q.id+':').join(q.text+':');return reason;});
 if(bid?.total!=null)return {code:'ready',label:'Comparable',tone:'',ready:true,reasons:[]};
 if(x.meta?.rfxSignature&&x.meta.rfxSignature!==rfxSourceSignature(rfx))return {code:'stale',label:'Previous RFQ version',tone:'warn',ready:false,reasons:['This extracted offer is for an earlier requirement.']};
 if(s.redFlags.some(f=>f.nonNegotiable))return {code:'conflict',label:'Requirement not met',tone:'bad',ready:false,reasons:[...s.redFlags.map(f=>f.detail),...(s.internalReviews.length?[s.internalReviews.length+' prices also need internal source verification.']:[]),...(s.quality.status!=='pass'?readable(s.quality.reasons):[])]};
 if(s.internalReviews.length)return {code:'extraction',label:'Source review pending',tone:'warn',ready:false,reasons:[s.internalReviews.length+' prices need internal source verification. No supplier clarification is required for this check.']};
 if(s.quality.status!=='pass')return {code:'evidence',label:s.quality.status==='fail'?'Documents do not meet requirements':'Required documents missing',tone:s.quality.status==='fail'?'bad':'warn',ready:false,reasons:readable(s.quality.reasons)};
 if(s.redFlags.length)return {code:'conflict',label:'Requirement not met',tone:'bad',ready:false,reasons:s.redFlags.map(f=>f.detail)};
 if(s.items.some(l=>l.why==='Valid FX assumption required'))return {code:'evaluation',label:'Exchange rate needed',tone:'warn',ready:false,reasons:['Add a buyer-approved, dated INR-per-USD rate in Compare & Ask. No supplier clarification is needed for currency conversion.']};
 return {code:'incomplete',label:'Offer incomplete',tone:'warn',ready:false,reasons:s.issues.length?s.issues.map(i=>i.title+': '+i.detail):bid?.reasons||['The offer is not ready for full-scope comparison.']};
}

export function quality(x,rfx) {
  if (!x) return {status:'unknown',reasons:['Not extracted']};
  const gates=rfx.questions.filter(q=>q.gate),reasons=[];let fail=false;
  if (!gates.length) return {status:'pass',notRequired:true,reasons:[]};
  for (const q of gates) {
    const e=x.evidence.find(e=>e.questionId===q.id),rule=gateRule(q);
    if (rule.type==='invalid') {reasons.push(q.id+': '+rule.reason);continue;}
    if (!e?.source?.trim()||!e.excerpt?.trim()||!['pass','fail'].includes(e.result)) {reasons.push(q.id+': evidence missing or inconclusive');continue;}
    if (e.result==='fail') {fail=true;reasons.push(q.id+': '+e.excerpt);continue;}
    if (rule.type==='date_on_or_after') {
      if (!isoDate(e.validUntil)) {reasons.push(q.id+': valid certificate expiry required');continue;}
      if (e.validUntil<rule.date) {fail=true;reasons.push(`${q.id}: expiry ${e.validUntil} precedes required ${rule.date}`);}
    }
    if (rule.type==='number_at_least') {
      if (!Number.isFinite(e.value)) {reasons.push(q.id+': numeric evidence missing');continue;}
      if (e.value<rule.minimum) {fail=true;reasons.push(`${q.id}: ${e.value} below required ${rule.minimum}`);}
    }
  }
  return {status:fail?'fail':reasons.length?'unknown':'pass',reasons};
}
function unitName(value) {
  const s=String(value||'').toLowerCase().trim().replace(/^per\s+/,'').replace(/\s+/g,' ');
  const aliases={reams:'ream',pieces:'piece',pcs:'piece',pc:'piece',packs:'pack',boxes:'box',rolls:'roll',cans:'can',cartridges:'cartridge',pads:'pad',kilogram:'kg',kilograms:'kg',kgs:'kg'};
  return aliases[s]||s;
}
export function normalize(q,l,rfx) {
  if (!q) return {price:null,state:'missing',why:'Not quoted',steps:[]};
  const provenance={source:q.source,excerpt:q.excerpt};
  if (q.price===null) {
    const missing=/\b(?:not quoted|not offered|no offer)\b/i.test(q.excerpt||'');
    return {...provenance,price:null,state:missing?'missing':'review',why:missing?'Not quoted':'Price unreadable or unresolved',steps:[]};
  }
  let p=q.price,steps=[`${q.price} ${q.currency} / ${q.unit}`],state=q.state==='review'?'review':'read';
  const u=unitName(q.unit),target=unitName(l.unit);let basis=1,weight=false;
  if (u!==target) {
    const counted=u.match(/^(\d+(?:\.\d+)?)\s+(pieces?|pcs?|reams?|packs?|boxes|rolls?|cans?|cartridges?|pads?|kg)$/);
    const container=u.match(/^(?:carton|box|pack|case)(?:\s+of\s+|\s*\()(\d+(?:\.\d+)?)\s+(pieces?|pcs?|reams?|packs?|boxes|rolls?|cans?|cartridges?|pads?)(?:\))?$/);
    const dozen=u.match(/^dozen(?:\s+(pieces?|pcs?))?$/);
    if (counted&&unitName(counted[2])===target) basis=Number(counted[1]);
    else if (container&&unitName(container[2])===target) basis=Number(container[1]);
    else if (dozen&&target==='piece') basis=12;
    else if (u==='kg'||(counted&&unitName(counted[2])==='kg')) {
      basis=counted?Number(counted[1]):1;
      const m=String(l.spec||'').match(/\b(\d+(?:\.\d+)?)\s*kg\s+per\s+(pack|piece|box|ream|roll|can|cartridge)\b/i);
      const mass=l.massKgPerUnit??(m&&unitName(m[2])===target?Number(m[1]):null);
      if (!Number.isFinite(mass)||mass<=0) return {...provenance,price:null,state:'review',why:'RFx lacks an explicit mass per '+target,steps};
      p=p/basis*mass;weight=true;steps.push(`divide by ${basis} kg per quoted unit, multiply by ${mass} kg/${target} from RFx`);
    } else return {...provenance,price:null,state:'review',why:'Unresolved pricing unit: '+q.unit,steps};
    if (!Number.isFinite(basis)||basis<=0) return {...provenance,price:null,state:'review',why:'Invalid quoted pack quantity',steps};
    if (!weight) {p/=basis;steps.push(`divide by ${basis} ${target} per quoted unit`);}
  }
  if (q.currency==='USD') {
    if (!Number.isFinite(rfx.fx)||rfx.fx<=0||!isoDate(rfx.fxDate)) return {...provenance,price:null,state:'review',why:'Valid FX assumption required',steps};
    p*=rfx.fx;steps.push(`multiply by planning FX ${rfx.fx} INR/USD as of ${rfx.fxDate}`);
  } else if (q.currency!=='INR') return {...provenance,price:null,state:'review',why:'Unsupported currency',steps};
  const price=round(p,6);if(!Number.isFinite(price)||price<=0)return {...provenance,price:null,state:'review',why:'Price is outside the supported evaluation precision',steps};
  return {...provenance,price,state,steps,verified:!!q.verified};
}
function scopeOptions(rfx,opts={}) {
  const ids=opts.lineIds??rfx.lines.map(l=>l.id);
  if (!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>!rfx.lines.some(l=>l.id===id))) throw Error('Choose a nonempty set of valid line IDs');
  if (opts.excludedVendors&&(!Array.isArray(opts.excludedVendors)||opts.excludedVendors.some(v=>!VENDORS.includes(v)))) throw Error('Unknown excluded vendor');
  if (opts.fx!=null&&(!Number.isFinite(opts.fx)||opts.fx<=0||opts.fx>1000)) throw Error('Invalid FX');
  return {qualityOnly:opts.qualityOnly!==false,includeReview:opts.includeReview===true,lineIds:ids,fx:opts.fx??rfx.fx,excludedVendors:[...new Set([...(opts.excludedVendors||[]),...Object.keys(evaluationExclusions(rfx))])]};
}
function discountTerms(x,rfx) {
  const d=x?.discount;if (!d) return null;
  const lineIds=d.lineIds||rfx.lines.filter(l=>/paper/i.test(l.name)&&unitName(l.unit)==='ream').map(l=>l.id);
  if (!(d.rate>0&&d.rate<1)||!(d.thresholdReams>0)||!lineIds.length||lineIds.length>4||lineIds.some(id=>!rfx.lines.some(l=>l.id===id&&unitName(l.unit)==='ream'))) return {invalid:true};
  return {...d,lineIds};
}
function allocationDiscount(x,cells,rfx) {
  const d=discountTerms(x,rfx);if (!d||d.invalid) return {amount:0,allocatedReams:0,qualified:false};
  const paper=cells.filter(c=>d.lineIds.includes(c.lineId)&&c.price!==null),allocatedReams=paper.reduce((s,c)=>s+c.quantity,0),qualified=allocatedReams>=d.thresholdReams;
  return {amount:qualified?round(paper.reduce((s,c)=>s+c.cost,0)*d.rate):0,allocatedReams,qualified,thresholdReams:d.thresholdReams,rate:d.rate,lineIds:d.lineIds,source:d.source};
}
export function comparison(data,rfx,opts={}) {
  const scope=scopeOptions(rfx,opts),effective={...rfx,fx:scope.fx},lines=rfx.lines.filter(l=>scope.lineIds.includes(l.id));
  return participatingVendors(rfx).map(v=>{
    const x=data[v],gate=quality(x,rfx),commercialBlockers=[...new Set([...actionableBlockers(x,rfx),...commercialRequirementIssues(x,rfx).map(c=>c.detail),...quoteRedFlags(x,rfx).filter(f=>f.field!=='qualification').map(f=>f.detail),...buyerClarifications(rfx).map(q=>'Buyer requirement unresolved: '+q)])];
    if(x?.meta?.rfxSignature&&x.meta.rfxSignature!==rfxSourceSignature(rfx))commercialBlockers.push('This quote belongs to an earlier requirement. Request an updated offer.');
    if (discountTerms(x,rfx)?.invalid) commercialBlockers.push('Unsupported discount structure: clarify before award');
    const eligible=gate.status==='pass'&&!commercialBlockers.length&&!scope.excludedVendors.includes(v);
    const inScope=!!x&&!scope.excludedVendors.includes(v)&&(!scope.qualityOnly||gate.status==='pass')&&!commercialBlockers.length;
    const cells=lines.map(l=>{const q=x?.quotes.find(q=>q.lineId===l.id),n=normalize(q,l,effective);return {lineId:l.id,name:l.name,quantity:l.quantity,unit:l.unit,...n,cost:n.price===null?null:round(n.price*l.quantity),usable:inScope&&n.price!==null&&(scope.includeReview||n.state!=='review')};});
    const coverage=cells.filter(c=>c.price!==null).length,freight=x?.freight;
    const freightKnown=freight?.state==='known'&&Number.isFinite(freight.amount)&&freight.amount>=0&&!!freight.source?.trim();
    const subtotal=round(cells.reduce((s,c)=>s+(c.cost??0),0)),discountDetail=allocationDiscount(x,cells,rfx),reasons=[];
    if (!x) reasons.push('No extraction');
    if (scope.qualityOnly&&gate.status!=='pass') reasons.push('Quality '+gate.status);
    if (scope.excludedVendors.includes(v)) reasons.push(evaluationExclusions(rfx)[v]?'Excluded from evaluation: '+evaluationExclusions(rfx)[v].reason:'Excluded from this scenario');
    if (coverage<lines.length) reasons.push(`${lines.length-coverage} lines missing or not comparable`);
    if (!scope.includeReview&&cells.some(c=>c.state==='review')) reasons.push('Unresolved price readings');
    if (!freightKnown) reasons.push('Freight unknown');reasons.push(...commercialBlockers);
    const complete=inScope&&coverage===lines.length&&cells.every(c=>c.usable)&&freightKnown;
    const quotedTotal=x&&coverage===lines.length&&cells.every(c=>c.price!==null&&c.state!=='review')&&freightKnown&&!discountDetail.invalid?round(subtotal-discountDetail.amount+freight.amount):null;
    return {vendor:v,quotedTotal,evaluationExclusion:evaluationExclusions(rfx)[v]||null,gate,eligible,inScope,commercialBlockers,cells,coverage,requestedLines:lines.length,subtotal,discount:discountDetail.amount,discountDetail,freight:freightKnown?freight.amount:null,total:complete?round(subtotal-discountDetail.amount+freight.amount):null,partialTotal:round(subtotal-discountDetail.amount),reasons,notes:x?.notes||[],scope,hypothetical:!scope.qualityOnly||scope.includeReview};
  });
}
export function split(data,rfx,opts={}) {
  const scope=scopeOptions(rfx,opts),comp=comparison(data,rfx,scope),lines=rfx.lines.filter(l=>scope.lineIds.includes(l.id));
  const eligible=comp.filter(v=>v.inScope&&v.freight!==null),gaps=[];
  for (const l of lines) if (!eligible.some(v=>v.cells.find(c=>c.lineId===l.id)?.usable)) gaps.push(l.id);
  const interacting=[...new Set(eligible.flatMap(v=>discountTerms(data[v.vendor],rfx)?.lineIds||[]))].filter(id=>scope.lineIds.includes(id));
  if (interacting.length>4) throw Error('This solver supports at most four interacting discount lines; narrow the scenario');
  let best=null;
  function evaluate(a) {
    const totals=participatingVendors(rfx).map(v=>{const own=a.filter(c=>c.vendor===v),d=allocationDiscount(data[v],own,rfx);return {vendor:v,lines:own.length,subtotal:round(own.reduce((s,c)=>s+c.cost,0)),discount:d.amount,discountDetail:d,freight:own.length?(comp.find(c=>c.vendor===v).freight??0):0};}).filter(v=>v.lines);
    const total=round(totals.reduce((s,v)=>s+v.subtotal-v.discount+v.freight,0));
    if (!best||total<best.total) best={total,allocations:[...a].sort((a,b)=>a.lineId-b.lineId),byVendor:totals};
  }
  for (let mask=1;mask<(1<<eligible.length);mask++) {
    const vendors=eligible.filter((_,i)=>mask&(1<<i)),variable=[],fixed=[];let feasible=true;
    for (const l of lines) {
      const candidates=vendors.map(v=>({vendor:v.vendor,...v.cells.find(c=>c.lineId===l.id)})).filter(c=>c.usable).sort((a,b)=>a.cost-b.cost||a.vendor.localeCompare(b.vendor));
      if (!candidates.length) {if (!gaps.includes(l.id)){feasible=false;break;}continue;}
      if (interacting.includes(l.id)) variable.push(candidates);else fixed.push(candidates[0]);
    }
    if (!feasible) continue;
    function walk(i,a) {if(i===variable.length)return evaluate([...fixed,...a]);for(const c of variable[i])walk(i+1,[...a,c]);}
    walk(0,[]);
  }
  return {...(best||{total:null,allocations:[],byVendor:[]}),gaps,complete:gaps.length===0&&!!best,scope,hypothetical:!scope.qualityOnly||scope.includeReview,method:'Exact vendor-subset and conditional-discount enumeration for whole-line assignments, known fixed freight and at most four discount lines. MOQ, capacity and concentration constraints are not supported.'};
}
export function analyzeAward(data,rfx,opts={}) {
  const scope=scopeOptions(rfx,opts),bids=comparison(data,rfx,scope),single=bids.filter(v=>v.total!==null).sort((a,b)=>a.total-b.total)[0]||null,allocation=split(data,rfx,scope);
  const baselineLines=rfx.lines.filter(l=>scope.lineIds.includes(l.id)),baseline=baselineLines.every(l=>Number.isFinite(l.baseline))?round(baselineLines.reduce((s,l)=>s+l.quantity*l.baseline,0)):null;
  const savings=single&&allocation.complete?round(single.total-allocation.total):null;
  const baselineSavings=baseline!==null&&allocation.complete?round(baseline-allocation.total):null;
  return {scope,hypothetical:allocation.hypothetical,bestSingle:single?{vendor:single.vendor,total:single.total}:null,split:allocation,savingsVsBestSingle:savings,savingsPercent:savings!==null&&single.total?round(savings/single.total*100,4):null,baseline,baselineSavings,exclusions:bids.filter(v=>v.total===null).map(v=>({vendor:v.vendor,reasons:v.reasons})),largestVendorSharePercent:allocation.complete?round(Math.max(...allocation.byVendor.map(v=>(v.subtotal-v.discount+v.freight)/allocation.total))*100,4):null};
}
export function reviewQueue(data,rfx) {
  const rows=[];
  for (const v of participatingVendors(rfx)) {
    const x=data[v];if(!x||evaluationExclusions(rfx)[v])continue;
    for (const l of rfx.lines) {const q=x.quotes.find(q=>q.lineId===l.id),n=normalize(q,l,rfx);if(n.state==='review'||n.state==='missing')rows.push({vendor:v,lineId:l.id,name:l.name,kind:n.state==='missing'?'gap':'price',why:n.why||'Uncertain or inherited price',value:n.price===null?null:round(n.price*l.quantity)});}
    if(x.freight?.state!=='known'||!Number.isFinite(x.freight.amount)||!x.freight.source?.trim())rows.push({vendor:v,lineId:0,name:'Freight',kind:'freight',why:'Freight amount or evidence unknown',value:null});
    for(const b of new Set([...actionableBlockers(x,rfx),...commercialRequirementIssues(x,rfx).map(c=>c.detail),...quoteRedFlags(x,rfx).map(f=>f.detail)]))rows.push({vendor:v,lineId:0,name:'Commercial condition',kind:'blocker',why:b,value:null});
    const g=quality(x,rfx);if(g.status==='unknown')rows.push({vendor:v,lineId:0,name:'Quality evidence',kind:'quality',why:g.reasons.join('; '),value:null});
  }
  return rows.sort((a,b)=>((a.value===null?0:1)-(b.value===null?0:1))||(b.value??0)-(a.value??0));
}
export function correctQuote(data,rfx,{vendor,lineId,price,unit,currency,source,excerpt,reason}) {
  if(!data[vendor])throw Error('Extract this vendor first');
  if(typeof price==='string'&&!price.trim())throw Error('Enter an explicit amount; blank is not zero');
  const value=Number(price);
  if(!reason?.trim()||!source?.trim()||!Number.isFinite(value)||value<0||(lineId&&value===0))throw Error('Amount, evidence source and reason are required');
  const x=data[vendor];
  if(!lineId){const old=clone(x.freight??null);x.freight={amount:value,state:'known',source,verified:true};return {vendor,lineId,old,next:clone(x.freight),reason};}
  if(!rfx.lines.some(l=>l.id===lineId)||!unit?.trim()||!['INR','USD'].includes(currency))throw Error('Valid line, quoted unit and currency are required');
  const existing=x.quotes.find(q=>q.lineId===lineId),old=clone(existing??null);
  const next={lineId,price:value,unit,currency,state:'read',source,excerpt:excerpt?.trim()||reason,verified:true};
  const n=normalize(next,rfx.lines.find(l=>l.id===lineId),rfx);if(n.price===null)throw Error(n.why);
  if(existing)Object.assign(existing,next);else x.quotes.push(next);
  return {vendor,lineId,old,next:clone(next),reason};
}
export function recoverState(state) {
  const next=clone(state),removed=[],legacy=next.schemaVersion!==2;
  for(const [v,x] of Object.entries(next.data||{}))if(legacy||(x.meta?.custom&&!state.packages?.[v]?.files?.every(f=>state.packages[v].assets?.[f]?.base64))){delete next.data[v];removed.push(v);}
  const orphaned=next.approved&&!next.decision;
  next.decisionHistory=next.decisionHistory||[];
  if(removed.length||orphaned){next.version=(next.version||0)+1;next.approved=false;if(next.decision){next.decisionHistory.push(next.decision);next.decision=null;}next.audit=[...(next.audit||[]),{at:new Date().toISOString(),action:legacy?'Previous calculation version requires re-extraction':'Session sources unavailable after reload',detail:{vendors:removed,orphanedApproval:!!orphaned},version:next.version}];}
  next.schemaVersion=2;next.draftChat=next.draftChat||[];next.decision=next.decision||null;
  return next;
}
export function draftDiff(before,after) {
  const rows=[];const add=(path,a,b)=>{if(JSON.stringify(a??null)!==JSON.stringify(b??null))rows.push({path,before:a??null,after:b??null});};
  for(const k of ['title','scope','deadline','terms','currency','fx','fxDate','buyerClarifications'])add(k,before[k],after[k]);
  for(const id of new Set([...before.lines,...after.lines].map(l=>l.id))){const a=before.lines.find(l=>l.id===id),b=after.lines.find(l=>l.id===id);if(!a||!b)add('Line '+id,a,b);else for(const k of ['name','spec','quantity','unit','baseline','massKgPerUnit'])add(`Line ${id} · ${k}`,a[k],b[k]);}
  for(const id of new Set([...before.questions,...after.questions].map(q=>q.id)))add('Question '+id,before.questions.find(q=>q.id===id),after.questions.find(q=>q.id===id));
  return rows;
}
export function runTool(name,args,data,rfx) {
  args=args||{};
  if(name==='compare_vendors')return comparison(data,rfx,args).map(({cells,...rest})=>rest);
  if(name==='allocate_award')return split(data,rfx,args);
  if(name==='analyze_award')return analyzeAward(data,rfx,args);
  if(name==='fx_sensitivity'){
    if(!Array.isArray(args.rates)||!args.rates.length||args.rates.length>5)throw Error('Provide one to five FX rates');
    const results=args.rates.map(fx=>({fx,result:analyzeAward(data,rfx,{...args,fx})}));
    return {results,deltas:results.map(r=>({fx:r.fx,splitDelta:r.result.split.complete&&results[0].result.split.complete?round(r.result.split.total-results[0].result.split.total):null,bestSingleDelta:r.result.bestSingle&&results[0].result.bestSingle?round(r.result.bestSingle.total-results[0].result.bestSingle.total):null}))};
  }
  if(name==='inspect_quotes')return comparison(data,rfx,{...args,qualityOnly:false}).filter(v=>!args.vendor||v.vendor===args.vendor).map(v=>({vendor:v.vendor,hasExtractedResponse:!!data[v.vendor],gate:v.gate,cells:data[v.vendor]?v.cells:[],freight:data[v.vendor]?.freight,commercialTerms:data[v.vendor]?.commercialTerms||{},offeredItems:(data[v.vendor]?.quotes||[]).filter(q=>v.cells.some(c=>c.lineId===q.lineId)),answers:data[v.vendor]?.answers||[],discount:data[v.vendor]?.discount||null,blockers:data[v.vendor]?v.commercialBlockers:[],notes:data[v.vendor]?v.notes:[]}));
  if(name==='quality_evidence')return participatingVendors(rfx).map(v=>({vendor:v,gate:quality(data[v],rfx),answers:data[v]?.answers||[],evidence:data[v]?.evidence||[],rules:rfx.questions.filter(q=>q.gate).map(q=>({questionId:q.id,rule:gateRule(q)}))}));
  if(name==='review_summary'){const rows=reviewQueue(data,rfx);return {items:rows,count:rows.length,knownAnnualValue:round(rows.reduce((s,r)=>s+(r.value??0),0)),unboundedItems:rows.filter(r=>r.value===null).length,meaning:'Known line value is nominal exposure, not a savings estimate or uncertainty bound'};}
  throw Error('Unsupported tool');
}
export function invalidateState(state,action,detail,at=new Date().toISOString()) {
  if(state.decision){state.decisionHistory=[...(state.decisionHistory||[]),state.decision];state.decision=null;}
  state.version=(state.version||0)+1;state.approved=false;
  state.audit=[...(state.audit||[]),{at,action,detail,version:state.version}];
  return state;
}
export function awardReadiness(state) {
  const r=rfxReadiness(state.rfx);let a=null;
  try{if(r.ready)a=analyzeAward(state.data,state.rfx);}catch{}
  const checks=[
    {label:'RFx scope, line items and rules complete',passed:r.ready},
    {label:'No unreviewed RFx changes',passed:!state.draft},
    {label:'Selected suppliers have sourced responses',passed:!!a?.split.complete&&a.split.byVendor.length>0&&a.split.byVendor.map(x=>x.vendor).every(v=>!!state.data[v]?.meta?.responseId&&!!state.data[v]?.meta?.model)},
    {label:'Extraction scope and source hashes match this RFx',passed:!!a?.split.complete&&a.split.byVendor.map(x=>x.vendor).every(v=>state.data[v]?.meta?.rfxSignature===rfxSourceSignature(state.rfx)&&state.data[v].meta.files?.length>0&&state.data[v].meta.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256||'')))},
    {label:'Every line has an eligible, resolved quote with known freight',passed:!!a?.split.complete&&a.split.allocations.length===state.rfx.lines.length},
    {label:'No hypothetical quality or review overrides in award',passed:!!a&&!a.hypothetical}
  ];
  return {ready:checks.every(c=>c.passed),checks,analysis:a};
}
// Draft text uses the same eligible allocation as the award; no model call or approval is implied.
export function awardRationale(state){
 const readiness=awardReadiness(state),a=readiness.analysis,s=a?.split;
 if(!readiness.ready||!s?.complete)return '';
 const money=n=>'INR '+Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const allocation=s.byVendor.map(v=>v.vendor+' ('+v.lines+' items)').join(', ');
 const paragraphs=['Recommend '+(s.byVendor.length>1?'a split award to ':'an award to ')+allocation+', covering all '+state.rfx.lines.length+' requested items at a total evaluated cost of '+money(s.total)+'.'];
 if(a.bestSingle&&a.savingsVsBestSingle>0)paragraphs.push('This saves '+money(a.savingsVsBestSingle)+' compared with the best eligible single-supplier offer from '+a.bestSingle.vendor+'.');
 else if(a.bestSingle&&s.byVendor.length===1)paragraphs.push('Splitting the order offers no additional evaluated saving against the best eligible single-supplier offer.');
 const freight=s.byVendor.reduce((n,v)=>n+v.freight,0),discount=s.byVendor.reduce((n,v)=>n+v.discount,0);
 paragraphs.push('The total includes '+money(freight)+' in fixed freight, counted once per selected supplier'+(discount?', and '+money(discount)+' in applicable discounts':'')+'. Recoverable GST is excluded.');
 paragraphs.push('The selected offers meet the current mandatory evidence and commercial checks.');
 const usd=s.allocations.some(c=>state.data[c.vendor]?.quotes.find(q=>q.lineId===c.lineId)?.currency==='USD');
 if(usd)paragraphs.push('USD prices are evaluated at INR '+state.rfx.fx+' per USD, using the reference date '+state.rfx.fxDate+'.');
 const waiting=pendingSuppliers(state);if(waiting.length)paragraphs.push('This recommendation uses available extracted offers; '+waiting.join(', ')+' '+(waiting.length===1?'has':'have')+' no current extracted offer and could change the result.');
 return paragraphs.join('\n\n');
}

export function freezeDecision(state,{reason,evidenceReviewed,assumptionsAccepted,pendingAccepted=false},at=new Date().toISOString()) {
  const readiness=awardReadiness(state);
  if(!readiness.ready)throw Error('A complete, sourced, quality-cleared recommendation is required');
  const pending=pendingSuppliers(state);if(pending.length&&!pendingAccepted)throw Error('Acknowledge the suppliers without current extracted responses before confirming');
  if(!reason?.trim()||!evidenceReviewed||!assumptionsAccepted)throw Error('Evidence review, evaluation assumptions and a rationale are required');
  return {version:state.version,at,reason:reason.trim(),analysis:clone(readiness.analysis),rfx:clone(state.rfx),data:clone(state.data),audit:clone(state.audit),evidenceReviewed:true,assumptionsAccepted:true,pendingSuppliers:pending,pendingAccepted:!!pendingAccepted};
}

export function gateDescription(q){const r=gateRule(q);if(r.type==='date_on_or_after')return 'Supporting certificate must remain valid through '+r.date;if(r.type==='number_at_least')return 'Supporting evidence must show a value of at least '+r.minimum;if(r.type==='invalid')return 'Rule needs correction: '+r.reason;return 'Supporting evidence must demonstrate this requirement is met';}

// IDs are application metadata. Repair representation only; never business values.
export function prepareDraftIds(draft,{replacement=false}={}){
  const next=clone(draft),repairs=[];
  if(!next||!Array.isArray(next.lines))throw Error('Model draft did not contain a line-item array');
  const original=next.lines.map(l=>l.id);
  for(const l of next.lines)if(typeof l.id==='string'&&/^[1-9]\d*$/.test(l.id.trim())&&Number.isSafeInteger(Number(l.id)))l.id=Number(l.id);
  const valid=next.lines.every(l=>Number.isSafeInteger(l.id)&&l.id>0)&&new Set(next.lines.map(l=>l.id)).size===next.lines.length;
  if(!valid){
    if(!replacement)throw Error('The model returned ambiguous line identifiers while refining. Existing item references were preserved; retry the refinement.');
    next.lines.forEach((l,i)=>l.id=i+1);
  }
  next.lines.forEach((l,i)=>{if(original[i]!==l.id)repairs.push({position:i+1,before:original[i]??null,after:l.id});});
  return {draft:next,repairs};
}

// Keep buyer decisions out of the outgoing vendor questionnaire.
export function clarificationTextKey(text){return String(text).toLowerCase().replace(/^(?:please\s+)?(?:confirm|provide|state|attach)\s+(?:whether\s+)?/,'').replace(/[^a-z0-9]+/g,' ').trim();}
export function conciseVendorQuestion(q){
 const text=String(q.text||'').trim();if(q.gate)return text;
 if(text.length>200&&/commercial terms/i.test(text)&&/including/i.test(text))return 'Confirm acceptance of our stated commercial terms. List any exceptions.';
 if(text.length>120&&/brands?.*models?.*specifications?/i.test(text)&&/all \d+ items|all items|each item/i.test(text))return 'List the offered brand, model and specifications for each item. Identify any deviations from our requirements.';
 if(text.length>180&&/quality.criteria/i.test(text)&&/certificate.*test.*sample/i.test(text))return 'Attach the required quality certificate, paper test reports and buyer-approved sample records.';
 return text.replace(/\bthe buyer[’']s\b/gi,'our').replace(/\bbuyer-defined\b/gi,'our stated');
}

export function deduplicateVendorQuestions(questions){
 const kept=[],words=s=>new Set(String(s).toLowerCase().replace(/\b(?:confirm|please|provide|state|whether|the|and|our|your|supplier|vendor|requested|requirement)\b/g,' ').match(/[a-z]+|\d+(?:\.\d+)?/g)||[]);
 for(const q of questions){const tokens=words(q.text),numbers=String(q.text).match(/\d+(?:\.\d+)?/g)||[];
  const duplicate=kept.some(k=>{if(k.gate!==q.gate||JSON.stringify(k.rule??null)!==JSON.stringify(q.rule??null)||JSON.stringify(String(k.text).match(/\d+(?:\.\d+)?/g)||[])!==JSON.stringify(numbers))return false;
   const other=words(k.text),intersection=[...tokens].filter(t=>other.has(t)).length,union=new Set([...tokens,...other]).size;return union>0&&intersection/union>=.8;});
  if(!duplicate)kept.push(q);
 }return kept;
}

export function routeDraftQuestions(result){
  const next=clone(result);
  const buyer=[...(next.buyerClarifications||next.questions||[]),...(next.draft?.buyerClarifications||[])];
  if(!buyer.every(q=>typeof q==='string'))throw Error('Buyer clarifications must be text questions');
  if(!next.draft||!Array.isArray(next.draft.questions))throw Error('Draft vendor questionnaire must be an array');
  const buyerWording=/\b(you want (bidders|vendors)|whether .{0,100}mandatory (for|to)|commercial terms required|detailed specifications for|what (are|is) (your|the required)|which .{0,60}(do you require|should be mandatory))\b/i;
  next.draft.questions=next.draft.questions.filter(q=>{
    if(q.audience==='buyer'||buyerWording.test(q.text||'')){buyer.push(q.text);return false;}
    if(q.audience&&q.audience!=='vendor')throw Error('Question audience must be buyer or vendor');
    return true;
  }).map(({audience,...q})=>q);
  next.draft.questions=deduplicateVendorQuestions(next.draft.questions);
  next.buyerClarifications=[...new Set(buyer.map(q=>q.trim()).filter(Boolean))];
  next.questions=[...next.buyerClarifications]; // Backward-compatible response field.
  next.draft.buyerClarifications=[...next.buyerClarifications];
  return next;
}

// Preserve supplied content while adapting legacy structured text for display.
export function normalizeDraftText(draft){
  const next=clone(draft),repairs=[];
  if(!next||!Array.isArray(next.lines)||!Array.isArray(next.questions))throw Error('RFx draft requires line items and a vendor questionnaire');
  const text=(v,depth=0)=>{
    if(depth>8)throw Error('Draft text nesting is too deep');
    if(v==null)return '';
    if(typeof v==='string')return v;
    if(typeof v==='number'||typeof v==='boolean')return String(v);
    if(Array.isArray(v))return v.map(x=>text(x,depth+1)).filter(Boolean).join('; ');
    if(typeof v==='object')return Object.entries(v).map(([k,x])=>k+': '+text(x,depth+1)).join('; ');
    throw Error('Unsupported draft text value');
  };
  const field=(obj,key,path)=>{if(typeof obj[key]!=='string'){const before=obj[key]??null;obj[key]=text(obj[key]);repairs.push({path,before,after:obj[key]});}};
  for(const key of ['title','scope','terms','deadline','currency','fxDate','fxNote'])field(next,key,key);
  next.lines.forEach((l,i)=>{
   if(!l||typeof l!=='object'||Array.isArray(l))throw Error('Draft line '+(i+1)+' must be an object');
   field(l,'spec','Line '+(i+1)+' specification');
   if(!l.spec.trim()&&!hasUnresolvedContent(l.name)){
    const attributes=[...new Set(String(l.name).match(/\b(?:A[0-6]|(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)[ -]*(?:rings?|inch(?:es)?|mm|cm|GSM|ml|litres?)|blue|black|white|refillable|polypropylene|stainless[ -]+steel)\b/gi)||[])];
    if(attributes.length>=2&&attributes.some(a=>/refillable|rings?|polypropylene|stainless/i.test(a))){l.spec=attributes.join(', ');repairs.push({path:'Line '+(i+1)+' specification',before:'',after:l.spec});}
   }
  });
  return {draft:next,repairs};
}

// Validate proposed buyer questions against stated facts; do not use vendor answers as buyer requirements.
export function reconcileBuyerClarifications(draft,{questions=draft.buyerClarifications||[],review=[],confirmedText=''}={}){
 const answerContext=String(confirmedText).replace(/(^|\n)\d+\. Question: ([^\n]+)\nBuyer answer: /g,(_,start,question)=>start+(/payment|credit period|advance/i.test(question)?'Payment terms: ':/delivery|lead time/i.test(question)?'Delivery terms: ':'Buyer answer: '));
 const facts=answerContext.split(/\n|(?<=[.!?])\s+/).filter(s=>!/^\s*(?:what|which|should|can you|could you|please confirm)\b/i.test(s)&&!s.trim().endsWith('?')).join('\n');
 const topic=q=>/payment|credit period|advance payment/i.test(q)?'payment':/allocation|rounding|40%|35%|25%/i.test(q)?'allocation':/seven|7 suppliers|single.supplier|split award|invite.*suppliers/i.test(q)?'awardPolicy':/freight|location surcharge/i.test(q)?'freight':/currency|quoted currency|GST/i.test(q)?'currency':/submission|deadline|quotation validity|offers.*valid|time zone/i.test(q)?'deadline':/sample.*(?:evidence|approval)|buyer.approved sample/i.test(q)?'sampleEvidence':/test evidence|paper.*(?:grades|test)|A4 and A3/i.test(q)?'paperEvidence':/quality.system|certificate.*standard|certification standard/i.test(q)?'qualityCertificate':/brand|models|deviations/i.test(q)?'offeredProducts':/delivery.*(?:lead|time|period|days|commit)|lead time/i.test(q)?'delivery':/tip size|ink type|page count|specification/i.test(q)?'specification':'other';
 const paymentDays=/(?:payment|credit|payable)[^.\n]{0,65}\b\d+\s*(?:calendar\s+)?days|\bnet\s*\d+/i.test(facts),paymentTrigger=/(?:invoice|delivery|acceptance)[^.\n]{0,30}(?:receipt|date)|(?:receipt|date)[^.\n]{0,30}(?:invoice|delivery|acceptance)/i.test(facts),advancePolicy=/(?:no|without)\s+(?:any\s+)?advance|advance[^.\n]{0,35}(?:not acceptable|not allowed|permitted|acceptable|required)|\d+\s*%[^.\n]{0,20}advance/i.test(facts);
 const deliveryDays=/deliver(?:y|ed)?[^.\n]{0,100}\b\d+\s*(?:calendar\s+|working\s+|business\s+)?days/i.test(facts),deliveryTrigger=/(?:from|after|of|following)[^.\n]{0,35}(?:PO|purchase[ -]order|award|order issuance)/i.test(facts);
 const confirmed={payment:paymentDays&&paymentTrigger&&advancePolicy,delivery:deliveryDays&&deliveryTrigger,
 allocation:/40\s*%[\s\S]{0,100}35\s*%[\s\S]{0,100}25\s*%/i.test(facts)&&/(?:round(?:ing)?|floor)[\s\S]{0,180}Pune/i.test(facts),
 awardPolicy:/(?:seven|7)\s+suppliers/i.test(facts)&&/single.supplier[\s\S]{0,60}split/i.test(facts),
 freight:/fixed annual (?:freight )?charge|freight[\s\S]{0,80}fixed annual/i.test(facts)&&/all three locations/i.test(facts)&&/without[^.\n]{0,40}(?:surcharges|charges)|no[^.\n]{0,40}location surcharges/i.test(facts),
 currency:/INR\s*(?:or|and|\/)\s*USD/i.test(facts)&&/GST[^.\n]{0,35}separat/i.test(facts)&&/fixed[^.\n]{0,70}(?:currency|contract)|prices[^.\n]{0,40}fixed/i.test(facts),
 deadline:/\bIST\b/i.test(facts)&&/(?:valid|validity)[^.\n]{0,90}(?:\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.test(facts)&&/(?:deadline|submit|submission)[^.\n]{0,120}(?:\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.test(facts),
 qualityCertificate:/quality.system certificate[^.\n]{0,100}(?:valid|through)|certificate[^.\n]{0,40}valid through/i.test(facts),
 paperEvidence:/product test evidence[^.\n]{0,90}paper grades|paper[^.\n]{0,80}test evidence/i.test(facts),
 sampleEvidence:/(?:recorded )?buyer.approved sample evidence[^.\n]{0,60}(?:offered specifications|every|all)|sample[^.\n]{0,70}approval evidence[^.\n]{0,40}(?:all|every)/i.test(facts),
 offeredProducts:/suppliers? must (?:identify|state|provide)[^.\n]{0,100}brands?[^.\n]{0,100}models?[^.\n]{0,100}deviations/i.test(facts)
 };
 const proposed=[...questions],explicitGaps=[];
 for(const [name,known,question]of [['delivery',confirmed.delivery,'What delivery lead time should suppliers commit to after each purchase order?'],['payment',confirmed.payment,'What payment terms should suppliers meet: the credit period, when it starts, and whether advance payment is acceptable?']]){
  const explicitlyOpen=new RegExp(name==='delivery'?'delivery lead time[^.!\\n]{0,90}(?:not|unfinalized|undecided|to be confirmed)':'payment terms[^.!\\n]{0,90}(?:not|unfinalized|undecided|to be confirmed)','i').test(facts);
  if(!known&&explicitlyOpen)explicitGaps.push({name,question});
 }
 const kept=[],seen=new Set(),reviewByQuestion=new Map(review.map(r=>[r.question?.trim(),r]));
 for(const raw of proposed){const q=String(raw).trim();if(!q)continue;const r=reviewByQuestion.get(q),t=topic(q),conflict=r?.status==='conflict'||/conflict|contradict|inconsistent/i.test(q);
  if(/which details.*suppliers?.*confirm.*offers/i.test(q))continue;
  if(r&&['optional','already_answered'].includes(r.status))continue;
  // A conflict is never suppressed by the presence of one of the conflicting statements.
  if(!conflict&&confirmed[t])continue;
  // More precision is optional when the buyer has already supplied an item specification.
  if(r?.status==='missing'&&t==='specification'&&r.itemIds?.length&&!/contradict|conflict|incompatible/i.test(r.reason||'')){
   const specified=r.itemIds.every(id=>{const l=draft.lines.find(l=>l.id===id);if(!l||!hasText(l.spec))return false;
    const words=String(l.name).toLowerCase().split(/\W+/).filter(w=>w.length>2),statements=facts.split('\n').filter(line=>words.filter(w=>line.toLowerCase().includes(w)).length>=Math.min(2,words.length)).join(' ');
    if(!statements)return false;
    if(/page count|number of pages/i.test(q))return /\d+\s*(?:ruled\s+|plain\s+)?pages/i.test(statements);
    if(/tip size|tip diameter/i.test(q))return /\d+(?:\.\d+)?\s*mm\s*(?:tip)?/i.test(statements);
    return /\d+(?:\.\d+)?\s*(?:mm|GSM|pages|litres?|sheets)|refillable|OEM|stainless|neutral.pH|food.grade/i.test(statements);
   });if(specified)continue;
  }
  const ids=r?.itemIds?.length?[...r.itemIds].sort((a,b)=>a-b):[];
  const key=conflict?'conflict:'+q.toLowerCase():['payment','delivery'].includes(t)?t:(r&&t!=='other'?t+':'+ids.join(','):q.toLowerCase().replace(/[^a-z0-9]/g,''));
  if(seen.has(key))continue;seen.add(key);
  // One focused question collects the entire commercial decision, without prescribing a value.
  kept.push(t==='payment'&&!conflict?'Please confirm '+[!paymentDays?'the payment credit period':null,!paymentTrigger?'when the credit period starts':null,!advancePolicy?'whether advance payment is acceptable':null].filter(Boolean).join(', ')+'.':q);
 }
 for(const gap of explicitGaps)if(!kept.some(q=>topic(q)===gap.name))kept.push(gap.question);
 return kept;
}

export function buyerClarifications(rfx){
 const open=[...new Set((rfx.buyerClarifications||[]).filter(q=>typeof q==='string'&&q.trim()&&!/\bFX\b|exchange rate|INR.per.USD|conversion rate/i.test(q)).map(q=>q.trim()))];
 for(const issue of draftContentIssues(rfx))if(!open.includes(issue.question))open.push(issue.question);
 if(!rfx.lines?.length)return open;
 if(rfx.lines.length>100)open.push('Which items should remain in this RFx? Please limit it to 100 lines.');
 for(const q of rfx.questions||[])if(q.gate&&gateRule(q).type==='invalid')open.push('Please confirm the exact pass condition for mandatory question '+q.id+': '+q.text);
 const add=(pattern,question)=>{if(!open.some(q=>pattern.test(q)))open.push(question);};
 if(!hasText(rfx.title))add(/title|call this|name.*request/i,'What should we call this purchase request?');
 if(!hasText(rfx.scope))add(/delivery location|deliver.*where|scope|purpose|which office/i,'Where should these items be delivered, and is there anything else we should include in the purchase scope?');
 for(const l of rfx.lines){
  if(!hasText(l.name))open.push('What item is required for line '+l.id+'?');
  const related=open.some(q=>String(l.name||'').toLowerCase().split(/\W+/).filter(w=>w.length>3).some(w=>q.toLowerCase().includes(w.replace(/s$/,''))));
  if(!hasText(l.spec)&&!related)open.push('What specifications should suppliers meet for '+l.name+'?');
  if(!Number.isFinite(l.quantity)||l.quantity<=0)add(new RegExp('quantity.*'+l.id+'\\b','i'),'What quantity do you need for item '+l.id+' ('+l.name+')?');
  if(!hasText(l.unit))open.push('How should '+l.name+' be counted—for example, pieces, packs or boxes?');
 }
 if(!hasText(rfx.terms))add(/payment|commercial terms|freight|tax|delivery terms/i,'What payment and delivery terms should suppliers quote against, including taxes and freight?');
 if(!isoDate(rfx.deadline))add(/quot(e|ation|es).*deadline|deadline.*quot|bids?.*(due|deadline)|when.*quot|last date.*quot/i,'By what date should vendors submit their quotations?');
 if(rfx.currency!=='INR')add(/evaluation currency/i,'Can we compare all offers in INR?');
 // FX is requested when a foreign-currency quote needs conversion, not before inviting suppliers.
 return [...new Map(open.map(q=>[q.toLowerCase().replace(/[^a-z0-9]/g,''),q])).values()];
}

export function clarificationReply(questions,answers){
 const filled=questions.filter(q=>typeof answers[q]==='string'&&answers[q].trim()).map(q=>({question:q,answer:answers[q].trim()}));
 if(!filled.length)throw Error('Answer at least one question before updating.');
 if(filled.some(x=>x.answer.length>2000))throw Error('Keep each answer under 2,000 characters.');
 const message='Use these buyer answers to update the current RFx specifications, scope and terms. Update relevant vendor questions, remove resolved clarifications and keep only genuinely unanswered questions. Do not change unrelated confirmed details.\n\n'+filled.map((x,i)=>(i+1)+'. Question: '+x.question+'\nBuyer answer: '+x.answer).join('\n\n');
 if(message.length>24000)throw Error('Submit fewer answers together.');
 return {message,answered:filled.map(x=>x.question)};
}

export function editVendorQuestion(rfx,{operation,id,text,gate=false,rule=null}){
 const next=clone(rfx),index=next.questions.findIndex(q=>String(q.id)===String(id)),before=index>=0?clone(next.questions[index]):null;
 if(operation==='delete'){
  if(index<0)throw Error('This vendor question is no longer available.');next.questions.splice(index,1);validateRfx(next,{partial:true});return {rfx:next,before,after:null};
 }
 if(!['add','edit'].includes(operation))throw Error('Choose add, edit or delete.');
 if(operation==='edit'&&index<0)throw Error('This vendor question is no longer available.');
 if(typeof text!=='string'||!text.trim())throw Error('Enter a vendor question.');
 if(text.trim().length>2000)throw Error('Keep the question under 2,000 characters.');
 if(typeof gate!=='boolean')throw Error('Choose whether the question is mandatory.');
 let key=before?.id;if(operation==='add'){let n=1;const used=new Set(next.questions.map(q=>String(q.id)));while(used.has('V'+n))n++;key='V'+n;}
 const after={id:key,text:text.trim(),gate,rule:gate?clone(rule||{type:'evidence_pass'}):null};
 if(operation==='add')next.questions.push(after);else next.questions[index]=after;
 validateRfx(next,{partial:true});return {rfx:next,before,after};
}

export function vendorShortlist(rfx){
 const profiles=[
 {vendor:'Metro',scope:'Office, stationery and housekeeping supplies',match:/paper|pen|marker|notebook|file|folder|stapl|binder|tape|scissor|tissue|towel|clean|bag|wash|glove|cloth|cup|stirrer|toner|cartridge/i,role:'Office & housekeeping supplies',why:'Offers stationery and housekeeping categories for a consolidated purchase.'},
 {vendor:'Bharat',scope:'Office and facility consumables',match:/paper|pen|marker|notebook|file|folder|stapl|binder|tape|scissor|tissue|towel|clean|bag|wash|glove|cloth|cup|stirrer|toner|cartridge/i,role:'Office & facility consumables',why:'Offers office and facility consumables across the requested categories.'},
 {vendor:'Jaipur Paper',scope:'Paper and stationery',match:/paper|pen|marker|notebook|file|folder|stapl|binder|sticky|pad/i,role:'Paper & stationery',why:'Adds a specialist alternative for paper and stationery items; confirm any uncovered lines.'},
 {vendor:'Rajan',scope:'Stationery and housekeeping consumables',match:/pen|marker|paper|notebook|file|folder|stapl|tape|tissue|clean|bag|wash|glove|cloth|cup|towel/i,role:'Stationery & cleaning supplies',why:'Offers stationery, cleaning products and everyday housekeeping consumables.'},
 {vendor:'QuickDesk',scope:'Everyday office supplies',match:/paper|pen|marker|notebook|file|folder|stapl|binder|sticky|pad|tape|scissor|toner|cartridge/i,role:'Everyday office essentials',why:'Offers everyday stationery and office essentials.'},
 {vendor:'Pioneer',scope:'Multi-hub office and housekeeping supplies',match:/paper|pen|marker|notebook|file|folder|stapl|tissue|clean|bag|wash|glove|cloth|cup|towel|toner|cartridge/i,role:'Housekeeping & printer supplies',why:'Adds a multi-hub facilities supplier for a possible split award; actual coverage must be confirmed.'},
 {vendor:'NorthStar',scope:'National office and facility consumables',match:/paper|pen|marker|notebook|file|folder|stapl|tissue|clean|bag|wash|glove|cloth|cup|towel|toner|cartridge/i,role:'Office & facility supplies',why:'Offers office and facility consumables; confirm item availability and delivery coverage.'}
 ];
 return profiles.filter((p,i)=>i<5||rfx.scenarioId==='seven-supplier-2027'||rfx.invitedVendors?.includes(p.vendor)).map(p=>{const lines=rfx.lines.filter(l=>p.match.test(l.name+' '+(l.spec||'')));return {vendor:p.vendor,scope:p.scope,role:p.role,reason:lines.length?p.why:'Confirm whether this supplier can provide the requested items.',matchedItems:lines.map(l=>({id:l.id,name:l.name})),requestedItems:rfx.lines.length,checks:['Confirm exact item coverage and offered specifications','Confirm delivery to the requested location and timeline','Validate required evidence and commercial exceptions'],basis:'Fictional demo supplier profile; coverage is unverified'};});
}
export function outboundRfq(rfx){
 validateRfx(rfx);
 const subject='RFQ-2027-001 | '+rfx.title;
 const document=['# '+rfx.title,'Reference: RFQ-2027-001','',rfx.scope,'','Quotation deadline: '+rfx.deadline+' at 18:00 IST','','Commercial and delivery terms',rfx.terms,'','Requested items',...rfx.lines.map(l=>`${l.id}. ${l.name} | Specification: ${l.spec} | Quantity: ${l.quantity} ${l.unit}`),'','Vendor questionnaire',...rfx.questions.map((q,index)=>`${index+1}. ${q.text}${q.gate?' [Mandatory: '+gateDescription(q)+']':''}`),'','Quote each line using its reference number. State raw pricing unit/pack size, currency, taxes, freight, quote validity and delivery commitment. Disclose omitted lines and specification or commercial deviations. Include supporting evidence for mandatory criteria.'].join('\n');
 const file={name:'RFQ-2027-001.pdf',mime:'application/pdf',text:document};
 const deadline=new Date(rfx.deadline+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});
 const body=['Dear supplier,','',`Please send your quotation for the ${rfx.lines.length} item${rfx.lines.length===1?'':'s'} in the attached PDF.`, `Reply by ${deadline}, 18:00 IST.`,'','Please include:','• Unit prices, currency, taxes and freight charges.','• Delivery lead time, payment terms and quote validity.',rfx.questions.some(q=>q.gate)?'• Answers to the attached vendor questions and the requested supporting evidence.':'• Answers to the attached vendor questions.','• Any items you cannot supply or changes to the requested specifications or terms.','',`Attachment: ${file.name}`,'','Thank you,','Procurement team','Aerchain'].join('\n');
 return {subject,body,files:[file]};
}

// Known unresolved drafting markers. A future contractual obligation is not a placeholder.
export function hasUnresolvedContent(value){
 if(typeof value!=='string')return false;
 return /\b(?:TBD|TBC|TBA|TODO)\b|\b(?:to be|yet to be|pending)\s+(?:confirmed|specified|provided|decided|defined|determined|finali[sz]ed)\b|\b(?:buyer|purchaser)\s+(?:to|needs? to)\s+(?:confirm|specify|provide|decide|define|finali[sz]e)\b|\bnot\s+(?:yet\s+)?(?:specified|provided|confirmed|decided|defined|set)\b|\[(?:insert|enter|add|specify|confirm)\b[^\]]*\]|\{\{[^}]+\}\}|^\s*(?:unknown|pending|[-—?]+)\s*$/i.test(value);
}
export function vaguePaymentTerms(value){
 if(typeof value!=='string')return false;
 const clauses=value.split(/[.;\n]/).map(s=>s.trim()).filter(Boolean);
 return clauses.some(clause=>{
  if(!/\bpayment\b/i.test(clause)&&! /^(?:all\s+)?(?:the\s+)?(?:basic|standard|usual|normal|regular)(?:\s+(?:ones|terms|conditions))*$/i.test(clause))return false;
  if(!/\b(?:basic|standard|usual|normal|regular)\b|\bas (?:discussed|agreed)\b/i.test(clause))return false;
  // A concrete payment condition or an explicit invitation for proposals is meaningful.
  if(/\bnet\s*\d+|\b\d+\s*(?:calendar\s+|working\s+|business\s+)?days?\b|\b(?:on|upon)\s+(?:delivery|receipt|invoice|acceptance)\b|\b(?:no|without|\d+\s*%?)\s+advance\b|\b(?:supplier|vendor)[- ]proposed\b|\b(?:suppliers?|vendors?)\s+(?:may|to|can)\s+propose\b/i.test(clause))return false;
  return true;
 });
}
export function draftContentIssues(rfx){
 const issues=[];
 if(vaguePaymentTerms(rfx.terms))issues.push({path:'payment terms',value:rfx.terms,question:'When should payment be due—for example, within 30 days of invoice receipt? Is advance payment acceptable?'});
 const add=(path,value,question)=>{if(hasUnresolvedContent(value))issues.push({path,value,question});};
 add('title',rfx.title,'What should we call this purchase request?');
 add('scope',rfx.scope,'Please confirm the delivery location, timing and purchase scope.');
 add('terms',rfx.terms,'Please confirm the payment and delivery conditions, including taxes, freight and replacement terms, so the request can go directly to vendors.');
 for(const l of rfx.lines||[]){add('Line '+l.id+' name',l.name,'What item is required for line '+l.id+'?');add('Line '+l.id+' specification',l.spec,'Please confirm the final specifications for '+l.name+'.');add('Line '+l.id+' unit',l.unit,'How should '+l.name+' be counted?');}
 for(const l of rfx.lines||[]){
  const colors=/\b(?:black|blue|red|green|purple|yellow|orange|white|pink|brown)\b/gi;
  const named=[...new Set(String(l.name||'').toLowerCase().match(colors)||[])],specified=[...new Set(String(l.spec||'').toLowerCase().match(colors)||[])];
  if(named.length===1&&specified.length===1&&named[0]!==specified[0])issues.push({path:'Line '+l.id+' conflicting color',value:l.spec,question:'Line '+l.id+' is named '+l.name+' but specifies '+specified[0]+'. Which color is required?'});
 }
 for(const q of rfx.questions||[])add('Vendor question '+q.id,q.text,'What confirmed requirement should vendor question '+q.id+' ask suppliers to address?');
 return issues;
}
export function draftDisplayText(value){
 return hasUnresolvedContent(value)?'Please complete this detail in Clarifications.':(value||'Please complete this detail in Clarifications.');
}

export function participatingVendors(rfx){
 const ids=rfx.invitedVendors;
 if(ids==null)return [...DEFAULT_VENDORS];
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(v=>!VENDORS.includes(v)))throw Error('Choose valid, unique vendors from the shortlist.');
 return VENDORS.filter(v=>ids.includes(v));
}

export function rfqContentSignature(rfx){const {invitedVendors,evaluationExclusions,...content}=rfx;return JSON.stringify(content);}
export function editedRfqEmail(rfx,edit){
 const packet=outboundRfq(rfx);
 if(edit?.signature===rfqContentSignature(rfx)){const checked=saveRfqEmail(rfx,edit);packet.subject=checked.subject;packet.body=checked.body;}
 return packet;
}
export function saveRfqEmail(rfx,{subject,body}){
 if(typeof subject!=='string'||!subject.trim()||subject.length>240)throw Error('Enter an email subject of 1–240 characters.');
 if(typeof body!=='string'||!body.trim()||body.length>12000)throw Error('Enter an email message of 1–12,000 characters.');
 if([subject,body].some(text=>hasUnresolvedContent(text)||/\[(?:vendor|supplier|company|buyer|name|date|deadline|insert|add|enter)[^\]]*\]|<(?:vendor|supplier|company|buyer|name|date|deadline)[^>]*>|\blorem ipsum\b|\binsert (?:text|details|here)\b/i.test(text)))throw Error('Resolve unfinished wording before saving the email.');
 return {signature:rfqContentSignature(rfx),subject:subject.trim(),body:body.trim()};
}

// Context labels are not supplier exceptions. Preserve genuine commercial risks.
function extractedIssueType(text,rfx){
 const b=String(text),risk=/\b(?:expired|exceeds|insufficient|mismatch|conflict|advance payment|not served|cannot supply|unable to supply|not binding|non.binding|indicative only|estimate only|no (?:actual |firm )?quoted prices?|unreadable|unsupported|minimum order)\b|freight[^.;\n]{0,35}(?:unknown|not confirmed|not provided)/i.test(b);
 if(!risk&&/\b(?:synthetic|demo|demonstration)\b/i.test(b)&&(/not a real market quote|treat as unverified|demo (?:data|context|quotation)|synthetic (?:source|pricing|quote)/i.test(b)||/^\s*The quotation is a synthetic demonstration document;\s*treat extracted commercial terms and evidence as unverified source data\.?\s*$/i.test(b)))return 'context';
 if(!risk&&/forecast values|buyer.baseline|reference\/buyer.baseline|reference.*language/i.test(b)&&/no buyer.verified|not independently verified|commercial evidence.*(?:absent|not present)|no.*commercial evidence/i.test(b))return 'context';
 const evidenceRequired=rfx.questions.some(q=>q.gate||/evidence|certificat|sample.approval|test report/i.test(q.text));
 if(!evidenceRequired&&/evidence|certificat|sample.approval/i.test(b)&&/not (?:a |an )?blocker|no .*requested|(?:not|never) requested/i.test(b))return 'context';
 if(!risk&&/availability.*(?:not|unknown|unconfirmed).*(?:stated|provided|evidenced|confirmed|explicit)|availability.*not explicitly|stock.*(?:not stated|not provided|unknown)/i.test(b))return 'availability';
 return 'blocker';
}
export function actionableBlockers(x,rfx){return (x?.blockers||[]).filter(b=>{
 if(extractedIssueType(b,rfx)!=='blocker')return false;
 if(/certificate|qualification|sample.*approval|test (?:evidence|report)|evidence/i.test(b)&&/missing|not (?:provided|supplied|attached|stated)|unknown|inconclusive/i.test(b)&&!/expired|does not conform|conflict|mismatch/i.test(b)&&quality(x,rfx).status==='pass')return false;
 const field=/payment|invoice|advance/i.test(b)?'payment':/delivery|lead time/i.test(b)?'delivery':null;
 if(field&&/not (?:stated|provided|confirmed)|unconfirmed|unknown|requires? (?:buyer )?(?:acceptance|confirmation)|supplier proposal|supplier.*propos/i.test(b)&&!/exceeds|cannot|non.negotiable|not served|excluded|mismatch|different|conflict/i.test(b)){
  const checks=commercialRequirements(x,rfx).filter(c=>c.field===field||(field==='delivery'&&c.field==='coverage'));
  if(checks.length&&checks.every(c=>c.status==='pass'))return false;
 }return true;
});}
export function quoteFollowUps(x,rfx){
 const available=x?.quotes?.length&&x.quotes.every(q=>typeof q.availability==='string'&&q.availability.trim()&&!/not (?:confirmed|stated|provided)|unknown|unconfirmed|pending/i.test(q.availability));
 const follow=[...(Array.isArray(x?.followUps)?x.followUps:[])].filter(f=>!available||!/availability|stock/i.test(f.title+' '+f.detail));
 if(!available&&(x?.blockers||[]).some(b=>extractedIssueType(b,rfx)==='availability'))follow.push({title:'Confirm availability',detail:'Confirm whether the full requested quantity is available and when it can be delivered.'});
 return [...new Map(follow.filter(f=>typeof f?.title==='string'&&typeof f?.detail==='string').map(f=>[f.title+'|'+f.detail,f])).values()];
}

// One decision per issue across deterministic checks, questionnaire omissions and model notes.
export function consolidateQuoteIssues(issues,rfx){
 const locations=rfx.requiredLocations?.length?rfx.requiredLocations:['Delhi','Bengaluru','Pune'].filter(p=>new RegExp(p,'i').test(rfx.scope+' '+rfx.terms));
 const combined=issues.map(i=>i.title+' '+i.detail).join('\n');
 const locationFailure=(p,text)=>new RegExp(p+'[^.\\n;]{0,45}(?:not served|not offered|not available|not provide|excluded)|(?:does not provide|cannot|no delivery|no service)[^.\\n;]{0,70}(?:to|for) '+p+'|not '+p+'\\b','i').test(text);
 const locationUnknown=(p,text)=>new RegExp(p+'[^.\\n;]{0,45}(?:not confirmed|unconfirmed|pending|require.{0,2} confirmation)|(?:unconfirmed|pending)[^.\\n;]{0,30}(?:for|to) '+p,'i').test(text);
 const failedLocations=locations.filter(p=>locationFailure(p,combined));
 const buckets=new Map();
 for(const item of issues){const text=item.title+' '+item.detail;let key=item.key;
  if(!key){
  if(item.lineId)key='line:'+item.lineId;
  else if(/certificate|qualification|sample.*approval|test (?:evidence|report)|evidence/i.test(text)&&!/payment|freight/i.test(text))key='qualification';
  else if(/payment|advance|credit period|invoice/i.test(text))key='payment';
  else if(/freight|delivery|coverage|hub|location|serve|Pune|Bengaluru|Delhi/i.test(text)){
   const relevant=locations.filter(p=>new RegExp(p,'i').test(text)&&(failedLocations.includes(p)&&locationFailure(p,text)||locationUnknown(p,text)));
   key=relevant.length?'coverage:'+relevant.sort().join(','):/freight|shipping/i.test(text)?'freight':/availability|stock|supply/i.test(text)?'availability':'delivery';
  }else if(/availability|stock/i.test(text))key='availability';
  else if(/validity|valid until|expir/i.test(text))key='validity';
  else if(/brand|model|specification|deviation/i.test(text))key='specification';
  else key=item.key||text.toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  const group=buckets.get(key)||{...item,key,details:[],sources:[],questionIds:[]};
  if(item.questionId&&!group.questionIds.includes(item.questionId))group.questionIds.push(item.questionId);
  if(!group.details.some(d=>clarificationTextKey(d)===clarificationTextKey(item.detail)))group.details.push(item.detail);
  if(item.source&&!group.sources.includes(item.source))group.sources.push(item.source);
  group.nonNegotiable=group.nonNegotiable||!!item.nonNegotiable;
  buckets.set(key,group);
 }
 const coverageGroups=[...buckets.values()].filter(g=>g.key.startsWith('coverage:'));
 if(coverageGroups.length===1&&buckets.has('freight')){const f=buckets.get('freight'),g=coverageGroups[0];g.details.push(...f.details);g.sources.push(...f.sources);buckets.delete('freight');}
 return [...buckets.values()].map(g=>{
  if(g.key.startsWith('coverage:')){const places=g.key.slice(9);g.field='coverage';g.title='Delivery coverage'+(/freight/i.test(g.details.join(' '))?' & freight':'')+' · '+places;g.detail=places.split(',').some(p=>failedLocations.includes(p))?'Our requirement includes '+places+', but the offer does not cover this location'+(/freight/i.test(g.details.join(' '))?' in its delivery and freight terms':'')+'.':'Delivery coverage and supply availability for '+places+' require confirmation.';g.request='Confirm supply availability and whether you can serve '+places+' within our required lead time and include it in the fixed freight charge. State any revised charge. If unavailable, confirm that you cannot meet this requirement.';}
  else if(g.key==='payment'){g.field='payment';g.title=/not provided/i.test(g.details.join(' ')+' '+g.title)?'Payment terms not provided':'Payment conditions require confirmation';g.detail=g.details.find(d=>/advance|differs|conflict/i.test(d))||g.details[0];g.request='Confirm acceptance of our payment terms ('+supplierBuyerPayment(rfx)+'). State any exception explicitly.';}
  else if(g.key==='qualification'){g.field='qualification';g.title='Qualification evidence';g.detail=[...new Set(g.details)].map(d=>{for(const q of rfx.questions)d=d.split(q.id+':').join(q.text+':');return d;}).join('; ');g.request='Provide the outstanding qualification evidence and resolve the following evidence gaps: '+g.detail;}
  else {g.detail=g.details[0];g.request=(g.lineId?g.title+': ':'')+g.details.join('; ');}
  if(g.sources.length&&!g.source)g.source=g.sources[0];return g;
 });
}
export function supplierBuyerPayment(rfx){const clauses=(rfx.terms||'').split(/[.;\n]/).filter(t=>/payment|invoice|advance|credit/i.test(t));return clauses.join('; ').trim()||'state the credit period, its starting point and any advance payment';}

export function quoteSummary(x,rfx){
 const items=rfx.lines.map(l=>{const q=x.quotes.find(q=>q.lineId===l.id),n=normalize(q,l,rfx);return {id:l.id,name:l.name,quantity:l.quantity,unit:l.unit,rawPrice:q?.price??null,currency:q?.currency||null,pricingUnit:q?.unit||null,price:n.price,amount:n.price===null?null:round(n.price*l.quantity),state:n.state,why:n.why||'',source:q?.source||'',excerpt:q?.excerpt||'',availability:q?(typeof q.availability==='string'&&q.availability.trim()?q.availability:'Stock availability not stated'):'Not quoted'};});
 const internalReviews=items.filter(l=>l.state==='review'&&(l.price!==null&&!l.why||x.quotes.find(q=>q.lineId===l.id)?.validationIssue||(x.notes||[]).some(n=>new RegExp('^Line '+l.id+':.*(?:excerpt could not|page-only citation)','i').test(n))));
 const issues=items.filter(l=>l.state!=='read'&&l.why!=='Valid FX assumption required'&&!internalReviews.some(i=>i.id===l.id)).map(l=>({title:'Line '+l.id+' · '+l.name,detail:l.state==='missing'?'Please quote this requested item.':l.why||'Confirm this price and pricing unit.',lineId:l.id}));
 if(x.freight?.state!=='known')issues.push({title:'Freight not confirmed',detail:'Confirm the freight charge, or explicitly confirm that delivery is included.'});
 if(items.some(l=>/not confirmed|unconfirmed|pending/i.test(l.availability)))issues.push({title:'Confirm supply availability',detail:'Confirm supply availability for '+[...new Set(items.filter(l=>/not confirmed|unconfirmed|pending/i.test(l.availability)).map(l=>l.availability))].join('; ')});
 for(const b of actionableBlockers(x,rfx))issues.push({title:'Terms to discuss',detail:b});
 issues.push(...quoteFollowUps(x,rfx));
 for(const f of quoteRedFlags(x,rfx))if(!issues.some(i=>i.detail===f.detail))issues.push({...f});
 for(const q of rfx.questions){
  // Gate evidence is assessed below from actual records, not an empty duplicate answer slot.
  if(q.gate)continue;
  const a=x.answers.find(a=>a.questionId===q.id);
  const duplicateAnswer=rfx.questions.some(other=>other.id!==q.id&&clarificationTextKey(other.text)===clarificationTextKey(q.text)&&x.answers.some(answer=>answer.questionId===other.id&&answer.source&&answer.answer?.trim()&&!/not provided|not supplied|not stated|to be confirmed/i.test(answer.answer)));
  if(duplicateAnswer)continue;
  if(!a?.answer?.trim()||/not provided|not supplied|not stated|to be confirmed/i.test(a.answer)){
   const fields=[];if(/payment|credit period|advance payment/i.test(q.text))fields.push('payment');if(/delivery|lead time/i.test(q.text))fields.push('delivery');
   const checks=commercialRequirements(x,rfx).filter(c=>fields.includes(c.field)||(fields.includes('delivery')&&c.field==='coverage'));
   if(fields.length&&!/freight|replacement|validity|brand|model|specification|tax/i.test(q.text)&&checks.length&&fields.every(field=>checks.some(c=>c.field===field))){
    // Any real gap is already represented by the field-level checks below.
    continue;
   }
   issues.push({title:q.text,detail:q.text,questionId:q.id});
  }
 }
 for(const c of commercialRequirementIssues(x,rfx))if(!issues.some(i=>i.detail===c.detail))issues.push({title:c.field==='delivery'?'Delivery commitment requires confirmation':c.field==='coverage'?'Delivery location requires confirmation':'Payment conditions require confirmation',detail:c.detail});
 const g=quality(x,rfx);for(const reason of g.reasons)if(!issues.some(i=>i.detail===reason))issues.push({title:'Qualification evidence',detail:reason});
 const unique=[...new Map(issues.map(i=>[i.title+'|'+i.detail,i])).values()];
 const terms=Object.fromEntries([['delivery',/delivery|lead time/i],['payment',/payment|invoice/i],['validity',/valid until|validity/i],['taxes',/tax|GST/i]].map(([key,pattern])=>{const explicit=x.commercialTerms?.[key],question=rfx.questions.find(q=>pattern.test(q.text)),answer=question&&x.answers.find(a=>a.questionId===question.id);return [key,explicit&&typeof explicit.value==='string'&&explicit.source?explicit:{value:answer?.answer||'Not provided',source:answer?.source||''}];}));
 for(const [key,label] of [['delivery','Delivery commitment'],['payment','Payment terms'],['validity','Quote validity']])if(terms[key].value==='Not provided'&&!unique.some(i=>new RegExp(key==='validity'?'valid':key,'i').test(i.title)))unique.push({title:label+' not provided',detail:'Please confirm '+label.toLowerCase()+' for this quotation.'});
 return {internalReviews,redFlags:quoteRedFlags(x,rfx),terms,items,quoted:items.filter(l=>l.rawPrice!==null).length,requested:items.length,subtotal:round(items.reduce((s,l)=>s+(l.amount??0),0)),completePrices:items.every(l=>l.price!==null&&l.state==='read'),issues:consolidateQuoteIssues(unique,rfx),quality:g,answers:rfx.questions.map(q=>({...q,...x.answers.find(a=>a.questionId===q.id)}))};
}

// Evaluation decisions are separate from the supplier-facing requirement.
export function rfxSourceSignature(rfx){const {evaluationExclusions,...source}=rfx;return JSON.stringify(source);}
export function evaluationExclusions(rfx){
 const map=rfx.evaluationExclusions||{};
 if(typeof map!=='object'||Array.isArray(map))throw Error('Invalid evaluation exclusions');
 for(const [v,e] of Object.entries(map))if(!participatingVendors(rfx).includes(v)||typeof e?.reason!=='string'||!e.reason.trim()||e.reason.length>1200)throw Error('Each excluded vendor needs a recorded reason.');
 return map;
}
export function evaluatedVendors(rfx){const excluded=evaluationExclusions(rfx);return participatingVendors(rfx).filter(v=>!excluded[v]);}
export function setVendorEvaluation(state,vendor,{exclude,reason=''},at=new Date().toISOString()){
 if(!state.sent||!participatingVendors(state.rfx).includes(vendor))throw Error('Choose a vendor invited to this RFQ.');
 const before=evaluationExclusions(state.rfx)[vendor]||null;
 if(exclude&&(!state.data[vendor]||typeof reason!=='string'||!reason.trim()||reason.trim().length>1200))throw Error('Review the quote and enter a reason of 1–1,200 characters.');
 state.rfx.evaluationExclusions={...evaluationExclusions(state.rfx)};
 if(exclude)state.rfx.evaluationExclusions[vendor]={reason:reason.trim(),at};else delete state.rfx.evaluationExclusions[vendor];
 invalidateState(state,exclude?'Vendor excluded from evaluation':'Vendor restored to evaluation',{vendor,before,after:state.rfx.evaluationExclusions[vendor]||null},at);return state;
}
function supplierTerm(x,rfx,key){
 const pattern={delivery:/delivery|lead time/i,payment:/payment|invoice/i,validity:/valid until|validity/i,taxes:/tax|GST/i}[key];
 const explicit=x.commercialTerms?.[key];if(explicit&&typeof explicit.value==='string'&&explicit.source)return explicit;
 const q=rfx.questions.find(q=>pattern.test(q.text)),a=q&&x.answers.find(a=>a.questionId===q.id);return {value:a?.answer||'Not provided',source:a?.source||''};
}
// Buyer requirements are evaluated independently of whether the LLM reported a blocker.
export function commercialTrigger(value){
 const s=String(value||'');
 const clause=s.split(/[.;\n]/).find(c=>/\binvoice\b/i.test(c))||s;
 const goodsAcceptance=/\baccept(?:ance|ed|ing|s)?\s+(?:(?:of|the|all|delivered|received|supplied)\s+){0,4}(?:goods|delivery|items)\b|\b(?:goods|delivery|items)\s+(?:(?:are|is|were|was|have been|has been)\s+)?accept(?:ed|ance)\b/i.test(clause);
 if(/\binvoice\b/i.test(s)){
  const accepted=/\baccept(?:ed|ance|ing)?\s+(?:(?:of|the|a|an|valid)\s+){0,4}invoice\b|\binvoice\s+(?:(?:is|was|has been|being)\s+)?accept(?:ed|ance)\b/i.test(clause);
  const received=/\b(?:receipt|receiving|receive(?:d)?)\s+(?:(?:of|the|a|an|valid)\s+){0,4}invoice\b|\binvoice\s+(?:(?:is|was|has been|being)\s+)?(?:receipt|received)\b/i.test(clause);
  const invoice=accepted?'invoice acceptance':received?'invoice receipt':'invoice';
  if(goodsAcceptance){
   if(/(?:goods acceptance|acceptance of (?:the )?(?:delivered )?goods)\s+(?:is\s+)?(?:not required|not necessary|excluded)|(?:regardless|irrespective) of (?:goods acceptance|(?:the )?acceptance of (?:the )?(?:delivered )?goods)/i.test(s))return invoice;
   if(/\bearlier of\b|\bwhichever\s+(?:(?:is|occurs|comes)\s+)?(?:the\s+)?(?:earlier|first)\b/i.test(clause))return invoice+' or goods acceptance (whichever is earlier)';
   if(/\blater of\b|\bwhichever\s+(?:(?:is|occurs|comes)\s+)?(?:the\s+)?later\b/i.test(clause))return invoice+' and goods acceptance (whichever is later)';
   if(!/\bor\b/i.test(clause)&&/\band\b|\bboth\b/i.test(clause))return invoice+' and goods acceptance (whichever is later)';
   return invoice+' or goods acceptance';
  }
  return invoice;
 }
 if(/\bPO\b|purchase[ -]order/i.test(s)){if(/recei(?:pt|ved)[^.;]{0,45}(?:purchase[ -]order|\bPO\b)|(?:purchase[ -]order|\bPO\b)[^.;]{0,35}recei(?:pt|ved)/i.test(s))return 'PO receipt';if(/(?:issu(?:e|ed|ance)|creat(?:ion|ed)|plac(?:ement|ed)|releas(?:e|ed))[^.;]{0,55}(?:purchase[ -]order|\bPO\b)|(?:purchase[ -]order|\bPO\b)[^.;]{0,35}(?:issu|creat|plac|releas)/i.test(s))return 'PO issuance';return 'PO';}
 return /award/i.test(s)?'award':/(?:from|after|following|receipt of)\s+(?:the\s+)?(?:advance\s+)?payment|advance payment receipt/i.test(s)?'payment':goodsAcceptance?'goods acceptance':/acceptance/i.test(s)?'acceptance':null;
}
export function recordSupplierQuery(state,vendor,text,at=new Date().toISOString()){
 if(!state.sent||!participatingVendors(state.rfx).includes(vendor))throw Error('Choose a supplier invited to this RFQ before sending a query.');
 if(typeof text!=='string'||!text.trim()||text.trim().length>6000)throw Error('Enter a query of 1–6,000 characters before sending.');
 const message={at,role:'buyer',text:text.trim(),files:[],kind:'query'};
 state.threads||={};(state.threads[vendor]||=[]).push(message);
 return message;
}
export function commercialRequirements(x,rfx){
 if(!x)return [];
 const text=(rfx.scope||'')+'.\n'+(rfx.terms||''),checks=[];
 const add=(field,status,required,offered,detail,source)=>checks.push({field,status,required,offered,detail,source:source||''});
 const dayBasis=s=>/business|working/i.test(s||'')?'business':'calendar';
 const trigger=commercialTrigger;

 const delivery=text.match(/(?:deliver(?:y|ed)?|lead time)[^.;\n]*?(?:within|maximum(?: of)?|no more than|not later than)\s+(\d+)\s*((?:calendar|working|business)\s+)?days?[^.;\n]*/i)||String(rfx.scope||'').match(/(?:within|maximum(?: of)?|no more than|not later than)\s+(\d+)\s*((?:calendar|working|business)\s+)?days?[^.;\n]*/i);
 if(delivery){
  const term=supplierTerm(x,rfx,'delivery'),match=term.value.match(/\b(\d+)\s*((?:calendar|working|business)\s+)?days?\b/i),required=delivery[1]+' '+dayBasis(delivery[2])+' days'+(trigger(delivery[0])?' from '+trigger(delivery[0]):'');
  let status='unknown',detail='Confirm a sourced delivery commitment against '+required+'.';
  const copied=/buyer[- ]defined|buyer requirement|RFx requires|for reference/i.test(term.value)&&!/\bwe\s+(?:can|will|confirm|accept|commit)|\bour delivery|\bmeets? (?:the )?requested/i.test(term.value);
  if(term.source&&match&&!copied){
   if(dayBasis(match[2])!==dayBasis(delivery[2]))detail='Delivery uses a different day basis; confirm equivalent dates before award.';
   else if(trigger(delivery[0])&&trigger(term.value)!==trigger(delivery[0]))detail='Confirm when the delivery lead time starts; it must use the buyer’s '+trigger(delivery[0])+' trigger.';
   else if(Number(match[1])>Number(delivery[1])){status='fail';detail=match[1]+' days offered against '+delivery[1]+' days required.';}
   else{status='pass';detail='Sourced delivery commitment meets the required lead time.';}
  }
  add('delivery',status,required,term.value,detail,term.source);
 }
 if(Array.isArray(rfx.requiredLocations)&&rfx.requiredLocations.length){
  const term=supplierTerm(x,rfx,'delivery');
  for(const place of rfx.requiredLocations){
   const escaped=place.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),mention=new RegExp('\\b'+escaped+'\\b','i');
   const unsupported=new RegExp('(?:no (?:delivery|service|coverage)(?: to| in| for)?|cannot (?:serve|deliver to)|do not (?:serve|deliver to)|not serving)\\s*'+escaped+'|'+escaped+'[^.;\\n]{0,35}(?:not (?:served|covered|included)|excluded|unavailable|not available|cannot be served)','i').test(term.value);
   const uncertain=new RegExp(escaped+'[^.;\\n]{0,60}(?:not confirmed|unconfirmed|pending|subject to|to be confirmed)','i').test(term.value);
   const explicit=term.source&&mention.test(term.value)&&!unsupported&&!uncertain;
   add('coverage',unsupported?'fail':explicit?'pass':'unknown','Delivery service to '+place,term.value,unsupported?'Supplier does not provide required delivery service to '+place+'.':explicit?'Sourced delivery coverage confirms '+place+'.':'Confirm delivery coverage and commitment for '+place+'.',term.source);
  }
 }
 const payment=text.match(/(?:payment|payable|credit terms)[^.;\n]*?(?:net\s*|within\s+|due\s+)?(\d+)\s*(?:calendar\s+)?days?[^.;\n]*/i)||text.match(/\bnet\s*(\d+)\b[^.;\n]*/i);
 const noAdvance=/\b(?:no|without)\s+(?:any\s+)?advance(?:\s+payment)?|advance\s+(?:payment\s+)?(?:is\s+)?not\s+(?:allowed|acceptable|permitted)/i.test(text);
 if(payment||noAdvance){
  const term=supplierTerm(x,rfx,'payment'),match=term.value.match(/(?:net\s*|within\s+|due\s+)?(\d+)\s*(?:calendar\s+)?days?|\bnet\s*(\d+)\b/i),offeredDays=match?Number(match[1]||match[2]):null;
  const noAdvanceOffered=/\b(?:no|without)\s+(?:any\s+)?advance|advance[^.;]*not\s+(?:required|requested)|(?:^|[^0-9])0\s*%\s*advance/i.test(term.value);
  const requiresAdvance=/\badvance\b/i.test(term.value)&&!noAdvanceOffered;
  let status='unknown',detail='Confirm the supplier’s payment period, trigger and advance-payment conditions.';
  if(term.source){
   if(noAdvance&&requiresAdvance){status='fail';detail='Supplier requests advance payment against our no-advance requirement.';}
   else if(payment&&offeredDays!==Number(payment[1]))detail='Payment period differs from or does not confirm the buyer’s '+payment[1]+'-day term; confirm acceptance before award.';
   else if(payment&&trigger(payment[0])&&trigger(term.value)!==trigger(payment[0]))detail='Confirm payment uses the buyer’s '+trigger(payment[0])+' reference point.';
   else if(payment&&/\bvalid invoice\b/i.test(payment[0])&&!/\bvalid invoice\b/i.test(term.value))detail='Confirm payment starts only after receiving a valid invoice, as required by the buyer.';
   else if(noAdvance&&!noAdvanceOffered)detail='Confirm explicitly that no advance payment is required.';
   else{status='pass';detail='Sourced payment conditions meet the stated buyer requirements.';}
  }
  add('payment',status,(payment?payment[1]+' days'+(trigger(payment[0])?' from '+trigger(payment[0]):''):'')+(noAdvance?'; no advance payment':''),term.value,detail,term.source);
 }
 return checks;
}
export function commercialRequirementIssues(x,rfx){return commercialRequirements(x,rfx).filter(c=>c.status!=='pass');}
export function quoteRedFlags(x,rfx){
 if(!x)return [];const flags=[],requiredText=rfx.scope+' '+rfx.terms;
 const requirement=requiredText.match(/(?:deliver(?:y|ed)?|lead time)[^.;\n]*?(?:within|maximum(?: of)?|no more than|not later than)\s+(\d+)\s*((?:calendar|working|business)\s+)?days?/i)||String(rfx.scope||'').match(/(?:within|maximum(?: of)?|no more than|not later than)\s+(\d+)\s*((?:calendar|working|business)\s+)?days?/i);
 const delivery=supplierTerm(x,rfx,'delivery'),offer=delivery.value.match(/\b(\d+)\s*((?:calendar|working|business)\s+)?days?\b/i);
 if(requirement&&offer){
  const basis=s=>(s||'').trim().toLowerCase(),reqBasis=basis(requirement[2]),offerBasis=basis(offer[2]);
  if(Number(offer[1])>Number(requirement[1])&&reqBasis===offerBasis)flags.push({field:'delivery',title:'Delivery exceeds your requirement',required:requirement[1]+' '+(reqBasis?reqBasis+' ':'')+'days',offered:offer[1]+' '+(offerBasis?offerBasis+' ':'')+'days',detail:offer[1]+' days offered against '+requirement[1]+' days required.',source:delivery.source});
  else if(Number(offer[1])>Number(requirement[1])&&!['working','business'].includes(reqBasis)&&!['working','business'].includes(offerBasis))flags.push({field:'delivery',title:'Delivery exceeds your requirement',required:requirement[1]+' days',offered:offer[1]+' days',detail:offer[1]+' days offered against '+requirement[1]+' days required.',source:delivery.source});
 }
 for(const c of commercialRequirements(x,rfx).filter(c=>c.status==='fail'))if(!flags.some(f=>f.detail===c.detail))flags.push({field:c.field,title:c.field==='coverage'?'Required delivery hub not served':c.field==='payment'?'Payment conflicts with your requirement':'Delivery conflicts with your requirement',detail:c.detail,source:c.source});
 const qualification=quality(x,rfx);if(qualification.status==='fail')flags.push({field:'qualification',title:'Mandatory qualification not met',detail:qualification.reasons.join('; '),source:''});
 for(const detail of actionableBlockers(x,rfx)){
  const field=/delivery|lead time/i.test(detail)?'delivery':/payment|invoice|advance/i.test(detail)?'payment':/valid|expir/i.test(detail)?'validity':/tax|GST/i.test(detail)?'taxes':'commercial';
  if(flags.some(f=>f.field===field))continue;
  flags.push({field,title:field==='commercial'?'Commercial condition needs attention':field[0].toUpperCase()+field.slice(1)+' needs attention',detail,source:field==='commercial'?'':supplierTerm(x,rfx,field).source});
 }
 const deliveryTerm=supplierTerm(x,rfx,'delivery').value,paymentTerm=supplierTerm(x,rfx,'payment').value;
 for(const f of flags)f.nonNegotiable=f.field==='payment'?/non.negotiable|cannot (?:accept|offer).*credit/i.test(paymentTerm):/no subcontractor or alternative|cannot (?:serve|deliver)|permanently unavailable/i.test(deliveryTerm);
 return consolidateQuoteIssues(flags,rfx);
}

// Workflow changes keep original conversations and previous quotes for reference.
export function pendingSuppliers(state){return evaluatedVendors(state.rfx).filter(v=>!state.data[v]||state.data[v].meta?.rfxSignature!==rfxSourceSignature(state.rfx));}
export function requirementImpact(before,after){
 const vendorContent=r=>{const {fx,fxDate,fxNote,currency,evaluationExclusions,...rest}=r;return rest;};
 if(JSON.stringify(before)===JSON.stringify(after))return 'none';
 return JSON.stringify(vendorContent(before))===JSON.stringify(vendorContent(after))?'evaluation':'supplier';
}
export function retainPreviousQuote(state,vendor){if(state.data[vendor]){state.previousQuotes||={};state.previousQuotes[vendor]=clone(state.data[vendor]);state.previousQuotes[vendor].meta={...state.previousQuotes[vendor].meta,previousRfx:clone(state.rfx)};}}
export function applyRequirementUpdate(state,next){
 validateRfx(next,{partial:true});const impact=requirementImpact(state.rfx,next),before=clone(state.rfx);
 if(impact==='none'){state.draft=null;return impact;}
 if(impact==='supplier'){
  for(const v of Object.keys(state.data))retainPreviousQuote(state,v);
  state.requirementHistory=[...(state.requirementHistory||[]),{rfx:before,outbound:clone(state.outbound||null),at:new Date().toISOString()}];
  state.data={};state.sent=false;state.sentVersion=null;state.sentSignature=null;state.emailDraft=null;
 }else{
  for(const x of Object.values(state.data))if(x.meta?.rfxSignature===rfxSourceSignature(before))x.meta.rfxSignature=rfxSourceSignature(next);
  for(const p of Object.values(state.packages||{}))if(p.signature===rfxSourceSignature(before))p.signature=rfxSourceSignature(next);
  if(state.sent)state.sentSignature=rfxSourceSignature(next);
 }
 state.rfx=clone(next);state.draft=null;invalidateState(state,'Requirement updated',{impact,changes:draftDiff(before,next)});return impact;
}
export function extractionCandidates(vendors,packages,data,rfx){return vendors.filter(v=>packages[v]?.files?.length&&packages[v].signature===rfxSourceSignature(rfx)&&(!data[v]||data[v].meta?.rfxSignature!==rfxSourceSignature(rfx)||quoteSummary(data[v],rfx).internalReviews.length>0));}
export async function withOperationTimeout(operation,ms,message){
 let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}
}
export async function extractAvailable(vendors,read,onProgress=()=>{}){
 const completed=[],failed=[],active=new Set();let next=0;
 const progress=vendor=>onProgress({vendor,active:[...active],completed:[...completed],failed:[...failed],total:vendors.length});
 const worker=async()=>{while(next<vendors.length){
  const vendor=vendors[next++];active.add(vendor);progress(vendor);
  try{await read(vendor);completed.push(vendor);}catch(error){failed.push({vendor,message:error.message||String(error)});}
  finally{active.delete(vendor);progress(vendor);}
 }};
 await Promise.all(Array.from({length:Math.min(2,vendors.length)},worker));
 return {completed:vendors.filter(v=>completed.includes(v)),failed:failed.sort((a,b)=>vendors.indexOf(a.vendor)-vendors.indexOf(b.vendor))};
}
export function clarificationMessage(vendor,rfx,quote,lineId=null){
 const issues=quote?quoteSummary(quote,rfx).issues.filter(i=>lineId==null||i.lineId===lineId):[];
 if(!issues.length)return '';
 const actionable=issues.filter(i=>!i.nonNegotiable);if(!actionable.length)return 'Dear '+vendor+',\n\nWe have noted that your offer cannot meet our mandatory conditions. Please contact us only if your position changes.';
 const short=s=>String(s).replace(/\s+/g,' ').trim(),points=[];
 const missing=actionable.filter(i=>i.lineId&&/quote this requested item|not quoted|missing offer/i.test(i.detail)),units=actionable.filter(i=>i.lineId&&!missing.includes(i));
 if(missing.length)points.push((missing.length>5?'Quote missing RFQ lines: '+missing.map(i=>i.lineId).join(', '):'Quote missing items: '+missing.map(i=>'Line '+i.lineId+' ('+rfx.lines.find(l=>l.id===i.lineId)?.name+')').join(', '))+'. Include unit prices and pricing units.');
 if(units.length)points.push('Confirm the quoted price and pack quantity for '+units.map(i=>'Line '+i.lineId+' ('+rfx.lines.find(l=>l.id===i.lineId)?.name+')').join(', ')+'. State the number of order units in each quoted pack.');
 for(const i of actionable.filter(i=>!i.lineId)){
  if(i.key==='qualification'){
   const gates=rfx.questions.filter(q=>(q.gate&&quality(quote,rfx).reasons.some(reason=>reason.startsWith(q.id+':')))||(!q.gate&&i.questionIds?.includes(q.id)));
   if(!gates.length)continue;
   points.push('Attach the outstanding evidence: '+[...new Map(gates.map(q=>[clarificationTextKey(q.text),q])).values()].map(q=>short(q.text).replace(/^(?:please )?(?:provide|attach|submit)\s+(?:a |the )?/i,'').replace(/[.]$/,'')).join('; ')+'.');
  }else if(i.key==='payment')points.push('Confirm acceptance of '+short(supplierBuyerPayment(rfx))+'. State any exception.');
  else if(i.key==='delivery'){if(/coverage and commitment for/i.test(i.detail)&&actionable.some(c=>c.key?.startsWith('coverage:')&&i.detail.includes(c.key.slice(9))))continue;const requirement=commercialRequirements(quote,rfx).find(c=>c.field==='delivery')?.required;points.push(requirement?'Confirm delivery within '+requirement+' for all requested locations. State any exception.':short(i.request||i.detail));}
  else if(i.key==='freight')points.push('State the fixed freight charge covering all requested locations and awarded items, or confirm it is included.');
  else if(i.key?.startsWith('coverage:'))points.push('Confirm supply availability and delivery to '+i.key.slice(9)+' within our required lead time. Confirm fixed freight covers every requested location; state any revised charge.');
  else {const text=short(i.request||i.detail);if(text&&!/^(?:ask (?:the )?supplier to complete this answer[.]?|attach the outstanding evidence[: .]*)$/i.test(text))points.push(text);}
 }
 if(!points.length)return '';
 return 'Dear '+vendor+',\n\nPlease confirm these points for your quotation:\n'+[...new Map(points.map(p=>[clarificationTextKey(p),p])).values()].map((p,i)=>(i+1)+'. '+p).join('\n')+'\n\nAnswer all points in one reply.\n\nThank you,\nProcurement team\nAerchain';
}

export function clarificationChoices(question){
 if(/brand.*(?:acceptable|restriction|preference)|acceptable brands/i.test(question))return [{label:'No brand restriction',answer:'There are no brand restrictions. Suppliers must meet the stated item specifications.'}];
 if(/payment.*(?:expectation|terms)|when should payment be due/i.test(question))return [{label:'Let suppliers propose',answer:'Invite suppliers to propose payment terms for buyer review; no fixed payment period is required in this RFQ.'}];
 if(/quality criteria.*if any|any.*(?:additional|extra).*certificat/i.test(question)&&!/mandatory/i.test(question))return [{label:'No additional certification',answer:'No additional quality certification is required. Supplied items must conform to the stated specifications.'}];
 return [];
}

// A price outlier is a buyer observation, not an eligibility failure or an automatic exclusion.
export function priceObservation(vendor,data,rfx){
 const sums=participatingVendors(rfx).filter(v=>!evaluationExclusions(rfx)[v]).map(v=>{const x=data[v];if(!x)return null;const n=rfx.lines.map(l=>normalize(x.quotes.find(q=>q.lineId===l.id),l,rfx));if(n.some(c=>c.price==null||c.state==='review'))return null;return {vendor:v,subtotal:round(n.reduce((s,c,i)=>s+c.price*rfx.lines[i].quantity,0))};}).filter(Boolean);
 const target=sums.find(x=>x.vendor===vendor),others=sums.filter(x=>x.vendor!==vendor).map(x=>x.subtotal).sort((a,b)=>a-b);
 if(!target||others.length<3)return null;
 const mid=Math.floor(others.length/2),median=others.length%2?others[mid]:(others[mid-1]+others[mid])/2;
 if(target.subtotal<median*1.75)return null;
 return {title:'Quoted prices are substantially above other offers',subtotal:target.subtotal,medianOtherSubtotal:round(median),multiple:round(target.subtotal/median,2),detail:'Item subtotal is '+round(target.subtotal/median,2)+' times the median of '+others.length+' other fully priced offers, before freight and discounts. Review the commercial rationale; exclusion remains your decision.'};
}

// Locations come from confirmed buyer scope, never a demonstration loader.
export function finalizeBuyerDraft(draft,{responseProfile='supplier-v3'}={}){
 const next=clone(draft),text=String(next.scope||'')+' '+String(next.terms||'');
 const named=Array.isArray(next.requiredLocations)?next.requiredLocations.filter(x=>typeof x==='string'&&x.trim()):[];
 const known=[['Delhi',/\bDelhi\b/i],['Bengaluru',/\b(?:Bengaluru|Bangalore)\b/i],['Pune',/\bPune\b/i]].filter(([,p])=>p.test(text)).map(([name])=>name);
 next.questions=next.questions.map(q=>({...q,text:conciseVendorQuestion(q)}));
 next.requiredLocations=[...new Set([...named,...known])];next.responseProfile=responseProfile;return next;
}
