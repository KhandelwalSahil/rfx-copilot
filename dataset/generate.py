from pathlib import Path
import json, math, base64
from openpyxl import Workbook
from docx import Document
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from PIL import Image,ImageDraw,ImageFont,ImageFilter
P=Path(__file__).parent
items=[
('A4 paper 75 GSM','500 sheets, white, 75 GSM',66000,'ream',270),('A4 paper 70 GSM','500 sheets, white, 70 GSM',24000,'ream',245),('A4 paper 80 GSM','500 sheets, white, 80 GSM',18000,'ream',295),('A3 paper 75 GSM','500 sheets, white',6000,'ream',540),('Blue ballpoint pen','0.7 mm, blue',120000,'piece',8),('Black ballpoint pen','0.7 mm, black',60000,'piece',8),('Sticky notes','76 x 76 mm, 100 sheets',24000,'pad',25),('Permanent marker','black, 2 mm',15000,'piece',18),('Whiteboard marker','blue, refillable',18000,'piece',24),('Lever arch file','A4, 75 mm spine',18000,'piece',85),('Ring binder','A4, 2 ring',12000,'piece',55),('Document folder','A4, polypropylene',36000,'piece',15),('Staple pins','24/6, 1000 pins',12000,'box',12),('Stapler','24/6, 20 sheet capacity',3000,'piece',110),('Notebook','A5, 160 ruled pages',30000,'piece',45),('Packing tape','48 mm x 65 m',18000,'roll',38),('Scissors','8 inch stainless steel',3000,'piece',65),('Desk tissue','2 ply, 100 pulls',48000,'box',35),('Toilet tissue','2 ply, 200 sheets',72000,'roll',22),('Hand towel','2 ply, 150 sheets',48000,'pack',45),('Floor cleaner','5 litre can, neutral pH',12000,'can',340),('Garbage bags','30 x 50 inch, 25 bags, 0.50 kg per pack',48000,'pack',75),('Hand wash','5 litre can, pH 5.5 to 7',12000,'can',360),('Nitrile gloves','powder free, medium, 100 gloves',18000,'box',210),('Microfibre cloth','40 x 40 cm, 300 GSM',24000,'piece',35),('Paper cup','150 ml, food grade',1200000,'piece',0.8),('Wooden stirrer','140 mm, food grade',1200000,'piece',0.35),('Toner HP 12A','genuine OEM, sealed, QA approval required',1800,'cartridge',2300),('Toner HP 88A','genuine OEM, sealed, QA approval required',1200,'cartridge',2400),('Toner HP 05A','genuine OEM, sealed, QA approval required',900,'cartridge',3100)]
lines=[dict(id=i+1,name=a,spec=b,quantity=c if i<4 else c//4,unit=d,baseline=e) for i,(a,b,c,d,e) in enumerate(items)]
questions=[dict(id='Q1',text='Quality system certificate valid through 31 Mar 2028',gate=True),dict(id='Q2',text='Paper test report supplied and matches 70/75/80 GSM scope',gate=True),dict(id='Q3',text='Buyer sample approval recorded for offered specifications',gate=True),dict(id='Q4',text='GST registration identifier',gate=False),dict(id='Q5',text='Monthly paper capacity in reams',gate=False),dict(id='Q6',text='Delivery lead time in days',gate=False),dict(id='Q7',text='Payment term in days',gate=False),dict(id='Q8',text='Quote valid until',gate=False),dict(id='Q9',text='Freight basis',gate=False),dict(id='Q10',text='Returns and replacement policy',gate=False),dict(id='Q11',text='Subcontracting disclosure',gate=False),dict(id='Q12',text='Brand and specification deviations',gate=False)]
rfx=dict(title='Office and housekeeping supplies annual rate contract',scope='Three regional service hubs supporting a 50,000-person network. Forecast consumption only, monthly call-offs. 1 Apr 2027 to 31 Mar 2028.',deadline='2026-11-14',currency='INR',fx=84,fxDate='2026-11-05',fxNote='Synthetic planning assumption, not a market rate',terms='Delivered to Delhi, Bengaluru and Pune hubs. Exclude recoverable GST from evaluated cost; display tax separately. Fixed INR prices through contract period. No minimum volume commitment. Annual forecast used only for evaluation. All discounts evaluated against actual scenario allocation. Reply in any format. Deadline 14 Nov 2026, 18:00 IST.',lines=lines,questions=questions)
rfx['questions'][0]['rule']={'type':'date_on_or_after','date':'2028-03-31'}
for q in rfx['questions'][1:3]: q['rule']={'type':'evidence_pass'}
(P/'rfx.json').write_text(json.dumps(rfx,indent=2))
vendors=['Metro','Bharat','Jaipur Paper','Rajan','QuickDesk']
price={v:[] for v in vendors}
for vi,v in enumerate(vendors):
 for l in lines:
  factor=[1.02,0.98,0.92,1.01,1.04][vi]+((l['id']*(vi+2))%7-3)*0.008
  price[v].append(round(l['baseline']*factor,2))
def qa(v):
 return f'''QUESTIONNAIRE RESPONSE {v}\nQ1: Yes. Certificate {v}-QMS-2026 attached.\nQ2: Yes. Paper scope report attached for 70, 75 and 80 GSM.\nQ3: Refer buyer sample approval register attached.\nQ4: Synthetic GST ID TEST-{v.upper().replace(' ','')}-001.\nQ5: 18000 reams monthly.\nQ6: 7 days.\nQ7: 45 days.\nQ8: 31 December 2026.\nQ9: {'Freight extra, amount to be confirmed' if v=='QuickDesk' else 'Delivered to all three hubs, freight included'}.\nQ10: Defects replaced within 7 days.\nQ11: None.\nQ12: All specifications match, OEM toner only.\n'''
def pdf(path,title,rows):
 c=canvas.Canvas(str(path),pagesize=A4);w,h=A4;y=h-42;page=1
 def head():
  nonlocal y
  c.setFont('Helvetica-Bold',14);c.drawString(36,y,title);y-=24
  c.setFont('Helvetica',8);c.drawString(36,y,'SYNTHETIC DEMO DATA - NOT A REAL COMMERCIAL OFFER');y-=20
 head()
 import textwrap
 for row in rows:
  for s in textwrap.wrap(row,112) or ['']:
   if y<45:
    c.setFont('Helvetica',8);c.drawString(36,25,f'Page {page}');c.showPage();page+=1;y=h-42;head()
   c.setFont('Helvetica',9);c.drawString(36,y,s);y-=14
 c.setFont('Helvetica',8);c.drawString(36,25,f'Page {page}');c.save()
wb=Workbook();ws=wb.active;ws.title='Commercial offer';ws.append(['METRO DISTRIBUTORS - annual offer, all prices ex GST, delivered']);ws.append(['Our SKU','Product','Pack / pricing unit','Rate INR','Annual forecast'])
for l,p in zip(lines,price['Metro']):ws.append([f'M-{l["id"]:03}',l['name'],l['unit'],p,l['quantity']])
ws2=wb.create_sheet('Terms and questionnaire')
for row in qa('Metro').splitlines():ws2.append([row])
wb.save(P/'Metro.xlsx')
rows=['Commercial offer BH-2026-11. Delivered, GST extra. Payment 45 days.']
for l,p in zip(lines,price['Bharat']):
 if l['id']>=28:rows.append(f"Line {l['id']}: {l['name']}; USD {round(p/84,2):.2f} per {l['unit']}; OEM specification.")
 else:rows.append(f"Line {l['id']}: {l['name']}; INR {p:.2f} per {l['unit']}.")
rows+=['Footnote 1: 2.5% discount on paper lines 1-4 only if the awarded annual paper allocation is at least 80,000 reams. Other items excluded. No other charges.']+qa('Bharat').splitlines()
pdf(P/'Bharat.pdf','Bharat Office Distribution',rows)
d=Document();d.add_heading('Jaipur Paper commercial proposal',0);d.add_paragraph('Synthetic demo data. We quote lines 1 through 27 only. No offer for toner. Delivered, GST extra. Payment 45 days.')
for l,p in zip(lines[:27],price['Jaipur Paper']):d.add_paragraph(f"For line {l['id']}, {l['name']}, we offer INR {p:.2f} per {l['unit']}. Specification as requested.")
d.add_paragraph(qa('Jaipur Paper'));d.save(P/'Jaipur-Paper.docx')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',24);bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',32)
im=Image.new('RGB',(1450,1720),'#e9e5dc');dr=ImageDraw.Draw(im);dr.rectangle((60,45,1390,1675),fill='#fffdf6');dr.text((90,70),'RAJAN TRADERS  |  RATE CARD',font=bold,fill='black');dr.text((90,120),'SYNTHETIC DEMO / Delivered / GST extra / INR',font=font,fill='black')
for i,(l,p) in enumerate(zip(lines,price['Rajan'])):
 unit=l['unit'];rate=p
 if l['id']<=4:unit='carton (5 reams)';rate=round(p*5,2)
 if l['id'] in [5,6,8,9,17,25]:unit='100 pieces';rate=round(p*100,2)
 dr.text((90,180+i*46),f"{l['id']:02}  {l['name'][:24]:24}  {rate:.2f} / {unit}",font=font,fill='#252525')
dr.text((90,1580),'Questionnaire and evidence: see Rajan-evidence.pdf',font=font,fill='black')
im=im.rotate(6,expand=True,fillcolor='#b8afa0').resize((1310,1620)).filter(ImageFilter.GaussianBlur(.45));im.save(P/'Rajan-rate-card.jpg',quality=80)
prior='QUICKDESK FY26 CONTRACT REGISTER\n'+'\n'.join(f"Line {l['id']}: {l['name']} = INR {p:.2f} / {l['unit']}." for l,p in zip(lines,price['QuickDesk']))+'\nHistorical rates. Apply to FY27 only where vendor expressly carries forward.'
(P/'QuickDesk-FY26.txt').write_text(prior)
(P/'QuickDesk-email.txt').write_text('From: quotes@quickdesk.example\nSubject: Re RFQ-2027 Office supplies\n\nLine 1 paper 75 GSM INR 265/ream; line 22 garbage bags INR 144/kg. 70 GSM and all remaining lines same as FY26 contract attached. Freight extra, amount to follow. GST extra.\n'+qa('QuickDesk'))
for v in vendors:
 expiry='30 September 2026' if v=='Jaipur Paper' else '31 December 2028'
 rows=qa(v).splitlines()+[f'EVIDENCE: Quality system certificate {v}-QMS-2026. Valid until {expiry}. Scope: office and housekeeping distribution. Synthetic issuer, demo only.','EVIDENCE: Paper report PR-2026 matches 70, 75 and 80 GSM for proposed paper grades. Test result: conforms. Synthetic lab, demo only.','BUYER SAMPLE APPROVAL REGISTER: QA-2026-11. Approved offered specifications for all quoted lines. Approved by Demo QA Lead on 4 Nov 2026. This is buyer evidence, not vendor self-certification.']
 pdf(P/(v.replace(' ','-')+'-evidence.pdf'),v+' questionnaire and evidence',rows)
# Expected values are test-only. Never embedded in the runtime.
(P/'answer-key.json').write_text(json.dumps({'prices':price,'baseline':sum(l['quantity']*l['baseline'] for l in lines),'expectedCoverage':{'Metro':30,'Bharat':30,'Jaipur Paper':27,'Rajan':30,'QuickDesk':30},'expectedQuality':{'Jaipur Paper':'fail'},'knownEdges':['Bharat allocation-dependent discount','Bharat USD toner at synthetic FX 84','Rajan carton and 100 piece rates','QuickDesk kg to pack via 0.50 kg specification','QuickDesk unresolved freight','Jaipur expired quality certificate overrides Yes','Jaipur missing three toner lines']},indent=2))
print('Baseline INR',sum(l['quantity']*l['baseline'] for l in lines))
