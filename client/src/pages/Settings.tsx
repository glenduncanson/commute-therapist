import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiGetSessions, apiDeleteAllSessions, apiExportSessions } from "@/lib/queryClient";
import type { SessionRecord } from "@/lib/db";
import { ChevronLeft, Download, Trash2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";

export default function Settings() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [deleted, setDeleted] = useState(false);

  const { data: sessions = [] } = useQuery<SessionRecord[]>({
    queryKey: ["sessions-search", "", null],
    queryFn: () => apiGetSessions(),
  });

  const deleteAll = useMutation({
    mutationFn: apiDeleteAllSessions,
    onSuccess: () => { qc.invalidateQueries(); setDeleted(true); },
  });

  const completedCount = sessions.filter(s => s.is_complete).length;

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto">
      <div className="px-5 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="tap-target opacity-60 hover:opacity-100"><ChevronLeft size={22} /></button>
        <h1 className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>Settings</h1>
      </div>

      <div className="flex-1 px-5 overflow-y-auto pb-10 space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-muted-foreground mb-1" style={{ fontSize: "var(--text-xs)" }}>Your data · stored on this device only</div>
          <div className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>{completedCount} {completedCount === 1 ? "session" : "sessions"}</div>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>Dark mode</div>
            </div>
            <button onClick={toggleTheme} className="tap-target opacity-60 hover:opacity-100">
              {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>Export sessions</div>
              <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>Download as JSON</div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={apiExportSessions}>
              <Download size={14} />Export
            </Button>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>Delete all sessions</div>
              <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{deleted ? "Done." : "Cannot be undone."}</div>
            </div>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => { if (confirm("Delete all session history?")) deleteAll.mutate(); }} disabled={deleteAll.isPending || deleted}>
              <Trash2 size={14} />Delete all
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="font-medium text-foreground mb-2" style={{ fontSize: "var(--text-sm)" }}>About</div>
          <p className="text-muted-foreground" style={{ fontSize: "var(--text-xs)", lineHeight: 1.6 }}>
            Structured CBT-style reflection. <strong>Not a replacement</strong> for therapy or medical care. If you are in crisis, contact a mental health professional or emergency services.
          </p>
          <p className="text-muted-foreground mt-2" style={{ fontSize: "var(--text-xs)" }}>
            All data is stored in your browser on this device. Nothing is sent to any server.
          </p>
        </div>

        <div className="text-center text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>Commute Therapist · v0.2-pwa</div>
      </div>
    </div>
  );
}
