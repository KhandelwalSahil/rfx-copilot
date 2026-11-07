for(const x of Object.values(state.data)){x.followUps=quoteFollowUps(x,state.rfx);x.blockers=actionableBlockers(x,state.rfx);}
// Recover previously saved model drafts before readiness/render reads their text fields.
if(state.draft){try{const x=normalizeDraftText(state.draft.draft);state.draft.draft=x.draft;if(x.repairs.length)state.draft.textRepairs=x.repairs;}catch{state.draft=null;}}
try{const x=normalizeDraftText(state.rfx);if(x.repairs.length){state.rfx=x.draft;state.data={};state.sent=false;invalidate('Legacy draft text standardized',{repairs:x.repairs});}}catch{}
if(state.draft){try{state.draft=routeDraftQuestions(state.draft);}catch{state.draft=null;}}
// Compact wording on unsent questionnaires without changing stable answer IDs.
if(!state.sent){state.rfx.questions=state.rfx.questions.map(q=>({...q,text:conciseVendorQuestion(q)}));if(state.draft)state.draft.draft.questions=state.draft.draft.questions.map(q=>({...q,text:conciseVendorQuestion(q)}));}
// Clean redundant legacy questions on unsent drafts using the saved buyer messages only.
if(!state.sent&&state.draftChat?.some(m=>m.role==='user')){
 const confirmedText=state.draftChat.filter(m=>m.role==='user').map(m=>m.text||'').join('\n');
 state.rfx.buyerClarifications=reconcileBuyerClarifications(state.rfx,{confirmedText});
 if(state.draft){const questions=reconcileBuyerClarifications(state.draft.draft,{questions:state.draft.buyerClarifications||state.draft.questions||state.draft.draft.buyerClarifications||[],confirmedText});state.draft.buyerClarifications=questions;state.draft.questions=questions;state.draft.draft.buyerClarifications=questions;}
}
const emptyRfx=()=>({title:'',scope:'',deadline:'',currency:'INR',fx:null,fxDate:'',fxNote:'',terms:'',lines:[],questions:[],responseProfile:'supplier-v3'});
if(!stored)state=freshState(emptyRfx());
state.selectedVendors ??= participatingVendors(state.rfx);
function activeVendorNames(){return state.sent?participatingVendors(state.rfx):[...state.selectedVendors];}
state.threads ||= {};state.packages ||= {};state.responseHistory ||= {};
// Generated originals are retained in browser storage; extracted results remain separate.
for(const p of state.packageHistory||[])for(const [k,a] of Object.entries(p.assets||{}))assets[k]=a;
for(const v of Object.keys(state.data))if(!state.packages[v]){retainPreviousQuote(state,v);delete state.data[v];invalidate('Supplier source package unavailable',{vendor:v,reason:'Previous quote retained for reference; current original files are needed for extraction.'});}
for(const [v,p] of Object.entries(state.packages)){for(const [k,a] of Object.entries(p.assets||{}))assets[k]=a;workingFiles[v]=p.files||[];}
for(const v of participatingVendors(state.rfx))if(!state.packages[v])workingFiles[v]=[];
const xmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function sourceDocument(text,ext,options={}){
 if(ext==='pdf')return {bytes:textPdf(text),mime:'application/pdf'};
 if(ext==='txt')return {bytes:new TextEncoder().encode(text),mime:'text/plain'};
 if(ext==='jpg'){
 const lines=text.split('\n').flatMap(s=>s.match(/.{1,82}/g)||['']);const c=document.createElement('canvas');c.width=1400;c.height=lines.length*27+300;const ctx=c.getContext('2d');ctx.fillStyle='#cec7bb';ctx.fillRect(0,0,c.width,c.height);ctx.translate(95,55);ctx.transform(.94,.035,-.035,.97,0,0);ctx.shadowColor='#776f62';ctx.shadowBlur=14;ctx.fillStyle='#fffdf5';ctx.fillRect(0,0,1300,c.height-150);ctx.shadowBlur=0;ctx.fillStyle='#252525';ctx.font='22px monospace';ctx.filter='blur(.25px)';lines.forEach((l,i)=>ctx.fillText(l,24,35+i*27));return {bytes:new Uint8Array(await(await new Promise(r=>c.toBlob(r,'image/jpeg',.85))).arrayBuffer()),mime:'image/jpeg'};
 }
 const z=new JSZip();z.file('_rels/.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${ext==='docx'?'word/document.xml':'xl/workbook.xml'}"/></Relationships>`);
 if(ext==='docx'){
 z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 z.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+text.split('\n').map(l=>'<w:p><w:r><w:t xml:space="preserve">'+xmlEscape(l)+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
 }else{
 const offered=options.rows||[],rfx=options.rfx;
 const matrix=[[(options.vendor||'Metro').toUpperCase()+' SUPPLIES - SYNTHETIC QUOTATION'],['Stock code','Pack / quoted unit','Unit rate','Currency','Description','Requested quantity','Order unit','Offered specification'],...offered.slice().reverse().map(l=>['MT-'+(1000+l.id),l.unit,l.price,l.currency,l.name,l.quantity,rfx.lines.find(x=>x.id===l.id).unit,l.spec])];
 const sheet=rows=>'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{const ref=String.fromCharCode(65+j)+(i+1);return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(v)+'</t></is></c>';}).join('')+'</row>').join('')+'</sheetData></worksheet>';
 z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+[1,2].map(i=>'<Override PartName="/xl/worksheets/sheet'+i+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
 z.file('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Offer" sheetId="1" r:id="rId1"/><sheet name="Terms" sheetId="2" r:id="rId2"/></sheets></workbook>');
 z.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+[1,2].map(i=>'<Relationship Id="rId'+i+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+i+'.xml"/>').join('')+'</Relationships>');
 z.file('xl/worksheets/sheet1.xml',sheet(matrix));z.file('xl/worksheets/sheet2.xml',sheet(text.split('\n').map(l=>[l])));
 }return {bytes:await z.generateAsync({type:'uint8array'}),mime:ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
}
function threadMessage(v,role,text,files=[]){(state.threads[v]||=[]).push({at:new Date().toISOString(),role,text,files:[...files]});}
async function generateResponse(v,round=0,clarification=''){
 if(round>1)throw Error('The clarification round is complete. Review the supplier outcome or upload a corrected document.');
 if(!participatingVendors(state.rfx).includes(v))throw Error('This supplier was not invited to the RFQ.');
 if(supplierResponseStatus(state.rfx,v)==='awaiting'){state.awaitingSuppliers||={};state.awaitingSuppliers[v]={at:new Date().toISOString(),status:'awaiting'};save();return;}
 const resolved=sourceProfileV3(state.rfx)?sevenResolution(clarification,state.packages[v]?.resolved||{}):simulationResolution(clarification,state.packages[v]?.resolved||{});
 const index=VENDORS.indexOf(v),ext=sourceProfileV3(state.rfx)&&index===3&&resolved.units?'xlsx':['xlsx','pdf','docx','jpg','txt','pdf','txt'][index],text=simulationText(state.rfx,v,index,round,resolved),photoSplit=text.split('Questionnaire and product details:'),doc=await sourceDocument(ext==='jpg'?photoSplit[0]:text,ext,{rows:simulationRows(state.rfx,index,round,resolved),rfx:state.rfx,vendor:v}),name=v.replaceAll(' ','-')+'-offer-r'+(round+1)+'.'+ext;
 const f=new File([doc.bytes],name,{type:doc.mime});await prepare(f);let binary='';for(const b of doc.bytes)binary+=String.fromCharCode(b);const key='Generated-'+crypto.randomUUID()+'-'+name,a={mime:doc.mime,base64:btoa(binary),displayName:name,generated:true};
 const old=state.data[v];retainPreviousQuote(state,v);if(old)(state.responseHistory[v]||=[]).push(structuredClone(old));delete state.data[v];
 const prior=state.packages[v];if(prior)(state.packageHistory||=[]).push({vendor:v,...prior});
 const evidenceName=v.replaceAll(' ','-')+'-evidence-r'+(round+1)+'.txt',evidenceKey='Generated-'+crypto.randomUUID()+'-'+evidenceName,evidence={mime:'text/plain',base64:btoa(unescape(encodeURIComponent(simulationEvidence(state.rfx,v,index,round,resolved)))),displayName:evidenceName,generated:true};assets[evidenceKey]=evidence;assets[key]=a;const packageFiles=[key,evidenceKey];
 const extra=(filename,body)=>{const k='Generated-'+crypto.randomUUID()+'-'+filename;assets[k]={mime:'text/plain',base64:btoa(unescape(encodeURIComponent(body))),displayName:filename,generated:true};packageFiles.push(k);};
 if(!sourceProfileV3(state.rfx)&&index===4&&!resolved.offers&&!resolved.specs)extra(simulationHistoryName(v,round),simulationHistory(state.rfx,v,index,round,resolved));
 if(ext==='jpg'&&photoSplit[1])extra(v.replaceAll(' ','-')+'-questionnaire-r'+(round+1)+'.txt','SYNTHETIC SUPPLIER QUESTIONNAIRE\n'+v+'\n'+photoSplit[1]);
 workingFiles[v]=packageFiles;state.packages[v]={files:packageFiles,assets:Object.fromEntries(packageFiles.map(k=>[k,assets[k]])),signature:rfxSourceSignature(state.rfx),round,resolved,clarification,generatorVersion:sourceProfileV3(state.rfx)?3:2};
 threadMessage(v,'vendor',round?'Revised quotation attached. Review the updated offer and any remaining open points.':'Quotation received. Review the attached offer for item prices, delivery and commercial terms.',packageFiles);
 invalidate('Simulated vendor response received',{vendor:v,round,files:[name],superseded:old||null});
}
// Reassess saved offers only from their matching, current original text attachments.
let evidenceUpdated=false;
for(const [v,x]of Object.entries(state.data)){
 const p=state.packages[v];if(!p||p.signature!==rfxSourceSignature(state.rfx)||(x.meta?.rfxSignature&&x.meta.rfxSignature!==rfxSourceSignature(state.rfx)))continue;
 const files=(p.files||[]).filter(k=>assets[k]?.mime==='text/plain').map(k=>({name:assets[k].displayName||k,kind:'text',text:new TextDecoder().decode(Uint8Array.from(atob(assets[k].base64),c=>c.charCodeAt(0)))}));
 const reconciled=reconcileEvidenceRecords(x,files,state.rfx);if(JSON.stringify(x.evidence)!==JSON.stringify(reconciled.evidence))evidenceUpdated=true;x.evidence=reconciled.evidence;if(reconciled.originalExtractedEvidence)x.originalExtractedEvidence=reconciled.originalExtractedEvidence;
}
if(evidenceUpdated)invalidate('Required documents reconciled from current source records',{});
if(state.outbound?.assets)for(const [k,v] of Object.entries(state.outbound.assets))assets[k]=v;
let inboxVendor=VENDORS[0];
function sentInvitationsPage(){
 const vendors=activeVendorNames(),packet=state.outbound,received=vendors.filter(v=>state.packages[v]?.signature===rfxSourceSignature(state.rfx)).length,extracted=vendors.filter(v=>state.data[v]).length;
 return `<section class="card sent-invitation-overview"><div class="row between"><div><div class="eyebrow">INVITATIONS SENT</div><h2>Your RFQ is with ${vendors.length} suppliers</h2><p class="muted">Follow replies, review quotes and continue the conversation in Supplier Responses.</p></div><button class="primary" data-nav="inbox">View supplier responses →</button></div><div class="invitation-metrics"><div><strong>${vendors.length}</strong><span>Invited</span></div><div><strong>${received}</strong><span>Replies received</span></div><div><strong>${extracted}</strong><span>Quotes extracted</span></div></div></section><section class="card invitation-recipients"><h2>Invited suppliers</h2><div class="invited-supplier-list">${vendors.map(v=>`<div class="invited-supplier-row"><b>${esc(v)}</b>${tag(state.data[v]?'Quote extracted':state.packages[v]?.signature===rfxSourceSignature(state.rfx)?'Reply received':'Awaiting reply',state.packages[v]?'':'warn')}</div>`).join('')}</div></section><details class="card sent-rfq-record"><summary>View sent email & RFQ</summary><div class="email-subject"><span class="muted">Subject</span><br><b>${esc(packet.subject)}</b></div><pre class="email-preview">${esc(packet.body)}</pre><div class="row"><button data-action="previewRfqPdf">View sent RFQ PDF</button><button data-action="exportRfxText">Download PDF</button></div></details>`;
}
function supplierMessageSignature(v){return 'concise-v4|'+rfxSourceSignature(state.rfx)+'|'+(state.packages[v]?.files||[]).join('|');}
function supplierClarificationText(v,lineId=null){if(state.packages[v]?.round>0)return '';const saved=state.clarificationDrafts?.[v];if(!lineId&&saved?.signature===supplierMessageSignature(v))return saved.text;return state.data[v]?clarificationMessage(v,state.rfx,state.data[v],lineId):'';}
function revisedSimulationRepair(v){
 const p=state.packages[v];
 if(p?.round!==1||p.generatorVersion!==3||p.signature!==rfxSourceSignature(state.rfx)||!p.files?.length||p.files.some(k=>!assets[k]?.generated||assets[k]?.custom))return null;
 const clarification=p.clarification||(state.threads[v]||[]).slice().reverse().find(m=>m.role==='buyer'&&m.kind!=='query'&&/Please confirm these points for your quotation:/i.test(m.text))?.text;
 if(!clarification)return null;
 const resolved=sevenResolution(clarification);
 return Object.entries(resolved).some(([key,value])=>value&&!p.resolved?.[key])?{clarification}:null;
}
function supplierClarificationComposer(v){
 if(!state.data[v])return '';
 const outcome=supplierOfferStatus(state.data,state.rfx,v);
 if(state.packages[v]?.round>0){
  const summary=quoteSummary(state.data[v],state.rfx),repair=revisedSimulationRepair(v),discount=state.data[v].discount,retry=summary.internalReviews.length>0||discount&&!(discount.rate>0&&discount.rate<1)||summary.issues.some(i=>i.questionIds?.length);
  return `<section class="notice ${outcome.tone}"><b>${outcome.ready?'Ready for comparison':outcome.label}</b><p>Clarification round completed.${outcome.ready?' This offer meets the current comparison checks.':' The offer is not ready for comparison for the reasons below.'}</p>${outcome.reasons.length?'<ul>'+outcome.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>':''}${repair?'<p>A previous simulator parser missed part of your existing clarification. Rebuild that same reply and extract it again; no second supplier question is sent.</p><button data-action="repairRevisedReply">Reprocess simulated revised reply</button>':retry?'<p>Retry the extraction against the existing revised documents; no supplier question is sent.</p><button data-action="repairRevisedReply">Re-extract revised reply</button>':''}</section>`;
 }

 if(outcome.ready)return '';
 const message=supplierClarificationText(v),points=(message.match(/^\d+\. /gm)||[]).length;
 if(!points)return '';
 return `<details class="supplier-clarification-chat" id="supplierClarification"><summary><span>Review clarification</span><small>${points} ${points===1?'question':'questions'} · one reply</small></summary><div class="supplier-message-body"><div class="row between clarification-draft-head"><div><h3>Message to ${esc(v)}</h3><p class="muted">Review once, then send.</p></div><button class="mini" data-edit-clarification aria-label="Edit clarification message">✎ Edit message</button></div><input id="supplierMessageVendor" type="hidden" value="${esc(v)}"><div id="supplierMessagePreview" class="clarification-preview">${esc(message)}</div><label class="sr-only" for="supplierMessageText">Clarification message to ${esc(v)}</label><textarea id="supplierMessageText" rows="9" maxlength="6000" hidden>${esc(message)}</textarea><div class="row between clarification-send"><span class="muted sr">Sent in this supplier’s conversation.</span><button class="primary" data-action="sendSupplierMessage" ${busy?'disabled':''}>Send clarification →</button></div><div id="supplierMessageError" role="alert"></div></div></details>`;

}
sendPage=function(){
 if(state.sent&&state.outbound)return sentInvitationsPage();
 const ready=rfxReadiness(state.rfx);if(!ready.ready)return `<section class="card"><h2>Finish your requirement before sending</h2><p>Some details still need confirmation. Complete the open questions and return here to review the finished request.</p><button class="primary" data-action="resolveClarifications">Go to clarifications</button></section>`;const packet=state.sent&&state.outbound?state.outbound:editedRfqEmail({...state.rfx,invitedVendors:undefined},state.emailDraft),shortlist=vendorShortlist({...state.rfx,invitedVendors:VENDORS}),selected=activeVendorNames();
 return `<div class="grid send-review-grid"><section class="card"><div class="eyebrow">1 · Why these vendors</div><div class="row between"><h2>Your supplier shortlist</h2>${tag(selected.length+' vendors selected')}</div><p class="muted">Compare broad-category suppliers with specialist alternatives. Choose which candidates should receive the RFQ. Profile matches indicate category coverage; qualification and pricing are assessed from their quotations.</p>${shortlist.map(v=>`<div class="shortlist-vendor ${selected.includes(v.vendor)?'':'vendor-deselected'}"><div class="row between"><label class="vendor-choice"><input type="checkbox" data-vendor-select="${esc(v.vendor)}" ${selected.includes(v.vendor)?'checked':''} ${state.sent||busy?'disabled':''}><b>${esc(v.vendor)}</b></label>${tag(v.role)}</div><p>${esc(v.reason)}</p><p class="muted sr">Profile: ${esc(v.scope)}</p><details><summary>${v.matchedItems.length}/${v.requestedItems} items match the profile</summary><p>${esc(v.matchedItems.map(l=>l.name).join(', ')||'Coverage needs confirmation.')}</p><p class="muted sr">Profile match is indicative. Suppliers must confirm actual coverage in their response.</p></details></div>`).join('')}<details class="shortlist-checks"><summary>What we still need to verify</summary><ul>${shortlist[0].checks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></section><section class="card"><div class="eyebrow">2 · What vendors receive</div><div class="row between"><h2>Request for quotation</h2><button class="email-pencil" data-action="editRfqEmail" aria-label="Edit email" title="Edit email" ${state.sent||busy?'disabled':''}>✎</button></div><p class="muted">A separate message goes to each supplier, with the same approved requirement attached.</p><div class="email-subject"><span class="muted">Subject</span><br><b>${esc(packet.subject)}</b></div><pre class="email-preview">${esc(packet.body)}</pre><div class="attachment-preview"><h3>Attachment</h3><div class="row"><button data-action="exportRfxText">Download PDF</button><button data-action="previewRfqPdf">Preview PDF</button></div><details><summary>Preview the full requirement</summary><div class="rfq-content"><h3>Items and specifications</h3>${lineTable()}<h3>Questions for vendors</h3>${questionTable()}<h3>Scope & terms</h3><p>${esc(state.rfx.scope)}</p><p>${esc(state.rfx.terms)}</p></div></details></div><div class="send-approval">${!selected.length?'<p class="notice warn">Select at least one vendor to send this RFQ.</p>':''}${state.sent?'<p class="muted sr">Recipients are locked for this sent RFQ.</p>':''}<label class="check"><input id="approvePackage" type="checkbox" ${busy?'disabled':''}><span>I approve this vendor shortlist and the request shown above.</span></label><div class="row"><button class="primary" data-action="send" ${!ready.ready||busy||state.sent||!selected.length?'disabled':''}>${state.sent?'RFQ sent':'Approve & send to '+selected.length+' vendor'+(selected.length===1?'':'s')}</button><button data-nav="define">Edit requirement</button></div>${state.sent?'<button data-nav="inbox">Open vendor conversations →</button>':''}</div></section></div>`;
};
inboxPage=function(){
 const vendors=activeVendorNames();if(!vendors.length)return '<section class="card"><h2>No vendors selected</h2><button data-nav="send">Review vendors</button></section>';if(!vendors.includes(inboxVendor))inboxVendor=vendors[0];const v=inboxVendor,threads=state.threads[v]||[],received=vendors.filter(x=>workingFiles[x].length).length,extracted=vendors.filter(x=>state.data[x]).length;
 return `<div class="row between inbox-toolbar"><p class="muted">${state.sent?vendors.length+' requests sent': 'No request sent'} · ${vendors.filter(x=>state.packages[x]?.signature===rfxSourceSignature(state.rfx)).length} current replies received · ${extracted} extracted</p><div class="row"><button data-action="refreshInbox" ${!state.sent||busy?'disabled':''}>Refresh inbox</button><button data-action="extractAll" ${!extractionCandidates(evaluatedVendors(state.rfx),state.packages,state.data,state.rfx).length||busy?'disabled':''}>Extract available replies</button></div></div>${responseProgress()}${state.replyErrors?.[v]?'<p class="notice warn">This supplier reply is not available yet. Refresh the inbox to try again.</p>':''}<div class="grid inbox-grid"><section class="card conversation-list"><h2>Suppliers</h2>${vendors.map(x=>`<button data-inbox-vendor="${esc(x)}" class="conversation-select ${x===v?'selected':''}"><b>${esc(x)}</b><small>${evaluationExclusions(state.rfx)[x]?'Excluded from evaluation':state.data[x]?'Extracted':workingFiles[x].length?'Reply received':state.sent?'Awaiting reply':'Not contacted'}</small></button>`).join('')}</section><section class="card"><div class="row between"><h2>${esc(v)}</h2>${evaluationExclusions(state.rfx)[v]?tag('Excluded','warn'):state.data[v]?tag('Extracted'):workingFiles[v].length?tag('Ready to extract','warn'):''}</div>${state.data[v]?`<p class="supplier-offer-status">${tag(supplierOfferStatus(state.data,state.rfx,v).label,supplierOfferStatus(state.data,state.rfx,v).tone)}</p>`:''}${evaluationExclusions(state.rfx)[v]?`<div class="notice warn"><b>Excluded from evaluation</b><p>${esc(evaluationExclusions(state.rfx)[v].reason)}</p><button data-restore-vendor="${esc(v)}">Restore to evaluation</button></div>`:''}<div class="vendor-conversation" id="conversationMessages">${threads.length?threads.map(m=>`<div class="thread-message ${m.role==='buyer'?'thread-buyer':'thread-vendor'}"><div class="row between"><b>${m.role==='buyer'?'You'+(m.kind==='query'?' · Query':''):'Supplier'}</b><small class="muted">${esc(new Date(m.at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}))} IST</small></div>${m.role==='buyer'&&m.text.length>600?`<p>${esc(m.text.split('\n\n').slice(0,2).join('\n\n'))}</p><details><summary>Read full message</summary><p>${esc(threadDisplayText(m))}</p></details>`:`<p>${esc(threadDisplayText(m))}</p>`}<div class="files">${m.files.map(f=>`<button data-file="${esc(f)}">${esc(labelFile(f))}</button>`).join('')}</div></div>`).join(''):`<div class="empty"><p>${state.sent?'Waiting for this supplier’s reply.':'Review and send your requirement to start this conversation.'}</p></div>`}</div><div class="row conversation-actions">${state.data[v]?`<button class="primary" data-vendor="${esc(v)}" >View quote</button>${state.packages[v]?.round>0||!quoteSummary(state.data[v],state.rfx).issues.some(i=>!i.nonNegotiable)?'':`<button data-thread="${esc(v)}" ${busy?'disabled':''}>Ask vendor to clarify</button>`}`:`<button class="primary" data-extract="${esc(v)}" ${!workingFiles[v].length||busy?'disabled':''}>Extract & view quote</button>`}${state.sent?`<button data-supplier-query="${esc(v)}">Ask supplier</button>`:''}${state.previousQuotes?.[v]&&!state.data[v]?`<button data-previous-quote="${esc(v)}">View previous quote</button><p class="muted">An updated quote is awaiting extraction. Previous prices are excluded from the current comparison.</p>`:''}</div>${supplierClarificationComposer(v)}<details class="quote-file-updates"><summary>Upload a revised quote</summary><div class="quote-file-panel"><h3>Received an updated quote?</h3><p class="muted">Upload files received outside this conversation. To request changes from the supplier, select Ask vendor to clarify next to View quote.</p><div class="quote-file-list">${workingFiles[v].map(f=>`<div class="quote-file-row"><div class="quote-file-name"><small>Current file</small><button data-file="${esc(f)}">${esc(labelFile(f))}</button></div><label class="file-picker">Replace file<input aria-label="Replace ${esc(labelFile(f))}" type="file" data-replacefile="${esc(v)}|${esc(f)}" ${busy?'disabled':''}></label></div>`).join('')}</div><div class="quote-package-update"><div><b>${workingFiles[v].length?'Replace all quote files':'Add quote files'}</b><p class="muted">${workingFiles[v].length?'Select the complete updated quote and any supporting documents. These will replace all current files.':'Select the quote and any supporting documents received from this supplier.'}</p></div><label class="file-picker">${workingFiles[v].length?'Choose updated files':'Choose files'}<input aria-label="${workingFiles[v].length?'Replace all quote files':'Add quote files'}" type="file" multiple data-upload="${esc(v)}" ${busy?'disabled':''}></label></div><p class="quote-update-note">After uploading, select <b>Extract & view quote</b> to update the comparison. Previous results stay out of the comparison until the revised files are extracted.</p></div></details></section></div>${responseNextStep()}`;
};
function openClarificationsWarning(){
 const pending=buyerClarifications(state.draft?.draft||state.rfx);
 $('#overlay').innerHTML=`<div class="modal"><article><h2>${pending.length?'Questions are still open':'Complete your requirement first'}</h2><p>Please resolve the remaining details before reviewing vendors. Your draft is saved.</p>${pending.length?`<ul>${pending.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:'<p>Add the requested items and complete the purchase details in Define.</p>'}<div class="row"><button class="primary" data-action="resolveClarifications">Go to clarifications</button><button data-close>Close</button></div></article></div>`;bindOverlay();
}
let rfqPdfCache=null;
async function rfqPdfBytes(rfx){
 if(state.sent&&state.outbound?.fileKeys?.length){const a=assets[state.outbound.fileKeys[0]];if(a?.mime==='application/pdf')return new Uint8Array(await original(state.outbound.fileKeys[0]).arrayBuffer());}
 const signature=rfqContentSignature(rfx);if(rfqPdfCache?.signature===signature)return rfqPdfCache.bytes;
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const bytes=await createRfqPdf(rfx,{PDFLib,fontkit,regularBytes:decode(rfqFontAssets['NotoSans-Regular.ttf']),boldBytes:decode(rfqFontAssets['NotoSans-Bold.ttf'])});rfqPdfCache={signature,bytes};return bytes;
}
function emailEditor(){
 const packet=editedRfqEmail({...state.rfx,invitedVendors:undefined},state.emailDraft);
 $('#overlay').innerHTML=`<div class="modal"><article><div class="row between"><h2>Edit email</h2><button data-close>Cancel</button></div><p class="muted">Edit the cover email here. To change quantities, specifications or terms in the PDF, return to Define.</p><label for="rfqEmailSubject">Subject</label><input id="rfqEmailSubject" maxlength="240" style="width:100%" value="${esc(packet.subject)}"><label for="rfqEmailBody">Message</label><textarea id="rfqEmailBody" maxlength="12000" style="height:43vh">${esc(packet.body)}</textarea><div class="row"><button class="primary" data-action="saveRfqEmail">Save changes</button><button data-action="resetRfqEmail">Use generated email</button></div><div id="inlineError" role="alert"></div></article></div>`;bindOverlay();
}
const oldAction=action;
action=async function(a){
 if(busy)return oldAction(a);
 if(a==='sendSupplierQuery'){
  const v=$('#supplierQueryVendor')?.value,text=$('#supplierQueryText')?.value;
  let message;
  try{message=recordSupplierQuery(state,v,text);}catch(error){return inlineError(error.message);}
  delete state.supplierQueryDrafts?.[v];
  $('#overlay').innerHTML='';inboxVendor=v;view='inbox';
  audit('Supplier query recorded',{vendor:v,text:message.text,delivery:'conversation only'});render();
  return notify('Query added to the conversation. No automatic reply is generated.');
 }
 if(a==='repairRevisedReply'){
  const v=inboxVendor,repair=revisedSimulationRepair(v);
  if(!state.data[v]||state.packages[v]?.round!==1)return notify('Choose an extracted reply from the completed clarification round.');
  return task('Reprocessing the existing revised reply...',async()=>{
   if(repair){await generateResponse(v,1,repair.clarification);invalidate('Simulated clarification parser repaired',{vendor:v,round:1,noNewSupplierQuestion:true});}
   await extract(v);
  });
 }
 if(['exportRfxText','previewRfqPdf'].includes(a)){
 if(!rfxReadiness(state.rfx).ready)return openClarificationsWarning();
 return task('Preparing your RFQ PDF…',async()=>{const bytes=await rfqPdfBytes(state.rfx);if(a==='exportRfxText')return download('RFQ-2027-001.pdf',bytes,'application/pdf');let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const key='PDF-preview-'+crypto.randomUUID()+'.pdf';assets[key]={mime:'application/pdf',base64:btoa(binary),displayName:'RFQ-2027-001.pdf'};await preview(key);});
 }
 if(a==='exportAward')return task('Preparing the recommendation…',async()=>{const d=state.decision,rfx=d?.rfx||state.rfx,data=d?.data||state.data,analysis=d?.analysis||awardReadiness(state).analysis,decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const bytes=await createAwardPdf(rfx,analysis,d,data,{PDFLib,fontkit,regularBytes:decode(rfqFontAssets['NotoSans-Regular.ttf']),boldBytes:decode(rfqFontAssets['NotoSans-Bold.ttf'])});download('Award-Recommendation.pdf',bytes,'application/pdf');});
 if(a==='editRfqEmail'){if(state.sent)return notify('A sent email cannot be edited.');return emailEditor();}
 if(a==='resetRfqEmail'){const packet=outboundRfq({...state.rfx,invitedVendors:undefined});$('#rfqEmailSubject').value=packet.subject;$('#rfqEmailBody').value=packet.body;return;}
 if(a==='saveRfqEmail'){try{const before=state.emailDraft||null;state.emailDraft=saveRfqEmail({...state.rfx,invitedVendors:undefined},{subject:$('#rfqEmailSubject').value,body:$('#rfqEmailBody').value});invalidate('RFQ email edited',{before,after:state.emailDraft});$('#overlay').innerHTML='';render();}catch(e){inlineError(e);}return;}
 if(a==='resolveClarifications'){view='define';tab='clarifications';$('#overlay').innerHTML='';render();return;}
 if(a==='addVendorQuestion')return vendorQuestionEditor();
 if(a==='saveVendorQuestion'){
 try{const gate=$('#vendorQuestionGate').checked,type=$('#vendorQuestionRule').value,rule=type==='date_on_or_after'?{type,date:$('#vendorQuestionDate').value}:type==='number_at_least'?{type,minimum:$('#vendorQuestionMinimum').value.trim()?Number($('#vendorQuestionMinimum').value):NaN}:{type:'evidence_pass'};
 commitVendorQuestion({operation:$('#vendorQuestionOperation').value,id:$('#vendorQuestionId').value,text:$('#vendorQuestionText').value,gate,rule});$('#overlay').innerHTML='';render();}catch(e){inlineError(e);}return;
 }
 if(a==='deleteVendorQuestion'){
 try{commitVendorQuestion({operation:'delete',id:$('#vendorQuestionId').value});$('#overlay').innerHTML='';render();}catch(e){inlineError(e);}return;
 }
 if(a==='answerClarifications'){
 let reply;try{reply=clarificationReply(buyerClarifications(state.draft?.draft||state.rfx),clarificationAnswers);}catch(e){return notify(e.message);}
 const before=state.draft,previousInput=$('#draftPrompt').value;
 draftInput=reply.message+(previousInput.trim()?'\n\nAdditional buyer instructions: '+previousInput:'');$('#draftPrompt').value=draftInput;
 await action('draft');
 if(state.draft!==before){for(const q of reply.answered)delete clarificationAnswers[q];tab='clarifications';}else{draftInput=previousInput;}
 render();return;
 }
 if(a==='extractAll'){
 const candidates=extractionCandidates(evaluatedVendors(state.rfx),state.packages,state.data,state.rfx);
 if(!candidates.length)return notify('All available current replies are already extracted.');
 if(!config.allowLive)return settings();
 return task('Extracting available supplier replies…',async()=>{bulkExtracting=true;try{const result=await extractAvailable(candidates,v=>extract(v),p=>{$('#status').innerHTML=`<div class="busy">${p.active.length?'Reading '+esc(p.active.join(', ')):'Finishing'} · ${p.completed.length} completed · ${p.failed.length} not extracted</div>`;});save();notify(result.completed.length+' extracted'+(result.failed.length?' · '+result.failed.length+' not extracted':''));}finally{bulkExtracting=false;render();}});
 }
 if(a==='setEvaluationFx')return evaluationFxDialog();
 if(a==='saveEvaluationFx'){
 const fx=Number($('#evaluationFx').value),fxDate=$('#evaluationFxDate').value;
 if(!Number.isFinite(fx)||fx<=0||!/^\d{4}-\d{2}-\d{2}$/.test(fxDate)||Number.isNaN(Date.parse(fxDate)))return inlineError('Enter a positive INR-per-USD rate and its reference date.');
 const next={...structuredClone(state.rfx),fx,fxDate},proposal=state.draft;applyRequirementUpdate(state,next);if(proposal){state.draft=proposal;state.draft.draft.fx=fx;state.draft.draft.fxDate=fxDate;}save();$('#overlay').innerHTML='';render();return;
 }
 if(a==='continueToVendors'){
 const current=state.draft?.draft||state.rfx;
 if(!rfxReadiness(current).ready)return openClarificationsWarning();
 if(state.draft)await action('applyDraft');view='send';tab='prices';render();return;
 }
 if(a==='send'){
 if(state.draft)return notify('Review your latest requirement in Define before sending.');
 if(!activeVendorNames().length)return notify('Select at least one vendor.');
 if(!$('#approvePackage')?.checked)return notify('Approve the RFQ and selected recipients before sending.');
 if(state.sent)return notify('This RFx has already been sent. Use a clarification thread or edit the RFx to begin a new round.');
 const rfx={...structuredClone(state.rfx),invitedVendors:[...activeVendorNames()]},version=state.version;validateRfx(rfx);
 return task('Sending your RFQ…',async()=>{
 const packet=editedRfqEmail(rfx,state.emailDraft),bytes=await rfqPdfBytes(rfx),file=packet.files[0],key='RFQ-'+crypto.randomUUID()+'.pdf';
 if(state.version!==version)throw Error('The requirement changed during preparation. Please review it again.');
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const attachment={mime:'application/pdf',displayName:file.name,base64:btoa(binary)},hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 assets[key]=attachment;state.rfx=rfx;state.sent=true;state.sentVersion=state.version;state.outbound={...packet,assets:{[key]:attachment},fileKeys:[key],pdfHash:hash};state.sentSignature=rfxSourceSignature(rfx);
 for(const v of participatingVendors(rfx))threadMessage(v,'buyer',packet.body.replace('Dear supplier,','Dear '+v+','),[key]);
 audit('Outbound RFQ approved',{subject:packet.subject,body:packet.body,attachments:[{name:file.name,mime:'application/pdf',sha256:hash}],shortlist:vendorShortlist(rfx).filter(v=>participatingVendors(rfx).includes(v.vendor)),recipients:participatingVendors(rfx)});view='inbox';render();await receiveSupplierReplies();render();
 });
 }
 if(a==='refreshInbox')return task('Checking supplier replies…',async()=>{const count=await receiveSupplierReplies();save();render();notify(count?count+' new supplier replies received.':'No new replies.');});
 if(a==='sendSupplierMessage'){const v=$('#supplierMessageVendor').value;if(state.packages[v]?.round>0)return notify('Clarification completed. Review the supplier outcome instead of starting another round.');const text=$('#supplierMessageText').value.trim();if(!text){$('#supplierMessageError').textContent='Enter a message before sending.';return;}return task('Sending your message…',async()=>{threadMessage(v,'buyer',text);await generateResponse(v,(state.packages[v]?.round||0)+1,text);view='inbox';save();render();await reviewRevisedReply(v);});}
 if(a==='sendClarification'){const v=$('#clarifyVendor').value;if(state.packages[v]?.round>0)return notify('Clarification completed. Review the supplier outcome instead of starting another round.');const text=$('#clarifyText').value.trim();if(!text||!$('#clarifyApprove').checked)return inlineError('Enter a question and approve sending.');return task('Sending your clarification…',async()=>{threadMessage(v,'buyer',text);await generateResponse(v,(state.packages[v]?.round||0)+1,text);$('#overlay').innerHTML='';view='inbox';save();render();await reviewRevisedReply(v);});}
 await oldAction(a);
 if(a==='confirm-blank'){clarificationAnswers={};state.packages={};state.threads={};state.responseHistory={};state.sentSignature=null;for(const v of VENDORS)workingFiles[v]=[];save();render();}
};
async function reviewRevisedReply(v){
 if(!config.allowLive)return notify('Revised reply received. Enable AI and extract it to update the comparison.');
 try{await extract(v);$('#overlay').innerHTML='';const count=quoteSummary(state.data[v],state.rfx).issues.length;notify(count?'Revised quote updated. '+count+' distinct points still need review.':'Revised quote updated. No open clarification points.');}
 catch(error){$('#overlay').innerHTML='';notify('Reply received. Extraction could not finish; the comparison has not changed.');}
 save();render();
}
function clarificationDialog(v,lineId=null){if(state.packages[v]?.round>0)return notify('Clarification completed. Review the quote outcome or upload a corrected document.');const text=supplierClarificationText(v,lineId);$('#overlay').innerHTML=`<div class="modal"><article><h2>Clarify with ${esc(v)}</h2><input id="clarifyVendor" type="hidden" value="${esc(v)}"><label for="clarifyText">Message to supplier</label><textarea id="clarifyText" rows="9">${esc(text)}</textarea><p class="muted">Your current quote stays available for reference. A revised reply must be extracted before it updates the comparison.</p><label class="check"><input id="clarifyApprove" type="checkbox">Approve sending this clarification.</label><button data-action="sendClarification">Send clarification</button><button data-close>Cancel</button><div id="inlineError"></div></article></div>`;bindOverlay();}
const oldBind=bind;
bind=function(){oldBind();document.querySelectorAll('[data-restore-vendor]').forEach(b=>b.onclick=()=>{if(busy)return;setVendorEvaluation(state,b.dataset.restoreVendor,{exclude:false});save();render();});if($('#supplierMessageText'))$('#supplierMessageText').oninput=e=>{const v=$('#supplierMessageVendor').value;state.clarificationDrafts||={};state.clarificationDrafts[v]={text:e.target.value,signature:supplierMessageSignature(v)};saveSoon();};document.querySelectorAll('[data-edit-clarification]').forEach(b=>b.onclick=()=>{$('#supplierMessagePreview').hidden=true;$('#supplierMessageText').hidden=false;$('#supplierMessageText').focus();b.hidden=true;});document.querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>{if(busy)return;const composer=$('#supplierClarification');if(composer){composer.open=true;if(!$('#supplierMessageText').hidden)$('#supplierMessageText').focus();composer.scrollIntoView({behavior:'smooth',block:'nearest'});}else clarificationDialog(b.dataset.thread);});document.querySelectorAll('[data-replacefile]').forEach(b=>b.onchange=()=>task('Validating replacement source…',async()=>{const [v,key]=b.dataset.replacefile.split('|'),file=b.files[0];if(!file)return;await prepare(file);let binary='';for(const x of new Uint8Array(await file.arrayBuffer()))binary+=String.fromCharCode(x);const k='Uploaded-'+crypto.randomUUID()+'-'+file.name;assets[k]={mime:file.type,displayName:file.name,base64:btoa(binary),custom:true};workingFiles[v]=workingFiles[v].map(f=>f===key?k:f);retainPreviousQuote(state,v);delete state.data[v];state.packages[v]={...(state.packages[v]||{}),files:[...workingFiles[v]],assets:Object.fromEntries(workingFiles[v].map(f=>[f,assets[f]]))};threadMessage(v,'buyer','Attachment replaced: '+file.name,[k]);invalidate('Single attachment replaced',{vendor:v,old:key,next:k});}));};
const oldBindOverlay=bindOverlay;
bindOverlay=function(){oldBindOverlay();if($('#supplierQueryText'))$('#supplierQueryText').oninput=e=>{state.supplierQueryDrafts||={};state.supplierQueryDrafts[$('#supplierQueryVendor').value]=e.target.value;saveSoon();};document.querySelectorAll('[data-clarify]').forEach(b=>b.onclick=()=>clarificationDialog(b.dataset.clarify.split('|')[0],Number(b.dataset.clarify.split('|')[1])||null));};
const oldExtract=extract;
let bulkExtracting=false;
state.extractionJobs||={};for(const job of Object.values(state.extractionJobs))if(job.status==='reading'){job.status='failed';job.message='The previous extraction was interrupted.';}
extract=async function(v){
 if(state.extractionJobs[v]?.status==='reading')throw Error('This supplier extraction is already in progress.');
 state.extractionJobs[v]={status:'reading',stage:'Preparing supplier files',at:new Date().toISOString()};save();render();
 try{
 if(!state.sent)throw Error('Approve and send the updated requirement before extracting its replies.');
 if(!participatingVendors(state.rfx).includes(v))throw Error('This supplier was not invited to this RFQ.');
 if(!workingFiles[v].length)throw Error('No reply received from this supplier yet.');
 if(state.packages[v]?.signature&&state.packages[v].signature!==rfxSourceSignature(state.rfx))throw Error('This reply is for the previous requirement. Request an updated quotation.');
 await oldExtract(v);state.extractionJobs[v]={status:'complete',at:new Date().toISOString()};save();
 if(state.data[v]&&!bulkExtracting)vendorInspector(v);
 }catch(e){state.extractionJobs[v]={status:'failed',message:e.message,at:new Date().toISOString()};save();throw e;}
};

function commitVendorQuestion(command){
 const changed=editVendorQuestion(state.draft?.draft||state.rfx,command);
 if(!state.draft)state.draft={draft:changed.rfx,changes:[],questions:[...(changed.rfx.buyerClarifications||[])]};else state.draft.draft=changed.rfx;
 state.draft.changes.push('Vendor question '+command.operation+' by buyer');
 state.draftChat.push({role:'user',text:command.operation==='delete'?'Remove this vendor question: '+changed.before.text:'Use this vendor question'+(changed.after.gate?' as a mandatory qualification':'')+': '+changed.after.text});
 state.sent=false;state.sentVersion=null;
 invalidate('Vendor question '+command.operation,{before:changed.before,after:changed.after});tab='quality';
}
function vendorQuestionEditor(id){
 const q=(state.draft?.draft||state.rfx).questions.find(q=>String(q.id)===String(id)),rule=q?gateRule(q):{type:'evidence_pass'};
 $('#overlay').innerHTML=`<div class="modal"><article><div class="row between"><h2>${q?'Edit vendor question':'Add vendor question'}</h2><button data-close>Cancel</button></div><p class="muted">Ask what the supplier offers or whether they meet your requirements.</p><input id="vendorQuestionOperation" type="hidden" value="${q?'edit':'add'}"><input id="vendorQuestionId" type="hidden" value="${esc(q?.id||'')}"><label for="vendorQuestionText">Question</label><textarea id="vendorQuestionText" maxlength="2000" placeholder="For example: Confirm delivery within 14 days of PO issuance and explain any exceptions.">${esc(q?.text||'')}</textarea><label class="check"><input id="vendorQuestionGate" type="checkbox" ${q?.gate?'checked':''}><span>Mandatory for vendor qualification</span></label><div id="vendorGateFields" ${q?.gate?'':'hidden'}><label>How should qualification be checked?<select id="vendorQuestionRule"><option value="evidence_pass" ${rule.type==='evidence_pass'?'selected':''}>Supporting evidence</option><option value="date_on_or_after" ${rule.type==='date_on_or_after'?'selected':''}>Certificate validity date</option><option value="number_at_least" ${rule.type==='number_at_least'?'selected':''}>Minimum numeric value</option></select></label><label id="vendorDateLabel" ${rule.type==='date_on_or_after'?'':'hidden'}>Certificate must be valid through<input id="vendorQuestionDate" type="date" value="${esc(rule.date||'')}"></label><label id="vendorMinimumLabel" ${rule.type==='number_at_least'?'':'hidden'}>Minimum acceptable value<input id="vendorQuestionMinimum" type="number" step="any" value="${esc(rule.minimum??'')}"></label></div><p class="muted sr">Saved changes stay in your draft until you review the vendor package.</p><button class="primary" data-action="saveVendorQuestion">Save question</button><div id="inlineError" role="alert"></div></article></div>`;
 bindOverlay();$('#vendorQuestionGate').onchange=()=>{$('#vendorGateFields').hidden=!$('#vendorQuestionGate').checked;};$('#vendorQuestionRule').onchange=()=>{$('#vendorDateLabel').hidden=$('#vendorQuestionRule').value!=='date_on_or_after';$('#vendorMinimumLabel').hidden=$('#vendorQuestionRule').value!=='number_at_least';};
}
function deleteVendorQuestionDialog(id){
 const q=(state.draft?.draft||state.rfx).questions.find(q=>String(q.id)===String(id));if(!q)return;
 $('#overlay').innerHTML=`<div class="modal"><article><h2>Delete vendor question?</h2><p>${esc(q.text)}</p><input id="vendorQuestionId" type="hidden" value="${esc(q.id)}"><p class="muted">This changes your working draft. You will review the updated package before sending.</p><div class="row"><button data-close>Keep question</button><button data-action="deleteVendorQuestion">Delete question</button></div><div id="inlineError"></div></article></div>`;bindOverlay();
}
const bindVendorQuestions=bind;
bind=function(){bindVendorQuestions();document.querySelectorAll('[data-question-edit]').forEach(b=>{b.disabled=busy;b.onclick=()=>{if(!busy)vendorQuestionEditor(b.dataset.questionEdit);};});document.querySelectorAll('[data-question-delete]').forEach(b=>{b.disabled=busy;b.onclick=()=>{if(!busy)deleteVendorQuestionDialog(b.dataset.questionDelete);};});};

const bindSendReview=bind;
bind=function(){bindSendReview();if($('#conversationMessages'))$('#conversationMessages').scrollTop=$('#conversationMessages').scrollHeight;document.querySelectorAll('[data-inbox-vendor]').forEach(b=>b.onclick=()=>{inboxVendor=b.dataset.inboxVendor;render();});document.querySelectorAll('[data-nav="send"]').forEach(b=>b.onclick=()=>{if(!busy)action('continueToVendors');});};

const bindVendorSelection=bind;
bind=function(){bindVendorSelection();document.querySelectorAll('[data-vendor-select]').forEach(input=>input.onchange=()=>{
 if(busy||state.sent)return;
 const previous=[...activeVendorNames()];state.selectedVendors=VENDORS.filter(v=>v===input.dataset.vendorSelect?input.checked:previous.includes(v));
 invalidate('RFQ recipients changed',{before:previous,after:[...state.selectedVendors]});render();
});};

function vendorInspector(v){
 const x=state.data[v];if(!x&&state.previousQuotes?.[v])return previousQuoteDialog(v);if(!x)return notify('Extract this vendor first.');const s=quoteSummary(x,state.rfx),outlier=priceObservation(v,state.data,state.rfx),excluded=evaluationExclusions(state.rfx)[v];
 const rate=l=>l.rawPrice===null?'Not provided':`${Number(l.rawPrice).toLocaleString('en-IN')} ${esc(l.currency)} / ${esc(l.pricingUnit)}`;
 const source=(text,excerpt='')=>text?`<details class="quote-source"><summary>View source</summary><p>${esc(text)}</p>${excerpt?`<blockquote>${esc(excerpt)}</blockquote>`:''}</details>`:'';
 $('#overlay').innerHTML=`<div class="drawer quote-drawer"><article><div class="row between quote-summary-head"><div><div class="eyebrow">QUOTE SUMMARY</div><h2>${esc(v)}</h2><p class="muted">${s.quoted} of ${s.requested} items priced · ${s.issues.length?s.issues.length+' points to discuss':'No open clarification points recorded'}</p></div><div class="row"><button data-evaluation="${esc(v)}">${excluded?'Restore to evaluation':'Exclude from evaluation'}</button><button data-close>Close</button></div></div>${state.packages[v]?.round>0&&!supplierOfferStatus(state.data,state.rfx,v).ready?`<section class="notice warn"><b>Clarification received · final outcome</b><ul>${supplierOfferStatus(state.data,state.rfx,v).reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p>No further question has been sent. Review the supplied documents or exclude an offer that cannot meet our requirements.</p></section>`:''}${s.internalReviews.length?'<div class="notice warn"><b>Price extraction needs review</b><p>'+s.internalReviews.length+' prices need source verification. These are internal extraction checks, not supplier clarification questions.</p></div>':''}${excluded?`<div class="notice warn"><b>Excluded from evaluation</b><p>${esc(excluded.reason)}</p><small>Quote and conversation retained. This vendor is omitted from rankings and awards.</small></div>`:''}${s.redFlags.some(f=>f.nonNegotiable)?'<div class="notice warn"><b>Consider excluding this supplier</b><p>The supplier explicitly states that a mandatory condition cannot be met. Repeating the same clarification will not resolve a non-negotiable exception.</p></div>':''}${outlier?`<div class="notice warn"><b>${esc(outlier.title)}</b><p>${esc(outlier.detail)}</p></div>`:''}${s.redFlags.length?`<section class="quote-redflags"><h3>Requirement conflicts · ${s.redFlags.length}</h3>${s.redFlags.map(f=>`<div><b>${esc(f.title)}</b>${f.required?`<p><span>Required: ${esc(f.required)}</span><strong>Offered: ${esc(f.offered)}</strong></p>`:`<p>${esc(f.detail)}</p>`}${(f.sources?.length?f.sources:[f.source]).map(s=>source(s)).join('')}</div>`).join('')}</section>`:''}<div class="quote-metrics"><div><small>Known item subtotal</small><strong>${s.quoted?amount(s.subtotal):'Not provided'}</strong><small>${s.completePrices?'Before freight, tax and discounts':s.items.some(l=>l.state==='review')?'Partial subtotal · check flagged prices':'Partial subtotal · unquoted items excluded'}</small></div><div><small>Freight</small><strong>${x.freight?.state==='known'?amount(x.freight.amount):'Not confirmed'}</strong><small>Quoted charge</small></div><div><small>Required documents</small><strong>${s.quality.notRequired?'None required':s.quality.status==='pass'?'Documents supplied':s.quality.status==='fail'?'Criteria not met':'Evidence needed'}</strong><small>${s.quality.notRequired?'No mandatory criteria set':'Against your mandatory criteria'}</small></div></div><section><h3>1. Items & prices</h3><p class="muted sr">Quoted rates retain the supplier’s currency and pack size. Line amounts use the requested quantity and your planning FX. A quote does not confirm stock.</p><div class="tablewrap"><table><tr><th>Requested item</th><th>Quoted price</th><th>Line amount · INR</th><th>Offer status</th></tr>${s.items.map(l=>`<tr><td><b>${l.id}. ${esc(l.name)}</b><small>${Number(l.quantity).toLocaleString('en-IN')} ${esc(l.unit)} requested</small></td><td>${rate(l)}${l.price!==null?`<small>${money(l.price)} / ${esc(l.unit)} normalized</small>`:''}</td><td>${l.amount===null?'Not provided':amount(l.amount)}</td><td>${tag(l.state==='missing'?'Not quoted':l.state==='review'?'Check price / unit':'Quoted',l.state==='read'?'':'warn')}${l.state==='missing'?'':`<small>${esc(l.availability)}</small>`}${source(l.source,l.excerpt)}</td></tr>`).join('')}</table></div></section><section><h3>2. Delivery & commercial terms</h3><div class="quote-answers">${[['delivery','Delivery'],['payment','Payment'],['validity','Quote validity'],['taxes','Taxes']].map(([key,label])=>`<div class="quote-answer ${s.redFlags.some(f=>f.field===key)?'quote-term-conflict':''}"><b>${label} ${s.redFlags.some(f=>f.field===key)?tag('Requirement conflict','bad'):''}</b><p>${esc(s.terms[key].value)}</p>${source(s.terms[key].source)}</div>`).join('')}</div><details class="quote-documents"><summary>Supplier questionnaire (${s.answers.length})</summary><div class="quote-answers">${s.answers.length?s.answers.map(a=>`<div class="quote-answer"><b>${esc(a.text)}</b><p>${esc(a.answer||'Not provided')}</p>${source(a.source)}</div>`).join(''):'<p>No supplier questions were included.</p>'}</div></details><div class="quote-answer"><b>Freight basis</b><p>${x.freight?.state==='known'?amount(x.freight.amount):'Not provided'}</p>${source(x.freight?.source)}</div>${x.discount?`<div class="quote-answer"><b>Conditional discount</b><p>${Number(x.discount.rate*100).toLocaleString()}% · applies only if the quoted conditions are met.</p>${source(x.discount.source)}</div>`:''}</section><details class="quote-documents"><summary>Original documents (${workingFiles[v].length})</summary><div class="files">${workingFiles[v].map(f=>`<button data-file="${esc(f)}">${esc(labelFile(f))}</button>`).join('')}</div></details><details class="quote-documents"><summary>Review details & corrections</summary><p class="muted">Use a source document to correct a value or review a qualification.</p><div class="row">${s.items.map(l=>`<button data-quote-line="${esc(v)}|${l.id}">Line ${l.id}</button>`).join('')}<button data-quote-manual="${esc(v)}">Review terms & evidence</button><button data-quote-refresh="${esc(v)}" ${!workingFiles[v].length?'disabled':''}>Re-extract response</button></div></details><p class="muted sr">Extracted from the supplier’s files. Values are not marked buyer-verified until you review them.</p></article></div>`;
 bindOverlay();document.querySelectorAll('[data-quote-refresh]').forEach(b=>b.onclick=()=>task('Updating your quote summary…',async()=>{$('#overlay').innerHTML='';await extract(b.dataset.quoteRefresh);}));document.querySelectorAll('[data-quote-manual]').forEach(b=>b.onclick=()=>manualVendorInspector(b.dataset.quoteManual));document.querySelectorAll('[data-quote-line]').forEach(b=>b.onclick=()=>{const [vendor,id]=b.dataset.quoteLine.split('|');inspect(vendor,Number(id));});
}

function evaluationDialog(v,fromOverview=false){
 if(busy)return;const current=evaluationExclusions(state.rfx)[v];
 if(current){setVendorEvaluation(state,v,{exclude:false});save();render();if(!fromOverview)vendorInspector(v);return;}
 $('#overlay').innerHTML=`<div class="modal"><article><h2>Exclude ${esc(v)} from evaluation?</h2><p>The quote and conversation will remain available. Rankings and award recommendations will be recalculated. You can restore this vendor later.</p><label for="evaluationReason">Reason</label><textarea id="evaluationReason" maxlength="1200" placeholder="For example: the offered delivery time exceeds our requirement."></textarea><div class="row"><button class="primary" data-confirm-exclusion="${esc(v)}" data-overview="${fromOverview?'true':'false'}">Exclude from evaluation</button><button ${fromOverview?'data-close':`data-cancel-exclusion="${esc(v)}"`}>Cancel</button></div><div id="inlineError" role="alert"></div></article></div>`;bindOverlay();
}
const priorEvaluationOverlay=bindOverlay;
bindOverlay=function(){priorEvaluationOverlay();document.querySelectorAll('#overlay [data-evaluation]').forEach(b=>b.onclick=()=>evaluationDialog(b.dataset.evaluation));document.querySelectorAll('[data-cancel-exclusion]').forEach(b=>b.onclick=()=>vendorInspector(b.dataset.cancelExclusion));document.querySelectorAll('[data-confirm-exclusion]').forEach(b=>b.onclick=()=>{try{if(busy)return;setVendorEvaluation(state,b.dataset.confirmExclusion,{exclude:true,reason:$('#evaluationReason').value});save();render();if(b.dataset.overview==='true')$('#overlay').innerHTML='';else vendorInspector(b.dataset.confirmExclusion);}catch(e){inlineError(e);}});};

function lockMutations(){document.querySelectorAll('#root [data-action],#root [data-extract],#root input[type="file"],#root [data-vendor-select],#root [data-buyer-answer]').forEach(b=>{if(b.dataset.action&&!['draft','send','applyDraft','discardDraft','confirm-blank','blank','extractAll','refreshInbox','sendSupplierMessage','sendClarification','freeze','updateClarifications','continueToVendors','addVendorQuestion'].includes(b.dataset.action))return;b.disabled=true;});}
function responseNextStep(){
 const count=activeVendorNames().filter(v=>state.data[v]).length;
 if(!count)return '';
 return `<section class="response-next-step" aria-label="Continue to supplier comparison"><div><h2>Compare supplier offers</h2><p>${count} quote${count===1?' is':'s are'} extracted. Compare prices and terms, or ask a question about the offers.</p></div><button class="primary" data-nav="compare">Compare & Ask <span aria-hidden="true">→</span></button></section>`;
}
function responseProgress(){return '';}

function evaluationNotice(){
 const usd=Object.values(state.data).some(x=>x.quotes?.some(q=>q.currency==='USD')),missing=usd&&(!Number.isFinite(state.rfx.fx)||state.rfx.fx<=0||!state.rfx.fxDate);
 return `${missing?'<div class="notice warn"><b>USD offers need an exchange rate</b><p>INR prices remain available. Add a dated rate to compare USD prices.</p><button data-action="setEvaluationFx">Set exchange rate</button></div>':usd?'<button class="mini" data-action="setEvaluationFx">Review exchange rate</button>':''}`;
}
function evaluationFxDialog(){$('#overlay').innerHTML=`<div class="modal"><article><h2>Currency conversion for comparison</h2><p>Enter the INR value of one USD and the date that rate applies to.</p><label>INR per USD<input id="evaluationFx" type="number" min="0" step="any" value="${esc(state.rfx.fx||'')}"></label><label>Reference date<input id="evaluationFxDate" type="date" value="${esc(state.rfx.fxDate||'')}"></label><button data-action="saveEvaluationFx">Update comparison</button><button data-close>Cancel</button><div id="inlineError"></div></article></div>`;bindOverlay();}
function previousQuoteDialog(v){const x=state.previousQuotes?.[v];if(!x)return;const r=x.meta?.previousRfx||state.rfx;$('#overlay').innerHTML=`<div class="drawer"><article><div class="row between"><h2>${esc(v)} · Previous quote</h2><button data-close>Close</button></div><div class="notice warn">For reference only. This quote is excluded from the current comparison while the updated response is pending.</div><table><thead><tr><th>Item</th><th>Quoted rate</th></tr></thead><tbody>${r.lines.map(l=>{const q=x.quotes.find(q=>q.lineId===l.id);return `<tr><td>${esc(l.name)}</td><td>${q?.price==null?'Not quoted':esc(q.price+' '+q.currency+' / '+q.unit)}</td></tr>`;}).join('')}</tbody></table></article></div>`;bindOverlay();}
const bindContinuity=bind;
bind=function(){bindContinuity();document.querySelectorAll('[data-clarification-choice]').forEach(b=>b.onclick=()=>{if(busy)return;const q=buyerClarifications(state.draft?.draft||state.rfx)[Number(b.dataset.clarificationChoice)];if(q){clarificationAnswers[q]=b.dataset.answer;save();render();}});document.querySelectorAll('[data-extract]').forEach(b=>{b.onclick=()=>config.allowLive?task('Reading '+b.dataset.extract+' original files…',()=>extract(b.dataset.extract)):settings();});document.querySelectorAll('[data-previous-quote]').forEach(b=>b.onclick=()=>previousQuoteDialog(b.dataset.previousQuote));};

// Present older app-generated messages consistently without rewriting source records.
function threadDisplayText(message){
 if(message.role!=='vendor')return message.text;
 const known={
 'Synthetic response received. Review the attached offer for pricing, omissions and open terms.':'Quotation received. Review the attached offer for item prices, delivery and commercial terms.',
 'Revised synthetic quotation attached. Requested supported topics have been addressed; check the document for remaining gaps.':'Revised quotation attached. Review the updated offer and any remaining open points.'};
 return known[message.text]||message.text;
}

const bindScenario=bind;
bind=function(){bindScenario();document.querySelectorAll('[data-comparable-only]').forEach(b=>b.onchange=()=>{comparableOnly=b.checked;render();});document.querySelectorAll('[data-inbox-jump]').forEach(b=>b.onclick=()=>{inboxVendor=b.dataset.inboxJump;view='inbox';render();});document.querySelectorAll('[data-supplier-query]').forEach(b=>b.onclick=()=>supplierQueryDialog(b.dataset.supplierQuery));};
function supplierQueryDialog(v){
 if(!state.sent||!activeVendorNames().includes(v))return notify('Send the RFQ before asking a supplier a question.');
 $('#overlay').innerHTML=`<div class="modal"><article><div class="row between"><h2>Ask ${esc(v)}</h2><button data-close>Cancel</button></div><input id="supplierQueryVendor" type="hidden" value="${esc(v)}"><label for="supplierQueryText">Message to supplier</label><textarea id="supplierQueryText" rows="7" maxlength="6000" placeholder="Type a question or share a note...">${esc(state.supplierQueryDrafts?.[v]||'')}</textarea><p class="muted">This query stays in the supplier conversation. It does not send external email, generate an automatic reply, or change the current quote.</p><button class="primary" data-action="sendSupplierQuery" ${busy?'disabled':''}>Send query</button><div id="inlineError" role="alert"></div></article></div>`;
 bindOverlay();$('#supplierQueryText').focus();
}

async function receiveSupplierReplies(){
 if(!state.sent||state.sentSignature!==rfxSourceSignature(state.rfx))throw Error('Approve and send the current requirement before checking replies.');
 let received=0;state.replyErrors||={};
 for(const v of participatingVendors(state.rfx))if(!state.packages[v]||state.packages[v].signature!==rfxSourceSignature(state.rfx)){
  try{await generateResponse(v);if(state.packages[v]?.signature===rfxSourceSignature(state.rfx))received++;delete state.replyErrors[v];}catch(e){state.replyErrors[v]=e.message;}
 }
 save();return received;
}
function aboutProduct(){$('#overlay').innerHTML=`<div class="modal"><article><div class="row between"><h2>About RFx Copilot</h2><button data-close>Close</button></div><p>Define a purchase request, review supplier offers, ask questions and record an award recommendation.</p><p>This prototype generates supplier messages and response documents; it does not send external email or issue purchase orders. Requirement drafting, document extraction and analytical answers use your connected AI deployment.</p></article></div>`;bindOverlay();}
const actionAbout=action;action=async function(a){if(a==='about')return aboutProduct();return actionAbout(a);};
