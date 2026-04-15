import { createHmac, timingSafeEqual } from "crypto";

const CALCOM_WEBHOOK_SECRET = process.env.CALCOM_WEBHOOK_SECRET;

/**
 * Verify the HMAC SHA-256 signature of an incoming Cal.com webhook payload.
 *
 * @param payload  - The raw request body as a string.
 * @param signature - The value of the `x-cal-signature-256` header.
 * @returns true when the signature matches.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!CALCOM_WEBHOOK_SECRET) {
    console.warn(
      "CALCOM_WEBHOOK_SECRET is not set — skipping signature verification"
    );
    return false;
  }

  const expected = createHmac("sha256", CALCOM_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
