import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiGetRecap, apiCreateSession } from "@/lib/queryClient";
import type { SessionRecord } from "@/lib/db";
import { Clock, Car, Zap, BookOpen, Settings, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecapData {
  last: SessionRecord | null;
  topTag: string | null;
  unfinished: SessionRecord | null;
}

function formatDate(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diff < 1) return "Just now";
  if (diff < 24) return `${diff}h ago`;
  const days = Math.floor(diff / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Home() {
  const [, navigate] = useLocation();

  const { data: recap, isLoading } = useQuery<RecapData>({
    queryKey: ["recap"],
    queryFn: apiGetRecap,
  });

  async function startSession(mode: "drive" | "short") {
    const session = await apiCreateSession({
      timestamp: new Date().toISOString(),
      mode,
      tags: "[]",
      messages: "[]",
      follow_up_status: "not_done",
      is_complete: false,
    });
    navigate(`/${mode === "drive" ? "drive" : "session"}/${session.id}`);
  }

  const last = recap?.last;

  return (
    <div className="min-h-dvh bg-background flex flex-col px-5 pt-12 pb-10 max-w-md mx-auto fade-up">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 32 32" fill="none" aria-label="CT logo" className="h-8 w-8">
            <circle cx="16" cy="16" r="14" stroke="hsl(var(--primary))" strokeWidth="2" fill="hsl(var(--primary) / 0.08)"/>
            <circle cx="16" cy="16" r="5" fill="hsl(var(--primary))"/>
            <path d="M16 6v4M16 22v4M6 16h4M22 16h4" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
          </svg>
        </div>
        <h1 className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)" }}>
          Commute Therapist
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          One situation at a time.
        </p>
      </div>

      {recap?.unfinished?.next_action && !isLoading && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6 flex gap-3 items-start fade-up" data-testid="unfinished-nudge">
          <AlertCircle size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>Still open from last time</p>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-sm)" }}>{recap.unfinished.next_action}</p>
          </div>
        </div>
      )}

      <div className="space-y-3 mb-8">
        <button
          data-testid="btn-drive-mode"
          onClick={() => startSession("drive")}
          className="tap-target w-full rounded-2xl p-5 flex items-center gap-4 text-left transition-all active:scale-95"
          style={{ background: "hsl(var(--drive-bg))", color: "hsl(var(--drive-text))" }}
        >
          <div className="rounded-xl p-2.5" style={{ background: "hsl(var(--primary) / 0.3)" }}>
            <Car size={22} className="text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)" }}>Drive mode</div>
            <div className="opacity-60 mt-0.5" style={{ fontSize: "var(--text-sm)" }}>One question at a time · safe in the car.</div>
          </div>
          <ChevronRight size={18} className="opacity-40" />
        </button>

        <button
          data-testid="btn-short-session"
          onClick={() => startSession("short")}
          className="tap-target w-full rounded-2xl border border-border bg-card p-5 flex items-center gap-4 text-left transition-all active:scale-95 hover:border-primary/40"
        >
          <div className="rounded-xl p-2.5 bg-primary/10">
            <Zap size={22} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)" }}>Short session</div>
            <div className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-sm)" }}>8–12 minutes. More depth, still focused.</div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground opacity-40" />
        </button>
      </div>

      {last && (
        <div
          className="rounded-xl border border-border bg-card p-4 mb-8 cursor-pointer hover:border-primary/30 transition-colors"
          data-testid="last-session-card"
          onClick={() => navigate(`/journal/${last.id}`)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              <Clock size={13} />
              <span>{formatDate(last.timestamp)}</span>
              <span className="capitalize px-1.5 py-0.5 rounded bg-muted">{last.mode}</span>
            </div>
            {last.emotion && (
              <span className="emotion-badge px-2 py-0.5 rounded-full" style={{ fontSize: "var(--text-xs)" }}>
                {last.emotion}{last.emotion_intensity != null ? ` · ${last.emotion_intensity}/10` : ""}
              </span>
            )}
          </div>
          <p className="text-foreground font-medium" style={{ fontSize: "var(--text-sm)" }}>
            {last.summary || last.situation || "Session recorded"}
          </p>
          {last.next_time_prompt && (
            <p className="text-primary mt-2" style={{ fontSize: "var(--text-xs)" }}>→ {last.next_time_prompt}</p>
          )}
        </div>
      )}

      <div className="mt-auto flex gap-3">
        <Button variant="ghost" data-testid="nav-journal" className="flex-1 gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/journal")}>
          <BookOpen size={17} />Journal
        </Button>
        <Button variant="ghost" data-testid="nav-settings" className="flex-1 gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/settings")}>
          <Settings size={17} />Settings
        </Button>
      </div>
    </div>
  );
}
