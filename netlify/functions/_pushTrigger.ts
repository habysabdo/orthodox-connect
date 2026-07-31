import { createHmac, timingSafeEqual } from 'node:crypto';

export type PushDeliveryEvent =
  | { kind: 'direct-message'; recordId: string }
  | { kind: 'notification'; recordId: string };

const SIGNATURE_HEADER = 'x-orthodox-push-signature';

function privateKey(): string {
  return process.env.WEB_PUSH_PRIVATE_KEY?.trim() ?? '';
}

function signature(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

export async function triggerPushDelivery(req: Request, event: PushDeliveryEvent): Promise<void> {
  const key = privateKey();
  if (!key) {
    console.warn('Push background trigger skipped because WEB_PUSH_PRIVATE_KEY is not configured');
    return;
  }

  const body = JSON.stringify(event);
  const endpoint = new URL('/.netlify/functions/push-delivery', req.url);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [SIGNATURE_HEADER]: signature(body, key),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Push background trigger returned ${response.status}`);
  }
}

export function hasValidPushSignature(body: string, suppliedSignature: string | null): boolean {
  const key = privateKey();
  if (!key || !suppliedSignature) return false;

  const expected = Buffer.from(signature(body, key));
  const supplied = Buffer.from(suppliedSignature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function pushSignatureHeader(): string {
  return SIGNATURE_HEADER;
}
