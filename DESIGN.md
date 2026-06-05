# System Design & Architecture Decisions

This document details the engineering decisions, trade-offs, and architecture constraints for the marketplace document verification workflow.

---

## 1. The One Question

The single product-owner question whose answer would most change the architecture:
> **"Are sellers allowed to create and list products in a 'pending verification' state, or is successful document verification a strict blocker for any listing activity?"**

### Design A: Strict Blocker (Assumed & Built)
*   **Workflow**: Upload Document → Queued → Processing → Verified → Can List Products.
*   **Architecture**: High-consistency, transactional state machine. A future listing endpoint would return HTTP `403 Forbidden` unless the seller is verified. Product listing itself is outside this implementation slice.
*   **Pros**: Complete operational safety. Zero risk of unverified merchants selling items.
*   **Cons**: Higher friction for sellers. Onboarding delays directly affect listing conversion.

### Design B: Eventual Consistency (Post-onboarding Verification)
*   **Workflow**: Upload Document → Immediate Access (Can List Products) → Asynchronous Verification.
*   **Architecture**: Event-driven with post-facto policy enforcement. Products can be listed immediately but are stored with `status: "shadow_pending"`. They are excluded from the elastic search indexes (invisible to buyers) or marked with a warning label. If verification fails, a trigger disables the seller's listings.
*   **Pros**: Zero-friction seller experience. Sellers can draft products immediately.
*   **Cons**: Complex indexing and filtering logic. Operational risk of bad actors bypasses.

**Decision**: We assumed **Design A (Strict Blocker)** and built toward it. Marketplace trust is the primary value, and blocking bad actors at the gate is worth the onboarding friction.

---

## 2. Launch Week (5,000 Sellers)

When about 5,000 sellers arrive in the first week, our architecture manages the constraints as follows:

### Financial & Throughput Calculations
*   **External Service Cap**: 100 calls per minute.
*   **Verification Cost**: $2 per call.
*   **Total Launch Week Cost**: 5,000 sellers × $2 = **$10,000**.
*   **Throughput Duration**: 5,000 requests / 100 requests per minute = **50 minutes** of total processing time.

### System Behavior & Seller Experience
*   **Throttling**: When a burst of uploads occurs (e.g., all 5,000 at the exact same hour), they are written to the database with status `QUEUED` and placed in the **BullMQ** queue.
*   **Rate-Limiter Protection**: BullMQ is configured with `limiter: { max: 100, duration: 60000 }`. This client-side throttling ensures our worker never submits more than 100 jobs/minute to the external verifier, avoiding costly rate-limit rejections.
*   **Experience**: Sellers see a "Queued" or "Analyzing" progress indicator. They do not wait synchronously. They can log out and return later; the UI polls the status, which updates automatically upon webhook execution.

### Chosen vs. Rejected Trade-Offs
*   **Chosen Trade-off**: High-throughput queuing and webhook-based callbacks. We trade immediate verification for cost predictability and system stability.
*   **Rejected Trade-off**: Synchronous inline API calls. If we submitted requests immediately, a launch spike would trigger 429 rate limit exceptions, leading to wasted API retries and broken UI connections.

### Uncertainty & Reversal Conditions
*   **Least Certain Part**: The assumption that the external service accepts webhooks for asynchronous verification.
*   **Reversal Cause**: If the external service is synchronous-only (blocking for 5–30 seconds per request), we would be forced to run a large pool of parallel worker threads, shifting the bottleneck to our database connection pool.

---

## 3. State Machine

Below is the lifecycle of a verification record:

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Seller Uploads Document
    QUEUED --> PROCESSING : Worker processes job
    PROCESSING --> QUEUED : Submission fails (Transient error, retrying)
    PROCESSING --> NEEDS_ATTENTION : Retries exhausted or callback timeout
    PROCESSING --> VERIFIED : Webhook: success
    PROCESSING --> REJECTED : Webhook: rejected
    PROCESSING --> UNDER_MANUAL_REVIEW : Webhook: inconclusive
    UNDER_MANUAL_REVIEW --> VERIFIED : Admin approves
    UNDER_MANUAL_REVIEW --> REJECTED : Admin rejects
    QUEUED --> NEEDS_ATTENTION : Queue publish failure
    NEEDS_ATTENTION --> [*] : Operational terminal; manual follow-up
    VERIFIED --> [*] : Terminal State
    REJECTED --> [*] : Terminal State
```

### Transition Guard Defense
> [!IMPORTANT]
> **Terminal State Guard**: A careless engineer might allow the webhook callback to update a record regardless of its current state.
> 
> **The Danger**: If a seller's verification is inconclusive (`UNDER_MANUAL_REVIEW`) and a human admin reviews the document, deciding to **REJECT** it, the record transitions to `REJECTED`. If a delayed webhook callback (due to network latency or external service retries) arrives 5 minutes later stating the automated check was `verified`, it could overwrite the admin's decision to `VERIFIED`.
>
> **The Guard**: In our `WebhookController`, automated callbacks can only update a record currently in `PROCESSING`. The state condition is checked atomically in the database:
> ```typescript
> updateMany({
>   where: { id: verificationId, status: 'PROCESSING' },
>   data: { status: dbStatus }
> })
> ```

---

## 4. What Was Deliberately Not Built

### Cut Feature: Durable External Verifier Status API
*   **What was cut**: A durable mock-verifier job store and status-query endpoint.
*   **Why it was correct for v1**: The slice demonstrates async submission, rate limiting, HMAC callbacks, idempotency, and manual review without building a second persistent workflow engine.
*   **Not just convenience**: Automatically retrying an uncertain `PROCESSING` request could create another paid `$2` call. Without a durable external status API, moving it to `NEEDS_ATTENTION` is the safer cost-control choice.
*   **Risk Created**: Operations must manually resolve timed-out `PROCESSING` records.
*   **Mitigation**: Reconciliation detects stale records, re-enqueues missing `QUEUED` jobs, and moves uncertain `PROCESSING` records to `NEEDS_ATTENTION`.

---

## 5. The Failure That Worries You Most

### Production Failure: Stuck Verifications (Orphaned Jobs)
If a worker crashes after starting a job, or if a webhook is lost due to network failure, a verification record can remain stuck in the `PROCESSING` state indefinitely. The seller is trapped waiting, and our support queue grows.

### Specific Mitigation
We implement a **Dual-layered Reconciliation Strategy**:

1.  **Queue Retries (Transient Failures)**:
    *   **What is retried**: Submission attempts from the worker to the external service.
    *   **Backoff Strategy**: Exponential backoff. We configure BullMQ to attempt submission up to **5 times**, starting with a **2-second delay** and doubling between retries.
    *   **Exhaustion behavior**: If all 5 attempts fail, the queue job is marked as failed and the verification moves to `NEEDS_ATTENTION` for operational follow-up.

2.  **Webhook Delivery Retries and Explicit Operational State**:
    *   The mock verifier retries webhook delivery three times with exponential delays of 1s and 2s.
    *   Reconciliation re-enqueues stale `QUEUED` records with no active BullMQ job and moves stale `PROCESSING` records to `NEEDS_ATTENTION`. A production implementation would add a durable external status API before automatically retrying uncertain paid calls.
