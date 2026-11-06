// Shared browser/Node PDF renderer. No provider call or market data is involved.
export async function createRfqPdf(rfx,{PDFLib,fontkit,regularBytes,boldBytes}){
 const doc=await PDFLib.PDFDocument.create();doc.registerFontkit(fontkit);
 const normal=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true});
 const {rgb}=PDFLib,green=rgb(.08,.25,.20),ink=rgb(.12,.20,.18),muted=rgb(.39,.45,.42),line=rgb(.83,.88,.85),pale=rgb(.94,.97,.95);
 const width=595.28,height=841.89,margin=44,bodyWidth=width-margin*2;let page,y;
 doc.setTitle('RFQ-2027-001 | '+rfx.title);doc.setAuthor('Procurement team');doc.setCreator('Aerchain RFx Copilot');doc.setSubject('Approved purchase requirement and vendor questionnaire');
 const supported=new Set(normal.getCharacterSet());
 const plain=value=>{const s=String(value??'').replace(/\r/g,'').replace(/\t/g,' ');for(const c of s)if(c!=='\n'&&!supported.has(c.codePointAt(0)))throw Error('The RFQ PDF font does not support character '+c+'. Please use a supported spelling before sending.');return s;};
 const wrap=(value,size=10.5,max=bodyWidth,font=normal)=>{
  const result=[];for(const paragraph of plain(value).split('\n')){let row='';for(const word of paragraph.split(/\s+/).filter(Boolean)){
   if(font.widthOfTextAtSize((row?row+' ':'')+word,size)<=max){row+=(row?' ':'')+word;continue;}
   if(row){result.push(row);row='';}
   for(const c of word){if(row&&font.widthOfTextAtSize(row+c,size)>max){result.push(row);row='';}row+=c;}
  }result.push(row);}return result;
 };
 const newPage=()=>{page=doc.addPage([width,height]);page.drawRectangle({x:0,y:height-9,width,height:9,color:green});page.drawText('AERCHAIN  /  REQUEST FOR QUOTATION',{x:margin,y:height-42,size:9,font:bold,color:green});page.drawText('RFQ-2027-001',{x:width-margin-85,y:height-42,size:9,font:normal,color:muted});page.drawLine({start:{x:margin,y:height-54},end:{x:width-margin,y:height-54},thickness:.6,color:line});y=height-76;};
 const ensure=needed=>{if(y-needed<52)newPage();};
 const block=(text,{size=10.5,font=normal,color=ink,gap=9}={})=>{const rows=wrap(text,size,bodyWidth,font),leading=size*1.42;for(const row of rows){ensure(leading);if(row)page.drawText(row,{x:margin,y:y-size,size,font,color});y-=leading;}y-=gap;};
 const section=title=>{ensure(42);y-=6;page.drawText(title,{x:margin,y:y-11,size:11,font:bold,color:green});y-=24;};
 newPage();block(rfx.title,{size:20,font:bold,gap:12});
 block('Quotation deadline: '+rfx.deadline+' at 18:00 IST',{size:10,font:bold,color:green});
 section('1. Purchase scope');block(rfx.scope);
 section('2. Delivery and commercial requirements');block(rfx.terms);
 section('3. Requested items');
 const descriptionWidth=310,quantityWidth=110;
 const tableHeader=()=>{ensure(36);page.drawRectangle({x:margin,y:y-24,width:bodyWidth,height:25,color:green});page.drawText('REF.',{x:margin+8,y:y-16,size:9,font:bold,color:rgb(1,1,1)});page.drawText('ITEM AND SPECIFICATION',{x:margin+43,y:y-16,size:9,font:bold,color:rgb(1,1,1)});page.drawText('QUANTITY',{x:margin+375,y:y-16,size:9,font:bold,color:rgb(1,1,1)});y-=32;};
 tableHeader();
 for(const item of rfx.lines){
  const name=wrap(item.name,10,descriptionWidth,bold),spec=wrap(item.spec,9.5,descriptionWidth,normal),quantity=wrap(Number(item.quantity).toLocaleString('en-IN')+' '+item.unit,10,quantityWidth,normal);
  const rows=[...name.map(t=>({text:t,font:bold,size:10})),...spec.map(t=>({text:t,font:normal,size:9.5}))];let offset=0,first=true;
  while(offset<Math.max(rows.length,quantity.length)){const rowCapacity=Math.floor((y-66)/14);if(rowCapacity<3){newPage();tableHeader();continue;}const count=Math.min(rowCapacity,Math.max(rows.length,quantity.length)-offset),chunk=rows.slice(offset,offset+count),h=count*14+15;
   if(y-h<52){newPage();tableHeader();continue;}
   page.drawRectangle({x:margin,y:y-h+4,width:bodyWidth,height:h,color:pale});
   if(first)page.drawText(String(item.id),{x:margin+8,y:y-11,size:10,font:normal,color:ink});quantity.slice(offset,offset+count).forEach((t,i)=>page.drawText(t,{x:margin+375,y:y-11-i*14,size:10,font:normal,color:ink}));
   chunk.forEach((r,i)=>page.drawText(r.text,{x:margin+43,y:y-11-i*14,size:r.size,font:r.font,color:ink}));y-=h;offset+=count;first=false;
  }
 }
 section('4. Vendor questionnaire');
 for(const [index,q] of rfx.questions.entries()){ensure(40);block((index+1)+'. '+q.text,{font:bold,gap:2});if(q.gate){let rule='Supporting evidence must demonstrate compliance.';if(q.rule?.type==='date_on_or_after')rule='Certificate must be valid through '+q.rule.date+'.';if(q.rule?.type==='number_at_least')rule='Minimum supported value: '+q.rule.minimum+'.';block('Mandatory qualification: '+rule,{size:9.5,color:muted,gap:9});}else y-=7;}
 section('5. How to respond');block('Quote each requested line using its reference number. State pricing unit or pack size, currency, taxes, freight, delivery commitment and quotation validity. Answer the vendor questionnaire, disclose unquoted lines and deviations, and include the supporting evidence requested.');
 const pages=doc.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:margin,y:39},end:{x:width-margin,y:39},thickness:.6,color:line});p.drawText('RFQ-2027-001  |  Procurement team',{x:margin,y:25,size:8,font:normal,color:muted});p.drawText('Page '+(i+1)+' of '+pages.length,{x:width-margin-65,y:25,size:8,font:normal,color:muted});});
 return doc.save();
}

