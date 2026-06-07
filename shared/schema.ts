import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table — full CBT session records
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(), // ISO string
  mode: text("mode").notNull(), // "drive" | "short" | "full" | "catch-up"
  situation: text("situation"),
  main_thought: text("main_thought"),
  emotion: text("emotion"),
  emotion_intensity: real("emotion_intensity"), // 0–10
  cognitive_pattern: text("cognitive_pattern"), // e.g. "catastrophising"
  alternative_thought: text("alternative_thought"),
  next_action: text("next_action"),
  follow_up_status: text("follow_up_status").default("not_done"), // done | partly_done | not_done | skipped
  tags: text("tags").default("[]"), // JSON array: ["work","sleep","health",...]
  summary: text("summary"),
  next_time_prompt: text("next_time_prompt"),
  messages: text("messages").default("[]"), // JSON array of {role, content} chat messages
  is_complete: integer("is_complete", { mode: "boolean" }).default(false),
});

// Settings table — user preferences
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// Types
export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
});
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
