# KVY TECH Full-stack Engineer Take-Home Requirements

## Feature

Build a document verification workflow for a marketplace.

Sellers must upload a business verification document before they can list products. Example documents include a business license or tax registration.

## Main Flow

1. A seller uploads a document.
2. The system sends the document to an external verification service.
3. The external verification service is mocked by the application.
4. The verification call is asynchronous and can take from seconds to hours.
5. The service eventually returns one of three outcomes:
   - `verified`
   - `rejected`
   - `inconclusive`
6. `inconclusive` documents go to a human admin for final review.
7. The admin makes the final decision.
8. The seller is notified of the final outcome.
9. The notification may include an optional reason.
10. Admins can see the full history of every verification attempt, including:
    - automated attempts
    - manual admin decisions
    - who performed each action
    - when each action happened
    - what changed

## Operating Conditions

The design must account for real marketplace constraints:

- Each external verification call costs `$2`.
- The external service accepts at most `100 calls per minute`.
- Calls beyond the limit are rejected by the service.
- A launch push is expected to onboard about `5,000 sellers` in the first week.
- The service is not free.
- The service is not instant.
- The marketplace is expected to grow quickly.

The exercise intentionally has no perfect answer across cost, throughput, and seller experience. The important part is choosing a trade-off and defending it.

## What The Submission Should Demonstrate

The submission should show engineering judgment more than completeness.

The reviewers care about:

- what was chosen
- what was deliberately not chosen
- whether the trade-offs are clear
- whether the design matches the implementation
- whether the candidate can explain and modify the work live
- whether the submitted code is actually understood by the candidate

A small, coherent, honest submission is preferred over a large, generic, overbuilt one.

## Required Repository Contents

Submit three things in one public GitHub repository:

1. `DESIGN.md`
2. implementation plus `README.md`
3. `AI-LOG.md`

The submission must also include a deployed public URL.

## DESIGN.md Requirements

`DESIGN.md` should be short and pointed. It should answer the following directly.

### 1. The One Question

Identify the single product-owner question whose answer would most change the architecture.

For that question:

- state the question
- sketch two different designs depending on the answer
- state which answer was assumed
- state which design was built toward

### 2. Launch Week

Explain what happens when about `5,000 sellers` arrive in the first week.

The explanation must cover:

- the `$2` cost per verification call
- the `100 calls/minute` service cap
- what sellers experience while waiting
- what the system spends
- what the system protects when it cannot optimize for everything
- the trade-off chosen
- the trade-off rejected
- the part of the approach that is least certain
- what would cause the design to be reversed

### 3. State Machine

Draw the lifecycle of a single verification record.

The diagram may be ASCII or Mermaid.

It must include:

- states
- transitions
- guards for transitions
- terminal states

The document must also defend one specific guard or terminal-state choice that a careless engineer might get wrong.

### 4. What Was Deliberately Not Built

Choose the most significant thing a thorough engineer might have included but that was intentionally cut from v1.

Explain:

- what was cut
- why cutting it was the right v1 decision
- why the choice was not just convenience
- what risk the cut creates

### 5. The Failure That Worries You Most

Identify the production failure most likely to page someone at 3am.

Describe a specific mitigation.

Generic "add retries" is not enough. The mitigation should specify:

- what is retried
- when it is retried
- the backoff strategy
- the maximum attempts or exhaustion behavior
- what happens after retries are exhausted

## Implementation Requirements

Build the slice that best demonstrates the core design.

Pick one complete path and make it work end-to-end, such as:

- upload -> automated result -> admin sees it
- upload -> inconclusive -> admin reviews -> seller notified

The implementation is judged mainly on:

- whether it runs end-to-end for the chosen path
- whether it is deployed at a public URL
- whether the code matches `DESIGN.md`

If the design describes a state machine, queue, failure path, or similar core behavior, that behavior should be visible in the code.

## Required Product Views

The application must include two UI views:

### Seller View

The seller view must support:

- login
- document upload
- viewing verification status

### Admin View

The admin view must support:

- login
- seeing pending or inconclusive reviews
- reviewing inconclusive documents
- making a final decision

The views may be in one app with role-based routing or split across separate apps.

## Mock Verification Service Requirements

The app must include its own mocked verification service.

The mock should demonstrate design choices around:

- async processing
- variable delay
- returning `verified`, `rejected`, or `inconclusive`
- enforcing the `100 calls/minute` rate limit

How the service is mocked is part of the assessment.

## Backend Requirements

Within the built slice, the backend must include:

- input validation
- errors that do not leak internals
- at least one meaningful test of core behavior
- no committed secrets
- `.env.example` instead of real secret values

## README.md Requirements

The `README.md` must include:

- what was built
- what works
- what is partial
- what is stubbed
- what would be built next and why
- how to run the project
- the deployed URL
- seeded credentials for at least one seller
- seeded credentials for at least one admin

Accuracy matters. An honest partial implementation is better than overstating completeness.

## AI-LOG.md Requirements

`AI-LOG.md` should be short and honest.

It must include:

- two or three things delegated to AI tools
- one concrete case where AI was wrong or weak
- how the issue was caught
- how the issue was fixed
- one thing manually verified instead of trusting AI

A generic AI log is a negative signal. Specificity matters.

## Required Stack Constraint

TypeScript is required on both backend and frontend.

All other stack choices are flexible, but should be defensible.

Suggested options from the prompt:

| Layer | Options |
| --- | --- |
| Backend | Express, NestJS, Fastify, Hono, or similar |
| Frontend | React, Next.js, Vue, Nuxt |
| Database | PostgreSQL, MySQL, SQLite |
| Async processing | BullMQ, pg-boss, native workers, cron, or simpler |
| Deployment | Vercel, Railway, Render, Fly.io, Supabase, or another free tier |

## Submission Instructions

Email the submission with:

- subject: `KVY Take-home Submission — [Your Name]`
- public GitHub repository link
- deployed URL

If an extension is needed for a real reason, ask early.

## Time Guidance

Expected actual working time is about `4-5 hours`.

Suggested time split:

- `DESIGN.md`: about `1 hour`
- implementation plus `README.md`: about `2.5 hours`
- `AI-LOG.md`: about `15 minutes`

Deadline is `4 days from receipt`.

