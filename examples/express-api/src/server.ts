import { ok } from "@backendfoundry/core";
import { v, expressValidate } from "@backendfoundry/validation";
import { expressRateLimit } from "@backendfoundry/rate-limit";
import { createIdempotencyGuard } from "@backendfoundry/idempotency";
import { createHealthRegistry } from "@backendfoundry/health";
import { createExpressErrorHandler } from "@backendfoundry/errors";
import { createLogger, expressRequestLogger } from "@backendfoundry/logger";

export function configureExpressExample(app: any) {
  const logger = createLogger({ service: "express-orders-api", level: "info" });
  const idempotency = createIdempotencyGuard({ ttlMs: 86_400_000 });
  const health = createHealthRegistry({ version: "1.0.0" });

  health.registerProbe({
    name: "database",
    critical: true,
    check: async () => ({ healthy: true })
  });

  app.use(expressRequestLogger(logger));
  app.use("/v1/orders", expressRateLimit({ limit: 30, windowMs: 60_000, routeId: "orders" }));

  const CreateOrderSchema = v.object({
    customerId: v.string().min(3),
    amountCents: v.number().int().min(100),
    currency: v.enum(["USD", "EUR", "INR"]).default("USD")
  }).strict();

  app.post(
    "/v1/orders",
    expressValidate({ body: CreateOrderSchema }),
    async (req: any, res: any, next: any) => {
      try {
        const key = idempotency.extractKey(req.headers) ?? `auto_${req.requestId}`;
        const outcome = await idempotency.execute(
          { key, method: "POST", path: "/v1/orders", body: req.body },
          async () => ({
            statusCode: 201,
            body: ok({ orderId: "ord_9001", ...req.body }, { requestId: req.requestId }, 201)
          })
        );
        res.status(outcome.statusCode).json(outcome.body);
      } catch (err) {
        next(err);
      }
    }
  );

  const healthHandlers = health.expressHandlers();
  app.get("/health/live", healthHandlers.liveness);
  app.get("/health/ready", healthHandlers.readiness);
  app.use(createExpressErrorHandler({ onError: (err) => logger.error(err.message, { code: err.code }) }));
}
