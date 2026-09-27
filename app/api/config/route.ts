import { capabilities } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

/** Tells the UI which providers and features are configured. Never returns key values. */
export function GET() {
  return Response.json(capabilities());
}
