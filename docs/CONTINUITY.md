# Continuous buyer journey

Requirements owns unresolved buyer decisions, incomplete specifications and vague commercial terms. Optional preferences are not automatically mandatory; the buyer can explicitly invite supplier proposals. Clarification answers can be entered together, and common preference questions offer a short selectable answer. Answers still pass through the requirement update before becoming supplier instructions.

Supplier responses can be read as they arrive. Bulk extraction only reads current available packages without saved current results, continues after an individual failure and exposes a targeted retry. It remains serial to avoid unnecessary rate pressure. Existing quote summaries, comparison and navigation stay readable during model processing; conflicting mutations remain protected.

Clarification messages are derived from the actual current quote issues, or the selected line. A revised source package moves the prior quote into a clearly labelled reference view. New pricing and evidence only enter the comparison after extraction. Sources and conversations persist across requirement edits. Missing original files invalidate only the affected supplier.

Evaluation settings such as FX are collected at comparison when needed. INR offers remain usable without FX. USD conversion requires both a positive rate and a reference date. Changing that evaluation basis reopens recommendations and marks earlier analyst answers as out of date, without rereading unchanged sources.

A recommendation can use complete, sourced eligible offers without waiting for every invited supplier. Confirmation requires acknowledgement of any suppliers without current extracted responses. Every selected supplier must still have current scope, source hashes, supported prices, known freight and satisfied mandatory conditions. Pending suppliers are included in the saved recommendation record.

Supplier-facing amendments require new approval and updated offers. Existing offers are kept for reference and do not silently become quotes for changed quantities, specifications or commercial terms. No external emails, orders or legal awards are issued by the prototype.

Draft messages, clarification answers and award rationale are saved in browser storage. Model credentials remain memory-only. Browsers can impose storage limits; the workspace warns if saving fails. Extraction jobs interrupted by reload are retryable rather than stuck as running. The application does not promise background completion after the browser closes.
