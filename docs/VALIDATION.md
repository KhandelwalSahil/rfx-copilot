# Validation status

## Completed offline

- The original 30-line benchmark remains available; five suppliers are retained by default.
- Source generator v2 has multiple line-level price leaders, a quality-failed low bidder, a supported split with positive savings, and allocation-dependent discount loss.
- Browser verification generated all five native packages for the 30-item benchmark with zero extracted records. The workbook exposed two sheets with cell coordinates; historical and questionnaire files were attached to the correct suppliers. All generated file types passed the local rehearsal preparer. Photo layout was inspected, then compacted further for legibility.
- Deterministic delivery/payment checks distinguish met, conflicting and unknown commitments. Missing required commitments block allocation and award; optional terms are not invented as mandatory.
- 152 unit and mock-transport tests pass. Rerun npm test for the authoritative current count.
- A matching v2 extraction scorer and an explicit-opt-in real-model rehearsal runner are included. These scripts do not execute automatically.

## Not yet established

- Live Azure extraction accuracy across the five generated packages.
- Manual fidelity of PDF/photo citations and evidence relevance.
- Quality of unseen analytical follow-ups over real extracted responses.
- A real recorded analyst conversation.
- Reviewer sharing and user-owned GitHub repository access.

No production runtime model key was configured at the time of this review. No live provider calls, fabricated model results or synthetic accuracy scores are claimed. These remaining checks require a connected model session. Browser fixture tests establish rendering and workflow behaviour only.

## Rehearsal acceptance checklist

Inspect all 150 supplier-item slots; retain missing/uncertain states rather than guessing. Check raw currencies and units as well as normalized prices, exact source locations, the expired certificate, missing freight, historical references and the discount threshold. Ask at least one unplanned question and repeat a question after a genuine re-extraction of revised source files. Preserve model/response IDs and source hashes in the saved run. Log every observed error and recovery before recording the submission.

## Continuous workflow validation (6 November 2026)

- 165 automated checks pass. Added regressions for independent batch failures, skipping completed responses, late FX setup, selected-supplier award provenance, explicit pending-response acknowledgement, old quote retention, saved custom packages and stale-scope rejection.
- Browser QA used an isolated, explicitly labelled UI fixture, never published and never counted as AI extraction accuracy. Verified a failed response has its own retry, comparison remains available with partial intake, and confirmation is disabled until pending suppliers are acknowledged.
- Browser QA verified adding a dated USD conversion rate updates the comparison without removing extracted quotes or requiring another model call.
- Supplier-facing requirement amendments retain conversations, original packages and prior quotes, but require an approved updated RFQ and fresh offers. Evaluation-only FX changes preserve current extraction. Previous quotations are reference-only.
- Successful extraction is still an actual provider result. This change does not substitute canned extraction or analyst answers. Live Azure calls were not performed during this workflow validation.

## Seven-supplier scenario (6 November 2026)

- Opt-in scenario retains the original five-supplier benchmark and adds a 30-line, three-hub, seven-supplier rehearsal. Six suppliers reply; NorthStar intentionally has no package or extraction result.
- Initial states cover a high-price observation, late delivery, 27/30 offers, expired evidence contradicting a declaration, an unknown pack count on a photographed rate card, missing location coverage/freight/sample evidence, and non-negotiable advance payment/no Pune service.
- Supplier revisions generate actual updated source documents. Rajan's unit clarification produces a typed XLSX schedule. Source generation never writes extracted quote records or analyst responses.
- Browser QA generated and prepared 13 original attachments across six supplier packages using the actual native-source preparation pipeline, with zero extracted records. NorthStar remained pending. Separate revision-source QA generated updated native files, preserved originals and again retained zero extraction records.
- Offline acceptance reference (not live extraction): four comparable suppliers after targeted revisions and Metro exclusion; the cost-optimal allocation uses Bharat for lines 1-17 and Pioneer for lines 18-30. At INR 95/USD dated 6 November 2026, expected split total INR 37,782,937.50 versus best single-supplier Bharat INR 38,461,600.93, saving INR 678,663.43 (1.7645%). Freight of INR 450,000 and paper discount of INR 1,483,500 are included in the split total.
- `scripts/seven-reference.mjs` is offline acceptance data only. It is never imported into the app/server or used to claim measured model accuracy. The model must extract the actual source files and answer using current data.
- Live Azure calls were not made during this scenario build. User testing with the configured model is still needed to establish extraction fidelity and analyst answer quality.
