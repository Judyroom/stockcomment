// Request guard for the public deployment: optional shared access code plus a simple
// per-IP rate limit. The limiter is per serverless instance, so it slows abuse rather
// than stopping it; put a real store (e.g. Upstash) behind it if the app gets traffic.

import { timingSafeEqual } from "node:crypto";

const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function guard(req: Request, cost = 1): Response | null {
  const code = process.env.ACCESS_CODE?.trim();
  if (code) {
    const given = req.headers.get("x-access-code") ?? "";
    const a = Buffer.from(given);
    const b = Buffer.from(code);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return Response.json({ error: "invalid_access_code" }, { status: 401 });
    }
  }

  const limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30);
  if (limit > 0) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length + cost > limit) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    for (let i = 0; i < cost; i++) recent.push(now);
    hits.set(ip, recent);
  }
  return null;
}

export const badRequest = (message: string) => Response.json({ error: "bad_request", message }, { status: 400 });
