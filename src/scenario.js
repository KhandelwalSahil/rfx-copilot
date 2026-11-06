// Scenario definition contains buyer inputs and a test script only, never extracted supplier results.
export function sevenSupplierScenario(base,{guided=true}={}){
 const r=JSON.parse(JSON.stringify(base));
 r.scenarioId='seven-supplier-2027';r.invitedVendors=['Metro','Bharat','Jaipur Paper','Rajan','QuickDesk','Pioneer','NorthStar'];
 r.title='2027–28 office and housekeeping supplies — Delhi, Bengaluru and Pune';
 r.scope='Annual rate contract from 1 Apr 2027 to 31 Mar 2028 for the Delhi, Bengaluru and Pune service hubs. Thirty line items; annual forecasts only, monthly purchase-order call-offs, no minimum volume commitment. Each selected supplier must serve all three hubs for every awarded line. Destination quantities per line: Delhi 40%, Bengaluru 35%, Pune 25%; integer rounding is allocated to Pune. Award whole line items across all three hubs; no destination-specific split award is requested.';
 r.requiredLocations=['Delhi','Bengaluru','Pune'];r.deadline='2026-11-20';r.currency='INR';r.fx=null;r.fxDate='';r.fxNote='Set a dated buyer-approved rate when USD offers arrive.';
 r.terms=guided?sevenSupplierTerms().replace(/^Delivery.*?No advance payment\. /,''):sevenSupplierTerms();
 r.buyerClarifications=guided?['What delivery lead time should apply to each call-off, and when should that period start?','What payment period and invoice trigger should apply, and is advance payment acceptable?']:[];
 r.questions=[
 {id:'Q1',text:'Provide a quality-system certificate valid through 31 Mar 2028.',gate:true,rule:{type:'date_on_or_after',date:'2028-03-31'}},
 {id:'Q2',text:'Provide product test evidence matching the requested 70, 75 and 80 GSM paper specifications.',gate:true,rule:{type:'evidence_pass'}},
 {id:'Q3',text:'Provide the recorded buyer-approved sample evidence for the offered specifications.',gate:true,rule:{type:'evidence_pass'}},
 {id:'Q4',text:'Provide your GST registration reference.',gate:false},
 {id:'Q5',text:'State monthly paper supply capacity in reams.',gate:false},
 {id:'Q6',text:'Confirm delivery lead time from PO issuance for Delhi, Bengaluru and Pune separately. Disclose any hub you cannot serve.',gate:false},
 {id:'Q7',text:'Confirm payment period, invoice reference point and whether advance payment is required.',gate:false},
 {id:'Q8',text:'State quote validity and confirm fixed prices in the quoted currency for the contract period.',gate:false},
 {id:'Q9',text:'State fixed freight for the entire annual allocation across all three hubs; disclose any additional location charges.',gate:false},
 {id:'Q10',text:'Confirm replacement of damaged or nonconforming items and the replacement timeline.',gate:false},
 {id:'Q11',text:'Disclose any subcontracted fulfilment.',gate:false},
 {id:'Q12',text:'State offered brand, model, specification and any deviation for every quoted line. Show pack size and order unit clearly.',gate:false},
 {id:'Q13',text:'Confirm supply availability for the forecast and monthly call-offs, including all three hubs.',gate:false}
 ];
 r.lines=r.lines.map(l=>({...l,spec:l.spec+'; no brand restriction; quantities are order units, not quoted packs'}));
 return r;
}
export function sevenSupplierTerms(){return 'Delivery within 14 calendar days from PO issuance to Delhi, Bengaluru and Pune for every awarded line. Payment within 30 calendar days from invoice receipt. No advance payment. Prices fixed in the quoted currency from 1 Apr 2027 to 31 Mar 2028. INR and USD quotes accepted; evaluation in INR using the buyer-approved dated exchange rate. Quote fixed annual freight once per selected supplier covering all three hubs and all allocated items; no separate location surcharge. Exclude recoverable GST from evaluated cost and state tax separately. No minimum order quantity or guaranteed annual volume. Replace damaged or nonconforming items within 7 calendar days of notification at no additional charge. Quote valid through 31 Dec 2026. Award whole requested lines across all hubs; supplier must service all three hubs for each awarded line.';}
export function scenarioSupplierStatus(rfx,vendor){return rfx.scenarioId==='seven-supplier-2027'&&vendor==='NorthStar'?'awaiting':null;}
export const sevenScenarioGuide={
 buyerAnswer:'Delivery within 14 calendar days from PO issuance for every call-off to Delhi, Bengaluru and Pune. Payment within 30 calendar days from invoice receipt. No advance payment. Prices fixed in the quoted currency for 1 Apr 2027 to 31 Mar 2028. Quote valid through 31 Dec 2026. Fixed annual freight must cover all three hubs, with no location surcharge. Show GST separately and exclude recoverable GST from evaluated costs. No MOQ or guaranteed annual volume. Replace damaged or nonconforming items within 7 days at no charge. Keep all confirmed items, quantities, specifications and mandatory qualification rules unchanged.',
 clarifications:[
 ['Bharat','Can you improve delivery from 21 to 14 calendar days from PO issuance at all three hubs? Confirm no price change, the paper discount threshold and exactly which awarded lines qualify.'],
 ['Jaipur Paper','Please quote missing lines 28, 29 and 30 with their requested specifications and quantities. Provide a current quality-system certificate valid through 31 Mar 2028 and confirm the paper test and sample approval evidence.'],
 ['Rajan','Confirm the raw quoted price and exact number of order units in each carton or 100-piece pack, especially line 5. Provide a typed current rate schedule and the missing offered model for line 1. Confirm no price or specification change.'],
 ['Pioneer','Confirm supply availability and delivery commitment for Pune as well as Delhi and Bengaluru. Confirm fixed freight for all three hubs and provide the outstanding sample-approval evidence. Keep current prices and confirm payment within 30 days from invoice receipt with no advance.']
 ],
 asks:['Which suppliers can meet all our requirements today, and what is preventing each remaining offer from being comparable?','Compare the four eligible suppliers across all 30 items, including freight and supported discounts. Show a cost table and cite the sources.','Which supplier has the lowest unit price for each paper item? How does the conditional discount change the answer?','Would a split award save money compared with the best complete single-supplier offer? Show the allocation, freight and savings.','Does Bharat qualify for the paper discount under the recommended allocation? Show the awarded volume and threshold.','Which prices were quoted in USD or per carton or 100 pieces? Explain the supported conversions and source references.','Compare using INR 85, INR 95 and INR 105 per USD. Does the preferred allocation change? Treat these as exploratory scenarios.','What happens if we exclude Pioneer from this scenario? Recalculate cost and identify which items move suppliers.','Why was Metro excluded, why is QuickDesk not comparable, and what does NorthStar’s missing response mean for this recommendation?','Recommend an award and explain delivery coverage, qualifications, unresolved risks and the cost versus operational complexity trade-off.']
};
