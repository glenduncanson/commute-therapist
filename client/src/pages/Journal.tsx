import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiGetSession, apiDeleteSession, apiSearchSessions } from "@/lib/queryClient";
import type { SessionRecord } from "@/lib/db";
import { SESSION_TAGS, STAGE_LABELS } from "@/lib/prompts";
import { Search, ChevronLeft, Clock, Tag, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function Journal() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery<SessionRecord[]>({
    queryKey: ["sessions-search", search, activeTag],
    queryFn: () => apiSearchSessions(search, activeTag ? [activeTag] : []),
    staleTime: 0,
  });

  const complete = sessions.filter(s => s.is_complete);

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto" data-testid="journal-screen">
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/")} className="tap-target opacity-60 hover:opacity-100"><ChevronLeft size={22} /></button>
          <h1 className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>Journal</h1>
        </div>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search situations, emotions, tags..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[null, ...SESSION_TAGS].map(tag => (
            <button key={tag ?? "all"} onClick={() => setActiveTag(tag)} className="shrink-0 px-3 py-1 rounded-full text-xs transition-all" style={{ background: activeTag === tag ? "hsl(var(--primary))" : "hsl(var(--muted))", color: activeTag === tag ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))", fontSize: "var(--text-xs)" }}>
              {tag ?? "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 overflow-y-auto">
        {isLoading && [1,2,3].map(i => <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-24 mb-3" />)}
        {!isLoading && complete.length === 0 && <div className="text-center py-16 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{search || activeTag ? "No sessions match." : "No completed sessions yet."}</div>}
        <div className="space-y-3 pb-10">
          {complete.map(s => {
            const tags: string[] = JSON.parse(s.tags || "[]");
            return (
              <button key={s.id} onClick={() => navigate(`/journal/${s.id}`)} className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 transition-colors fade-up">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
                    <Clock size={12} /><span>{formatDate(s.timestamp)}</span>
                    <span className="capitalize px-1.5 py-0.5 rounded bg-muted">{s.mode}</span>
                  </div>
                  {s.emotion && <span className="emotion-badge px-2 py-0.5 rounded-full" style={{ fontSize: "var(--text-xs)" }}>{s.emotion}{s.emotion_intensity != null ? ` · ${s.emotion_intensity}/10` : ""}</span>}
                </div>
                <p className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.4 }}>{s.summary || s.situation || "Session recorded"}</p>
                {s.cognitive_pattern && <p className="text-muted-foreground mt-1" style={{ fontSize: "var(--text-xs)" }}>Pattern: {s.cognitive_pattern}</p>}
                {tags.length > 0 && <div className="flex gap-1.5 mt-2 flex-wrap">{tags.map(t => <span key={t} className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t}</span>)}</div>}
                {s.next_time_prompt && <p className="text-primary mt-2" style={{ fontSize: "var(--text-xs)" }}>→ {s.next_time_prompt}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function JournalDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: session, isLoading } = useQuery<SessionRecord>({
    queryKey: ["session", id],
    queryFn: () => apiGetSession(parseInt(id)) as Promise<SessionRecord>,
  });

  const del = useMutation({
    mutationFn: () => apiDeleteSession(parseInt(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions-search"] }); navigate("/journal"); },
  });

  if (isLoading) return <div className="min-h-dvh bg-background flex items-center justify-center"><div className="text-muted-foreground pulse-soft" style={{ fontSize: "var(--text-sm)" }}>Loading…</div></div>;
  if (!session) return <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground">Not found</div>;

  const tags: string[] = JSON.parse(session.tags || "[]");
  const fields = [
    { label: "Situation", value: session.situation },
    { label: "Main thought", value: session.main_thought },
    { label: "Emotion", value: session.emotion ? `${session.emotion}${session.emotion_intensity != null ? ` (${session.emotion_intensity}/10)` : ""}` : null },
    { label: "Cognitive pattern", value: session.cognitive_pattern },
    { label: "Alternative thought", value: session.alternative_thought },
    { label: "Next action", value: session.next_action },
    { label: "Follow-up", value: session.follow_up_status?.replace("_", " ") },
  ].filter(f => f.value);

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto">
      <div className="px-5 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/journal")} className="tap-target opacity-60 hover:opacity-100"><ChevronLeft size={22} /></button>
        <div className="flex-1">
          <div className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)" }}>{session.situation?.slice(0, 50) ?? "Session detail"}</div>
          <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{formatDate(session.timestamp)} · {session.mode}</div>
        </div>
        <button onClick={() => { if (confirm("Delete this session?")) del.mutate(); }} className="tap-target opacity-40 hover:opacity-70 text-destructive"><Trash2 size={18} /></button>
      </div>

      <div className="flex-1 px-5 overflow-y-auto pb-10 space-y-4">
        {session.summary && <div className="rounded-xl bg-primary/5 border border-primary/15 p-4"><p className="text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>{session.summary}</p></div>}
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {fields.map(f => (
            <div key={f.label} className="px-4 py-3">
              <div className="text-muted-foreground mb-1" style={{ fontSize: "var(--text-xs)" }}>{f.label}</div>
              <div className="text-foreground" style={{ fontSize: "var(--text-sm)" }}>{f.value}</div>
            </div>
          ))}
        </div>
        {tags.length > 0 && <div className="flex gap-2 flex-wrap">{tags.map(t => <span key={t} className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t}</span>)}</div>}
        {session.next_time_prompt && <div className="rounded-xl bg-accent/10 border border-accent/20 p-3"><div className="text-muted-foreground mb-1" style={{ fontSize: "var(--text-xs)" }}>Next time</div><p className="text-foreground" style={{ fontSize: "var(--text-sm)" }}>{session.next_time_prompt}</p></div>}
      </div>
    </div>
  );
}
