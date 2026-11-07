# Independent Nessa UI reader/source/model review

Source checkpoint a32191c26ee27c2d8159ab6498a0f0530a93e3ea;31-page draft. Reading surface for this pass: Markdown; author browser receipt is separate. Simulated reader, not human user study.

## Docs-only tasks before source

Root → Conversation → Queue: closure removes only UI. Host owns queue persistence/delivery. Reorder is a proposed ID order; no sender/outbox is provided.
Root → Conversation → Mermaid: timeout releases the caller but leaves the unabortable render owning shared configuration. Later jobs return quarantined until that same Promise settles. They are not automatically rerun.
Root → Content → Preview: changing file schedules cleanup/new effect; after cleanup old success/error cannot publish. It does not synchronously produce a new body or undo server work. Caller-supplied URLs remain caller-owned; component Blob URLs are paired and revoked.
Root → Conversation → Overlays: two covers share counts, so closing one keeps content inert. Initially host-inert siblings are excluded from overlay ownership. This is nonmodal; outside composer remains usable.
Root → Conversation → Approvals: mounted resolved is history and has no onExited. A pending-to-resolved transition owns one exit period; cleared resolution retires old callbacks. Callback is visual completion, not remote permission evidence.
Root → Streams → Transcript: a new main prompt abandons only its path; late result clears that call's abandonment. live defaults false, host supplies liveness. Replay range is not arbitrary reordering or a transactional batch.

These six sampled tasks have supported answers without guessed recovery procedures. Exact source/model comparison follows.

## Technical/model pass

Read real MermaidRenderQueue run/timeout/lift, useFileText success/error/cleanup, ChatOverlay cover/release/observer, ToolApproval exit effect/report/cancel paths, TranscriptBuilder push/absorb/abandon/snapshot, and queue reorder callback. The six reader answers match these owners. No claim that a UI action is remote authorization/delivery or process cancellation was introduced.

Four models match their declared narrow scope: FileTextGeneration checks post-cleanup publication, OverlayCoverage checks shared covers and initially host-owned inertness, ApprovalExit separates two periods with timer/animation callbacks and cancellation, TranscriptCalls checks same-path abandonment and late-result reconciliation. Their controls remove the respective semantic guard/effect and retain independent history facts. Browser DOM/focus/network and arbitrary transcript order are not modeled.

### U1: Mermaid model has an extra admission guard (P2)

Start currently requires active={} as well as quarantine=0. After Timeout releases the real queue link, the underlying render is still active; real protection is quarantine, but the model's extra active guard still blocks new work if quarantine is removed. The start control removes both guards and can fail before timeout, missing this causal boundary. Separate queue-link busy from underlying active; timeout releases the former while retaining the latter, and a guard-removal control should expose a second render after timeout. Requested author correction and repeat TLC/control review. Current user-facing prose already explains this separation accurately.

Execution receipts are author-owned; this review inspected source, all5models and9controls, not a second implementation suite. Final closure pending U1 correction and affected verification.

## U1 closure

Re-read corrected MermaidOwnership and final results.json. Start now checks queue-link availability plus quarantine; Timeout releases linkBusy but keeps the underlying active set. The isolated quarantine guard control yields Start → Timeout → Start with active={1,2}, precisely the dangerous window. The lost-quarantine control breaks retained ownership and also reaches overlap. Both controls have no unchecked rules. Baseline remains passing. U1 resolved; no remaining material finding in the reviewed sample. No edits made to the UI checkout during its full gate.
