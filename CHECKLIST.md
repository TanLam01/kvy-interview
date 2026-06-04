# KVY Take-Home Checklist

## Product Understanding

- [ ] Confirm the app is a document verification workflow for marketplace sellers.
- [ ] Confirm sellers must be verified before listing products.
- [ ] Confirm the system supports seller and admin roles.
- [ ] Choose the primary trade-off: speed, cost control, or operational safety.
- [ ] Decide what happens to sellers while verification is pending.
- [ ] Decide how duplicate uploads or repeated attempts are handled.

## Design Decisions

- [ ] Write the single most important product-owner question.
- [ ] Sketch design A for one possible answer.
- [ ] Sketch design B for the opposite answer.
- [ ] State the assumed answer.
- [ ] State the design built toward.
- [ ] Explain launch-week behavior for `5,000` sellers.
- [ ] Calculate or discuss possible verification cost at `$2` per call.
- [ ] Explain how the system respects the `100 calls/minute` service cap.
- [ ] Explain what seller experience is protected.
- [ ] Explain what trade-off was rejected.
- [ ] Name the weakest assumption in the approach.
- [ ] Define what would make you reverse the approach.

## State Machine

- [ ] Define all verification states.
- [ ] Define all state transitions.
- [ ] Identify terminal states.
- [ ] Add guards for state transitions.
- [ ] Prevent late automated results from overwriting manual admin decisions.
- [ ] Prevent terminal records from being modified accidentally.
- [ ] Include the state machine in `DESIGN.md`.
- [ ] Defend one non-obvious guard or terminal-state choice.

## Suggested States

- [ ] `uploaded`
- [ ] `queued`
- [ ] `processing`
- [ ] `verified`
- [ ] `rejected`
- [ ] `inconclusive`
- [ ] `under_manual_review`
- [ ] optional: `failed`
- [ ] optional: `needs_attention`

## Backend

- [ ] Use TypeScript.
- [ ] Pick a backend framework.
- [ ] Create seller login flow.
- [ ] Create admin login flow.
- [ ] Add role-based access checks.
- [ ] Add document upload endpoint.
- [ ] Validate upload input.
- [ ] Create verification record on upload.
- [ ] Add audit/history records.
- [ ] Add endpoint for seller status.
- [ ] Add endpoint for admin pending/inconclusive reviews.
- [ ] Add endpoint for admin decision.
- [ ] Return safe errors that do not leak internals.
- [ ] Add `.env.example`.
- [ ] Ensure no secrets are committed.

## Mock Verification Service

- [ ] Build an internal mocked service.
- [ ] Make verification async.
- [ ] Add variable delay.
- [ ] Return `verified`, `rejected`, or `inconclusive`.
- [ ] Enforce or simulate `100 calls/minute` rate limit.
- [ ] Decide how rate-limit rejection is represented.
- [ ] Add idempotency or locking to avoid duplicate paid calls.
- [ ] Log automated verification results into history.

## Async Processing

- [ ] Pick async mechanism: queue, worker, cron, DB polling, or simpler.
- [ ] Defend why the mechanism is enough for v1.
- [ ] Implement `queued -> processing` safely.
- [ ] Avoid two workers processing the same verification.
- [ ] Add retry behavior for transient failures.
- [ ] Add backoff behavior.
- [ ] Add max attempts.
- [ ] Define what happens after retries are exhausted.

## Frontend

- [ ] Use TypeScript.
- [ ] Build seller login view.
- [ ] Build seller upload view.
- [ ] Build seller status view.
- [ ] Build admin login view.
- [ ] Build admin pending/inconclusive review view.
- [ ] Build admin decision action.
- [ ] Show status clearly while verification is pending.
- [ ] Show final result and optional reason.
- [ ] Hide admin routes from sellers.
- [ ] Hide seller-only actions from admins where appropriate.

## History And Audit

- [ ] Store each automated verification attempt.
- [ ] Store manual admin decisions.
- [ ] Store actor information.
- [ ] Store timestamps.
- [ ] Store reason where available.
- [ ] Show full history to admins.

## Tests

- [ ] Add at least one meaningful test of core behavior.
- [ ] Prefer testing state transitions, worker behavior, or admin decision behavior.
- [ ] Test that terminal states cannot be overwritten.
- [ ] Test validation or authorization if time allows.

## README.md

- [ ] Explain what was built.
- [ ] Explain what works.
- [ ] Explain what is partial.
- [ ] Explain what is stubbed.
- [ ] Explain what would be built next and why.
- [ ] Include local setup instructions.
- [ ] Include run commands.
- [ ] Include test command.
- [ ] Include deployed URL.
- [ ] Include seeded seller credentials.
- [ ] Include seeded admin credentials.

## DESIGN.md

- [ ] Include "The one question".
- [ ] Include two architecture sketches based on possible answers.
- [ ] Include assumed answer.
- [ ] Include launch-week behavior.
- [ ] Include state machine.
- [ ] Include deliberate cut.
- [ ] Include most worrying failure.
- [ ] Include specific mitigation for that failure.

## AI-LOG.md

- [ ] List two or three tasks delegated to AI.
- [ ] Include one concrete AI mistake or weak output.
- [ ] Show brief before and after.
- [ ] Explain how the mistake was caught.
- [ ] Include one thing verified manually.

## Deployment

- [ ] Deploy to a public URL.
- [ ] Verify seller login works on deployed app.
- [ ] Verify admin login works on deployed app.
- [ ] Verify the chosen end-to-end path works on deployed app.
- [ ] Verify environment variables are configured in deployment.
- [ ] Verify seeded credentials work in deployment.

## Final Submission

- [ ] Public GitHub repository is available.
- [ ] Deployed URL is available.
- [ ] `DESIGN.md` is complete.
- [ ] `README.md` is complete.
- [ ] `AI-LOG.md` is complete.
- [ ] Implementation matches `DESIGN.md`.
- [ ] At least one meaningful test passes.
- [ ] No secrets are committed.
- [ ] Email subject is `KVY Take-home Submission — [Your Name]`.
- [ ] Repo link is included in the email.
- [ ] Deployed URL is included in the email.

