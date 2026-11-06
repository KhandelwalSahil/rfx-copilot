# Seven-supplier end-to-end test

Open Requirements → Seven-supplier example. Loading is opt-in and asks before replacing the current browser workspace. Use Test walkthrough on any scenario page for buyer answers, targeted supplier messages and analytical prompts.

The generated scenario includes 30 office/housekeeping lines and Delhi, Bengaluru and Pune hubs. Complete the two buyer clarifications, retain seven recipients, review email/PDF and approve sending. Receive six replies; NorthStar remains pending. Extract the available packages with the connected model. Enter INR 95/USD dated 6 November 2026 when comparison needs FX.

| Supplier | Initial source issue | Intended treatment |
|---|---|---|
| Metro | Complete but materially higher prices | Buyer may exclude after comparing actual extracted offers; record reason |
| Bharat | USD toner prices, 21-day delivery, conditional paper discount | Clarify delivery commitment for all hubs; retain supported prices/discount |
| Jaipur Paper | Only 27 lines and expired certificate despite declaration | Request toner lines 28-30 and current qualification evidence |
| Rajan | Angled photo, missing line-5 pack count, missing line-1 model | Obtain typed XLSX unit/model confirmation |
| QuickDesk | Does not serve Pune; 100% advance non-negotiable | Not comparable against approved terms; clarification does not automatically fix it |
| Pioneer | Pune coverage/availability, freight and sample approval incomplete | Obtain specific coverage, freight and evidence confirmations |
| NorthStar | No response | Awaiting response; no invented offer or model extraction |

Re-extract each revised supplier only. Compare Bharat, Jaipur Paper, Rajan and Pioneer using Comparable offers only, or keep the seven-supplier view for context. Ask about eligibility, discount thresholds, carton/100-piece and USD conversions, FX sensitivity, alternative supplier exclusions and unsupported facts.

The offline reference after those revisions selects Bharat for lines 1-17 and Pioneer for 18-30. It includes INR 450,000 annual freight and INR 1,483,500 paper discount. Expected total: INR 37,782,937.50. Best complete single supplier: Bharat at INR 38,461,600.93. Saving: INR 678,663.43, or 1.7645%. Four suppliers are comparable, but extra freight makes a two-supplier allocation cheaper than using all four. This reference is not prefilled extraction, analyst output or a measured live-model result.

Acknowledge pending NorthStar when confirming. Export the recommendation and supporting records. Then optionally test exclusion/restore, file replacement, targeted partial clarification, failed-extraction retry, saved drafts, updated data after confirmation and a material requirement change.

See `scripts/build-seven-guide.py` for the detailed PDF walkthrough, and `scripts/seven-reference.mjs` for the independent offline acceptance report. Neither injects model output into the platform.
