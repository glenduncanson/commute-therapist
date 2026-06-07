import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiGetSessions, apiDeleteAllSessions, apiExportSessions } from "@/lib/queryClient";
import type { SessionRecord } from "@/lib/db";
import { ChevronLeft, Download, Trash2, Moon, Sun, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useState, useEffect } from "react";

const VOICE_PREF_KEY = "ct_voice_name";

export default function Settings() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [deleted, setDeleted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => localStorage.getItem(VOICE_PREF_KEY) ?? "");

  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"));
      if (v.length) setVoices(v);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  function previewVoice(name: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Hi, I'm your commute therapist. How are you feeling today?");
    const v = voices.find(v => v.name === name);
    if (v) u.voice = v;
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  }

  function pickVoice(name: string) {
    setSelectedVoice(name);
    localStorage.setItem(VOICE_PREF_KEY, name);
    previewVoice(name);
  }

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
          <div className="font-medium text-foreground mb-1" style={{ fontSize: "var(--text-sm)" }}>Voice</div>
          <div className="text-muted-foreground mb-3" style={{ fontSize: "var(--text-xs)" }}>Tap a voice to preview it. Your choice is saved.</div>
          {voices.length === 0 && (
            <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>No voices loaded yet — open Drive Mode first to unlock them.</div>
          )}
          <div className="space-y-1">
            {voices.map((v) => (
              <button
                key={v.name}
                onClick={() => pickVoice(v.name)}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  background: selectedVoice === v.name ? "hsl(var(--accent) / 0.15)" : "transparent",
                  border: selectedVoice === v.name ? "1px solid hsl(var(--accent) / 0.4)" : "1px solid transparent",
                }}
              >
                <div>
                  <span className="text-foreground" style={{ fontSize: "var(--text-xs)", fontWeight: selectedVoice === v.name ? 600 : 400 }}>{v.name}</span>
                  <span className="text-muted-foreground ml-2" style={{ fontSize: "var(--text-xs)" }}>{v.lang}</span>
                </div>
                <Volume2 size={13} className="text-muted-foreground flex-shrink-0" />
              </button>
            ))}
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
