import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema } from "@shared/schema";
import { z } from "zod";

export function registerRoutes(httpServer: Server, app: Express) {
  // ─── Sessions ───────────────────────────────────────────────────────────

  // GET /api/sessions — list all sessions (most recent first)
  app.get("/api/sessions", (_req, res) => {
    res.json(storage.getSessions());
  });

  // GET /api/sessions/recent?limit=N — recent sessions
  app.get("/api/sessions/recent", (req, res) => {
    const limit = parseInt((req.query.limit as string) || "5");
    res.json(storage.getRecentSessions(limit));
  });

  // GET /api/sessions/search?q=...&tags=work,sleep
  app.get("/api/sessions/search", (req, res) => {
    const q = (req.query.q as string) || "";
    const tags = req.query.tags
      ? (req.query.tags as string).split(",").filter(Boolean)
      : [];
    res.json(storage.searchSessions(q, tags));
  });

  // GET /api/sessions/recap — the 3 things needed for a session opening
  app.get("/api/sessions/recap", (_req, res) => {
    const last = storage.getLastCompleteSession();
    const all = storage.getSessions().filter((s) => s.is_complete);

    // Find most relevant recurring theme (tag that appears most)
    const tagCounts: Record<string, number> = {};
    all.forEach((s) => {
      const tags: string[] = JSON.parse(s.tags || "[]");
      tags.forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Find unfinished action item
    const unfinished = all
      .filter((s) => s.next_action && s.follow_up_status !== "done" && s.follow_up_status !== "skipped")
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] || null;

    res.json({ last, topTag, unfinished });
  });

  // GET /api/sessions/:id
  app.get("/api/sessions/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const s = storage.getSession(id);
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  });

  // POST /api/sessions — create new session
  app.post("/api/sessions", (req, res) => {
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(storage.createSession(parsed.data));
  });

  // PATCH /api/sessions/:id — update session fields
  app.patch("/api/sessions/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const partial = insertSessionSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error });
    const updated = storage.updateSession(id, partial.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // DELETE /api/sessions/:id
  app.delete("/api/sessions/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    storage.deleteSession(id);
    res.json({ ok: true });
  });

  // DELETE /api/sessions — delete all
  app.delete("/api/sessions", (_req, res) => {
    storage.deleteAllSessions();
    res.json({ ok: true });
  });

  // GET /api/sessions/export — full JSON export
  app.get("/api/sessions/export", (_req, res) => {
    const all = storage.getSessions();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=commute-therapist-export.json");
    res.json({ exported_at: new Date().toISOString(), sessions: all });
  });

  // ─── Settings ───────────────────────────────────────────────────────────

  app.get("/api/settings", (_req, res) => {
    res.json(storage.getAllSettings());
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(req.body);
    storage.setSetting(key, value);
    res.json({ ok: true });
  });
}
