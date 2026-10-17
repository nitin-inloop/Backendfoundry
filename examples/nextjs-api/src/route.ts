import { extractOrGenerateRequestId, ok } from "@backendfoundry/core";
import { v, validateBody } from "@backendfoundry/validation";
import { verifyWebhookOrThrow } from "@backendfoundry/webhooks";
import { createAiClient, MockAiProvider } from "@backendfoundry/ai";
import { toSafeErrorResponse } from "@backendfoundry/errors";

const ai = createAiClient({
  primary: new MockAiProvider({
    name: "triage-model",
    responseGenerator: () => JSON.stringify({ severity: "high", category: "billing" })
  })
});

const OutputSchema = v.object({
  severity: v.enum(["low", "medium", "high"]),
  category: v.string()
});

const WebhookBodySchema = v.object({
  eventId: v.string().min(4),
  text: v.string().min(5)
}).strict();

export async function POST(req: Request, webhookSecret: string): Promise<Response> {
  const headers = Object.fromEntries(req.headers.entries());
  const requestId = extractOrGenerateRequestId(headers);

  try {
    const rawBody = await req.text();
    verifyWebhookOrThrow({
      payload: rawBody,
      signatureHeader: headers["x-foundry-signature"] ?? "",
      secret: webhookSecret
    });

    const parsed = validateBody(WebhookBodySchema, JSON.parse(rawBody), requestId);
    const { object, meta } = await ai.generateObject({
      prompt: parsed.text,
      schema: OutputSchema
    });

    return new Response(
      JSON.stringify(ok({ eventId: parsed.eventId, triage: object, provider: meta.provider }, { requestId })),
      { status: 200, headers: { "content-type": "application/json", "x-request-id": requestId } }
    );
  } catch (err) {
    const safe = toSafeErrorResponse(err, { requestId });
    return new Response(JSON.stringify(safe.body), { status: safe.statusCode, headers: safe.headers });
  }
}
