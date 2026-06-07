import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, like, or } from "drizzle-orm";
import { sessions, settings } from "@shared/schema";
import type { Session, InsertSession, Setting, InsertSetting } from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

// Create tables if not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    mode TEXT NOT NULL,
    situation TEXT,
    main_thought TEXT,
    emotion TEXT,
    emotion_intensity REAL,
    cognitive_pattern TEXT,
    alternative_thought TEXT,
    next_action TEXT,
    follow_up_status TEXT DEFAULT 'not_done',
    tags TEXT DEFAULT '[]',
    summary TEXT,
    next_time_prompt TEXT,
    messages TEXT DEFAULT '[]',
    is_complete INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  );
`);

export interface IStorage {
  // Sessions
  getSessions(): Session[];
  getSession(id: number): Session | undefined;
  getRecentSessions(limit: number): Session[];
  searchSessions(query: string, tags?: string[]): Session[];
  createSession(session: InsertSession): Session;
  updateSession(id: number, session: Partial<InsertSession>): Session | undefined;
  deleteSession(id: number): void;
  deleteAllSessions(): void;
  getLastCompleteSession(): Session | undefined;
  getMostRecentIncompleteSession(): Session | undefined;
  // Settings
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  getAllSettings(): Setting[];
}

export const storage: IStorage = {
  getSessions() {
    return db.select().from(sessions).orderBy(desc(sessions.timestamp)).all();
  },

  getSession(id: number) {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  },

  getRecentSessions(limit: number) {
    return db.select().from(sessions).orderBy(desc(sessions.timestamp)).limit(limit).all();
  },

  searchSessions(query: string, tags?: string[]) {
    const results = db.select().from(sessions).all();
    const q = query.toLowerCase();
    return results.filter((s) => {
      const matchesQuery =
        !q ||
        (s.situation && s.situation.toLowerCase().includes(q)) ||
        (s.summary && s.summary.toLowerCase().includes(q)) ||
        (s.emotion && s.emotion.toLowerCase().includes(q)) ||
        (s.cognitive_pattern && s.cognitive_pattern.toLowerCase().includes(q));
      const sessionTags: string[] = JSON.parse(s.tags || "[]");
      const matchesTags =
        !tags || tags.length === 0 || tags.some((t) => sessionTags.includes(t));
      return matchesQuery && matchesTags;
    });
  },

  createSession(session: InsertSession) {
    return db.insert(sessions).values(session).returning().get();
  },

  updateSession(id: number, session: Partial<InsertSession>) {
    return db
      .update(sessions)
      .set(session)
      .where(eq(sessions.id, id))
      .returning()
      .get();
  },

  deleteSession(id: number) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  },

  deleteAllSessions() {
    db.delete(sessions).run();
  },

  getLastCompleteSession() {
    return db
      .select()
      .from(sessions)
      .where(eq(sessions.is_complete, true))
      .orderBy(desc(sessions.timestamp))
      .limit(1)
      .get();
  },

  getMostRecentIncompleteSession() {
    return db
      .select()
      .from(sessions)
      .where(eq(sessions.is_complete, false))
      .orderBy(desc(sessions.timestamp))
      .limit(1)
      .get();
  },

  getSetting(key: string) {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value;
  },

  setSetting(key: string, value: string) {
    db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  },

  getAllSettings() {
    return db.select().from(settings).all();
  },
};
