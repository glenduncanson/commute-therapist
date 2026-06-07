import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import type { Session } from "@shared/schema";
import { ChevronLeft, Download, Trash2, Info, Moon, Sun, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";

function Row({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div>
        <div className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {label}
        </div>
        {sublabel && (
          <div className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-xs)" }}>
            {sublabel}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [deleted, setDeleted] = useState(false);

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => (await apiRequest("GET", "/api/sessions")).json(),
  });

  const deleteAll = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/sessions"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sessions"] });
      setDeleted(true);
    },
  });

  function handleExport() {
    const url = `${API_BASE}/api/sessions/export`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "commute-therapist-export.json";
    a.click();
  }

  const completedCount = sessions.filter((s) => s.is_complete).length;

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto" data-testid="settings-screen">
      <div className="px-5 pt-10 pb-4 flex items-center gap-3">
        <button data-testid="btn-back" onClick={() => navigate("/")} className="tap-target opacity-60 hover:opacity-100">
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>
          Settings
        </h1>
      </div>

      <div className="flex-1 px-5 overflow-y-auto pb-10">
        {/* Stats */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <div className="text-muted-foreground mb-1" style={{ fontSize: "var(--text-xs)" }}>Your data</div>
          <div className="font-bold text-foreground" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>
            {completedCount} {completedCount === 1 ? "session" : "sessions"}
          </div>
          <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
            stored on this device
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border border-border bg-card px-4 mb-4">
          <Row
            label="Dark mode"
            sublabel="Switch between light and dark theme"
          >
            <button
              data-testid="toggle-theme"
              onClick={toggleTheme}
              className="tap-target flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </Row>
        </div>

        {/* Data */}
        <div className="rounded-xl border border-border bg-card px-4 mb-4">
          <Row
            label="Export sessions"
            sublabel="Download all session data as JSON"
          >
            <Button
              data-testid="btn-export"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
            >
              <Download size={14} />
              Export
            </Button>
          </Row>
          <Row
            label="Delete all sessions"
            sublabel={deleted ? "All sessions deleted." : "This cannot be undone."}
          >
            <Button
              data-testid="btn-delete-all"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (confirm("Delete all session history? This cannot be undone.")) {
                  deleteAll.mutate();
                }
              }}
              disabled={deleteAll.isPending || deleted}
            >
              <Trash2 size={14} />
              Delete all
            </Button>
          </Row>
        </div>

        {/* About */}
        <div className="rounded-xl border border-border bg-card px-4 mb-4">
          <Row label="About Commute Therapist">
          </Row>
          <div className="pb-4">
            <p className="text-muted-foreground" style={{ fontSize: "var(--text-xs)", lineHeight: 1.6 }}>
              This tool is for structured personal reflection using CBT principles. It is <strong>not a replacement</strong> for therapy, diagnosis, or medical care. It does not provide crisis support.
            </p>
            <p className="text-muted-foreground mt-2" style={{ fontSize: "var(--text-xs)", lineHeight: 1.6 }}>
              If you are in crisis or need urgent support, please contact a mental health professional or emergency services.
            </p>
            <p className="text-muted-foreground mt-2" style={{ fontSize: "var(--text-xs)" }}>
              All session data is stored locally on this device only.
            </p>
          </div>
        </div>

        <div className="text-center text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          Commute Therapist MVP · v0.1
        </div>
      </div>
    </div>
  );
}
