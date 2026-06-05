# AI Collaboration Log

This log documents the tasks delegated to AI, mistakes encountered, and manual verifications performed during the development of this take-home assignment.

---

## 1. Tasks Delegated to AI

*   **Custom JWT Cryptographic Helper**: Delegated the generation of base64url encode/decode methods and HMAC-SHA256 token signing/verification using Node.js's built-in `crypto` module. This avoided adding standard external dependencies like `@nestjs/jwt` or `jsonwebtoken` and kept the backend footprint small and portable.
*   **CSS Stepper & Timeline Layouts**: Delegated the creation of the custom vertical audit event timeline styles and horizontal seller stepper layouts in CSS to achieve a premium dark-mode aesthetic quickly.
*   **Jest Unit Tests Mocking**: Delegated the writing of mock providers for `PrismaService` and NestJS's BullMQ `getQueueToken('document-verification')` in the unit tests to fix dependency resolution failures.

---

## 2. Where AI Was Wrong or Weak

### The Issue: Prisma v7 Schema URL Property
*   **What the AI did**: The AI wrote a standard Prisma datasource block in `schema.prisma` containing `url = env("DATABASE_URL")`.
*   **How it was caught**: Running `npx prisma db push` threw a validation error (P1012):
    ```
    error: The datasource property `url` is no longer supported in schema files. Move connection URLs for Migrate to `prisma.config.ts`...
    ```
*   **How it was fixed**: We updated `prisma/schema.prisma` to remove the `url` line completely, leaving only `provider = "postgresql"`. We verified that the database URL was instead configured dynamically inside `prisma.config.ts`, which is the correct and standard setup for Prisma v7.

---

## 3. Manually Verified (Instead of Trusting AI)

### Database Connection Credentials
*   **The Scenario**: The AI initially configured `.env` with standard PostgreSQL local credentials (`postgres:postgres`).
*   **Verification**: Rather than assuming standard settings or trying to rebuild the postgres docker container, we ran `docker inspect postgres17` to view the environment variables of the active container. We found:
    *   `POSTGRES_USER=root`
    *   `POSTGRES_PASSWORD=secret`
*   **Action**: We manually corrected `.env` to `postgresql://root:secret@localhost:5432/postgres?schema=public`, allowing the Prisma sync command to connect and execute successfully.
