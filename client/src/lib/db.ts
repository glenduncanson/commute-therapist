// ─── Local IndexedDB storage ─────────────────────────────────────────────────
// Replaces the Express/SQLite backend entirely.
// All data stays on the device, never leaves the browser.

const DB_NAME = "commute-therapist";
const DB_VERSION = 1;

export interface SessionRecord {
  id?: number;
  timestamp: string;
  mode: string;
  situation?: string;
  main_thought?: string;
  emotion?: string;
  emotion_intensity?: number;
  cognitive_pattern?: string;
  alternative_thought?: string;
  next_action?: string;
  follow_up_status?: string;
  tags?: string;
  summary?: string;
  next_time_prompt?: string;
  messages?: string;
  is_complete?: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp");
        store.createIndex("is_complete", "is_complete");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, stores: string | string[], mode: IDBTransactionMode) {
  return db.transaction(stores, mode);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getAllSessions(): Promise<SessionRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "sessions", "readonly").objectStore("sessions").getAll();
    req.onsuccess = () => resolve((req.result as SessionRecord[]).sort((a, b) => b.timestamp!.localeCompare(a.timestamp!)));
    req.onerror = () => reject(req.error);
  });
}

export async function getSession(id: number): Promise<SessionRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "sessions", "readonly").objectStore("sessions").get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function createSession(session: Omit<SessionRecord, "id">): Promise<SessionRecord> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "sessions", "readwrite").objectStore("sessions").add(session);
    req.onsuccess = () => resolve({ ...session, id: req.result as number });
    req.onerror = () => reject(req.error);
  });
}

export async function updateSession(id: number, updates: Partial<SessionRecord>): Promise<SessionRecord> {
  const db = await openDB();
  return new Promise(async (resolve, reject) => {
    const existing = await getSession(id);
    if (!existing) return reject(new Error("Not found"));
    const merged = { ...existing, ...updates, id };
    const req = tx(db, "sessions", "readwrite").objectStore("sessions").put(merged);
    req.onsuccess = () => resolve(merged);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "sessions", "readwrite").objectStore("sessions").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAllSessions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "sessions", "readwrite").objectStore("sessions").clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function searchSessions(query: string, tags: string[]): Promise<SessionRecord[]> {
  const all = await getAllSessions();
  const q = query.toLowerCase();
  return all.filter((s) => {
    const matchesQuery = !q ||
      (s.situation?.toLowerCase().includes(q)) ||
      (s.summary?.toLowerCase().includes(q)) ||
      (s.emotion?.toLowerCase().includes(q)) ||
      (s.cognitive_pattern?.toLowerCase().includes(q));
    const sessionTags: string[] = JSON.parse(s.tags || "[]");
    const matchesTags = !tags.length || tags.some((t) => sessionTags.includes(t));
    return matchesQuery && matchesTags;
  });
}

export async function getRecap() {
  const all = await getAllSessions();
  const complete = all.filter((s) => s.is_complete);

  const last = complete[0] ?? null;

  const tagCounts: Record<string, number> = {};
  complete.forEach((s) => {
    JSON.parse(s.tags || "[]").forEach((t: string) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const unfinished = complete.find(
    (s) => s.next_action && s.follow_up_status !== "done" && s.follow_up_status !== "skipped"
  ) ?? null;

  return { last, topTag, unfinished };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "settings", "readonly").objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "settings", "readwrite").objectStore("settings").put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
