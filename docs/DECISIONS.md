# Kill the Quote Spreadsheet
## Product decisions and deliberate boundaries

**Problem and scope.** A category buyer should move from an RFx and five inconsistent supplier replies to a defensible purchasing recommendation without retyping a comparison spreadsheet. The primary demonstration uses 30 office and housekeeping items, five suppliers, a questionnaire and supporting documents. Custom items within that category are supported; this is not a universal procurement platform.

**One buyer journey.** Requirements → Vendor Invitations → Supplier Responses → AI Insights & Ask → Award Recommendation. Buyers clarify material missing choices, approve the RFQ, inspect supplier exceptions, ask follow-up questions and confirm a recommendation. Detailed calculations and audit records remain available without dominating the interface.

**What is real.** The model drafts requirements, extracts actual supplier files and interprets analytical questions. Spreadsheet/Word readers preserve source coordinates; PDFs and images go directly to the multimodal model. The analyst calls bounded tools over the current extracted data. Code performs unit conversion, FX, discounts, coverage, quality rules and supported allocations. Suggested questions have no stored answers; model failure never substitutes a scripted result.

**What is simulated.** Supplier profiles, sending, replies, prior-price schedules and evidence are fabricated. Simulated replies create source files only, never extracted comparison records. Prices vary by item and supplier; documents include a 27-of-30 bid, expired evidence, USD rates, carton/per-100 pricing, historical carry-forward, an awarded-volume discount and unknown freight. Clarifications create revised originals which must be re-extracted.

**Trust and judgment.** Missing prices and freight remain unknown. A supplier declaration does not override contradictory evidence. Sources, corrections, exclusions and versions remain traceable. Supported mandatory delivery and payment conditions require sourced commitments; missing or incomparable commitments prevent selection. Source citations establish traceability, not document authenticity. Revised inputs reopen prior recommendations. The result is a buyer-reviewed recommendation, not an issued purchase order.

**Deliberately left out.** Production email, vendor discovery, multi-tenant storage, enterprise permissions, ERP/PO integration and autonomous negotiation. Optimization covers whole-line assignments, known fixed supplier freight and one supported conditional ream discount; capacity, minimum orders and other unsupported constraints need clarification. The browser workspace is a prototype, not a production system of record.

**Evaluation and remaining evidence.** Automated tests verify calculations, boundaries and workflow rules. They do not prove model accuracy. A live rehearsal must check all 150 supplier-item slots, evidence and citations; challenge the analyst with an unseen follow-up; revise an input; and record the real conversation. Report observed errors honestly rather than substituting a UI-only recording or a fabricated accuracy claim.
