// Recent runs kept in this browser only (localStorage). It is a convenience, not a record:
// it can be empty in private windows and is never sent anywhere.

import type { RunState } from "./run-state";

const KEY = "sc.history.v2";
const MAX = 15;

export function loadHistory(): RunState[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRun(run: RunState): RunState[] {
  const slim: RunState = { ...run, agents: run.agents.map((a) => ({ ...a, reasoning: "" })) };
  const list = [slim, ...loadHistory().filter((r) => r.id !== run.id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Quota exceeded: keep fewer entries.
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)));
    } catch {}
  }
  return list;
}

export function deleteRun(id: string): RunState[] {
  const list = loadHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  return list;
}
