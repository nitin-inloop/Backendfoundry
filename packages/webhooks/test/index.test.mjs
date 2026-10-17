import test from "node:test";
import assert from "node:assert/strict";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookOrThrow,
  WebhookVerificationError,
  MemoryWebhookDeduplicator
} from "../dist/index.js";

test("@backendfoundry/webhooks - signs and verifies valid HMAC-SHA256 payload and supports secret rotation", () => {
  const secretOld = "whsec_old_secret_key_123456";
  const secretNew = "whsec_new_secret_key_654321";
  const payload = JSON.stringify({ id: "evt_01", type: "invoice.paid", data: { amount: 4900 } });
  const nowSeconds = 1_720_000_000;

  const signed = signWebhookPayload(payload, secretNew, { timestampSeconds: nowSeconds - 15 });
  const verification = verifyWebhookSignature({
    payload,
    signatureHeader: signed.signatureHeader,
    secret: [secretOld, secretNew],
    toleranceSeconds: 300,
    nowSeconds
  });

  assert.equal(verification.valid, true);
  assert.equal(verification.matchedSecretIndex, 1);
});

test("@backendfoundry/webhooks - detects tampered payload, expired replay window, and duplicate event IDs", () => {
  const secret = "whsec_production_secret_987654";
  const payload = JSON.stringify({ id: "evt_02", type: "user.deleted" });
  const nowSeconds = 1_720_000_000;

  const signed = signWebhookPayload(payload, secret, { timestampSeconds: nowSeconds - 600 });

  // Expired timestamp outside 300s replay window
  const expired = verifyWebhookSignature({
    payload,
    signatureHeader: signed.signatureHeader,
    secret,
    toleranceSeconds: 300,
    nowSeconds
  });
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "timestamp_expired");

  // Tampered payload body
  const freshSigned = signWebhookPayload(payload, secret, { timestampSeconds: nowSeconds });
  assert.throws(
    () =>
      verifyWebhookOrThrow({
        payload: JSON.stringify({ id: "evt_02", type: "user.deleted", admin: true }),
        signatureHeader: freshSigned.signatureHeader,
        secret,
        nowSeconds
      }),
    (err) => err instanceof WebhookVerificationError && err.reason === "signature_mismatch"
  );

  // Deduplicator
  const dedup = new MemoryWebhookDeduplicator();
  assert.equal(dedup.checkAndRecord("evt_02").duplicate, false);
  assert.equal(dedup.checkAndRecord("evt_02").duplicate, true);
});
