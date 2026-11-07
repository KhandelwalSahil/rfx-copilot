# Aerchain RFx Copilot

A prototype for **Kill the Quote Spreadsheet**: 30 office/housekeeping items, five suppliers, mixed-format extraction and grounded procurement Q&A.

## Run and inspect the code

Requires Node 22.9+ only. Build and preview commands work on Windows, macOS and Linux. No package installation is needed for the vendored, dependency-free Worker runtime.

```bash
npm run compose
npm test
npm run dev -- --port 3000
```

Never commit credentials or real buyer exports.

## Current buyer journey

1. **Requirements:** start with an empty workspace or load the 30-item benchmark. Use real conversational drafting and answer material buyer clarifications. Supplier questions remain editable.
2. **Vendor Invitations:** review the fictional shortlist and supplier-facing email/PDF, choose recipients and approve simulated sending.
3. **Supplier Responses:** receive fabricated source files, inspect actual attachments and extract with the connected model. Clarifications create revised files and invalidate the affected extraction.
4. **Compare Vendors & Ask:** use the full-width comparison for all supplier totals, coverage, delivery and conflicts; switch to the full-width copilot for questions. Open detailed prices/answers/documents when needed. Ask naturally, inspect sources or cost breakdowns, and exclude/restore suppliers.
5. **Award Recommendation:** review allocation, savings and trade-offs. Resolve missing required commitments, review evidence and record buyer rationale before confirming. No purchase order is issued.

## Real AI and simulated plumbing

Live AI defaults OFF for local preview. Configure a vision-capable Azure deployment in Model settings and explicitly enable live requests. Browser-entered credentials stay in page memory and clear on reload; no key is stored in localStorage. Alternatively supply OPENAI_API_KEY, MODEL_BASE_URL and MODEL_DEPLOYMENT on the server. Set `RFX_AUTO_CONNECT=true` to enable AI and run a small connection test automatically on each page load; credentials stay on the server.

For local server credentials, copy `.env.example` to `.env` and fill in the key,
the API base URL (ending in `/openai/v1/`, not `/responses`) and deployment name.
Restart `npm run dev`, then enable AI requests and test the connection in Model settings.
The preview binds to localhost. Azure App Service uses `npm start`, its assigned
`PORT`, and the canonical HTTPS `WEBSITE_HOSTNAME` for same-origin API checks.
Container Apps uses the included `Dockerfile`; set `PUBLIC_ORIGIN` to the exact
HTTPS application URL so the server binds externally and validates browser origins.
For production, protect a hosted server key with authentication and usage controls
so untrusted visitors cannot spend your model quota.

## Azure deployment

The demo is deployed at https://rfx-copilot.whitecliff-8885ace2.northcentralus.azurecontainerapps.io/
in `rg-aerchain-demo`, using one consumption Container App (0.5 vCPU, 1 GiB,
zero minimum / one maximum replica). Cold starts are expected. Compute, image
build/storage and model usage can incur charges.

This testing deployment is publicly accessible without sign-in, as requested by
the owner. AI is enabled automatically using the `gpt-5.4-mini` Azure Foundry
deployment and an API key stored as a Container App secret, never in source or
the image. Each page load makes a small live connection-test request.
Hosted visitors see a read-only AI status; model settings remain available only
in the local, manually configured preview.
There are no public usage caps: anyone with the URL can incur model charges.
Keep provider quota low, monitor costs and add access/usage controls before
broader distribution. Do not upload confidential buyer information to a public demo.

The private image is `paiosacr44326.azurecr.io/rfx-copilot:20261107-5`.
Image pulls use the `rfx-copilot-identity` managed identity with `AcrPull`.
Rebuild with `az acr build` using the included Dockerfile, then update the app
image with `az containerapp update`. Git pushes do not automatically deploy.
Use explicit subscription and resource-group arguments for Azure commands;
do not alter the existing PAIOS applications.

The same-origin Worker calls the Responses API for drafting, extraction and an iterative analyst tool loop. Code handles exact supported procurement arithmetic; it never fabricates model answers. Native XLSX/DOCX files are read with source coordinates. Actual PDF/image bytes go to the model. Uploaded documents are data, not executable instructions.

SMTP, fictional supplier profiles, replies and evidence are simulated. Source generator v2 produces an off-template two-sheet workbook, reversed PDF item schedule with discount footnote, paragraph Word offer, skewed photographic rate card with separate questionnaire, and an email referencing an attached prior-rate schedule. Raw source prices deliberately omit normalized INR line totals. All files depend on the approved RFx items and quantities. Historical carry-forward, partial coverage, unknown freight, USD, pack bases and expired certificates remain explicit challenges. Generated data is never assigned to extracted comparison state.

