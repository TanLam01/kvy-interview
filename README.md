# Marketplace Seller Document Verification Workflow

An end-to-end local full-stack document verification workflow for a marketplace, built using TypeScript, NestJS, React, Prisma, Postgres, Redis, and BullMQ.

---

## Deployed URL
*   **Staging URL**: Not deployed yet.
*   **Local URL**: `http://localhost:5173` (Frontend) & `http://localhost:3000` (Backend)

---

## Seeded Credentials

The application is pre-seeded with the following credentials (also available via a helper panel on the Login screen):

### Seller Accounts
*   **Seller 1**: `seller1@kvy.tech` / `password123` (Seller ID: `seller_1`)
*   **Seller 2**: `seller2@kvy.tech` / `password123` (Seller ID: `seller_2`)

### Admin Accounts
*   **Admin 1**: `admin@kvy.tech` / `adminpassword` (Admin ID: `admin_1`)

---

## Features & What Works

### 1. Security & Identity
*   **JWT Token Auth**: Custom cryptographic JWT tokens generated on login.
*   **Role-Based Access Control**: Strict Guards (`AuthGuard`, `RolesGuard`) protecting routes based on roles (`SELLER` or `ADMIN`).

### 2. Seller Upload & Status Tracking
*   **File Persistence**: Uploaded business documents are validated (PDF, PNG, JPG, JPEG under 5MB) and saved to local disk storage (`uploads/`).
*   **Idempotency & Cost Control**: If a seller has an active verification in progress (`QUEUED`, `PROCESSING`, `UNDER_MANUAL_REVIEW`), new uploads are blocked to prevent duplicate $2 verification costs.
*   **Content Validation**: Uploads are checked by extension, MIME type, size, and PDF/PNG/JPEG magic bytes.
*   **Status Stepper & Timeline**: Stepper tracker reflecting the live state of verification, backed by a detailed history timeline.
*   **Automatic Polling**: UI polls status every 3 seconds while verification is in progress, updating instantly when webhooks complete.

### 3. Asynchronous Verification Queue (BullMQ + Redis)
*   **Throttling**: Workers process jobs at a maximum rate of 100 requests per minute to respect the external service cap.
*   **Transient Retries**: Configured with exponential backoff retries (up to 5 attempts). Exhausted jobs move to `NEEDS_ATTENTION`.
*   **Reconciliation**: Missing stale `QUEUED` jobs are re-enqueued; stale uncertain `PROCESSING` records move to `NEEDS_ATTENTION` without another paid call.

### 4. Mock Verification Service
*   **Sliding Window Rate Limiter**: Uses Redis sorted sets to count requests in the last 60 seconds. If request count > 100, returns HTTP `429 Too Many Requests`.
*   **Webhook Callback**: Simulates async processing delay (5–15 seconds), randomly dispatching `verified` (45%), `rejected` (45%), or `inconclusive` (10%) results via webhook POST.
*   **Idempotent Submission**: Duplicate submissions with the same verification ID do not schedule another paid verification.

### 5. Webhook Receiver & Guards
*   **Webhook Receiver**: Processes callback results and logs events.
*   **State Transition Guard**: Automated callbacks can only transition records from `PROCESSING`; late callbacks cannot overwrite manual-review or terminal states.
*   **HMAC Authentication**: Mock-verifier callbacks include a SHA-256 signature validated by the receiver.

### 6. Admin Manual Review Panel
*   **Pending Queue**: List of verifications stuck in `inconclusive` (`UNDER_MANUAL_REVIEW` status).
*   **Override Action**: Admins can approve or reject the document with audit comments.
*   **Detailed Audit Log**: Timeline showing automated history, actor IDs, actions, and changes.
*   **Document Review APIs**: Admins can list all attempts and download uploaded documents.

---

## Technical Details: Stubs & Incomplete Slices

### What is Partial
*   **Document OCR Scanning**: No real OCR service (like Amazon Textract or Google Cloud Document AI) is integrated. The mock verifier evaluates submissions randomly using document metadata.
*   **External Status Query**: The mock verifier has no durable status-query API, so stale uncertain paid calls require operational review.

### What is Stubbed
*   **Notifications**: Email/SMS delivery is stubbed as explicit `SELLER_NOTIFICATION` audit events visible through seller status polling.

---

## What Would Be Built Next & Why
1.  **Durable Verifier Status API**: Persist mock-verifier jobs and expose a status query so reconciliation can safely resolve uncertain paid calls.
2.  **S3/Cloud Storage Integration**: Store uploaded files in Amazon S3 rather than local disk folders to allow scalability across multiple server instances.
3.  **WebSockets (Socket.io)**: Replace HTTP polling on the seller dashboard with real-time WebSocket events to update the status timeline instantly without overhead.

---

## How to Run the Project Locally

### Prerequisites
*   Node.js (`v20.19+`, `v22.12+`, or `v24+`, as required by Prisma 7)
*   Docker (with running instances of **Postgres** on `5432` and **Redis** on `6379`)

### 1. Database & Queue Setup (Docker)
Ensure your Docker containers are running. If you need to spin up default images, run:
```bash
docker run -d --name postgres17 -e POSTGRES_USER=root -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:17-alpine
docker run -d --name redis -p 6379:6379 redis/redis-stack-server:latest
```

### 2. Backend Setup (`kvy-be`)
1.  Navigate to the backend directory:
    ```bash
    cd kvy-be
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create local environment configuration and replace development secrets as needed:
    ```bash
    cp .env.example .env
    ```
4.  Apply Prisma database schema and generate Prisma client:
    ```bash
    npx prisma migrate deploy
    npx prisma generate
    ```
5.  Start the NestJS dev server:
    ```bash
    npm run start:dev
    ```
    *The backend runs on `http://localhost:3000/api`.*

### 3. Frontend Setup (`kvy-fe`)
1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd kvy-fe
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite development server:
    ```bash
    npm run dev
    ```
    *The frontend will run on `http://localhost:5173`.*

### 4. Running Backend Tests
To run all tests (including the custom webhook terminal state guard tests):
```bash
cd kvy-be
npm run test
```
