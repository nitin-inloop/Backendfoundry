import { NextResponse } from "next/server";
import { packages } from "../../../lib/registry";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** Lists every playground scenario defined in registry/registry.json. */
export function GET() {
  return NextResponse.json({
    scenarios: packages.map((p) => ({
      slug: p.slug,
      packageName: p.packageName,
      category: p.category,
      scenario: p.playground.scenario,
      title: p.playground.title,
      description: p.playground.description,
      inputs: p.playground.inputs,
      run: `/api/playground/${p.slug}`
    }))
  });
}