## Validation

```bash
npm test
npm run build
npm run validate
```

Automated tests cover conversion, exact supported allocation against an exhaustive oracle, scope/exclusion handling, source schema, uncertainty, mandatory delivery/payment commitments and revision invalidation. Mock transport tests are not live model evaluations. See [VALIDATION.md](docs/VALIDATION.md) for the observed status and [DEMO.md](DEMO.md) for the real-session runbook.

After receiving fresh v2 demo replies, export **Compare Vendors & Ask → Downloads → Workspace record**. To score an actual extraction run:

```bash
node scripts/score-run.mjs /private/path/workspace-record.json
```

The offline oracle reconstructs the generated source facts for that exact RFx, revision and supported clarification state. It is never imported into the server or sent to a model. Legacy/static/uploaded packages require independent expected facts and are rejected by this scorer. Source locator accuracy, evidence relevance and semantic commitment fidelity still need manual review.

An optional real-model rehearsal runner prepares every actual package and saves real provider results and tool traces:

```bash
# Set OPENAI_API_KEY, MODEL_BASE_URL, MODEL_DEPLOYMENT privately in your environment.
AERCHAIN_ALLOW_LIVE=true node scripts/rehearse-live.mjs /private/path/workspace-record.json /private/path/rehearsal
node scripts/score-run.mjs /private/path/rehearsal/workspace-record.json
```

This runner incurs real provider usage when opted in; it is not a recording. Use the UI to record the required real analyst conversation. Keep exports and keys outside Git. The current hosted demo is publicly accessible without sign-in.

## Important boundaries

The selected category is intentional. Initial RFx input is text chat; arbitrary-format supplier attachments are the requirement. PDF/image/Office parsing supports the demonstrated formats, not every embedded object or encrypted document. Historical prices require review and a supplier confirmation to become current offers. Deterministic commercial checks cover explicit day-based delivery commitments, payment periods and no-advance requirements. Other wording or conditions require model review and clarification; this is not a universal contract interpreter. The prototype uses browser storage; export records before clearing the workspace. Source references do not verify external certificate authenticity.

Optimization covers whole-line assignment, known fixed freight and one percentage discount on at most four ream-priced lines at an awarded-volume threshold. MOQ, supplier capacity, concentration constraints and unsupported commercial structures are not silently optimized. See [DECISIONS.md](docs/DECISIONS.md) for the one-page submission rationale.

## Source map

- src/app.js, src/page.html, src/flow.js: buyer UI and source-document generation.
- src/domain.js: validation, conversion, qualification, commercial readiness and arithmetic.
- src/server.js: model calls, structured extraction and bounded analytical tools.
- src/simulation.js: synthetic original-document facts; no AI result injection.
- scripts/compose.py: bundles deployable worker/index.js; test-only answer keys are excluded.
- tests/: deterministic and mock-transport regressions.
- dataset/: 30-item RFx and legacy static stress files. Current generated runs use v2 facts and the matching scorer; do not score them against dataset/answer-key.json.


## End-to-end validation

The product starts with an empty RFx. Enter the purchase requirement in the chat, resolve buyer clarifications, review supplier selection and the RFQ PDF, then approve the invitations. Supplier source documents arrive automatically; NorthStar remains pending. Extract actual packages through the connected model before comparison or analysis.

The seven-supplier source profile supports targeted revisions for Bharat, Jaipur Paper, Rajan and Pioneer, an expensive Metro offer and incompatible QuickDesk terms. No model extraction or analyst response is prefilled. Historical scenario fixtures remain offline developer references only; the product does not expose sample loaders or a test walkthrough.

Only one supplier clarification round is sent. Older generated revisions can expose **Reprocess simulated revised reply** when the simulator missed part of the original clarification; this rebuilds that same round and performs real extraction, retaining source history. Uploaded or modified documents are never rebuilt. **Re-extract revised reply** retries internal extraction against unchanged documents, without another supplier question. Genuine source uncertainty, missing evidence and non-negotiable conflicts remain unresolved; awards use eligible offers, not forced passes. Missing dated FX is a buyer evaluation decision in Compare & Ask.

`node scripts/seven-reference.mjs` prints offline reference calculations, not live model results. Actual Azure model fidelity requires live testing. See DEMO.md for the final validation flow.
