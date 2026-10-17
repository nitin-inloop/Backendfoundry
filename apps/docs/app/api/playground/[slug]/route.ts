import { NextResponse } from "next/server";
import { PlaygroundInputError, runScenario, UnknownScenarioError } from "../../../../lib/playground/runners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string } };

async function execute(slug: string, inputs: Record<string, unknown>) {
  try {
    const result = await runScenario(slug, inputs);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof UnknownScenarioError) {
      return NextResponse.json({ error: { code: "UNKNOWN_SCENARIO", message: err.message } }, { status: 404 });
    }
    if (err instanceof PlaygroundInputError) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: err.message, field: err.field } }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: { code: "SCENARIO_FAILED", message } }, { status: 500 });
  }
}

/** GET runs the scenario with registry defaults; query params override individual inputs. */
export async function GET(request: Request, { params }: Ctx) {
  const url = new URL(request.url);
  return execute(params.slug, Object.fromEntries(url.searchParams.entries()));
}

/** POST { inputs: { ... } } runs the scenario with the submitted inputs. */
export async function POST(request: Request, { params }: Ctx) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const inputs = (record.inputs && typeof record.inputs === "object" ? record.inputs : record) as Record<string, unknown>;
  return execute(params.slug, inputs);
}
