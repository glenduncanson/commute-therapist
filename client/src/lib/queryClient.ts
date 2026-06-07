// PWA mode — all data is local IndexedDB, no server calls.
import { QueryClient } from "@tanstack/react-query";
import * as db from "./db";
export type { SessionRecord } from "./db";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30, retry: 1 },
  },
});

// ── Thin API shim — same call signatures as before ───────────────────────────
// Pages call these instead of fetch(). All data stays on device.

export async function apiGetSessions() {
  return db.getAllSessions();
}

export async function apiGetSession(id: number) {
  return db.getSession(id);
}

export async function apiCreateSession(data: Omit<import("./db").SessionRecord, "id">) {
  return db.createSession(data);
}

export async function apiUpdateSession(id: number, data: Partial<import("./db").SessionRecord>) {
  return db.updateSession(id, data);
}

export async function apiDeleteSession(id: number) {
  return db.deleteSession(id);
}

export async function apiDeleteAllSessions() {
  return db.deleteAllSessions();
}

export async function apiSearchSessions(query: string, tags: string[]) {
  return db.searchSessions(query, tags);
}

export async function apiGetRecap() {
  return db.getRecap();
}

export async function apiExportSessions() {
  const sessions = await db.getAllSessions();
  const blob = new Blob(
    [JSON.stringify({ exported_at: new Date().toISOString(), sessions }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "commute-therapist-export.json";
  a.click();
  URL.revokeObjectURL(url);
}
