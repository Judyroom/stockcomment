// Starts `next dev` with the proxy settings from .env.development.local in the environment.
// NODE_USE_ENV_PROXY must be set before Node starts, which .env loading inside Next is too late for.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const file = ".env.development.local";
const env = { ...process.env };
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