// Buyer-facing decision summary. The evidence archive retains the detailed audit separately.
export async function createAwardPdf(rfx,analysis,decision,data,{PDFLib,fontkit,regularBytes,boldBytes}){
 const doc=await PDFLib.PDFDocument.create();doc.registerFontkit(fontkit);
 const normal=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true}),{rgb}=PDFLib;
 const width=595.28,height=841.89,margin=46,max=width-margin*2,green=rgb(.08,.25,.20),ink=rgb(.12,.20,.18);let page,y;
 const money=n=>n==null?'Not available':'INR '+Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const next=()=>{page=doc.addPage([width,height]);y=height-65;page.drawText('AERCHAIN  /  AWARD RECOMMENDATION',{x:margin,y:height-35,size:9,font:bold,color:green});};
 const block=(value,{size=10,font=normal,gap=8}={})=>{const lines=[];for(const para of String(value??'').split('\n')){let line='';for(const word of para.split(/\s+/).filter(Boolean)){const joined=(line?line+' ':'')+word;if(font.widthOfTextAtSize(joined,size)>max&&line){lines.push(line);line=word;}else line=joined;}lines.push(line);}for(const line of lines){if(y<60)next();if(line)page.drawText(line,{x:margin,y:y-size,size,font,color:ink});y-=size*1.45;}y-=gap;};
 const section=t=>{if(y<105)next();block(t,{font:bold,size:12,gap:7});};
 const a=analysis,s=a?.split;next();doc.setTitle('Award recommendation | '+rfx.title);doc.setAuthor('Procurement team');
 block(rfx.title,{size:18,font:bold,gap:12});block(decision?'Confirmed recommendation':'Draft recommendation',{font:bold});
 if(decision?.at)block('Confirmed: '+new Date(decision.at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}));
 section('1. Recommended allocation');
 block('Evaluated total: '+(s?.complete?money(s.total):'Incomplete - selected offers do not cover the complete requirement'));
 block('Best complete single supplier: '+(a?.bestSingle?a.bestSingle.vendor+' - '+money(a.bestSingle.total):'Not available'));
 block('Saving versus best complete single supplier: '+money(a?.savingsVsBestSingle));
 for(const v of s?.byVendor||[])block(v.vendor+': '+v.lines+' items; item subtotal '+money(v.subtotal)+'; discount '+money(v.discount)+'; freight '+money(v.freight)+'; evaluated amount '+money(v.subtotal-v.discount+v.freight));
 section('2. Assigned items');
 for(const l of rfx.lines){const cell=s?.allocations.find(c=>c.lineId===l.id);block(l.id+'. '+l.name+' | '+Number(l.quantity).toLocaleString('en-IN')+' '+l.unit+' | '+(cell?cell.vendor+' | '+money(cell.cost)+' before supplier-level discount/freight':'No eligible allocation'),{size:9,gap:4});}
 section('3. Evaluation basis');
 block('All requested quantities are evaluated. Recoverable GST is excluded. Known fixed freight is charged once per selected supplier. Conditional discounts apply only to supported lines and awarded quantities. Missing costs are not treated as zero.');
 if(Object.values(data).some(x=>x.quotes?.some(q=>q.currency==='USD')))block('Conversion: INR '+rfx.fx+' per USD, reference date '+rfx.fxDate+'.');
 section('4. Delivery and commercial commitments');
 for(const v of s?.byVendor||[]){const x=data[v.vendor];block(v.vendor,{font:bold});for(const k of ['delivery','payment','validity'])if(x?.commercialTerms?.[k])block(k[0].toUpperCase()+k.slice(1)+': '+x.commercialTerms[k].value,{size:9,gap:5});}
 section('5. Buyer rationale and outstanding offers');block(decision?.reason||'Buyer review and rationale are still required.');
 const excluded=Object.entries(rfx.evaluationExclusions||{});for(const [v,e]of excluded)block('Excluded supplier - '+v+': '+e.reason,{size:9});
 if(decision?.pendingSuppliers?.length)block('Buyer acknowledged proceeding without current extracted offers from: '+decision.pendingSuppliers.join(', ')+'. Those offers could change the outcome.');
 section('6. Supporting sources');for(const v of s?.byVendor||[]){block(v.vendor+': '+(data[v.vendor]?.meta?.files||[]).map(f=>f.name).join('; '),{size:9});}
 block('This document records a procurement recommendation. It does not issue a purchase order. Review the supporting records for the original quotations and evidence.',{size:9});
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText('RFQ-2027-001 | Page '+(i+1)+' of '+pages.length,{x:margin,y:28,size:8,font:normal,color:green}));return doc.save();
}
