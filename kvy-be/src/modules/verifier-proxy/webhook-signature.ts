import * as crypto from 'crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'x-verifier-signature';

export function signWebhookPayload(payload: unknown): string {
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('WEBHOOK_SECRET is required');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(canonicalJson(payload))
    .digest('hex');
}

export function isValidWebhookSignature(
  payload: unknown,
  signature: string | undefined,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = signWebhookPayload(payload);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}
